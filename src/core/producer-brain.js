import { createCreativeGenome } from "./creative-genome.js";
import {
  applyCreativeGenomeSteering,
  isCreativeGenomeFusionProtected,
} from "./creative-genome-steering.js";
import {
  createProducerSearchPolicy,
  createProductionPriorities,
  normalizeProducerCharacter,
  normalizeProducerKind,
  normalizeProducerTaste,
  normalizeThinkingDepth,
  roundProducerValue,
} from "./producer-policy.js";
import { createSongBlueprint } from "./producer-blueprint.js";

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
  consumeCreativeGenome = false,
} = {}) {
  const normalizedKind = normalizeProducerKind(kind);
  const depth = normalizeThinkingDepth(config.thinkingDepth);
  const resolvedCharacter = normalizeProducerCharacter(character);
  const resolvedTaste = normalizeProducerTaste(taste);
  const search = createProducerSearchPolicy(config, normalizedKind, depth);
  const priorities = createProductionPriorities(resolvedCharacter, resolvedTaste, normalizedKind);
  const blueprint = createSongBlueprint(config, {
    kind: normalizedKind,
    character: resolvedCharacter,
    taste: resolvedTaste,
    priorities,
  });
  const creativeGenome = createCreativeGenome(config, {
    kind: normalizedKind,
    consumedByComposition: consumeCreativeGenome,
  });
  const qualityIntent = Object.freeze({
    preserveKeySafety: true,
    preserveDeterminism: true,
    preserveCriticCalibration: true,
    preferReleaseGatePass: true,
    diagnoseWeakestDimension: search.weaknessAwareSearch,
    preferSurgicalRepair: search.targetedRepair,
    avoidBackToBackIdentity: normalizedKind === "new",
    preserveSongFamily: normalizedKind !== "new",
  });
  const adaptiveLoop = Object.freeze({
    enabled: search.adaptive,
    stages: Object.freeze(["plan", "compose", "diagnose", "repair", "compare", "finalize"]),
    diagnoseWeakestDimension: search.weaknessAwareSearch,
    targetedRepair: search.targetedRepair,
    maxRepairPasses: search.repairAttempts,
    compareBeforeCommit: true,
  });

  return Object.freeze({
    version: 2,
    id: "producer-brain-v2",
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
    blueprint,
    creativeGenome,
    adaptiveLoop,
    qualityIntent,
  });
}

/**
 * Convert producer intent into the existing engine knobs. Phase 9B consumes
 * only Creative Genome Energy Arc + Space Strategy, through bounded priors.
 * Audible Genome steering is opt-in until its UI phase: an explicit
 * `creativeRange` or `creativeGenomeSteering: true` activates it. Ordinary
 * calibrated requests remain bit-for-bit compatible. Fusion calibration,
 * candidate ceilings and the engine's critic/release authority remain intact.
 */
export function applyProducerBrainConfig(config = {}, options = {}) {
  const source = config && typeof config === "object" && !Array.isArray(config) ? { ...config } : {};
  const protectedFusion = isCreativeGenomeFusionProtected(source);
  const explicitRange = source.creativeRange != null && String(source.creativeRange).trim() !== "";
  const defaultConsumption = source.creativeGenomeSteering === true
    || (source.creativeGenomeSteering !== false && explicitRange);
  const requestedConsumption = options.consumeCreativeGenome ?? defaultConsumption;
  const consumeCreativeGenome = Boolean(requestedConsumption) && !protectedFusion;
  const plan = createProducerBrainPlan(source, {
    ...options,
    consumeCreativeGenome,
  });
  const steering = applyCreativeGenomeSteering(source, plan.creativeGenome, {
    kind: plan.kind,
    enabled: Boolean(requestedConsumption),
  });
  const out = {
    ...steering.config,
    thinkingDepth: source.thinkingDepth ?? plan.search.depth,
    adaptiveCandidates: source.adaptiveCandidates ?? plan.search.adaptive,
    weaknessAwareSearch: source.weaknessAwareSearch ?? plan.search.weaknessAwareSearch,
    targetedRepair: source.targetedRepair ?? plan.search.targetedRepair,
    repairAttempts: source.repairAttempts ?? plan.search.repairAttempts,
    producerBrain: plan,
    creativeGenomeSteering: steering.diagnostics,
  };
  if (plan.kind === "songVariations" && source.candidatesPerVariation == null) {
    out.candidatesPerVariation = plan.search.candidatesPerVariation;
  }
  return out;
}
