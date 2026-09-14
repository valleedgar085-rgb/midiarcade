import { adaptGenerationRequest } from "./adaptive-generation.js";
import { createGenerationFlightRecorder } from "./generation-flight-recorder.js";
import { applyOutputQualityEvolution } from "./output-quality-evolution.js";
import { applyResultOutputQualityPostprocess } from "./output-quality-postprocess.js";
import {
  createSelfCorrectionPayload,
  diagnoseGenerationOutcome,
  selectSelfCorrectedResult,
} from "./generation-self-correction.js";

function evolveGenerationPayload(kind, payload = {}) {
  if (!["new", "similar", "songVariations"].includes(kind)) return payload;
  return {
    ...payload,
    config: applyOutputQualityEvolution(payload?.config ?? {}, { kind }),
  };
}

export function createGenerationExecutor({
  fallback,
  workerFactory = null,
  timeoutMs = 60000,
  recorder = null,
} = {}) {
  if (typeof fallback !== "function") throw new TypeError("generation executor requires a fallback");

  const flightRecorder = recorder ?? createGenerationFlightRecorder();
  let worker = null;
  let workerUnavailable = typeof workerFactory !== "function";
  let requestId = 0;
  const pending = new Map();

  function runFallback(request) {
    Promise.resolve()
      .then(() => fallback(request.kind, request.payload))
      .then(request.resolve, request.reject);
  }

  function takePending(id) {
    const request = pending.get(id);
    if (!request) return null;
    pending.delete(id);
    clearTimeout(request.timer);
    return request;
  }

  function rejectPending(error) {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    pending.clear();
  }

  function recoverPendingWithFallback() {
    const interrupted = [...pending.values()];
    pending.clear();
    for (const request of interrupted) {
      clearTimeout(request.timer);
      runFallback(request);
    }
  }

  function disposeWorker(error = null) {
    if (worker) {
      try { worker.terminate?.(); } catch { /* already terminated */ }
    }
    worker = null;
    if (error) rejectPending(error);
  }

  function ensureWorker() {
    if (workerUnavailable) return null;
    if (worker) return worker;
    try {
      worker = workerFactory();
      if (!worker?.postMessage) throw new Error("Background generation is unavailable.");
      worker.addEventListener("message", (event) => {
        const request = takePending(event.data?.requestId);
        if (!request) return;
        if (event.data?.ok) request.resolve(event.data.result);
        else {
          workerUnavailable = true;
          disposeWorker();
          runFallback(request);
        }
      });
      worker.addEventListener("error", () => {
        workerUnavailable = true;
        disposeWorker();
        recoverPendingWithFallback();
      });
      return worker;
    } catch {
      workerUnavailable = true;
      disposeWorker();
      return null;
    }
  }

  function executeAdapted(kind, adaptedPayload) {
    const activeWorker = ensureWorker();
    if (!activeWorker) return Promise.resolve().then(() => fallback(kind, adaptedPayload));
    const id = ++requestId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const request = takePending(id);
        if (!request) return;
        workerUnavailable = true;
        disposeWorker();
        runFallback(request);
      }, Math.max(1000, Number(timeoutMs) || 60000));
      pending.set(id, { resolve, reject, timer, kind, payload: adaptedPayload });
      try {
        activeWorker.postMessage({ requestId: id, kind, payload: adaptedPayload });
      } catch {
        const request = takePending(id);
        workerUnavailable = true;
        disposeWorker();
        if (request) runFallback(request);
      }
    });
  }

  async function run(kind, payload = {}) {
    const adaptedPayload = evolveGenerationPayload(kind, adaptGenerationRequest(kind, payload));
    const config = adaptedPayload?.config ?? {};
    const flightId = flightRecorder.begin(kind, {
      sourceSong: adaptedPayload?.sourceSong,
      config,
    });
    flightRecorder.mark(flightId, "plan", {
      producerBrain: config?.producerBrain?.id ?? null,
      blueprint: config?.producerBrain?.blueprint?.id ?? null,
      outputQuality: config?.outputQuality?.seedSignature ?? null,
    });

    try {
      flightRecorder.mark(flightId, "compose", { pass: 0 });
      const originalResult = await executeAdapted(kind, adaptedPayload);
      const diagnosis = diagnoseGenerationOutcome(kind, originalResult, config);
      flightRecorder.mark(flightId, "diagnose", {
        shouldRetry: diagnosis.shouldRetry,
        reason: diagnosis.reason,
        focusRoute: diagnosis.focusRoute,
        focusDimension: diagnosis.focusDimension,
        focusGroup: diagnosis.focusGroup,
        totalScore: diagnosis.totalScore,
        creativeFloor: diagnosis.creativeFloor,
      });

      let selectedResult = originalResult;
      if (diagnosis.shouldRetry) {
        const correctionPayload = createSelfCorrectionPayload(adaptedPayload, diagnosis);
        flightRecorder.mark(flightId, "repair", {
          pass: 1,
          focusRoute: diagnosis.focusRoute,
          focusDimension: diagnosis.focusDimension,
          focusGroup: diagnosis.focusGroup,
        });
        const correctedResult = await executeAdapted(kind, correctionPayload);
        const comparison = selectSelfCorrectedResult(originalResult, correctedResult);
        selectedResult = comparison.result;
        flightRecorder.mark(flightId, "compare", {
          selected: comparison.selected,
          reason: comparison.reason,
          scoreDelta: comparison.scoreDelta,
          creativeFloorDelta: comparison.creativeFloorDelta,
        });
      } else {
        flightRecorder.mark(flightId, "compare", {
          selected: "original",
          reason: diagnosis.reason,
          skipped: true,
        });
      }

      selectedResult = applyResultOutputQualityPostprocess(selectedResult, config);
      flightRecorder.mark(flightId, "finalize", {
        arrangementEvolution: selectedResult?.outputQualityDiagnostics?.arrangement ?? null,
      });
      flightRecorder.complete(flightId, selectedResult?.song);
      return selectedResult;
    } catch (error) {
      flightRecorder.fail(flightId, error);
      throw error;
    }
  }

  return Object.freeze({
    run,
    diagnosticsSnapshot() {
      return flightRecorder.snapshot();
    },
    clearDiagnostics() {
      flightRecorder.clear();
    },
    dispose() {
      disposeWorker(new Error("Background generation was canceled."));
    },
    get usingWorker() {
      return Boolean(worker);
    },
    get activeRequests() {
      return pending.size;
    },
  });
}
