const CANDIDATE_EDIT_BUDGETS = Object.freeze([1, 2, 3]);
const MAX_ONSET_SHIFT_BEATS = 0.5;
const CADENCE_GUARD_BEATS = 0.75;
const MIN_NOTE_GAP_BEATS = 0.06;
const ERROR_EPSILON = 1e-6;

export const MAX_REPETITION_REFINEMENT_CANDIDATES = CANDIDATE_EDIT_BUDGETS.length;
export const MAX_REPETITION_REFINEMENT_EDITS = Math.max(...CANDIDATE_EDIT_BUDGETS);
export const MAX_REPETITION_REFINEMENT_SHIFT = MAX_ONSET_SHIFT_BEATS;

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, finite(value, min)));
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function noteStart(note) {
  return finite(note?.start ?? note?.startBeat ?? note?.beat ?? note?.time, 0);
}

function setNoteStart(note, value) {
  const key = ["start", "startBeat", "beat", "time"]
    .find((candidate) => Object.prototype.hasOwnProperty.call(note ?? {}, candidate)) ?? "start";
  note[key] = round(value);
}

function notePitch(note) {
  return finite(note?.pitch ?? note?.note ?? note?.midi, 60);
}

function melodyTrack(song) {
  return (song?.tracks ?? []).find((track) => track?.id === "melody") ?? null;
}

function sectionsOf(song) {
  return Array.isArray(song?.structure) ? song.structure : Array.isArray(song?.sections) ? song.sections : [];
}

function motifLengthOf(song) {
  return finite(song?.motifs?.melody?.lengthBeats, 0);
}

function quarterBeatOffset(note, windowStart) {
  return Math.round((noteStart(note) - windowStart) * 4) / 4;
}

function signatureForEntries(entries, windowStart) {
  return new Set(entries.map(({ note }) => quarterBeatOffset(note, windowStart)));
}

function signatureCoverage(signature, reference) {
  if (!signature?.size || !reference?.size) return 0;
  const shared = [...reference].filter((offset) => signature.has(offset)).length;
  return shared / Math.max(1, Math.min(reference.size, signature.size));
}

function motifWindows(song) {
  const melody = melodyTrack(song);
  const length = motifLengthOf(song);
  if (!melody?.notes?.length || length <= 0) return [];
  const indexedNotes = melody.notes.map((note, noteIndex) => ({ note, noteIndex }));
  const windows = [];
  for (const section of sectionsOf(song)) {
    const sectionStart = finite(section?.startBeat, 0);
    const sectionEnd = finite(section?.endBeat, sectionStart);
    const repeats = Math.min(4, Math.floor((sectionEnd - sectionStart) / length));
    for (let repeat = 0; repeat < repeats; repeat += 1) {
      const start = sectionStart + repeat * length;
      const end = Math.min(sectionEnd, start + length);
      const entries = indexedNotes
        .filter(({ note }) => noteStart(note) >= start - 1e-6 && noteStart(note) < end - 1e-6)
        .sort((left, right) => noteStart(left.note) - noteStart(right.note) || notePitch(left.note) - notePitch(right.note));
      if (entries.length < 2) continue;
      windows.push({
        sectionId: String(section?.id ?? section?.name ?? windows.length),
        start,
        end,
        sectionEnd,
        entries,
        signature: signatureForEntries(entries, start),
      });
    }
  }
  return windows;
}

/** Mirrors the production critic's quarter-beat motif-window repetition ratio. */
export function repetitionRatio(song) {
  const windows = motifWindows(song);
  if (windows.length < 2) return 0.55;
  const reference = windows[0].signature;
  return windows.length > 1
    ? windows.slice(1).reduce((sum, window) => sum + signatureCoverage(window.signature, reference), 0) / (windows.length - 1)
    : 0.55;
}

export function repetitionBalance(song, target = 0.62) {
  const boundedTarget = clamp(target, 0, 1);
  const actual = repetitionRatio(song);
  const signedDelta = actual - boundedTarget;
  return Object.freeze({
    actual: round(actual),
    target: round(boundedTarget),
    signedDelta: round(signedDelta),
    absoluteError: round(Math.abs(signedDelta)),
    direction: signedDelta < -ERROR_EPSILON ? "reinforce" : signedDelta > ERROR_EPSILON ? "evolve" : "on-target",
  });
}

function offsetCounts(window) {
  const counts = new Map();
  for (const { note } of window.entries) {
    const offset = quarterBeatOffset(note, window.start);
    counts.set(offset, (counts.get(offset) ?? 0) + 1);
  }
  return counts;
}

function placementIsSafe(window, entry, desiredStart) {
  const guardEnd = Math.min(window.end, window.sectionEnd) - CADENCE_GUARD_BEATS;
  if (noteStart(entry.note) >= guardEnd - 1e-6 || desiredStart >= guardEnd - 1e-6) return false;
  if (desiredStart < window.start - 1e-6 || desiredStart >= window.end - 0.03) return false;
  const shift = Math.abs(desiredStart - noteStart(entry.note));
  if (shift <= ERROR_EPSILON || shift > MAX_ONSET_SHIFT_BEATS + 1e-6) return false;
  return window.entries.every((other) => (
    other.noteIndex === entry.noteIndex
    || Math.abs(noteStart(other.note) - desiredStart) >= MIN_NOTE_GAP_BEATS - 1e-6
  ));
}

function possibleMoves(song, direction) {
  const windows = motifWindows(song);
  if (windows.length < 2) return [];
  const reference = windows[0].signature;
  const moves = [];

  for (let windowIndex = 1; windowIndex < windows.length; windowIndex += 1) {
    const window = windows[windowIndex];
    const counts = offsetCounts(window);
    if (direction === "reinforce") {
      const missing = [...reference].filter((offset) => !window.signature.has(offset));
      if (!missing.length) continue;
      for (const entry of window.entries) {
        const sourceOffset = quarterBeatOffset(entry.note, window.start);
        const movable = !reference.has(sourceOffset) || (counts.get(sourceOffset) ?? 0) > 1;
        if (!movable) continue;
        for (const targetOffset of missing) {
          const desiredStart = window.start + targetOffset;
          if (!placementIsSafe(window, entry, desiredStart)) continue;
          moves.push({ windowIndex, noteIndex: entry.noteIndex, desiredStart, targetOffset });
        }
      }
    } else if (direction === "evolve") {
      for (const entry of window.entries) {
        const sourceOffset = quarterBeatOffset(entry.note, window.start);
        if (!reference.has(sourceOffset) || (counts.get(sourceOffset) ?? 0) !== 1) continue;
        for (const offsetDelta of [-0.5, -0.25, 0.25, 0.5]) {
          const targetOffset = round(sourceOffset + offsetDelta, 2);
          if (targetOffset < 0 || targetOffset >= window.end - window.start - 0.03) continue;
          if (reference.has(targetOffset) || window.signature.has(targetOffset)) continue;
          const desiredStart = window.start + targetOffset;
          if (!placementIsSafe(window, entry, desiredStart)) continue;
          moves.push({ windowIndex, noteIndex: entry.noteIndex, desiredStart, targetOffset });
        }
      }
    }
  }
  return moves;
}

function bestImprovingMove(song, target, direction) {
  const melody = melodyTrack(song);
  if (!melody?.notes?.length) return null;
  const before = repetitionBalance(song, target);
  let best = null;

  for (const move of possibleMoves(song, direction)) {
    const note = melody.notes[move.noteIndex];
    if (!note) continue;
    const originalStart = noteStart(note);
    setNoteStart(note, move.desiredStart);
    const after = repetitionBalance(song, target);
    setNoteStart(note, originalStart);

    const directional = direction === "reinforce"
      ? after.actual > before.actual + ERROR_EPSILON
      : after.actual < before.actual - ERROR_EPSILON;
    const improvement = before.absoluteError - after.absoluteError;
    if (!directional || improvement <= ERROR_EPSILON) continue;

    const shift = Math.abs(move.desiredStart - originalStart);
    const candidate = { ...move, originalStart, improvement, shift, after };
    if (
      !best
      || improvement > best.improvement + ERROR_EPSILON
      || (Math.abs(improvement - best.improvement) <= ERROR_EPSILON && shift < best.shift - ERROR_EPSILON)
      || (
        Math.abs(improvement - best.improvement) <= ERROR_EPSILON
        && Math.abs(shift - best.shift) <= ERROR_EPSILON
        && (move.windowIndex < best.windowIndex || (move.windowIndex === best.windowIndex && move.noteIndex < best.noteIndex))
      )
    ) best = candidate;
  }
  return best;
}

function createCandidate(song, target, editBudget, candidateIndex) {
  const candidate = clone(song);
  const before = repetitionBalance(candidate, target);
  if (before.direction === "on-target") return null;
  const melody = melodyTrack(candidate);
  if (!melody?.notes?.length) return null;

  let changedNotes = 0;
  let maxShift = 0;
  for (let edit = 0; edit < editBudget; edit += 1) {
    const current = repetitionBalance(candidate, target);
    if (current.direction === "on-target") break;
    const move = bestImprovingMove(candidate, target, current.direction);
    if (!move) break;
    const note = melody.notes[move.noteIndex];
    if (!note) break;
    setNoteStart(note, move.desiredStart);
    note.repetitionRefinementRole = current.direction === "reinforce" ? "motif-reinforce" : "motif-evolve";
    note.preservePitch = true;
    maxShift = Math.max(maxShift, move.shift);
    changedNotes += 1;
  }

  const after = repetitionBalance(candidate, target);
  const errorDelta = after.absoluteError - before.absoluteError;
  if (changedNotes === 0 || errorDelta >= -ERROR_EPSILON) return null;
  melody.notes.sort((left, right) => noteStart(left) - noteStart(right) || notePitch(left) - notePitch(right));

  return {
    id: before.direction === "reinforce"
      ? `rnb-recall-${editBudget}`
      : `rnb-evolve-${editBudget}`,
    candidateIndex,
    song: candidate,
    direction: before.direction,
    changedNotes,
    maxShift: round(maxShift),
    beforeActual: before.actual,
    afterActual: after.actual,
    target: before.target,
    beforeError: before.absoluteError,
    afterError: after.absoluteError,
    errorDelta: round(errorDelta),
  };
}

/**
 * Build no more than three signed repetition candidates. This first calibrated
 * pass is intentionally RnB Soul-only: the Quality Lab proved that RnB can be
 * both under-recalled and over-repeated across seeds, while Techno already has
 * a separately proven recall path. Candidates preserve note count, pitch,
 * duration and velocity and only move a few non-reference melody onsets.
 */
export function createRepetitionRefinementCandidates(song, {
  target = 0.62,
  maxCandidates = MAX_REPETITION_REFINEMENT_CANDIDATES,
} = {}) {
  const genre = String(song?.genre ?? song?.meta?.genre ?? "");
  if (genre !== "rnbSoul") return [];
  const limit = Math.max(0, Math.min(MAX_REPETITION_REFINEMENT_CANDIDATES, Math.floor(finite(maxCandidates))));
  const seen = new Set();
  return CANDIDATE_EDIT_BUDGETS
    .slice(0, limit)
    .map((editBudget, candidateIndex) => createCandidate(song, target, editBudget, candidateIndex))
    .filter(Boolean)
    .filter((candidate) => {
      const signature = JSON.stringify(melodyTrack(candidate.song)?.notes ?? []);
      if (seen.has(signature)) return false;
      seen.add(signature);
      return candidate.changedNotes <= MAX_REPETITION_REFINEMENT_EDITS
        && candidate.maxShift <= MAX_REPETITION_REFINEMENT_SHIFT + 1e-6
        && candidate.errorDelta < -ERROR_EPSILON;
    });
}
