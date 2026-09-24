import { adaptGenerationRequest } from "./adaptive-generation.js";
import { createGenerationFlightRecorder } from "./generation-flight-recorder.js";
import { applyOutputQualityEvolution } from "./output-quality-evolution.js";
import { applyResultOutputQualityPipeline } from "./output-quality-pipeline-register.js";
import {
  createSelfCorrectionPayload,
  diagnoseGenerationOutcome,
  selectSelfCorrectedResult,
} from "./generation-self-correction.js";

function evolveGenerationPayload(kind, payload = {}) {
  if (!["new", "similar", "songVariations"].includes(kind)) return payload;
  const evolvedConfig = applyOutputQualityEvolution(payload?.config ?? {}, { kind });
  const phraseResolutionRefinement = typeof evolvedConfig.phraseResolutionRefinement === "boolean"
    ? evolvedConfig.phraseResolutionRefinement
    : kind === "new";
  const registerHealthRefinement = typeof evolvedConfig.registerHealthRefinement === "boolean"
    ? evolvedConfig.registerHealthRefinement
    : kind === "new";
  return {
    ...payload,
    config: {
      ...evolvedConfig,
      phraseResolutionRefinement,
      registerHealthRefinement,
    },
  };
}

export function createGenerationExecutor({
  fallback,
  workerFactory = null,
  timeoutMs = 60000,
  recorder = null,
  now = () => Date.now(),
  workerRetryBaseMs = 1000,
  workerRetryMaxMs = 30000,
} = {}) {
  if (typeof fallback !== "function") throw new TypeError("generation executor requires a fallback");

  const flightRecorder = recorder ?? createGenerationFlightRecorder();
  let worker = null;
  let workerUnavailable = typeof workerFactory !== "function";
  let workerFailures = 0;
  let workerRetryAt = 0;
  let requestId = 0;
  let lifecycle = 0;
  const pending = new Map();

  function requireCurrentLifecycle(expected) {
    if (expected !== lifecycle) throw new Error("Background generation was canceled.");
  }

  function markWorkerFailure() {
    workerFailures += 1;
    const base = Math.max(100, Number(workerRetryBaseMs) || 1000);
    const max = Math.max(base, Number(workerRetryMaxMs) || 30000);
    const delay = Math.min(max, base * (2 ** Math.min(8, workerFailures - 1)));
    workerRetryAt = Number(now()) + delay;
    workerUnavailable = true;
  }

  function runFallback(request) {
    Promise.resolve()
      .then(() => {
        requireCurrentLifecycle(request.lifecycle);
        return fallback(request.kind, request.payload);
      })
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
    if (typeof workerFactory !== "function") return null;
    if (workerUnavailable && Number(now()) < workerRetryAt) return null;
    if (workerUnavailable) workerUnavailable = false;
    if (worker) return worker;
    try {
      worker = workerFactory();
      if (!worker?.postMessage) throw new Error("Background generation is unavailable.");
      const createdWorker = worker;
      worker.addEventListener("message", (event) => {
        if (worker !== createdWorker) return;
        const request = takePending(event.data?.requestId);
        if (!request) return;
        if (event.data?.ok) {
          workerFailures = 0;
          workerRetryAt = 0;
          request.resolve(event.data.result);
        } else {
          markWorkerFailure();
          disposeWorker();
          runFallback(request);
        }
      });
      worker.addEventListener("error", () => {
        if (worker !== createdWorker) return;
        markWorkerFailure();
        disposeWorker();
        recoverPendingWithFallback();
      });
      return worker;
    } catch {
      markWorkerFailure();
      disposeWorker();
      return null;
    }
  }

  function executeAdapted(kind, adaptedPayload, expectedLifecycle) {
    requireCurrentLifecycle(expectedLifecycle);
    const activeWorker = ensureWorker();
    if (!activeWorker) return Promise.resolve().then(() => {
      requireCurrentLifecycle(expectedLifecycle);
      return fallback(kind, adaptedPayload);
    });
    const id = ++requestId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const request = takePending(id);
        if (!request) return;
        markWorkerFailure();
        disposeWorker();
        runFallback(request);
      }, Math.max(1000, Number(timeoutMs) || 60000));
      pending.set(id, { resolve, reject, timer, kind, payload: adaptedPayload, lifecycle: expectedLifecycle });
      try {
        activeWorker.postMessage({ requestId: id, kind, payload: adaptedPayload });
      } catch {
        const request = takePending(id);
        markWorkerFailure();
        disposeWorker();
        if (request) runFallback(request);
      }
    });
  }

  async function run(kind, payload = {}) {
    const expectedLifecycle = lifecycle;
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
      const originalResult = await executeAdapted(kind, adaptedPayload, expectedLifecycle);
      requireCurrentLifecycle(expectedLifecycle);

      if (kind === "compositionCandidate") {
        const transaction = originalResult?.transaction;
        const correction = transaction?.selfCorrection;
        flightRecorder.mark(flightId, "diagnose", {
          valid: transaction?.validation?.valid === true,
          issues: transaction?.validation?.issues ?? [],
          attempts: correction?.attemptCount ?? 1,
          selectedAttempt: correction?.selectedAttempt ?? 0,
        });
        flightRecorder.mark(flightId, "compare", {
          selected: transaction?.validation?.valid ? "candidate" : "rejected",
          reason: correction?.stoppedReason ?? "composition-candidate",
        });
        flightRecorder.mark(flightId, "finalize", {
          compositionCandidate: true,
          passed: transaction?.validation?.valid === true,
        });
        flightRecorder.complete(flightId, transaction?.after ?? adaptedPayload?.sourceSong);
        return originalResult;
      }

      const diagnosis = diagnoseGenerationOutcome(kind, originalResult, config);
      flightRecorder.mark(flightId, "diagnose", {
        shouldRetry: diagnosis.shouldRetry,
        reason: diagnosis.reason,
        focusRoute: diagnosis.focusRoute,
        focusDimension: diagnosis.focusDimension,
        focusGroup: diagnosis.focusGroup,
        totalScore: diagnosis.totalScore,
        creativeFloor: diagnosis.creativeFloor,
        criticalFloor: diagnosis.criticalFloor,
        lowestCriticalDimension: diagnosis.lowestCriticalDimension,
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
        const correctedResult = await executeAdapted(kind, correctionPayload, expectedLifecycle);
        requireCurrentLifecycle(expectedLifecycle);
        const comparison = selectSelfCorrectedResult(originalResult, correctedResult);
        selectedResult = comparison.result;
        flightRecorder.mark(flightId, "compare", {
          selected: comparison.selected,
          reason: comparison.reason,
          scoreDelta: comparison.scoreDelta,
          creativeFloorDelta: comparison.creativeFloorDelta,
          criticalFloorDelta: comparison.criticalFloorDelta,
        });
      } else {
        flightRecorder.mark(flightId, "compare", {
          selected: "original",
          reason: diagnosis.reason,
          skipped: true,
        });
      }

      let stageDiagnostics = {};
      selectedResult = applyResultOutputQualityPipeline(selectedResult, config, {
        onStageDiagnostics(diagnostics) {
          stageDiagnostics = diagnostics ?? {};
        },
      });
      const acceptedDiagnostics = selectedResult?.outputQualityDiagnostics ?? {};
      flightRecorder.mark(flightId, "finalize", {
        arrangementEvolution: stageDiagnostics.arrangement ?? acceptedDiagnostics.arrangement ?? null,
        returnDevelopment: stageDiagnostics.returnDevelopment ?? acceptedDiagnostics.returnDevelopment ?? null,
        densityRefinement: stageDiagnostics.densityRefinement ?? acceptedDiagnostics.densityRefinement ?? null,
        phraseResolutionRefinement: stageDiagnostics.phraseResolutionRefinement ?? acceptedDiagnostics.phraseResolutionRefinement ?? null,
        registerHealthRefinement: stageDiagnostics.registerHealthRefinement ?? acceptedDiagnostics.registerHealthRefinement ?? null,
        melodyContinuityRefinement: stageDiagnostics.melodyContinuityRefinement ?? acceptedDiagnostics.melodyContinuityRefinement ?? null,
        bassContinuityRefinement: stageDiagnostics.bassContinuityRefinement ?? acceptedDiagnostics.bassContinuityRefinement ?? null,
        ensembleContinuityRefinement: stageDiagnostics.ensembleContinuityRefinement ?? acceptedDiagnostics.ensembleContinuityRefinement ?? null,
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
      lifecycle += 1;
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
