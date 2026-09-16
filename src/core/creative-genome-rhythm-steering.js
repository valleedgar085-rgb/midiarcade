import { isCreativeGenomeFusionProtected } from "./creative-genome-steering.js";

export const CREATIVE_GENOME_RHYTHM_STEERING_VERSION = 1;

const RHYTHM_STEERING = Object.freeze({
  locked: Object.freeze({ syncopation: -0.018, swing: -0.006, humanize: -0.008 }),
  "laid-back": Object.freeze({ syncopation: -0.004, swing: 0.014, humanize: 0.018 }),
  "push-pull": Object.freeze({ syncopation: 0.016, swing: 0.01, humanize: 0.014 }),
  syncopated: Object.freeze({ syncopation: 0.03, swing: 0.006, humanize: 0.01, drumFills: 0.006 }),
  interlocking: Object.freeze({ syncopation: 0.024, swing: 0.004, humanize: 0.008, drumFills: 0.012 }),
});

const PERFORMANCE_STEERING = Object.freeze({
  tight: Object.freeze({ humanize: -0.02, swing: -0.004 }),
  "laid-back": Object.freeze({ humanize: 0.018, swing: 0.014 }),
  pushed: Object.freeze({ humanize: 0.008, syncopation: 0.01, swing: -0.002 }),
  ghosted: Object.freeze({ humanize: 0.016, drumFills: 0.01 }),
  clipped: Object.freeze({ humanize: -0.008, drumFills: -0.006 }),
  legato: Object.freeze({ humanize: 0.01, swing: 0.004 }),
});

const RANGE_STRENGTH = Object.freeze({ familiar: 0.55, fresh: 1, wild: 1.28 });
const KIND_STRENGTH = Object.freeze({ new: 1, similar: 0.35, songVariations: 0.58 });
const SCALAR_BOUNDS = Object.freeze({
  syncopation: Object.freeze([0, 1, 0.5]),
  swing: Object.freeze([0, 0.72, 0]),
  humanize: Object.freeze([0, 0.72, 0.12]),
  drumFills: Object.freeze([0, 1, 0.4]),
});

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

function combinedDelta(rhythm, performance, key) {
  return finite(rhythm?.[key]) + finite(performance?.[key]);
}

/**
 * Phase 9F consumes Creative Genome Rhythm Topology + Performance Feel through
 * the engine's existing syncopation, swing, humanize and fill controls. It is
 * intentionally a bounded prior layer: no direct note mutation, new timing
 * engine, candidate-budget expansion, critic relaxation, or export rewrite.
 */
export function applyCreativeGenomeRhythmSteering(config = {}, genome = null, {
  kind = "new",
  enabled = true,
} = {}) {
  const source = cloneRecord(config);
  const protectedFusion = isCreativeGenomeFusionProtected(source);
  if (!enabled || !genome || protectedFusion) {
    return Object.freeze({
      config: source,
      diagnostics: Object.freeze({
        version: CREATIVE_GENOME_RHYTHM_STEERING_VERSION,
        applied: false,
        reason: !enabled ? "disabled" : !genome ? "missing-genome" : "fusion-contract-protected",
        rhythmTopology: genome?.rhythmTopology ?? null,
        performanceFeel: genome?.performanceFeel ?? null,
        strength: 0,
        scalarDeltas: Object.freeze({}),
      }),
    });
  }

  const rhythm = RHYTHM_STEERING[genome.rhythmTopology] ?? {};
  const performance = PERFORMANCE_STEERING[genome.performanceFeel] ?? {};
  const rangeStrength = RANGE_STRENGTH[genome.creativeRange] ?? RANGE_STRENGTH.fresh;
  const kindStrength = KIND_STRENGTH[kind] ?? 1;
  const strength = round(rangeStrength * kindStrength);
  const out = { ...source };
  const scalarDeltas = {};

  for (const [key, [min, max, fallback]] of Object.entries(SCALAR_BOUNDS)) {
    const delta = round(combinedDelta(rhythm, performance, key) * strength);
    if (Math.abs(delta) <= 1e-9) continue;
    const before = finite(source[key], fallback);
    out[key] = round(clamp(before + delta, min, max));
    scalarDeltas[key] = round(out[key] - before);
  }

  return Object.freeze({
    config: out,
    diagnostics: Object.freeze({
      version: CREATIVE_GENOME_RHYTHM_STEERING_VERSION,
      applied: true,
      reason: "rhythm-performance-priors",
      genomeSignature: genome.signature ?? null,
      rhythmTopology: genome.rhythmTopology ?? null,
      performanceFeel: genome.performanceFeel ?? null,
      creativeRange: genome.creativeRange ?? "fresh",
      kind,
      strength,
      scalarDeltas: Object.freeze({ ...scalarDeltas }),
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
