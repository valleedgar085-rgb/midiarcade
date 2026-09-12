import {
  createProducerSearchPolicy,
  createProductionPriorities,
  normalizeProducerCharacter,
  normalizeProducerKind,
  normalizeProducerTaste,
  normalizeThinkingDepth,
  roundProducerValue,
} from "./producer-policy.js";

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
  const normalizedKind = normalizeProducerKind(kind);
  const depth = normalizeThinkingDepth(config.thinkingDepth);
  const resolvedCharacter = normalizeProducerCharacter(character);
  const resolvedTaste = normalizeProducerTaste(taste);
  const search = createProducerSearchPolicy(config, normalizedKind, depth);
  const priorities = createProductionPriorities(resolvedCharacter, resolvedTaste, normalizedKind);
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
      confidence: roundProducerValue(resolvedTaste.confidence),
      genreAffinity: roundProducerValue(resolvedTaste.genreAffinity),
      rejectionPressure: roundProducerValue(resolvedTaste.rejectionPressure),
      learnedEnergy: resolvedTaste.energy == null ? null : roundProducerValue(resolvedTaste.energy),
      learnedComplexity: resolvedTaste.complexity == null ? null : roundProducerValue(resolvedTaste.complexity),
      learnedVariation: resolvedTaste.variation == null ? null : roundProducerValue(resolvedTaste.variation),
    }),
    priorities,
    qualityIntent,
  });
}

/**
 * Convert producer intent into the existing engine knobs. This deliberately
 * preserves explicit user/benchmark controls and does not change executor
 * result shapes or bypass the engine's critic and key-safety contracts.
 */
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
