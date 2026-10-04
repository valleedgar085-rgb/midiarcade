function finite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function wrappedLoopPosition(timelineSeconds, durationSeconds) {
  const duration = Math.max(0, finite(durationSeconds, 0));
  if (!(duration > 0)) return 0;
  const timeline = Math.max(0, finite(timelineSeconds, 0));
  return ((timeline % duration) + duration) % duration;
}

export function loopHeadHorizonSeconds({
  timelineNowSeconds = 0,
  horizonSeconds = 0,
  durationSeconds = 0,
} = {}) {
  const duration = Math.max(0, finite(durationSeconds, 0));
  if (!(duration > 0)) return null;
  const now = Math.max(0, finite(timelineNowSeconds, 0));
  const horizon = Math.max(now, finite(horizonSeconds, now));
  if (now >= duration || horizon < duration) return null;
  return Math.min(duration, Math.max(0, horizon - duration));
}
