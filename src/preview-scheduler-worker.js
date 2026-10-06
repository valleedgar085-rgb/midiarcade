let timer = null;

function stop() {
  if (timer != null) clearInterval(timer);
  timer = null;
}

self.onmessage = (event) => {
  const type = String(event?.data?.type ?? "");
  if (type === "stop") {
    stop();
    return;
  }
  if (type !== "start") return;

  stop();
  const requested = Number(event?.data?.intervalMs);
  const intervalMs = Math.min(250, Math.max(20, Number.isFinite(requested) ? requested : 45));
  timer = setInterval(() => {
    self.postMessage({ type: "tick" });
  }, intervalMs);
};

self.onclose = stop;
