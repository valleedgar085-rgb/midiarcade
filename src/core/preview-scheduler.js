/**
 * Coerce a wake interval to whole milliseconds with an 8 ms minimum.
 *
 * @param {*} value - Requested interval, converted to a number.
 * @param {number} [fallback=25] - Value returned when the conversion is not finite.
 * @returns {number} The normalized interval or the unchanged fallback.
 */
function finiteInterval(value, fallback = 25) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(8, Math.round(numeric)) : fallback;
}

/**
 * Create an idle worker-based wake scheduler with a recurring timeout fallback.
 * Ticks only wake the caller; the AudioContext remains the musical clock.
 *
 * @param {object} [options={}] - Scheduler configuration and injectable browser APIs.
 * @param {number} [options.intervalMs=25] - Wake interval, rounded and clamped to at least 8 ms.
 * @param {Function} [options.onTick] - Callback invoked on each wake while running.
 * @param {string|URL|null} [options.workerUrl=null] - Worker script; null selects the fallback.
 * @param {Function|null} [options.workerFactory=null] - Worker creator; defaults to the browser Worker API.
 * @param {Function} [options.setTimeoutFn=setTimeout] - Schedule a fallback wake.
 * @param {Function} [options.clearTimeoutFn=clearTimeout] - Cancel a fallback wake.
 * @returns {{start: Function, stop: Function, mode: string, running: boolean, intervalMs: number}}
 * Controls and live state. start() restarts scheduling and returns "worker" or
 * "fallback"; stop() cancels wakeups, terminates the worker, and returns to "idle".
 */
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
