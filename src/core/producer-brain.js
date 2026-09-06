const SUPPORTED_KINDS = Object.freeze(new Set(["new", "similar", "songVariations"]));
const MAX_ENGINE_CANDIDATES = 12;
const STANDARD_BASE_CANDIDATES = 4;
const DEEP_BASE_CANDIDATES = 6;
const STANDARD_ADAPTIVE_CANDIDATES = 3;
const DEEP_ADAPTIVE_CANDIDATES = 4;
const MAX_REPAIR_ATTEMPTS = 2;

function finite(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, finite(value, min)));
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function normalizeKind(kind) {
  return SUPPORTED_KINDS.has(String(kind)) ? String(kind) : "new";
}

function normalizeDepth(value) {
  return value === "standard" ? "standard" : "deep";
}

function normalizedCharacter(character = {}) {
  return Object.freeze({
    grooveDepth: clamp(character.grooveDepth, 0, 1),
    bassMotion: clamp(character.bassMotion, 0, 1),
    melodyMotion: clamp(character.melodyMotion, 0, 1),
    harmonicColor: clamp(character.harmonicColor, 0, 1),
    space: clamp(character.space, 0, 1),
  });
}

function normalizedTaste(taste = {}) {
  const nullable = (value) => Number.isFinite(Number(value)) ? clamp(value, 0, 1) : null;
  return Object.freeze({
    confidence: clamp(taste.confidence, 0, 1),
    energy: nullable(taste.energy),
    complexity: nullable(taste.complexity),
    variation: nullable(taste.variation),
    genreAffinity: clamp(taste.genreAffinity, -1, 1),
    rejectionPressure: clamp(taste.rejectionPressure, 0, 1),
  });
}

function searchPolicy(config, kind, depth) {
  const explicitCandidateCount = Number.isFinite(Number(config.candidateCount));
  const baseCandidateCount = explicitCandidateCount
    ? clamp(Math.round(finite(config.candidateCount, 1)), 1, MAX_ENGINE_CANDIDATES)
    : depth === "deep" ? DEEP_BASE_CANDIDATES : STANDARD_BASE_CANDIDATES;
  const adaptive = !explicitCandidateCount && config.adaptiveCandidates !== false;
  const adaptiveExpansion = adaptive
    ? depth === "deep" ? DEEP_ADAPTIVE_CANDIDATES : STANDARD_ADAPTIVE_CANDIDATES
    : 0;
  const maxCandidateCount = Math.min(MAX_ENGINE_CANDIDATES, baseCandidateCount + adaptiveExpansion);
  const targetedRepair = adaptive && config.targetedRepair !== false;
  const repairAttempts = targetedRepair
    ? clamp(Math.round(finite(config.repairAttempts, MAX_REPAIR_ATTEMPTS)), 0, MAX_REPAIR_ATTEMPTS)
    : 0;
  const candidatesPerVariation = kind === "songVariations"
    ? clamp(Math.round(finite(config.candidatesPerVariation, depth === "deep" ? 3 : 2)), 1, 4)
    : null;

  return Object.freeze({
    depth,
    adaptive,
    targetedRepair,
    repairAttempts,
    baseCandidateCount,
    maxCandidateCount,
    candidatesPerVariation,
    wholeSongAuditions: kind === "songVariations" ? candidatesPerVariation * 3 : maxCandidateCount + repairAttempts,
  });
}

function productionPriorities(character, taste, kind) {
  const entries = [
    ["groove", round(character.grooveDepth * 0.58 + character.bassMotion * 0.42)],
    ["hook", round(character.melodyMotion)],
    ["harmony", round(character.harmonicColor)],
    ["space", round(character.space)],
  ];
  const confidence = taste.confidence;
  const variationPreference = taste.variation == null ? 0.5 : taste.variation;
  entries.push(["novelty", round(clamp(
    (kind === "new" ? 0.72 : kind === "similar" ? 0.48 : 0.6)
      + (variationPreference - 0.5) * confidence * 0.18
      + taste.rejectionPressure * confidence * 0.08,
    0.32,
    0.92,
  ))]);
  return Object.freeze(entries
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([id, weight]) => Object.freeze({ id, weight })));
}

/**
 * Producer Brain is an orchestration layer, not a second composition engine.
 * It decides how deeply to audition, whether to expand/repair, and which
 * musical priorities should steer the request. The calibrated engine remains
 * authoritative for notes, harmony, candidate scoring and final selection.
 */
export function createProducerBrainPlan(config = {}, {
  kind = "new",
  character = {},
  taste = {},
} = {}) {
  const normalizedKind = normalizeKind(kind);
  const depth = normalizeDepth(config.thinkingDepth);
  const resolvedCharacter = normalizedCharacter(character);
  const resolvedTaste = normalizedTaste(taste);
  const search = searchPolicy(config, normalizedKind, depth);
  const priorities = productionPriorities(resolvedCharacter, resolvedTaste, normalizedKind);
  const qualityIntent = Object.freeze({
    preserveKeySafety: true,
    preserveDeterminism: true,
    preserveCriticCalibration: true,
    preferReleaseGatePass: true,
    avoidBackToBackIdentity: normalizedKind === "new",
    preserveSongFamily: normalizedKind !== "new",
  });

  return Object.freeze({
    version: 1,
    id: "producer-brain-v1",
    kind: normalizedKind,
    mode: depth === "deep" ? "deep-audition" : "balanced-audition",
    search,
    taste: Object.freeze({
      confidence: round(resolvedTaste.confidence),
      genreAffinity: round(resolvedTaste.genreAffinity),
      rejectionPressure: round(resolvedTaste.rejectionPressure),
    }),
    priorities,
    qualityIntent,
  });
}

export function applyProducerBrainConfig(config = {}, options = {}) {
  const source = config && typeof config === "object" && !Array.isArray(config) ? { ...config } : {};
  const plan = createProducerBrainPlan(source, options);
  const out = {
    ...source,
    thinkingDepth: source.thinkingDepth ?? plan.search.depth,
    adaptiveCandidates: source.adaptiveCandidates ?? plan.search.adaptive,
    targetedRepair: source.targetedRepair ?? plan.search.targetedRepair,
    repairAttempts: source.repairAttempts ?? plan.search.repairAttempts,
    producerBrain: plan,
  };
  if (plan.kind === "songVariations" && source.candidatesPerVariation == null) {
    out.candidatesPerVariation = plan.search.candidatesPerVariation;
  }
  return out;
}

function decorateSong(song, plan, variationIndex = null) {
  if (!song || typeof song !== "object") return song;
  const direction = song.variationSet?.direction?.id ?? null;
  return {
    ...song,
    meta: {
      ...(song.meta ?? {}),
      producerBrain: variationIndex == null
        ? plan
        : {
          ...plan,
          variationSelection: Object.freeze({
            index: variationIndex,
            direction,
            candidatesAuditioned: song.variationSet?.candidatesAuditioned ?? plan.search.candidatesPerVariation,
          }),
        },
    },
  };
}

/** Attach the exact brain plan used for a request to the committed result. */
export function decorateProducerBrainResult(result, plan) {
  if (!plan || !result || typeof result !== "object") return result;
  const decorated = { ...result, producerBrain: plan };
  if (result.song) decorated.song = decorateSong(result.song, plan);
  if (Array.isArray(result.variations)) {
    decorated.variations = result.variations.map((song, index) => decorateSong(song, plan, index));
  }
  return decorated;
}
