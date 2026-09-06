/** Resume the remaining musical duration, never a burst of expired notes. */
export function resumePreviewEvent(event, position) {
  const elapsed = position - event.time;
  if (elapsed <= 0) return event;
  const remaining = Number(event.duration) - elapsed;
  if (event.id === "drums" || !Number.isFinite(remaining) || remaining <= 0.02) return null;
  const curve = event.expressionCurve ?? [];
  let value = Number(event.expressionStart ?? 1);
  for (let index = 0; index < curve.length; index += 1) {
    const point = curve[index];
    const next = curve[index + 1];
    if (point.offset > elapsed) break;
    value = point.value;
    if (next && next.offset > elapsed) {
      const amount = (elapsed - point.offset) / (next.offset - point.offset);
      value += (next.value - point.value) * amount;
    }
  }
  return {
    ...event,
    time: position,
    duration: remaining,
    glideFromSemitones: 0,
    glideDuration: 0,
    expressionStart: value,
    expressionCurve: [
      { offset: 0, value },
      ...curve.filter((point) => point.offset > elapsed)
        .map((point) => ({ ...point, offset: point.offset - elapsed })),
    ],
  };
}

/** Keep future notes in the event queue until voices free up, not throw them away. */
export function shouldDeferPreviewEvent(when, now, voiceCount, profile) {
  const dueWindow = Math.max(0.06, profile.scheduleIntervalMs / 1000 * 2);
  return voiceCount >= profile.maxScheduledVoices && when - now > dueWindow;
}
