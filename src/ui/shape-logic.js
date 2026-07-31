function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function pitchClass(value) {
  return ((Math.round(Number(value) || 0) % 12) + 12) % 12;
}

function noteStart(note) {
  return Number(note?.start ?? note?.tick ?? note?.startTick ?? note?.time ?? 0);
}

/**
 * Snap a MIDI pitch to the closest pitch class in a harmony guide. Ties favor
 * the lower note so drawing near a boundary cannot unexpectedly jump register.
 */
export function nearestScalePitch(pitch, guide = {}) {
  const numericPitch = Number(pitch);
  const safePitch = clamp(Math.round(Number.isFinite(numericPitch) ? numericPitch : 60), 0, 127);
  const pitchClasses = new Set((guide?.scalePitchClasses ?? []).map(pitchClass));
  if (!pitchClasses.size || pitchClasses.has(pitchClass(safePitch))) return safePitch;
  for (let distance = 1; distance <= 6; distance += 1) {
    const lower = safePitch - distance;
    const upper = safePitch + distance;
    if (lower >= 0 && pitchClasses.has(pitchClass(lower))) return lower;
    if (upper <= 127 && pitchClasses.has(pitchClass(upper))) return upper;
  }
  return safePitch;
}

/** Move by one scale degree instead of one chromatic semitone. */
export function transposeScaleStep(pitch, direction, guide = {}) {
  const current = nearestScalePitch(pitch, guide);
  const step = Math.sign(Number(direction));
  if (!step || !(guide?.scalePitchClasses?.length > 0)) return current;
  for (let candidate = current + step; candidate >= 0 && candidate <= 127; candidate += step) {
    if (guide.scalePitchClasses.some((value) => pitchClass(value) === pitchClass(candidate))) return candidate;
  }
  return current;
}

/**
 * Summarize onset interlock without assuming a specific instrument. The UI
 * uses this for kick/bass and melody/counterpoint relationship feedback.
 */
export function analyzeSectionRelationship(notes = [], partnerNotes = [], tolerance = 0.08) {
  const primary = Array.isArray(notes) ? notes : [];
  const partner = Array.isArray(partnerNotes) ? partnerNotes : [];
  const safeTolerance = clamp(Number(tolerance) || 0.08, 0.001, 0.5);
  const sharedAttacks = primary.filter((note) => partner.some((partnerNote) => (
    Math.abs(noteStart(note) - noteStart(partnerNote)) <= safeTolerance
  ))).length;
  return Object.freeze({
    primaryNotes: primary.length,
    partnerNotes: partner.length,
    sharedAttacks,
    breathingNotes: Math.max(0, primary.length - sharedAttacks),
    interlockRatio: primary.length ? sharedAttacks / primary.length : 0,
  });
}
