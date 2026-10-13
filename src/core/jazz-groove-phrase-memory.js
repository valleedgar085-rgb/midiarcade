// Deterministic opt-in Jazz hat-cell memory authored by Groove DNA itself.
// This is NOT a late note rewrite: the modified pulse plan is the source of
// truth for the resulting instrument events and the Groove Conductor.
const finite = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const uniqueSorted = (values) => [...new Set(values.map(Number).filter(Number.isFinite))]
  .sort((a, b) => a - b);
const name = (section) => String(section?.name ?? section?.role ?? section?.id ?? "")
  .toLowerCase().replace(/[^a-z]/g, "");
const inSection = (section, bar) => bar >= section.startBar
  && bar < section.startBar + section.bars;
const safeInterior = (section, bar) => section && bar > section.startBar
  && bar < section.startBar + section.bars - 1;

export const JAZZ_GROOVE_PHRASE_MEMORY_LIMITS = Object.freeze({
  maxChangedBarsPerSection: 1, maxEditedCellsPerBar: 1,
  maxHatStepChangesPerBar: 2, beatsPerBar: 4, gridSteps: 16,
});

/**
 * Identify explicit memoryMap relationships first, falling back to the first
 * earlier matching section label. Intro/outro and section boundaries are
 * excluded from recall.
 */
export function jazzGrooveRecallLinks(structure = [], memoryMap = []) {
  const byId = new Map(structure.map((section) => [String(section.id), section]));
  const links = new Map();
  for (const item of memoryMap) {
    if (!["recall", "return"].includes(String(item?.relationship))) continue;
    const source = byId.get(String(item?.originSectionId));
    const target = byId.get(String(item?.sectionId));
    if (!source || !target || source.startBar >= target.startBar) continue;
    links.set(String(target.id), source);
  }
  const origins = new Map();
  for (const section of structure) {
    const key = name(section);
    if (!key) continue;
    if (!origins.has(key)) origins.set(key, section);
    else if (!links.has(String(section.id))) links.set(String(section.id), origins.get(key));
  }
  return links;
}

/**
 * Plan one recognizable two-beat optional hat/percussion phrase response.
 * The Jazz quarter-note timekeeper remains locked; only one supporting lane
 * and one short phrase are developed. No complete bar is copied.
 *
 * Prefer moving a single optional hit. A deliberate one-note rest/addition
 * is a fallback when no one-for-one swap is possible.
 */
export function proposeJazzGrooveCellMemory({
  sourceSteps = [], targetSteps = [], requiredSteps = [],
  optionalSteps = [], protectedSteps = [], gridSteps = 16,
} = {}) {
  if (gridSteps !== 16) return null;
  const required = new Set(requiredSteps);
  const protectedSet = new Set(protectedSteps);
  const legal = new Set(optionalSteps.filter((step) =>
    !required.has(step) && !protectedSet.has(step)));
  const before = uniqueSorted(targetSteps);
  const source = uniqueSorted(sourceSteps);
  if (!source.length && !before.length) return null;

  const candidates = [];
  for (const [start, end] of [[0, 8], [8, 16]]) {
    const src = source.filter((step) => legal.has(step) && step >= start && step < end);
    const dst = before.filter((step) => legal.has(step) && step >= start && step < end);
    const onlySource = src.filter((step) => !dst.includes(step));
    const onlyTarget = dst.filter((step) => !src.includes(step));
    if (!onlySource.length && !onlyTarget.length) continue;

    const alternatives = [];
    if (onlySource.length && onlyTarget.length) {
      alternatives.push({
        kind: "one-for-one-development", add: onlySource[0], remove: onlyTarget[0],
      });
    }
    // A rest before a returning phrase is musically meaningful, and reduces
    // density rather than increasing it.
    if (onlyTarget.length) alternatives.push({
      kind: "phrase-rest", add: null, remove: onlyTarget[0],
    });
    if (onlySource.length) alternatives.push({
      kind: "controlled-pickup", add: onlySource[0], remove: null,
    });
    for (const alternative of alternatives) {
      const result = uniqueSorted(before
        .filter((step) => step !== alternative.remove)
        .concat(alternative.add == null ? [] : [alternative.add]));
      const changedSteps = (alternative.remove == null ? 0 : 1)
        + (alternative.add == null ? 0 : 1);
      if (!changedSteps || changedSteps > 2) continue;
      if (requiredSteps.some((step) => !result.includes(step))) continue;
      if (result.some((step) => protectedSet.has(step))) continue;
      const sourceCell = source.filter((step) => step >= start && step < end);
      const beforeCell = before.filter((step) => step >= start && step < end);
      const afterCell = result.filter((step) => step >= start && step < end);
      const mismatch = (left) => left.filter((step) => !sourceCell.includes(step)).length
        + sourceCell.filter((step) => !left.includes(step)).length;
      const oldMismatch = mismatch(beforeCell);
      const newMismatch = mismatch(afterCell);
      if (newMismatch >= oldMismatch) continue;
      candidates.push({
        steps: result,
        kind: alternative.kind,
        cellStartStep: start,
        sourceCellSteps: sourceCell.length,
        beforeCellSteps: beforeCell.length,
        afterCellSteps: afterCell.length,
        mismatchBefore: oldMismatch,
        mismatchAfter: newMismatch,
        mismatchReduction: oldMismatch - newMismatch,
        changedSteps,
        stepsAdded: alternative.add == null ? 0 : 1,
        stepsRemoved: alternative.remove == null ? 0 : 1,
        sourceStep: alternative.add,
        replacedStep: alternative.remove,
      });
    }
  }
  candidates.sort((a, b) =>
    b.mismatchReduction - a.mismatchReduction
    || b.stepsRemoved - a.stepsRemoved // prefer breath/rest over extra density
    || a.changedSteps - b.changedSteps
    || a.cellStartStep - b.cellStartStep
    || finite(a.sourceStep, 99) - finite(b.sourceStep, 99));
  return candidates[0] ?? null;
}

// Backwards-compatible name for the first calibrated hat-only phase.
export const proposeJazzHatCellMemory = proposeJazzGrooveCellMemory;

/**
 * Resolve the earlier source bar at a matching offset in a return section.
 * Every return bar except the section's opening/closing bars is eligible;
 * the caller enforces the one-changed-bar-per-section budget.
 */
export function jazzGrooveMemorySourceForBar(bar, section, structure = [], links = new Map()) {
  if (!safeInterior(section, bar)) return null;
  const origin = links.get(String(section?.id));
  if (!origin || !inSection(section, bar)) return null;
  const sourceBar = origin.startBar + (bar - section.startBar);
  if (sourceBar >= bar - 1 || !safeInterior(origin, sourceBar)) return null;
  if (sourceBar < 0 || sourceBar >= origin.startBar + origin.bars) return null;
  return { sourceBar, originSectionId: String(origin.id), returnSectionId: String(section.id) };
}
