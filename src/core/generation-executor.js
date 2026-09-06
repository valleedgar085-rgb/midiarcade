import { adaptGenerationRequest } from "./adaptive-generation.js";

export function createGenerationExecutor({
  fallback,
  workerFactory = null,
  timeoutMs = 60000,
  allowFallback = true,
  onProgress = null,
} = {}) {
  if (allowFallback && typeof fallback !== "function") throw new TypeError("generation executor requires a fallback");

  let worker = null;
  let workerUnavailable = typeof workerFactory !== "function";
  let requestId = 0;
  const pending = new Map();

  function runFallback(request) {
    if (!allowFallback) {
      request.reject(new Error("Background generation stopped. Your previous song is safe; tap Generate to retry."));
      return;
    }
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
      const ownedWorker = worker;
      worker.addEventListener("message", (event) => {
        if (worker !== ownedWorker) return;
        if (event.data?.type === "progress") {
          if (pending.has(event.data.requestId)) onProgress?.(event.data.progress);
          return;
        }
        const request = takePending(event.data?.requestId);
        if (!request) return;
        if (event.data?.ok) request.resolve(event.data.result);
        else {
          workerUnavailable = true;
          disposeWorker();
          runFallback(request);
          recoverPendingWithFallback();
        }
      });
      worker.addEventListener("error", () => {
        if (worker !== ownedWorker) return;
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
    if (pending.size) throw new Error("A composition is already running.");
    if (!allowFallback) workerUnavailable = typeof workerFactory !== "function";
    const adaptedPayload = adaptGenerationRequest(kind, payload);
    const activeWorker = ensureWorker();
    if (!activeWorker) {
      if (!allowFallback) throw new Error("Background generation is unavailable. Reopen the app and try again.");
      return fallback(kind, adaptedPayload);
    }
    const id = ++requestId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const request = takePending(id);
        if (!request) return;
        workerUnavailable = true;
        disposeWorker();
        runFallback(request);
        recoverPendingWithFallback();
      }, Math.max(1000, Number(timeoutMs) || 60000));
      pending.set(id, { resolve, reject, timer, kind, payload: adaptedPayload });
      try {
        activeWorker.postMessage({ requestId: id, kind, payload: adaptedPayload });
      } catch {
        const request = takePending(id);
        workerUnavailable = true;
        disposeWorker();
        if (request) runFallback(request);
        recoverPendingWithFallback();
      }
    });
  }

  return Object.freeze({
    run,
    cancel(message = "Background generation was canceled.") {
      disposeWorker(new Error(message));
      workerUnavailable = typeof workerFactory !== "function";
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
