import { adaptGenerationRequest } from "./adaptive-generation.js";
import { decorateProducerBrainResult } from "./producer-brain.js";

export function createGenerationExecutor({
  fallback,
  workerFactory = null,
  timeoutMs = 60000,
} = {}) {
  if (typeof fallback !== "function") throw new TypeError("generation executor requires a fallback");

  let worker = null;
  let workerUnavailable = typeof workerFactory !== "function";
  let requestId = 0;
  const pending = new Map();

  function runFallback(request) {
    Promise.resolve()
      .then(() => fallback(request.kind, request.payload))
      .then((result) => decorateProducerBrainResult(result, request.payload?.config?.producerBrain))
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
        if (event.data?.ok) {
          request.resolve(decorateProducerBrainResult(
            event.data.result,
            request.payload?.config?.producerBrain,
          ));
        } else {
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

  async function run(kind, payload = {}) {
    const adaptedPayload = adaptGenerationRequest(kind, payload);
    const activeWorker = ensureWorker();
    if (!activeWorker) {
      const result = await fallback(kind, adaptedPayload);
      return decorateProducerBrainResult(result, adaptedPayload.config?.producerBrain);
    }
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

  return Object.freeze({
    run,
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
