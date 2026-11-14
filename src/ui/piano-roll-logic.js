/**
 * Pure pointer-to-note geometry for the canonical Shape piano roll.
 * Times are beats (not pixels) and remain inside the focused section.
 */
export function pianoRollPointToNote({
  clientX, clientY, left, top, beatWidth, rowHeight, rows, startBeat, endBeat, grid,
} = {}) {
  const numbers = [clientX, clientY, left, top, beatWidth, rowHeight, startBeat, endBeat, grid];
  if (!numbers.every((value) => typeof value === "number" && Number.isFinite(value))
    || beatWidth <= 0 || rowHeight <= 0 || grid <= 0
    || !Array.isArray(rows) || !rows.length || endBeat - startBeat < grid) return null;

  const pitchIndex = Math.max(0, Math.min(rows.length - 1, Math.floor((clientY - top) / rowHeight)));
  const pitch = Number(rows[pitchIndex]);
  if (!Number.isInteger(pitch) || pitch < 0 || pitch > 127) return null;

  const beatOffset = Math.round(Math.max(0, (clientX - left) / beatWidth) / grid) * grid;
  const onset = Math.min(endBeat - grid, Math.max(startBeat, startBeat + beatOffset));
  return { pitch, start: Math.round(onset * 1e6) / 1e6 };
}

/** Avoid stacking duplicate notes when a producer taps the same grid cell twice. */
export function hasPianoRollOnset(notes, pitch, start, grid) {
  if (!Array.isArray(notes) || !Number.isFinite(pitch) || !Number.isFinite(start)
    || !Number.isFinite(grid) || grid <= 0) return false;
  const tolerance = Math.max(1e-5, grid * 0.2);
  return notes.some((note) => {
    const notePitch = Number(note?.pitch ?? note?.note ?? note?.midi);
    const noteStart = Number(note?.start ?? note?.tick ?? note?.startTick ?? note?.time);
    return notePitch === pitch && Number.isFinite(noteStart) && Math.abs(noteStart - start) < tolerance;
  });
}
