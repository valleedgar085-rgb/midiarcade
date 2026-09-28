/**
 * Read the final performed representation of a note/event.
 *
 * Legacy MIDI Arcade notes store performed values directly on the note.
 * Canonical musical events store them under `performed`. Consumers such as
 * preview and MIDI export must use this resolver so performance transforms are
 * applied exactly once.
 */
export function resolvePerformedNote(note = {}) {
  const performed = note?.performed && typeof note.performed === "object"
    ? note.performed
    : null;

  const value = (performedValue, ...fallbacks) => {
    if (performedValue != null && Number.isFinite(Number(performedValue))) return Number(performedValue);
    for (const fallback of fallbacks) {
      if (fallback != null && Number.isFinite(Number(fallback))) return Number(fallback);
    }
    return null;
  };

  const text = (performedValue, ...fallbacks) => {
    if (performedValue != null && String(performedValue).trim()) return String(performedValue);
    for (const fallback of fallbacks) {
      if (fallback != null && String(fallback).trim()) return String(fallback);
    }
    return null;
  };

  return Object.freeze({
    start: value(performed?.startBeat, note?.start, note?.time, 0) ?? 0,
    duration: Math.max(0, value(performed?.durationBeats, note?.duration, 0) ?? 0),
    pitch: value(performed?.renderedMidiPitch, note?.renderedMidiPitch, note?.pitch, note?.note, note?.midi),
    velocity: value(performed?.velocity, note?.velocity, 90) ?? 90,
    articulation: text(performed?.articulation, note?.articulation, "normal") ?? "normal",
    microtimingMs: value(performed?.microtimingMs, note?.microtimingMs, note?.microtiming_ms, 0) ?? 0,
    finalized: Boolean(performed),
    source: performed ? "performed" : "legacy-note",
  });
}

export function performanceTransformForNote(note = {}, legacyTransform = null) {
  if (note?.performed && typeof note.performed === "object") {
    return Object.freeze({
      velocityDelta: 0,
      durationScale: 1,
      source: "performed-final",
    });
  }

  const transform = legacyTransform && typeof legacyTransform === "object"
    ? legacyTransform
    : {};
  return Object.freeze({
    velocityDelta: Number.isFinite(Number(transform.velocityDelta))
      ? Number(transform.velocityDelta)
      : 0,
    durationScale: Number.isFinite(Number(transform.durationScale))
      ? Number(transform.durationScale)
      : 1,
    source: "legacy-performance",
  });
}
