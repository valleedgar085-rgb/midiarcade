function finiteInterval(value, fallback = 25) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(8, Math.round(numeric)) : fallback;
}

export function createPreviewWakeScheduler({
  intervalMs = 25,
  onTick = () => {},
  workerUrl = null,
  workerFactory = null,
  setTimeoutFn = setTimeout,
  clearTimeoutFn = clearTimeout,
} = {}) {
  const cadenceMs = finiteInterval(intervalMs);
  let worker = null;
  let fallbackTimer = null;
  let running = false;
  let mode = "idle";

  const invokeTick = () => {
    if (running) onTick();
  };

  const clearFallback = () => {
    if (fallbackTimer != null) clearTimeoutFn(fallbackTimer);
    fallbackTimer = null;
  };

  const terminateWorker = () => {
    if (!worker) return;
    try { worker.postMessage({ type: "stop" }); } catch { /* worker already gone */ }
    try { worker.terminate(); } catch { /* worker already gone */ }
    worker = null;
  };

  const startFallback = () => {
    terminateWorker();
    clearFallback();
    if (!running) return;
    mode = "fallback";
    const loop = () => {
      fallbackTimer = null;
      if (!running) return;
      invokeTick();
      fallbackTimer = setTimeoutFn(loop, cadenceMs);
    };
    fallbackTimer = setTimeoutFn(loop, cadenceMs);
  };

  const stop = () => {
    running = false;
    clearFallback();
    terminateWorker();
    mode = "idle";
  };

  const start = () => {
    stop();
    running = true;

    const WorkerFactory = workerFactory
      ?? (typeof Worker === "function" ? ((url, options) => new Worker(url, options)) : null);

    if (WorkerFactory && workerUrl) {
      try {
        worker = WorkerFactory(workerUrl, { type: "module", name: "midi-arcade-preview-scheduler" });
        worker.onmessage = (event) => {
          if (event?.data?.type === "tick") invokeTick();
        };
        worker.onerror = () => {
          if (running) startFallback();
        };
        worker.postMessage({ type: "start", intervalMs: cadenceMs });
        mode = "worker";
        return mode;
      } catch {
        // WebView/browser worker startup failed; keep playback alive with a
        // non-authoritative main-thread wake-up fallback.
      }
    }

    startFallback();
    return mode;
  };

  return {
    start,
    stop,
    get mode() {
      return mode;
    },
    get running() {
      return running;
    },
    intervalMs: cadenceMs,
  };
}
