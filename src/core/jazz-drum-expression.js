import { cloneValue } from "./clone-value.js";
import { normalizeGenreId } from "./genre-contract.js";
import { evaluateCrossAuthorityCoherence } from "./cross-authority-coherence.js";

// Jazz ride/hat articulation: a shadow-controlled, one-for-one velocity pass.
// Kick/snare onsets, all note pitches, note count, Groove DNA timing, and all
// other instruments remain byte-equivalent. Not enabled in normal production.
const CYMBALS = new Set([42, 44, 46, 51, 53, 59]);
const KICKS = new Set([35, 36]);
const SNARES = new Set([37, 38, 39, 40]);
const MAX_CHANGED_HITS = 8;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value, places = 4) => Number(finite(value).toFixed(places));
const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
const average = (values, fallback = 0) => values.length
  ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
const beatOffset = (beat, barBeats) => ((beat % barBeats) + barBeats) % barBeats;
const isJazz = (song) => normalizeGenreId(song?.genre ?? song?.meta?.genre) === "jazz";

function isProtected(note) {
  const feature = String(note?.rhythmicFeature ?? "");
  return Boolean(
    note?.drumFillId || note?.transitionFeature || note?.transitionHandoffRole
    || note?.transitionHandoffId || note?.phraseAnchor || note?.resolutionRole
    || note?.ensembleAccent || note?.memoryRole || note?.motifHandoffRole
    || note?.jazzMemoryPocketRecall || note?.jazzMemoryColorRecall
    || note?.jazzMemoryGlobalRecall || note?.finalAssemblyRole
    || feature.includes("fill") || feature.includes("roll")
  );
}

function quarterAccentClass(note, barBeats) {
  const local = beatOffset(finite(note?.start), barBeats);
  const quarter = Math.round(local);
  if (quarter >= barBeats || Math.abs(local - quarter) > 0.13) return null;
  return quarter % 2 === 1 ? "backbeat" : "downbeat";
}

function drumTrack(song) {
  return (song?.tracks ?? []).find((track) => track.id === "drums") ?? null;
}

function barCount(song) {
  return Math.max(1, Math.round(finite(song?.meta?.bars, song?.bars ?? 1)));
}

function protectedBar(song, bar, notes, barBeats) {
  if (bar <= 0 || bar >= barCount(song) - 1) return true;
  if (notes.some(isProtected)) return true;
  return (song?.structure ?? []).some((section) => {
    const start = finite(section?.startBeat, finite(section?.startBar) * barBeats);
    const end = finite(section?.endBeat, start + finite(section?.bars, 1) * barBeats);
    const first = Math.floor(start / barBeats + 1e-6);
    const last = Math.max(first, Math.ceil(end / barBeats - 1e-6) - 1);
    return first === bar || last === bar;
  });
}

function measureBar(notes, bar, barBeats) {
  const cymbals = notes.filter((note) => CYMBALS.has(Number(note.pitch)));
  const accents = cymbals.filter((note) => quarterAccentClass(note, barBeats) === "backbeat");
  const anchors = cymbals.filter((note) => quarterAccentClass(note, barBeats) === "downbeat");
  return Object.freeze({
    bar,
    cymbalHits: cymbals.length,
    quarterAccentHits: accents.length,
    quarterAnchorHits: anchors.length,
    accentContrast: round(average(accents.map((note) => finite(note.velocity)))
      - average(anchors.map((note) => finite(note.velocity)))),
    viable: accents.length > 0 && anchors.length > 0,
  });
}

/**
 * Compact read-only Jazz groove observation, not a new critic.
 * Emits no individual copyrighted/source patterns; only aggregated metrics.
 */
export function analyzeJazzDrumExpression(song) {
  if (!isJazz(song)) return Object.freeze({ available: false, reason: "jazz-only" });
  const barBeats = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  const bars = barCount(song);
  const notes = drumTrack(song)?.notes ?? [];
  const bass = (song?.tracks ?? []).find((track) => track.id === "bass")?.notes ?? [];
  const byBar = Array.from({ length: bars }, (_, bar) => {
    const barNotes = notes.filter((note) => Math.floor(finite(note.start) / barBeats) === bar);
    return measureBar(barNotes, bar, barBeats);
  });
  const viable = byBar.filter((row) => row.viable);
  const kicks = notes.filter((note) => KICKS.has(Number(note.pitch)));
  const snares = notes.filter((note) => SNARES.has(Number(note.pitch)));
  const hats = notes.filter((note) => CYMBALS.has(Number(note.pitch)));
  const bassPocket = bass.length
    ? bass.filter((note) => kicks.some((kick) => Math.abs(finite(kick.start) - finite(note.start)) <= 0.10)).length / bass.length
    : 0;
  const meterDeviation = hats.length
    ? average(hats.map((note) => Math.abs(finite(note.start) - Math.round(finite(note.start) * 4) / 4)))
    : 0;
  const isFill = (note) => {
    const feature = String(note?.rhythmicFeature ?? "");
    return Boolean(note?.drumFillId || feature.includes("fill") || feature.includes("roll"));
  };
  const fills = new Set(notes.filter(isFill).map((note) => Math.floor(finite(note.start) / barBeats)));
  const densityCurve = Array.from({ length: bars }, (_, bar) =>
    notes.filter((note) => Math.floor(finite(note.start) / barBeats) === bar).length);
  const hatShapeKeys = Array.from({ length: bars }, (_, bar) => {
    const inBar = hats.filter((note) => Math.floor(finite(note.start) / barBeats) === bar);
    return inBar.map((note) => {
      const local = beatOffset(finite(note.start), barBeats);
      return `${Math.round(finite(note.pitch))}@${round(Math.round(local * 12) / 12, 4)}`;
    }).sort().join("|");
  }).filter(Boolean);
  const hatShapeDiversity = hatShapeKeys.length
    ? new Set(hatShapeKeys).size / hatShapeKeys.length : 0;
  // Only aggregated uniqueness counts are exported; exact event signatures
  // are local and discarded, so the diagnostic cannot reconstruct a song.
  const barSignatures = Array.from({ length: bars }, (_, bar) => {
    const inBar = notes.filter((note) => Math.floor(finite(note.start) / barBeats) === bar);
    return inBar.map((note) => `${Math.round(finite(note.pitch))}@${round(beatOffset(finite(note.start), barBeats), 3)}`)
      .sort().join("|");
  });
  const populatedSignatures = barSignatures.filter(Boolean);
  const fullBarUniqueness = populatedSignatures.length
    ? new Set(populatedSignatures).size / populatedSignatures.length : 0;
  // Shadow structural identity at a 1/12-beat lattice so harmless swing and
  // humanization do not masquerade as entirely different drum compositions.
  const structuralSignatures = Array.from({ length: bars }, (_, bar) => {
    const inBar = notes.filter((note) => Math.floor(finite(note.start) / barBeats) === bar);
    return inBar.map((note) => {
      const local = beatOffset(finite(note.start), barBeats);
      const quantized = round(Math.round(local * 12) / 12, 4);
      return `${Math.round(finite(note.pitch))}@${quantized}`;
    }).sort().join("|");
  }).filter(Boolean);
  const structuralBarUniqueness = structuralSignatures.length
    ? new Set(structuralSignatures).size / structuralSignatures.length : 0;
  const skeletonSignatures = Array.from({ length: bars }, (_, bar) => {
    const inBar = notes.filter((note) => Math.floor(finite(note.start) / barBeats) === bar
      && (KICKS.has(Number(note.pitch)) || SNARES.has(Number(note.pitch))));
    return inBar.map((note) => {
      const local = beatOffset(finite(note.start), barBeats);
      return `${Math.round(finite(note.pitch))}@${round(Math.round(local * 12) / 12, 4)}`;
    }).sort().join("|");
  }).filter(Boolean);
  const skeletonUniqueness = skeletonSignatures.length
    ? new Set(skeletonSignatures).size / skeletonSignatures.length : 0;
  const adjacentClones = populatedSignatures.length > 1
    ? populatedSignatures.slice(1).filter((value, index) => value === populatedSignatures[index]).length
      / (populatedSignatures.length - 1)
    : 0;
  const kickSnareCounts = Object.freeze({
    kicks: kicks.length, snares: snares.length,
    // Timekeeping and accents are assessed separately from raw hit quantity.
    backbeatOnsetRatio: round(snares.length
      ? snares.filter((note) => quarterAccentClass(note, barBeats) === "backbeat").length / snares.length
      : 0),
  });
  return Object.freeze({
    available: true, version: 1, authority: "jazz-drum-expression-shadow",
    bars, barBeats,
    velocityContrast: round(average(viable.map((row) => row.accentContrast))),
    evaluatedBars: viable.length,
    cymbalHits: hats.length,
    bassKickCoincidence: round(bassPocket),
    kickSnareCounts,
    protectedFillBars: fills.size,
    hatShapeDiversity: round(hatShapeDiversity),
    // Fixed-size aggregate curve only: no MIDI song, note sequence, or fingerprint is copied.
    densityCurve: Object.freeze(densityCurve),
    microtimingSpreadProxy: round(meterDeviation),
    fullBarUniqueness: round(fullBarUniqueness),
    structuralBarUniqueness: round(structuralBarUniqueness),
    kickSnareSkeletonUniqueness: round(skeletonUniqueness),
    adjacentCloneRatio: round(adjacentClones),
    possibleOvervariation: populatedSignatures.length >= 8 && structuralBarUniqueness >= 0.95,
    humanizedRepeatLikely: populatedSignatures.length >= 8
      && fullBarUniqueness >= 0.95 && structuralBarUniqueness < 0.8,
  });
}

/**
 * Proposes one small bar of ride/hat accents. A ghosted quarter (1/3) is
 * reduced by 4 velocity units, and a backbeat quarter (2/4) gains 8 units.
 * No extra notes, timing rewrites, chord changes, or drum-skeleton changes.
 */
export function createJazzDrumExpressionCandidate(song) {
  if (!isJazz(song) || !drumTrack(song)?.notes?.length) return null;
  const beatsPerBar = Math.max(1, finite(song?.meta?.beatsPerBar, 4));
  if (beatsPerBar !== 4) return null;
  const drums = drumTrack(song).notes;
  const bars = [];
  for (let bar = 1; bar < barCount(song) - 1; bar += 1) {
    const indexed = drums.map((note, index) => ({ note, index }))
      .filter(({ note }) => Math.floor(finite(note.start) / beatsPerBar) === bar);
    if (protectedBar(song, bar, indexed.map(({ note }) => note), beatsPerBar)) continue;
    const accents = indexed.filter(({ note }) => CYMBALS.has(Number(note.pitch))
      && !isProtected(note) && quarterAccentClass(note, beatsPerBar) === "backbeat");
    const anchors = indexed.filter(({ note }) => CYMBALS.has(Number(note.pitch))
      && !isProtected(note) && quarterAccentClass(note, beatsPerBar) === "downbeat");
    if (!accents.length || !anchors.length) continue;
    const measured = measureBar(indexed.map(({ note }) => note), bar, beatsPerBar);
    // Avoid repeated exaggerated backbeat emphasis. Preserve good existing dynamics.
    if (measured.accentContrast >= 12) continue;
    bars.push({ bar, measured, accents, anchors });
  }
  if (!bars.length) return null;
  bars.sort((a, b) => a.measured.accentContrast - b.measured.accentContrast || a.bar - b.bar);
  const selected = bars[0];
  const changes = new Map();
  for (const { note, index } of [...selected.accents, ...selected.anchors]) {
    if (changes.size >= MAX_CHANGED_HITS) break;
    const before = Math.round(finite(note.velocity, 80));
    const emphasized = quarterAccentClass(note, beatsPerBar) === "backbeat";
    const after = clamp(before + (emphasized ? 8 : -4), 28, 112);
    if (after !== before) changes.set(index, after);
  }
  if (!changes.size) return null;

  const candidate = cloneValue(song);
  const drumNotes = drumTrack(candidate).notes;
  for (const [index, velocity] of changes) drumNotes[index].velocity = velocity;
  const beforeReport = analyzeJazzDrumExpression(song);
  const afterReport = analyzeJazzDrumExpression(candidate);
  const contrastDelta = afterReport.velocityContrast - beforeReport.velocityContrast;
  if (contrastDelta <= 0) return null;
  return Object.freeze({
    id: `jazz-drum-expression:bar-${selected.bar}`,
    song: candidate,
    targetBar: selected.bar,
    changedNotes: changes.size,
    contrastBefore: beforeReport.velocityContrast,
    contrastAfter: afterReport.velocityContrast,
    contrastDelta: round(contrastDelta),
  });
}

const rejected = (reason, details = {}) => Object.freeze({
  attempted: false, accepted: false, changed: false, reason, ...details,
});

/**
 * The existing score and release gate own final acceptance.
 * Strict mutation-authority checks in the stage runner permit velocity ONLY.
 */
export function applyJazzDrumExpressionRefinement(song, config = {}, evaluate, releaseGate) {
  if (config.jazzDrumExpressionRefinement !== true) {
    return { song, diagnostics: rejected("disabled") };
  }
  if (!isJazz(song)) return { song, diagnostics: rejected("genre-not-targeted") };
  if (typeof evaluate !== "function" || typeof releaseGate !== "function") {
    throw new TypeError("Jazz drum expression requires the existing critic and release gate");
  }
  const candidate = createJazzDrumExpressionCandidate(song);
  if (!candidate) return { song, diagnostics: rejected("no-eligible-jazz-expression-bar") };
  const before = evaluate(song);
  const after = evaluate(candidate.song);
  const release = releaseGate(candidate.song, after);
  const protectedDeltas = Object.fromEntries(
    Object.entries(before?.subscores ?? {}).map(([key, value]) => [
      key, finite(after?.subscores?.[key]) - finite(value),
    ]),
  );
  const criticSafe = Object.values(protectedDeltas).every((delta) => delta >= 0)
    && finite(after.score) >= finite(before.score);
  const beforeCoherence = evaluateCrossAuthorityCoherence(song);
  const afterCoherence = evaluateCrossAuthorityCoherence(candidate.song);
  const coherenceSafe = !(afterCoherence?.issues ?? [])
    .some((issue) => !(beforeCoherence?.issues ?? []).includes(issue))
    && finite(afterCoherence?.score) >= finite(beforeCoherence?.score)
    && finite(afterCoherence?.grooveLock?.timingViolations) <= finite(beforeCoherence?.grooveLock?.timingViolations)
    && finite(afterCoherence?.grooveLock?.protectedSpaceViolations) <= finite(beforeCoherence?.grooveLock?.protectedSpaceViolations);
  const scaleSafe = finite(after?.diagnostics?.scaleFit, 0) >= 0.999999;
  const accepted = Boolean(release?.passed && scaleSafe && criticSafe && coherenceSafe
    && candidate.contrastDelta > 0 && candidate.changedNotes <= MAX_CHANGED_HITS);
  const diagnostics = Object.freeze({
    attempted: true, accepted, changed: accepted,
    reason: accepted ? "jazz-drum-expression-win"
      : !release?.passed ? "release-gate"
        : !scaleSafe ? "scale-safety"
          : !coherenceSafe ? "coherence-regression"
            : !criticSafe ? "critic-regression" : "no-expression-gain",
    candidateId: candidate.id, changedNotes: candidate.changedNotes,
    targetBar: candidate.targetBar,
    contrastBefore: candidate.contrastBefore,
    contrastAfter: candidate.contrastAfter,
    contrastDelta: candidate.contrastDelta,
    beforeScore: finite(before?.score), afterScore: finite(after?.score),
    protectedDeltas,
    candidateLimit: 1,
    candidatesEvaluated: 1,
  });
  if (!accepted) return { song, diagnostics };
  candidate.song.outputQualityEvolution = {
    ...(candidate.song.outputQualityEvolution ?? {}),
    jazzDrumExpressionRefinement: {
      accepted: true, changedNotes: candidate.changedNotes,
      contrastDelta: candidate.contrastDelta,
    },
  };
  return { song: candidate.song, diagnostics };
}
