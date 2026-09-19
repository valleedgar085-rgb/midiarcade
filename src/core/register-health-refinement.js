import { cloneValue } from "./clone-value.js";
import { roleRegisterWindow } from "./role-register-policy.js";
const CANDIDATE_BLOCK_SIZES = Object.freeze([2, 3, 4]);
const SCORE_EPSILON = 1e-6;
const MELODY_REGISTER = roleRegisterWindow("melody");
const MELODY_REGISTER_FLOOR = MELODY_REGISTER.min;
const MELODY_REGISTER_CEILING = MELODY_REGISTER.max;

export const MAX_REGISTER_HEALTH_CANDIDATES = CANDIDATE_BLOCK_SIZES.length;
export const MAX_REGISTER_HEALTH_EDITS = Math.max(...CANDIDATE_BLOCK_SIZES);

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, finite(value, min)));
}

/**
 * Mirrors the production Critic register-health dimension. Keeping this local
 * score identical makes candidate direction measurable before the full critic
 * decides whether the change is safe enough to commit.
 */
export function registerHealthScore(notes = []) {
  const ordered = [...notes]
    .sort((left, right) => finite(left.start) - finite(right.start) || finite(left.pitch) - finite(right.pitch));
  if (ordered.length < 4) return 68;
  const octaves = ordered.map((note) => Math.floor(finite(note.pitch) / 12));
  let longest = 1;
  let run = 1;
  for (let index = 1; index < octaves.length; index += 1) {
    run = octaves[index] === octaves[index - 1] ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  const pitches = ordered.map((note) => finite(note.pitch));
  const span = Math.max(...pitches) - Math.min(...pitches);
  const runFit = 1 - clamp((longest - 6) / 18, 0, 1);
  const spanFit = clamp(span / 16, 0.35, 1);
  return clamp(Math.round(38 + runFit * 38 + spanFit * 24), 30, 100);
}

function orderedMelodyEntries(song) {
  const melody = (song?.tracks ?? []).find((track) => track?.id === "melody");
  return (melody?.notes ?? [])
    .map((note, noteIndex) => ({ note, noteIndex }))
    .sort((left, right) => (
      finite(left.note.start) - finite(right.note.start)
      || finite(left.note.pitch) - finite(right.note.pitch)
      || left.noteIndex - right.noteIndex
    ));
}

function octaveRuns(entries) {
  if (!entries.length) return [];
  const runs = [];
  let start = 0;
  for (let index = 1; index <= entries.length; index += 1) {
    const currentOctave = index < entries.length ? Math.floor(finite(entries[index].note.pitch) / 12) : null;
    const runOctave = Math.floor(finite(entries[start].note.pitch) / 12);
    if (index < entries.length && currentOctave === runOctave) continue;
    runs.push({
      start,
      end: index,
      length: index - start,
      octave: runOctave,
    });
    start = index;
  }
  return runs.sort((left, right) => right.length - left.length || left.start - right.start);
}

function targetWindow(entries, blockSize) {
  const runs = octaveRuns(entries);
  const longest = runs[0];
  if (!longest) return [];

  if (longest.length >= 7) {
    const size = Math.max(1, Math.min(blockSize, longest.length - 1));
    const center = longest.start + Math.floor(longest.length / 2);
    const start = clamp(
      center - Math.floor(size / 2),
      longest.start + (longest.length > 2 ? 1 : 0),
      Math.max(longest.start, longest.end - size - (longest.length > 2 ? 1 : 0)),
    );
    return entries.slice(start, start + size);
  }

  // A narrow global span can still score weakly even when octave runs are not
  // long. Shift a small middle phrase so the critic can audition wider contour.
  const size = Math.max(1, Math.min(blockSize, entries.length));
  const start = Math.max(0, Math.floor((entries.length - size) / 2));
  return entries.slice(start, start + size);
}

function shiftedScore(entries, selectedIndexes, semitones) {
  const notes = entries.map(({ note, noteIndex }) => ({
    ...note,
    pitch: selectedIndexes.has(noteIndex) ? finite(note.pitch) + semitones : finite(note.pitch),
  }));
  if (notes.some((note) => note.pitch < MELODY_REGISTER_FLOOR || note.pitch > MELODY_REGISTER_CEILING)) return -Infinity;
  return registerHealthScore(notes);
}

function chooseDirection(entries, selected) {
  const selectedIndexes = new Set(selected.map(({ noteIndex }) => noteIndex));
  const up = shiftedScore(entries, selectedIndexes, 12);
  const down = shiftedScore(entries, selectedIndexes, -12);
  if (!Number.isFinite(up) && !Number.isFinite(down)) return 0;
  if (up > down + SCORE_EPSILON) return 12;
  if (down > up + SCORE_EPSILON) return -12;

  const pitches = entries.map(({ note }) => finite(note.pitch));
  const median = [...pitches].sort((a, b) => a - b)[Math.floor(pitches.length / 2)] ?? 60;
  const selectedMean = selected.reduce((sum, { note }) => sum + finite(note.pitch), 0) / Math.max(1, selected.length);
  return selectedMean <= median ? 12 : -12;
}

function createCandidate(song, blockSize, candidateIndex) {
  const sourceEntries = orderedMelodyEntries(song);
  if (sourceEntries.length < 4) return null;
  const selected = targetWindow(sourceEntries, blockSize);
  if (!selected.length) return null;
  const semitones = chooseDirection(sourceEntries, selected);
  if (!semitones) return null;

  const candidate = cloneValue(song);
  const melody = (candidate.tracks ?? []).find((track) => track?.id === "melody");
  if (!melody) return null;

  const beforeLocalScore = registerHealthScore(sourceEntries.map(({ note }) => note));
  let changedNotes = 0;
  for (const entry of selected) {
    const note = melody.notes?.[entry.noteIndex];
    if (!note) continue;
    const nextPitch = finite(note.pitch) + semitones;
    if (nextPitch < MELODY_REGISTER_FLOOR || nextPitch > MELODY_REGISTER_CEILING) continue;
    note.pitch = nextPitch;
    note.registerHealthRefinementRole = semitones > 0 ? "phrase-lift" : "phrase-drop";
    note.preserveTiming = true;
    changedNotes += 1;
  }
  melody.notes.sort((left, right) => finite(left.start) - finite(right.start) || finite(left.pitch) - finite(right.pitch));
  const afterLocalScore = registerHealthScore(melody.notes ?? []);
  if (changedNotes === 0 || afterLocalScore <= beforeLocalScore) return null;

  return {
    id: blockSize === 2 ? "register-break" : blockSize === 3 ? "phrase-register-shift" : "register-contrast",
    candidateIndex,
    song: candidate,
    changedNotes,
    semitones,
    beforeLocalScore: round(beforeLocalScore, 2),
    afterLocalScore: round(afterLocalScore, 2),
    localScoreDelta: round(afterLocalScore - beforeLocalScore, 2),
  };
}

/**
 * Phase 6D register candidates preserve rhythm and harmonic identity exactly:
 * only one contiguous melody phrase may move by one octave. Pitch classes,
 * onsets, durations, velocities, note count, harmony and all other tracks stay
 * unchanged. The full critic/release gate remains authoritative downstream.
 */
export function createRegisterHealthCandidates(song, {
  maxCandidates = MAX_REGISTER_HEALTH_CANDIDATES,
} = {}) {
  const limit = Math.max(0, Math.min(MAX_REGISTER_HEALTH_CANDIDATES, Math.floor(finite(maxCandidates))));
  const seen = new Set();
  return CANDIDATE_BLOCK_SIZES
    .slice(0, limit)
    .map((blockSize, candidateIndex) => createCandidate(song, blockSize, candidateIndex))
    .filter(Boolean)
    .filter((candidate) => {
      const signature = JSON.stringify((candidate.song.tracks ?? []).find((track) => track.id === "melody")?.notes ?? []);
      if (seen.has(signature)) return false;
      seen.add(signature);
      return candidate.changedNotes <= MAX_REGISTER_HEALTH_EDITS && candidate.localScoreDelta > 0;
    });
}
