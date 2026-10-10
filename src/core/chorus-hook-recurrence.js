/**
 * A read-only hook-return audit. Unlike whole-section phrase-memory scoring,
 * this compares the actual opening 2-bar musical fingerprints of consecutive
 * choruses without requiring phrase-memory metadata.
 *
 * All measurements are derived from the final note events. Nothing is
 * inserted, removed, re-pitched, or re-timed, and this file has no dependency
 * on preview synthesis.
 */
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const clamp01 = (value) => Math.min(1, Math.max(0, value));
const round = (value, places = 3) => {
  const factor = 10 ** places;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
};
const quantize = (value, step = 0.125) => Math.round(value / step) * step;
const MAX_HOOK_NOTES = 12;

function songSections(song) {
  return Array.isArray(song?.structure) ? song.structure : (song?.sections ?? []);
}

function sectionName(section) {
  return String(section?.name ?? section?.type ?? section?.id ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function isChorus(section) {
  return /^(chorus|refrain|hook)/.test(sectionName(section));
}

function isVerse(section) {
  return /^(verse|rapverse)/.test(sectionName(section));
}

function sectionBounds(song, section) {
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const start = finite(section?.startBeat, finite(section?.startBar, 0) * beatsPerBar);
  const end = Math.max(start, finite(
    section?.endBeat,
    start + Math.max(1, finite(section?.bars, 4)) * beatsPerBar,
  ));
  return { start, end, beatsPerBar };
}

function melodyNotes(song) {
  return ((song?.tracks ?? []).find((track) => track?.id === "melody")?.notes ?? [])
    .filter((note) => Number.isFinite(Number(note?.start)) && Number.isFinite(Number(note?.pitch)))
    .sort((left, right) => finite(left.start) - finite(right.start) || finite(left.pitch) - finite(right.pitch));
}

function openingHook(song, section, notes, windowBars = 2) {
  const bounds = sectionBounds(song, section);
  const end = Math.min(bounds.end, bounds.start + bounds.beatsPerBar * windowBars);
  return notes.filter((note) => finite(note.start) >= bounds.start - 1e-6
    && finite(note.start) < end - 1e-6).slice(0, MAX_HOOK_NOTES);
}

function hookFingerprint(notes) {
  if (notes.length < 4) return null;
  const intervals = notes.slice(1).map((note, index) =>
    Math.max(-12, Math.min(12, Math.round(finite(note.pitch) - finite(notes[index].pitch)))));
  const contours = intervals.map((interval) => Math.sign(interval));
  const rhythmicSteps = notes.slice(1).map((note, index) =>
    quantize(Math.max(0, finite(note.start) - finite(notes[index].start))));
  const durations = notes.map((note) => quantize(Math.max(0.0625, finite(note.duration, 0.25))));
  return { contours, intervals, rhythmicSteps, durations, noteCount: notes.length };
}

/** Levenshtein-style sequence comparison; a small local pitch variation is allowed. */
function sequenceSimilarity(left, right, substitutionPenalty) {
  if (!left.length && !right.length) return 1;
  if (!left.length || !right.length) return 0;
  let previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let row = 1; row <= left.length; row += 1) {
    const next = [row];
    for (let column = 1; column <= right.length; column += 1) {
      const replacement = previous[column - 1] + clamp01(substitutionPenalty(left[row - 1], right[column - 1]));
      next.push(Math.min(previous[column] + 1, next[column - 1] + 1, replacement));
    }
    previous = next;
  }
  return clamp01(1 - previous[right.length] / Math.max(left.length, right.length));
}

function hookSimilarity(source, returning) {
  const a = hookFingerprint(source);
  const b = hookFingerprint(returning);
  if (!a || !b) return null;
  const contour = sequenceSimilarity(a.contours, b.contours, (x, y) => x === y ? 0 : 1);
  const interval = sequenceSimilarity(a.intervals, b.intervals, (x, y) =>
    Math.min(1, Math.abs(x - y) / 6));
  const rhythm = sequenceSimilarity(a.rhythmicSteps, b.rhythmicSteps, (x, y) =>
    Math.min(1, Math.abs(x - y) / 0.75));
  const duration = sequenceSimilarity(a.durations, b.durations, (x, y) =>
    Math.min(1, Math.abs(x - y) / 0.75));
  const coverage = Math.min(a.noteCount, b.noteCount) / Math.max(a.noteCount, b.noteCount);
  const identity = clamp01(contour * 0.36 + interval * 0.24 + rhythm * 0.3 + duration * 0.1);
  // Do not mistake a short coincidental fragment for a complete, recognizable return.
  const score = clamp01(identity * (0.35 + coverage * 0.65));
  return Object.freeze({
    score: round(score),
    contour: round(contour),
    interval: round(interval),
    rhythm: round(rhythm),
    duration: round(duration),
    noteCoverage: round(coverage),
    openingNotes: a.noteCount,
    returningNotes: b.noteCount,
    // Exact repetition is recognizable, but report it for later artistic judgment.
    literalRepeat: JSON.stringify(a) === JSON.stringify(b)
      && source.every((note, index) => Math.round(finite(note.pitch)) === Math.round(finite(returning[index].pitch))),
  });
}

/**
 * Independent onset alignment. This counts shared attacks on the song's
 * beat grid even when a returning phrase adds a pickup, omits an ending,
 * or changes note pitches. It does not alter the legacy hook score.
 */
function onsetAlignment(source, returning, sourceStart, returningStart) {
  const left = source.map((note) => finite(note.start) - sourceStart);
  const right = returning.map((note) => finite(note.start) - returningStart);
  let i = 0;
  let j = 0;
  let sharedAttacks = 0;
  const tolerance = 0.125;
  while (i < left.length && j < right.length) {
    if (Math.abs(left[i] - right[j]) <= tolerance) {
      sharedAttacks += 1;
      i += 1;
      j += 1;
    } else if (left[i] < right[j]) {
      i += 1;
    } else {
      j += 1;
    }
  }
  const sourceCoverage = left.length ? sharedAttacks / left.length : 0;
  const returnCoverage = right.length ? sharedAttacks / right.length : 0;
  const extraPickup = left.length > 0 && right.length > 0 && right[0] < left[0] - tolerance;
  const missingTail = left.length > 0 && right.length > 0
    && left.at(-1) > right.at(-1) + tolerance;
  return Object.freeze({
    sharedAttacks,
    sourceOnsetCoverage: round(sourceCoverage),
    returnOnsetCoverage: round(returnCoverage),
    extraPickup,
    missingTail,
    reason: extraPickup && missingTail ? "pickup-and-shortened-return"
      : missingTail ? "shortened-return"
        : extraPickup ? "extra-pickup"
          : returnCoverage >= 0.9 && sourceCoverage >= 0.65
            ? "onsets-preserved" : "phrase-onsets-changed",
  });
}

function verseSpace(song, section, notes) {
  const bounds = sectionBounds(song, section);
  const length = Math.max(0.25, bounds.end - bounds.start);
  const starts = notes.filter((note) => finite(note.start) >= bounds.start - 1e-6
    && finite(note.start) < bounds.end - 1e-6);
  const intervals = starts.map((note) => [
    Math.max(bounds.start, finite(note.start)),
    Math.min(bounds.end, finite(note.start) + Math.max(0, finite(note.duration, 0.25))),
  ]).sort((a, b) => a[0] - b[0]);
  let covered = 0;
  let cursor = bounds.start;
  let longestRest = 0;
  for (const [start, end] of intervals) {
    if (end <= cursor) continue;
    longestRest = Math.max(longestRest, start - cursor);
    covered += end - Math.max(cursor, start);
    cursor = end;
  }
  longestRest = Math.max(longestRest, bounds.end - cursor);
  return Object.freeze({
    sectionId: String(section?.id ?? ""),
    notes: starts.length,
    notesPerBar: round(starts.length / (length / bounds.beatsPerBar)),
    // Fraction of section when the lead MIDI melody is silent; not a vocal track estimate.
    leadRestFraction: round(1 - clamp01(covered / length)),
    longestLeadRestBeats: round(longestRest),
  });
}

/**
 * Diagnostic only; never used to rewrite MIDI or as an automatic release gate.
 * A single chorus or a missing melody is not treated as a failed hook return.
 */
export function evaluateChorusHookRecurrence(song) {
  const melody = (song?.tracks ?? []).find((track) => track?.id === "melody");
  const sections = songSections(song);
  const verses = sections.filter(isVerse).map((section) => verseSpace(song, section, melodyNotes(song)));
  if (!melody) {
    return Object.freeze({
      version: 1, authority: "chorus-hook-recurrence-v1", mode: "read-only",
      status: "unavailable", passed: null, score: null,
      reason: "missing-melody", comparisons: Object.freeze([]), verses: Object.freeze(verses),
    });
  }
  const notes = melodyNotes(song);
  const choruses = sections.filter(isChorus);
  if (choruses.length < 2) {
    return Object.freeze({
      version: 1, authority: "chorus-hook-recurrence-v1", mode: "read-only",
      status: "unavailable", passed: null, score: null,
      reason: "single-or-no-chorus", comparisons: Object.freeze([]), verses: Object.freeze(verses),
    });
  }
  const source = choruses[0];
  const comparisons = choruses.slice(1).map((section) => {
    const twoBarSource = openingHook(song, source, notes, 2);
    const twoBarReturn = openingHook(song, section, notes, 2);
    // A deliberate two-bar pickup can contain fewer than four note attacks.
    // Compare up to four bars ONLY when both actual section durations allow it,
    // rather than classifying sparse hip-hop hooks as absent too early.
    const sourceRange = sectionBounds(song, source);
    const targetRange = sectionBounds(song, section);
    const canExtend = sourceRange.end - sourceRange.start >= sourceRange.beatsPerBar * 4
      && targetRange.end - targetRange.start >= targetRange.beatsPerBar * 4;
    const windowBars = canExtend && (twoBarSource.length < 4 || twoBarReturn.length < 4) ? 4 : 2;
    const sourceNotes = windowBars === 4 ? openingHook(song, source, notes, 4) : twoBarSource;
    const returningNotes = windowBars === 4 ? openingHook(song, section, notes, 4) : twoBarReturn;
    const result = hookSimilarity(sourceNotes, returningNotes);
    const alignment = onsetAlignment(sourceNotes, returningNotes, sourceRange.start, targetRange.start);
    return Object.freeze({
      sourceSectionId: String(source?.id ?? ""),
      sectionId: String(section?.id ?? ""),
      windowBars,
      available: result !== null,
      ...alignment,
      ...(result ?? { score: null, reason: "insufficient-opening-notes" }),
    });
  });
  const valid = comparisons.filter((entry) => entry.available);
  const score = valid.length ? Math.round(valid.reduce((sum, entry) => sum + entry.score, 0) * 100 / valid.length) : null;
  return Object.freeze({
    version: 1,
    authority: "chorus-hook-recurrence-v1",
    mode: "read-only",
    status: valid.length === comparisons.length ? "evaluated" : "incomplete",
    passed: score === null ? null : valid.length === comparisons.length && score >= 66,
    score,
    reason: !valid.length ? "missing-comparable-hooks"
      : valid.length !== comparisons.length ? "incomplete-hook-evidence"
        : score >= 66 ? "recognizable-hook-return" : "weak-hook-recurrence",
    comparisons: Object.freeze(comparisons),
    verses: Object.freeze(verses),
  });
}
