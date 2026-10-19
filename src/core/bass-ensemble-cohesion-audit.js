/** Read-only measurements of how a bass part relates to kicks and active harmony.
 * These are diagnostic signals, not automatic musical-quality verdicts.
 * Do not modify song events, default generator, or MIDI output.
 */
const finite = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const pc = (n) => ((Math.round(n) % 12) + 12) % 12;
const ratio = (a, b) => b ? Math.round((a / b) * 1000) / 1000 : null;
const notes = (song, id) => (song?.tracks ?? []).find((t) => t?.id === id)?.notes ?? [];

export function analyzeBassEnsembleCohesion(song) {
  const bass = notes(song, "bass").filter((n) => Number.isFinite(Number(n?.start)) && Number.isFinite(Number(n?.pitch)));
  const kicks = notes(song, "drums").filter((n) => [35, 36].includes(Math.round(finite(n?.pitch, -1))))
    .map((n) => finite(n.start));
  const harmony = Array.isArray(song?.harmony) ? song.harmony : [];
  let kickLocks = 0, nearKicks = 0, chordRoots = 0, chordKnown = 0, outsideChord = 0, repeats = 0, largeLeaps = 0;
  const details = [];
  for (let i = 0; i < bass.length; i++) {
    const note = bass[i], onset = finite(note.start);
    const nearestKick = kicks.length ? Math.min(...kicks.map((k) => Math.abs(k - onset))) : null;
    if (nearestKick !== null && nearestKick <= 0.08) kickLocks++;
    if (nearestKick !== null && nearestKick <= 0.25) nearKicks++;
    const chord = harmony.find((h) => onset >= finite(h?.start) - 1e-6
      && onset < finite(h?.start) + Math.max(0.05, finite(h?.duration, 0.25)) - 1e-6);
    const root = Number(chord?.rootPc);
    const pitchClass = pc(note.pitch);
    const rootMatch = chord && Number.isFinite(root) ? pitchClass === pc(root) : null;
    if (rootMatch !== null) {
      chordKnown++;
      if (rootMatch) chordRoots++;
    }
    const pitchClasses = chord?.pitchClasses ?? chord?.chordPitchClasses;
    if (Array.isArray(pitchClasses) && pitchClasses.length && !pitchClasses.some((p) => pc(p) === pitchClass)) outsideChord++;
    if (i > 0) {
      if (pc(bass[i - 1].pitch) === pitchClass) repeats++;
      if (Math.abs(finite(note.pitch) - finite(bass[i - 1].pitch)) >= 9) largeLeaps++;
    }
    details.push({ start: onset, pitch: finite(note.pitch), nearestKickBeats: nearestKick, rootMatch });
  }
  return {
    bassNotes: bass.length, kickNotes: kicks.length,
    kickLockRatio: ratio(kickLocks, bass.length),
    nearKickRatio: ratio(nearKicks, bass.length),
    rootOnsetRatio: ratio(chordRoots, chordKnown),
    rootEvidenceCount: chordKnown,
    outsideKnownChordCount: outsideChord,
    repeatPitchClassRatio: ratio(repeats, Math.max(0, bass.length - 1)),
    largeLeapRatio: ratio(largeLeaps, Math.max(0, bass.length - 1)),
    notes: details,
  };
}
