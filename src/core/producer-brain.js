import { createCreativeGenome } from "./creative-genome.js";
import {
  resolveCreativeGenomeMotifStrategy,
} from "./creative-genome-motif-steering.js";
import {
  applyCreativeGenomeRhythmSteering,
} from "./creative-genome-rhythm-steering.js";
import {
  applyCreativeGenomeSteering,
  isCreativeGenomeFusionProtected,
} from "./creative-genome-steering.js";
import {
  applyCreativeGenomeSurpriseSteering,
} from "./creative-genome-surprise-steering.js";
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
 * Energy Arc + Space Strategy through bounded priors; Phase 9C resolves Motif
 * Mutation + Spotlight Rotation into explicit bounded engine strategy tokens;
 * Phase 9F consumes Rhythm Topology + Performance Feel through the existing
 * syncopation/swing/humanize controls; Phase 9G consumes Surprise Budget through
 * the existing surprise control. Audible Genome steering activates only for an
 * explicit `creativeRange` or `creativeGenomeSteering: true`. Ordinary calibrated
 * requests remain bit-for-bit compatible. Fusion calibration, candidate ceilings
 * and the engine's critic/release authority remain intact.
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
  const rhythmSteering = applyCreativeGenomeRhythmSteering(steering.config, plan.creativeGenome, {
    kind: plan.kind,
    enabled: Boolean(requestedConsumption),
  });
  const surpriseSteering = applyCreativeGenomeSurpriseSteering(rhythmSteering.config, plan.creativeGenome, {
    kind: plan.kind,
    enabled: Boolean(requestedConsumption),
  });
  const motifSteering = resolveCreativeGenomeMotifStrategy(source, plan.creativeGenome, {
    kind: plan.kind,
    enabled: Boolean(requestedConsumption),
  });
  const motifStrategy = motifSteering.strategy;
  const out = {
    ...surpriseSteering.config,
    thinkingDepth: source.thinkingDepth ?? plan.search.depth,
    adaptiveCandidates: source.adaptiveCandidates ?? plan.search.adaptive,
    weaknessAwareSearch: source.weaknessAwareSearch ?? plan.search.weaknessAwareSearch,
    targetedRepair: source.targetedRepair ?? plan.search.targetedRepair,
    repairAttempts: source.repairAttempts ?? plan.search.repairAttempts,
    producerBrain: plan,
    creativeGenomeSteering: steering.diagnostics,
    creativeGenomeRhythmSteering: rhythmSteering.diagnostics,
    creativeGenomeSurpriseSteering: surpriseSteering.diagnostics,
    creativeGenomeMotifSteering: motifSteering.diagnostics,
    ...(motifStrategy ? {
      creativeMotifMutation: motifStrategy.motifMutation,
      creativeSpotlightRotation: motifStrategy.spotlightRotation,
      creativeMotifStrength: motifStrategy.strength,
      creativeMotifMaxEvents: motifStrategy.maxMutationEvents,
    } : {}),
  };
  if (plan.kind === "songVariations" && source.candidatesPerVariation == null) {
    out.candidatesPerVariation = plan.search.candidatesPerVariation;
  }
  return out;
}
