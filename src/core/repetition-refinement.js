import { clamp, finite } from "../utils.js";

const EDIT_BUDGETS = Object.freeze([1, 2, 3]);
const MAX_SHIFT = 0.5;
const CADENCE_GUARD = 0.75;
const MIN_GAP = 0.06;
const EPSILON = 1e-6;

export const MAX_REPETITION_REFINEMENT_CANDIDATES = EDIT_BUDGETS.length;
export const MAX_REPETITION_REFINEMENT_EDITS = 3;
export const MAX_REPETITION_REFINEMENT_SHIFT = MAX_SHIFT;

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function melody(song) {
  return (song?.tracks ?? []).find((track) => track.id === "melody");
}

export function repetitionRefinementFamily(song) {
  const primary = String(song?.genre ?? song?.meta?.genre ?? "");
  if (primary === "rnbSoul") return "rnb";
  const secondary = String(song?.meta?.secondaryGenre ?? song?.secondaryGenre ?? "");
  if (song?.meta?.isFusion !== true) return null;
  const hipHopRap = (primary === "hipHop" && secondary === "rap")
    || (primary === "rap" && secondary === "hipHop");
  if (hipHopRap) return "hiphop-rap-fusion";
  const popRap = (primary === "pop" && secondary === "rap")
    || (primary === "rap" && secondary === "pop");
  return popRap ? "pop-rap-fusion" : null;
}

function coverage(signature, reference) {
  if (!signature.size || !reference.size) return 0;
  let shared = 0;
  for (const offset of reference) if (signature.has(offset)) shared += 1;
  return shared / Math.max(1, Math.min(reference.size, signature.size));
}

function windows(song) {
  const track = melody(song);
  const length = finite(song?.motifs?.melody?.lengthBeats);
  if (!track?.notes?.length || length <= 0) return [];
  const indexed = track.notes.map((note, noteIndex) => ({ note, noteIndex }));
  const result = [];
  for (const section of song.structure ?? []) {
    const sectionStart = finite(section.startBeat);
    const sectionEnd = finite(section.endBeat, sectionStart);
    const repeats = Math.min(4, Math.floor((sectionEnd - sectionStart) / length));
    for (let repeat = 0; repeat < repeats; repeat += 1) {
      const start = sectionStart + repeat * length;
      const end = Math.min(sectionEnd, start + length);
      const entries = indexed
        .filter(({ note }) => note.start >= start - EPSILON && note.start < end - EPSILON)
        .sort((left, right) => left.note.start - right.note.start || left.note.pitch - right.note.pitch);
      if (entries.length < 2) continue;
      result.push({
        start,
        end,
        entries,
        signature: new Set(entries.map(({ note }) => Math.round((note.start - start) * 4) / 4)),
      });
    }
  }
  return result;
}

export function repetitionRatio(song) {
  const groups = windows(song);
  if (groups.length < 2) return 0.55;
  const reference = groups[0].signature;
  return groups.slice(1).reduce((sum, group) => sum + coverage(group.signature, reference), 0) / (groups.length - 1);
}

export function repetitionBalance(song, target = 0.62) {
  const actual = repetitionRatio(song);
  const boundedTarget = clamp(target, 0, 1);
  const signedDelta = actual - boundedTarget;
  return Object.freeze({
    actual: round(actual),
    target: round(boundedTarget),
    signedDelta: round(signedDelta),
    absoluteError: round(Math.abs(signedDelta)),
    direction: signedDelta < -EPSILON ? "reinforce" : signedDelta > EPSILON ? "evolve" : "on-target",
  });
}

function safePlacement(group, entry, desiredStart) {
  if (entry.note.start >= group.end - CADENCE_GUARD || desiredStart >= group.end - CADENCE_GUARD) return false;
  const shift = Math.abs(desiredStart - entry.note.start);
  if (shift <= EPSILON || shift > MAX_SHIFT + EPSILON || desiredStart < group.start || desiredStart >= group.end - 0.03) return false;
  return group.entries.every((other) => other.noteIndex === entry.noteIndex || Math.abs(other.note.start - desiredStart) >= MIN_GAP - EPSILON);
}

function possibleMoves(song, direction) {
  const groups = windows(song);
  if (groups.length < 2) return [];
  const reference = groups[0].signature;
  const result = [];
  for (let windowIndex = 1; windowIndex < groups.length; windowIndex += 1) {
    const group = groups[windowIndex];
    const counts = new Map();
    for (const offset of group.signature) counts.set(offset, 0);
    for (const { note } of group.entries) {
      const offset = Math.round((note.start - group.start) * 4) / 4;
      counts.set(offset, (counts.get(offset) ?? 0) + 1);
    }

    if (direction === "reinforce") {
      const missing = [...reference].filter((offset) => !group.signature.has(offset));
      for (const entry of group.entries) {
        const sourceOffset = Math.round((entry.note.start - group.start) * 4) / 4;
        if (reference.has(sourceOffset) && counts.get(sourceOffset) === 1) continue;
        for (const offset of missing) {
          const desiredStart = group.start + offset;
          if (safePlacement(group, entry, desiredStart)) result.push({ windowIndex, noteIndex: entry.noteIndex, desiredStart });
        }
      }
    } else {
      for (const entry of group.entries) {
        const sourceOffset = Math.round((entry.note.start - group.start) * 4) / 4;
        if (!reference.has(sourceOffset) || counts.get(sourceOffset) !== 1) continue;
        for (const delta of [-0.5, -0.25, 0.25, 0.5]) {
          const offset = round(sourceOffset + delta, 2);
          if (offset < 0 || offset >= group.end - group.start - 0.03 || reference.has(offset) || group.signature.has(offset)) continue;
          const desiredStart = group.start + offset;
          if (safePlacement(group, entry, desiredStart)) result.push({ windowIndex, noteIndex: entry.noteIndex, desiredStart });
        }
      }
    }
  }
  return result;
}

function bestMove(song, target, direction) {
  const track = melody(song);
  const before = repetitionBalance(song, target);
  let best = null;
  for (const move of possibleMoves(song, direction)) {
    const note = track?.notes?.[move.noteIndex];
    if (!note) continue;
    const start = note.start;
    note.start = round(move.desiredStart);
    const after = repetitionBalance(song, target);
    note.start = start;
    const directional = direction === "reinforce" ? after.actual > before.actual + EPSILON : after.actual < before.actual - EPSILON;
    const improvement = before.absoluteError - after.absoluteError;
    if (!directional || improvement <= EPSILON) continue;
    const shift = Math.abs(move.desiredStart - start);
    if (!best || improvement > best.improvement + EPSILON || (Math.abs(improvement - best.improvement) <= EPSILON && shift < best.shift - EPSILON)) {
      best = { ...move, improvement, shift };
    }
  }
  return best;
}

function createCandidate(song, target, editBudget, candidateIndex, family) {
  const candidate = JSON.parse(JSON.stringify(song));
  const before = repetitionBalance(candidate, target);
  if (before.direction === "on-target") return null;
  const track = melody(candidate);
  let changedNotes = 0;
  let maxShift = 0;
  for (; changedNotes < editBudget; changedNotes += 1) {
    const current = repetitionBalance(candidate, target);
    if (current.direction === "on-target") break;
    const move = bestMove(candidate, target, current.direction);
    if (!move) break;
    const note = track?.notes?.[move.noteIndex];
    if (!note) break;
    note.start = round(move.desiredStart);
    maxShift = Math.max(maxShift, move.shift);
  }
  const after = repetitionBalance(candidate, target);
  const errorDelta = after.absoluteError - before.absoluteError;
  if (!changedNotes || errorDelta >= -EPSILON) return null;
  track.notes.sort((left, right) => left.start - right.start || left.pitch - right.pitch);
  const prefix = family === "rnb" ? "rnb" : family;
  return {
    id: `${prefix}-${before.direction === "reinforce" ? "recall" : "evolve"}-${editBudget}`,
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

export function createRepetitionRefinementCandidates(song, {
  target = 0.62,
  maxCandidates = MAX_REPETITION_REFINEMENT_CANDIDATES,
} = {}) {
  const family = repetitionRefinementFamily(song);
  if (!family) return [];
  const limit = clamp(Math.floor(finite(maxCandidates)), 0, MAX_REPETITION_REFINEMENT_CANDIDATES);
  const seen = new Set();
  return EDIT_BUDGETS.slice(0, limit)
    .map((budget, candidateIndex) => createCandidate(song, target, budget, candidateIndex, family))
    .filter(Boolean)
    .filter((candidate) => {
      const signature = JSON.stringify(melody(candidate.song)?.notes ?? []);
      if (seen.has(signature)) return false;
      seen.add(signature);
      return candidate.changedNotes <= MAX_REPETITION_REFINEMENT_EDITS && candidate.maxShift <= MAX_SHIFT + EPSILON && candidate.errorDelta < -EPSILON;
    });
}