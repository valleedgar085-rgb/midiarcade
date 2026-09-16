import { isCreativeGenomeFusionProtected } from "./creative-genome-steering.js";

export const CREATIVE_GENOME_SURPRISE_STEERING_VERSION = 1;

const BUDGET_DELTAS = Object.freeze({
  0: -0.028,
  1: 0,
  2: 0.04,
});
const RANGE_STRENGTH = Object.freeze({ familiar: 0.55, fresh: 1, wild: 1.28 });
const KIND_STRENGTH = Object.freeze({ new: 1, similar: 0.35, songVariations: 0.58 });

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, finite(value, min)));
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function cloneRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
}

function surpriseBudget(value) {
  return Math.max(0, Math.min(2, Math.round(finite(value, 1))));
}

/**
 * Phase 9G consumes the Creative Genome Surprise Budget through the existing
 * `surprise` composition control. It remains a bounded prior layer: there is no
 * direct note mutation, candidate-budget expansion, critic relaxation, repair
 * expansion, or MIDI/export rewrite.
 */
export function applyCreativeGenomeSurpriseSteering(config = {}, genome = null, {
  kind = "new",
  enabled = true,
} = {}) {
  const source = cloneRecord(config);
  const protectedFusion = isCreativeGenomeFusionProtected(source);
  if (!enabled || !genome || protectedFusion) {
    return Object.freeze({
      config: source,
      diagnostics: Object.freeze({
        version: CREATIVE_GENOME_SURPRISE_STEERING_VERSION,
        applied: false,
        reason: !enabled ? "disabled" : !genome ? "missing-genome" : "fusion-contract-protected",
        surpriseBudget: genome?.surpriseBudget ?? null,
        strength: 0,
        surpriseDelta: 0,
      }),
    });
  }

  const budget = surpriseBudget(genome.surpriseBudget);
  const creativeRange = String(genome.creativeRange ?? "fresh");
  const normalizedKind = String(kind ?? "new");
  const rangeStrength = RANGE_STRENGTH[creativeRange] ?? RANGE_STRENGTH.fresh;
  const kindStrength = KIND_STRENGTH[normalizedKind] ?? 1;
  const strength = round(rangeStrength * kindStrength);
  const requestedDelta = round((BUDGET_DELTAS[budget] ?? 0) * strength);
  const before = finite(source.surprise, 0.28);
  const after = round(clamp(before + requestedDelta, 0, 1));
  const surpriseDelta = round(after - before);

  return Object.freeze({
    config: { ...source, surprise: after },
    diagnostics: Object.freeze({
      version: CREATIVE_GENOME_SURPRISE_STEERING_VERSION,
      applied: true,
      reason: "surprise-budget-prior",
      genomeSignature: genome.signature ?? null,
      creativeRange,
      kind: normalizedKind,
      surpriseBudget: budget,
      strength,
      surpriseBefore: round(before),
      surpriseAfter: after,
      surpriseDelta,
      preserves: Object.freeze({
        seed: source.seed ?? null,
        key: source.key ?? null,
        scale: source.scale ?? source.mode ?? null,
        bars: source.bars ?? null,
        candidateCount: source.candidateCount ?? null,
        repairAttempts: source.repairAttempts ?? null,
      }),
    }),
  });
}
