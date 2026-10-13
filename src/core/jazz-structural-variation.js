import { cloneValue } from "./clone-value.js";
import { normalizeGenreId } from "./genre-contract.js";
import { evaluateCrossAuthorityCoherence } from "./cross-authority-coherence.js";

// A two-hit bell answer to a repeated ride cell, never a new rhythm or bar copy.
// Quantization is observation-only: the performed song retains every onset.
export const JAZZ_STRUCTURAL_LIMITS = Object.freeze({ candidateLimit: 3, maxEdits: 2, maxBars: 1, grid: 12, tolerance: 0.035 });
const drums = (song) => song?.tracks?.find((track) => track.id === "drums")?.notes ?? [];
const jazz = (song) => normalizeGenreId(song?.genre ?? song?.meta?.genre) === "jazz";
const sections = (song) => song?.structure ?? song?.sections ?? [];
const start = (section) => section.startBeat ?? section.startBar * 4;
const end = (section) => section.endBeat ?? start(section) + section.bars * 4;
const protectedNote = (note) => Boolean(
  note.performed || note.renderedMidiPitch != null || note.drumFillId || note.transitionFeature || note.transitionHandoffRole
  || note.transitionHandoffId || note.ensembleAccent || note.phraseAnchor || note.resolutionRole
  || note.memoryRole || note.motifHandoffRole || note.finalAssemblyRole
  || note.jazzMemoryPocketRecall || note.jazzMemoryColorRecall || note.jazzMemoryGlobalRecall
  || /fill|roll/.test(String(note.rhythmicFeature ?? ""))
);
function cellRows(song) {
  const rows = new Map();
  drums(song).forEach((note, index) => {
    if (![51, 53, 59].includes(note.pitch) || !Number.isFinite(note.start)) return;
    const snapped = Math.round(note.start * 12) / 12;
    const aligned = Math.abs(snapped - note.start) <= JAZZ_STRUCTURAL_LIMITS.tolerance;
    const cell = Math.floor(snapped / 2);
    if (!rows.has(cell)) rows.set(cell, []);
    rows.get(cell).push({ note, index, offset: snapped - cell * 2, aligned });
  });
  return [...rows].sort(([a], [b]) => a - b).map(([cell, hits]) => ({
    cell, hits, signature: hits.map(({ note, offset, aligned }) =>
      `${note.pitch}:${aligned ? offset : `free-${note.start - cell * 2}`}`).sort().join("|"),
  }));
}
export function analyzeJazzStructuralGroove(song) {
  const rows = cellRows(song);
  const counts = new Map();
  for (const row of rows) counts.set(row.signature, (counts.get(row.signature) ?? 0) + 1);
  return Object.freeze({
    available: jazz(song), cells: rows.length, uniqueCells: counts.size,
    repeatedCells: rows.length - counts.size,
    dominantCellOccurrences: Math.max(0, ...counts.values()),
    // Deliberately separate from the release critic's exact-onset bar signature.
    method: "two-beat-ride-voice-grid-12-observation-only",
  });
}
function safeBar(song, bar) {
  const notes = drums(song).filter((note) => Math.floor(note.start / 4) === bar);
  if (notes.some(protectedNote)) return false;
  return sections(song).some((section) =>
    bar * 4 >= start(section) + 4 && (bar + 1) * 4 <= end(section) - 4);
}
export function createJazzStructuralVariationCandidates(song) {
  if (!jazz(song) || (song?.meta?.beatsPerBar ?? 4) !== 4) return [];
  // Use only a color already established by this drummer's existing kit phrase.
  if (!drums(song).some((note) => note.pitch === 53)) return [];
  const rows = cellRows(song), candidates = [], before = analyzeJazzStructuralGroove(song);
  const counts = new Map();
  for (const row of rows) counts.set(row.signature, (counts.get(row.signature) ?? 0) + 1);
  for (const row of rows) {
    if (candidates.length === JAZZ_STRUCTURAL_LIMITS.candidateLimit) break;
    const bar = Math.floor(row.cell / 2);
    // Answer only in the second half of an interior bar after two statements.
    if (row.cell % 2 !== 1 || !safeBar(song, bar) || counts.get(row.signature) < 3) continue;
    if (rows.filter((source) => source.cell < row.cell && source.signature === row.signature).length < 2) continue;
    if (row.hits.some(({ note, aligned }) => protectedNote(note) || !aligned)) continue;
    const answer = row.hits.filter(({ note, offset }) => note.pitch === 51 && [0.75, 1.75].includes(offset));
    if (answer.length !== 2) continue;
    // Never overlap an existing bell or edit an onset spilling across bar borders.
    if (answer.some(({ note }) => Math.floor(note.start / 4) !== bar
      || drums(song).some((other) => other.pitch === 53
        && other.start < note.start + note.duration && other.start + other.duration > note.start))) continue;
    const candidate = cloneValue(song);
    const notes = drums(candidate);
    for (const { index } of answer) notes[index].pitch = 53;
    const after = analyzeJazzStructuralGroove(candidate);
    if (after.uniqueCells !== before.uniqueCells + 1 || after.repeatedCells !== before.repeatedCells - 1) continue;
    candidates.push({ id: `jazz-ride-answer:${row.cell}`, song: candidate, targetBar: bar,
      changedNotes: answer.length, before, after });
  }
  return candidates;
}
const diagnostic = (reason, extra = {}) => ({ attempted: false, accepted: false, changed: false,
  reason, candidateLimit: JAZZ_STRUCTURAL_LIMITS.candidateLimit, candidatesEvaluated: 0, ...extra });
const finiteScore = (value) => typeof value === "number" && Number.isFinite(value);
export function applyJazzStructuralVariationRefinement(song, config = {}, evaluate, releaseGate) {
  if (config.jazzStructuralVariationRefinement !== true) return { song, diagnostics: diagnostic("disabled") };
  if (!jazz(song)) return { song, diagnostics: diagnostic("jazz-only") };
  if (typeof evaluate !== "function" || typeof releaseGate !== "function") {
    throw new TypeError("Jazz structural variation requires critic and release evaluators");
  }
  const candidates = createJazzStructuralVariationCandidates(song);
  if (!candidates.length) return { song, diagnostics: diagnostic("no-safe-repeated-ride-cell") };
  const before = evaluate(song), coherence = evaluateCrossAuthorityCoherence(song);
  const reports = [];
  let selected;
  for (const candidate of candidates) {
    const after = evaluate(candidate.song), release = releaseGate(candidate.song, after);
    const next = evaluateCrossAuthorityCoherence(candidate.song);
    const dimensions = Object.entries(before?.subscores ?? {});
    const criticSafe = dimensions.length > 0 && finiteScore(before?.score) && finiteScore(after?.score)
      && after.score >= before.score && dimensions.every(([key, value]) =>
        finiteScore(value) && finiteScore(after?.subscores?.[key]) && after.subscores[key] >= value);
    const coherenceSafe = finiteScore(next?.score) && next.score >= coherence.score
      && !(next.issues ?? []).some((issue) => !(coherence.issues ?? []).includes(issue))
      && next.grooveLock?.timingViolations <= coherence.grooveLock?.timingViolations
      && next.grooveLock?.protectedSpaceViolations <= coherence.grooveLock?.protectedSpaceViolations;
    const scaleSafe = finiteScore(after?.diagnostics?.scaleFit) && after.diagnostics.scaleFit >= 0.999999;
    const accepted = release?.passed === true && criticSafe && coherenceSafe && scaleSafe;
    const reason = !release?.passed ? "release-gate" : !scaleSafe ? "scale-safety"
      : !criticSafe ? "critic-regression" : !coherenceSafe ? "coherence-regression" : "ride-bell-answer";
    reports.push({ id: candidate.id, accepted, reason, beforeVariety: before.subscores?.drumVariety,
      afterVariety: after.subscores?.drumVariety });
    if (accepted && !selected) selected = candidate;
  }
  return { song: selected?.song ?? song, diagnostics: diagnostic(selected ? "ride-bell-answer" : reports[0].reason, {
    attempted: true, accepted: Boolean(selected), changed: Boolean(selected), candidatesEvaluated: reports.length,
    changedNotes: selected?.changedNotes ?? 0, targetBar: selected?.targetBar,
    structuralBefore: candidates[0].before, structuralAfter: selected?.after ?? candidates[0].before,
    candidates: reports,
  }) };
}
