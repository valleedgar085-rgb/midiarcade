let timer = null;
let intervalMs = 25;
let active = false;

function clearWakeup() {
  if (timer != null) clearTimeout(timer);
  timer = null;
}

function scheduleNext() {
  clearWakeup();
  if (!active) return;
  timer = setTimeout(() => {
    timer = null;
    if (!active) return;
    postMessage({ type: "tick" });
    scheduleNext();
  }, intervalMs);
}

self.onmessage = (event) => {
  const message = event?.data ?? {};
  if (message.type === "stop") {
    active = false;
    clearWakeup();
    return;
  }
  if (message.type !== "start") return;

  const requested = Number(message.intervalMs);
  intervalMs = Number.isFinite(requested) ? Math.max(8, Math.round(requested)) : 25;
  active = true;
  scheduleNext();
};
