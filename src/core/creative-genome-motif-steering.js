import { isCreativeGenomeFusionProtected } from "./creative-genome-steering.js";

export const CREATIVE_GENOME_MOTIF_STEERING_VERSION = 1;

const RANGE_STRENGTH = Object.freeze({ familiar: 0.55, fresh: 1, wild: 1.28 });
const KIND_STRENGTH = Object.freeze({ new: 1, similar: 0.35, songVariations: 0.58 });
const MOTIF_MUTATIONS = new Set([
  "literal-recall",
  "answer",
  "rhythmic-mutation",
  "truncate-expand",
  "instrument-handoff",
  "contour-rewrite",
]);
const SPOTLIGHT_ROTATIONS = new Set([
  "lead-led",
  "bass-to-lead",
  "chords-to-lead",
  "counterpoint-to-hook",
  "section-rotation",
]);

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function validToken(value, values, fallback) {
  const token = String(value ?? "").trim();
  return values.has(token) ? token : fallback;
}

/**
 * Phase 9C resolves Creative Genome motif/spotlight intent into two explicit,
 * bounded engine tokens. It never rewrites MIDI, widens candidate/repair
 * budgets, or bypasses the existing orchestration, motif-memory, critic,
 * release, and scale-safety stages.
 */
export function resolveCreativeGenomeMotifStrategy(config = {}, genome = null, {
  kind = "new",
  enabled = true,
} = {}) {
  const protectedFusion = isCreativeGenomeFusionProtected(config);
  if (!enabled || !genome || protectedFusion) {
    return Object.freeze({
      strategy: null,
      diagnostics: Object.freeze({
        version: CREATIVE_GENOME_MOTIF_STEERING_VERSION,
        applied: false,
        reason: !enabled ? "disabled" : !genome ? "missing-genome" : "fusion-contract-protected",
        motifMutation: genome?.motifMutation ?? null,
        spotlightRotation: genome?.spotlightRotation ?? null,
        strength: 0,
        maxMutationEvents: 0,
      }),
    });
  }

  const creativeRange = validToken(genome.creativeRange, new Set(Object.keys(RANGE_STRENGTH)), "fresh");
  const normalizedKind = validToken(kind, new Set(Object.keys(KIND_STRENGTH)), "new");
  const strength = round((RANGE_STRENGTH[creativeRange] ?? 1) * (KIND_STRENGTH[normalizedKind] ?? 1));
  const motifMutation = validToken(genome.motifMutation, MOTIF_MUTATIONS, "literal-recall");
  let spotlightRotation = validToken(genome.spotlightRotation, SPOTLIGHT_ROTATIONS, "section-rotation");

  // An explicit instrument-handoff mutation must have a rotating return lane;
  // otherwise the semantic request could collapse to a metadata-only no-op.
  if (motifMutation === "instrument-handoff" && spotlightRotation === "lead-led") {
    spotlightRotation = "section-rotation";
  }

  const maxMutationEvents = motifMutation === "literal-recall" || motifMutation === "instrument-handoff"
    ? 0
    : strength < 0.45 ? 1 : 2;

  const strategy = Object.freeze({
    motifMutation,
    spotlightRotation,
    strength,
    maxMutationEvents,
  });
  return Object.freeze({
    strategy,
    diagnostics: Object.freeze({
      version: CREATIVE_GENOME_MOTIF_STEERING_VERSION,
      applied: true,
      reason: "motif-spotlight-strategy",
      genomeSignature: genome.signature ?? null,
      creativeRange,
      kind: normalizedKind,
      motifMutation,
      requestedSpotlightRotation: genome.spotlightRotation ?? null,
      spotlightRotation,
      strength,
      maxMutationEvents,
      preserves: Object.freeze({
        seed: config.seed ?? null,
        key: config.key ?? null,
        scale: config.scale ?? config.mode ?? null,
        bars: config.bars ?? null,
        candidateCount: config.candidateCount ?? null,
        repairAttempts: config.repairAttempts ?? null,
      }),
    }),
  });
}
