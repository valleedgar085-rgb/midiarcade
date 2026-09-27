export const CANONICAL_MUSICAL_EVENT_SCHEMA = "midi-arcade/musical-event@1";

function finite(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function round(value, digits = 6) {
  const number = finite(value, 0);
  const factor = 10 ** digits;
  return Math.round((number + Number.EPSILON) * factor) / factor;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, finite(value, min)));
}

function firstFiniteField(source, fields, fallback) {
  for (const field of fields) {
    const value = finite(source?.[field], null);
    if (value != null) return { value, source: field };
  }
  return { value: fallback, source: "performed-fallback" };
}

function firstText(source, fields, fallback = null) {
  for (const field of fields) {
    const value = source?.[field];
    if (value != null && String(value).trim()) return String(value);
  }
  return fallback;
}

function normalizedVelocity(value, fallback = 96) {
  const raw = finite(value, fallback);
  return Math.round(clamp(raw <= 1 ? raw * 127 : raw, 1, 127));
}

export function createCanonicalMusicalEvent({
  id,
  eventType = "note",
  trackId,
  roleId,
  sectionId = null,
  time,
  duration,
  semanticPitch,
  renderedMidiPitch,
  velocity,
  chordContext = null,
  motifId,
  motifSource = "derived",
  phraseRole,
  phraseRoleSource = "role",
  articulation = "normal",
  note = null,
} = {}) {
  const performedStart = round(Math.max(0, finite(time, 0)));
  const performedDuration = round(Math.max(0, finite(duration, 0)));
  const performedVelocity = normalizedVelocity(velocity);
  const renderedPitch = Math.round(clamp(renderedMidiPitch, 0, 127));

  const canonicalStart = firstFiniteField(note, [
    "canonicalStartBeat",
    "canonicalStart",
    "intendedStartBeat",
    "intendedStart",
    "gridStartBeat",
    "quantizedStartBeat",
  ], performedStart);
  const canonicalDuration = firstFiniteField(note, [
    "canonicalDurationBeats",
    "canonicalDuration",
    "intendedDurationBeats",
    "intendedDuration",
    "gridDurationBeats",
  ], performedDuration);
  const canonicalVelocity = firstFiniteField(note, [
    "canonicalVelocity",
    "intendedVelocity",
    "accentVelocity",
  ], performedVelocity);

  const microtimingMs = finite(note?.microtimingMs ?? note?.microtiming_ms, 0);
  const probability = clamp(note?.probability ?? 1, 0, 1);
  const source = firstText(note, ["source", "generatorSource", "authority"], "composer");
  const reason = firstText(note, [
    "musicalReason",
    "compositionReason",
    "intentReason",
    "reason",
  ]);
  const rhythmSource = firstText(note, [
    "rhythmSource",
    "grooveCellId",
    "sectionPatternId",
    "patternId",
  ]);
  const harmonySource = firstText(note, [
    "harmonySource",
    "chordId",
    "harmonyEventId",
  ], chordContext?.id ?? null);

  const canonical = Object.freeze({
    startBeat: round(Math.max(0, canonicalStart.value)),
    durationBeats: round(Math.max(0, canonicalDuration.value)),
    renderedMidiPitch: renderedPitch,
    velocity: normalizedVelocity(canonicalVelocity.value, performedVelocity),
    timingSource: canonicalStart.source,
    durationSource: canonicalDuration.source,
    velocitySource: canonicalVelocity.source,
  });

  const performed = Object.freeze({
    startBeat: performedStart,
    durationBeats: performedDuration,
    renderedMidiPitch: renderedPitch,
    velocity: performedVelocity,
    articulation: String(articulation || "normal"),
    microtimingMs: round(microtimingMs),
    timingDeltaBeats: round(performedStart - canonical.startBeat),
    durationDeltaBeats: round(performedDuration - canonical.durationBeats),
    velocityDelta: performedVelocity - canonical.velocity,
  });

  const intent = Object.freeze({
    source,
    reason,
    rhythmSource,
    harmonySource,
    motifId: motifId == null ? null : String(motifId),
    phraseRole: phraseRole == null ? null : String(phraseRole),
    sectionId: sectionId == null ? null : String(sectionId),
    probability: round(probability),
    locked: Boolean(note?.locked ?? note?.preserveTiming ?? false),
  });

  return Object.freeze({
    schema: CANONICAL_MUSICAL_EVENT_SCHEMA,
    version: 1,
    id: String(id ?? `${trackId ?? roleId ?? "event"}:${performedStart}`),
    eventType: String(eventType || "note"),
    trackId: String(trackId ?? ""),
    roleId: String(roleId ?? ""),
    sectionId: sectionId == null ? null : String(sectionId),

    // Compatibility aliases used by the existing Gauntlet and diagnostics.
    time: performed.startBeat,
    duration: performed.durationBeats,
    semanticPitch,
    renderedMidiPitch: performed.renderedMidiPitch,
    velocity: performed.velocity,
    chordContext,
    motifId: intent.motifId,
    motifSource: String(motifSource || "derived"),
    phraseRole: intent.phraseRole,
    phraseRoleSource: String(phraseRoleSource || "role"),
    articulation: performed.articulation,
    microtimingMs: performed.microtimingMs,
    probability: intent.probability,
    locked: intent.locked,

    intent,
    canonical,
    performed,
  });
}

export function validateCanonicalMusicalEvent(event) {
  const issues = [];
  if (!event || typeof event !== "object") {
    return Object.freeze({
      passed: false,
      issues: Object.freeze(["invalid-event"]),
    });
  }

  if (event.schema !== CANONICAL_MUSICAL_EVENT_SCHEMA) issues.push("schema");
  if (event.version !== 1) issues.push("version");
  if (!String(event.id ?? "").trim()) issues.push("id");
  if (!String(event.trackId ?? "").trim()) issues.push("trackId");
  if (!String(event.roleId ?? "").trim()) issues.push("roleId");

  const canonical = event.canonical ?? {};
  const performed = event.performed ?? {};
  const intent = event.intent ?? {};

  if (!Number.isFinite(canonical.startBeat) || canonical.startBeat < 0) issues.push("canonicalTiming");
  if (!Number.isFinite(canonical.durationBeats) || canonical.durationBeats < 0) issues.push("canonicalDuration");
  if (!Number.isFinite(performed.startBeat) || performed.startBeat < 0) issues.push("performedTiming");
  if (!Number.isFinite(performed.durationBeats) || performed.durationBeats < 0) issues.push("performedDuration");

  if (!Number.isInteger(performed.renderedMidiPitch)
    || performed.renderedMidiPitch < 0
    || performed.renderedMidiPitch > 127) issues.push("performedPitch");
  if (!Number.isInteger(canonical.renderedMidiPitch)
    || canonical.renderedMidiPitch < 0
    || canonical.renderedMidiPitch > 127) issues.push("canonicalPitch");

  if (!Number.isInteger(performed.velocity)
    || performed.velocity < 1
    || performed.velocity > 127) issues.push("performedVelocity");
  if (!Number.isInteger(canonical.velocity)
    || canonical.velocity < 1
    || canonical.velocity > 127) issues.push("canonicalVelocity");

  if (event.time !== performed.startBeat
    || event.duration !== performed.durationBeats
    || event.renderedMidiPitch !== performed.renderedMidiPitch
    || event.velocity !== performed.velocity
    || event.articulation !== performed.articulation) {
    issues.push("compatibilityParity");
  }

  if (!String(intent.source ?? "").trim()) issues.push("intentSource");
  if (!String(event.motifId ?? "").trim()) issues.push("motifTraceability");
  if (!String(event.phraseRole ?? "").trim()) issues.push("phraseTraceability");

  return Object.freeze({
    passed: issues.length === 0,
    issues: Object.freeze(issues),
  });
}
