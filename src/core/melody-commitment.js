/** Opt-in, pitch-only chorus hook commitment. Never mutates the accepted song. */
import { createChorusHookDevelopmentCandidates } from "./chorus-hook-development.js";
import { evaluateChorusHookRecurrence } from "./chorus-hook-recurrence.js";

const snapshot = (song) => (song?.tracks ?? []).map((track) => ({
  id: track.id,
  notes: (track.notes ?? []).map(({ start, duration, pitch, velocity }) => ({
    start, duration, pitch, velocity,
  })),
}));

export function proposeMelodyCommitment(song, { maxCandidates = 3 } = {}) {
  const before = evaluateChorusHookRecurrence(song);
  if (before.status !== "evaluated" || before.score === null) return [];
  const original = snapshot(song);
  const melodyIndex = original.findIndex((track) => track.id === "melody");
  if (melodyIndex < 0) return [];
  return createChorusHookDevelopmentCandidates(song, { maxCandidates }).filter((candidate) => {
    const next = snapshot(candidate.song);
    if (next.length !== original.length) return false;
    let changedPitches = 0;
    for (let i = 0; i < original.length; i += 1) {
      const source = original[i];
      const target = next[i];
      if (source.id !== target.id || source.notes.length !== target.notes.length) return false;
      for (let j = 0; j < source.notes.length; j += 1) {
        const a = source.notes[j];
        const b = target.notes[j];
        if (a.start !== b.start || a.duration !== b.duration || a.velocity !== b.velocity) return false;
        if (a.pitch !== b.pitch) {
          if (i !== melodyIndex) return false;
          changedPitches += 1;
        }
      }
    }
    return changedPitches === 1 && candidate.afterScore >= before.score
      && candidate.localScoreDelta > 0;
  });
}
