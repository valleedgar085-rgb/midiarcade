export const CREATIVE_GENOME_VERSION = 1;

const RANGE = new Set(["familiar", "fresh", "wild"]);
const FORM_ARCHETYPES = Object.freeze({
  pop: Object.freeze(["hook-first", "double-peak", "verse-story", "slow-bloom", "breakdown-return"]),
  hipHop: Object.freeze(["verse-story", "hook-first", "loop-evolution", "double-peak", "breakdown-return"]),
  rap: Object.freeze(["verse-story", "hook-first", "loop-evolution", "breakdown-return", "double-peak"]),
  house: Object.freeze(["double-peak", "slow-bloom", "loop-evolution", "breakdown-return", "hook-first"]),
  techno: Object.freeze(["slow-bloom", "loop-evolution", "double-peak", "breakdown-return", "hook-first"]),
  drumBass: Object.freeze(["double-peak", "breakdown-return", "slow-bloom", "hook-first", "loop-evolution"]),
  ambient: Object.freeze(["slow-bloom", "loop-evolution", "verse-story", "double-peak", "breakdown-return"]),
  default: Object.freeze(["hook-first", "verse-story", "double-peak", "slow-bloom", "breakdown-return", "loop-evolution"]),
});

const ENERGY_ARCS = Object.freeze(["rising", "early-peak", "two-waves", "valley-payoff", "hypnotic-flat"]);
const RHYTHM_TOPOLOGIES = Object.freeze(["locked", "laid-back", "push-pull", "syncopated", "interlocking"]);
const SPACE_STRATEGIES = Object.freeze(["continuous-bed", "breathing", "strategic-dropouts", "vacuum-before-payoff", "sectional-reset"]);
const MOTIF_MUTATIONS = Object.freeze(["literal-recall", "answer", "rhythmic-mutation", "truncate-expand", "instrument-handoff", "contour-rewrite"]);
const HARMONIC_MOTIONS = Object.freeze(["static-vamp", "functional", "modal-drift", "pedal-point", "descending-motion"]);
const SPOTLIGHT_ROTATIONS = Object.freeze(["lead-led", "bass-to-lead", "chords-to-lead", "counterpoint-to-hook", "section-rotation"]);
const REGISTER_ARCS = Object.freeze(["stable", "low-to-high", "chorus-lift", "narrow-to-wide", "expanding-return"]);
const PERFORMANCE_FEELS = Object.freeze(["tight", "laid-back", "pushed", "ghosted", "clipped", "legato"]);
const RETURN_STRATEGIES = Object.freeze(["bigger-return", "stripped-return", "instrument-swap", "rhythmic-recall", "register-lift"]);
const CONTRAST_TYPES = Object.freeze(["rhythmic", "harmonic", "instrumental", "register", "silence"]);

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, finite(value, min)));
}

function hash32(value) {
  const text = String(value ?? "");
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

function unit(seed, salt) {
  return hash32(`${seed}:${salt}`) / 0xffffffff;
}

function pick(values, seed, salt, range = "fresh") {
  if (!values.length) return null;
  const visibleLength = range === "familiar"
    ? Math.max(1, Math.ceil(values.length * 0.6))
    : values.length;
  return values[hash32(`${seed}:${salt}`) % visibleLength];
}

function normalizeRange(value) {
  const normalized = String(value ?? "fresh").trim().toLowerCase();
  return RANGE.has(normalized) ? normalized : "fresh";
}

function normalizedGenre(config = {}) {
  return String(config.genre ?? "pop").trim() || "pop";
}

function formPool(genre, range) {
  const base = FORM_ARCHETYPES[genre] ?? FORM_ARCHETYPES.default;
  if (range !== "wild") return base;
  return Object.freeze([...new Set([...base, ...FORM_ARCHETYPES.default])]);
}

function surpriseBudget(config, seed, range) {
  const surprise = clamp(config.surprise, 0, 1);
  const rangePressure = range === "wild" ? 0.45 : range === "familiar" ? -0.25 : 0;
  const score = surprise * 1.55 + unit(seed, "surprise-budget") + rangePressure;
  return Math.max(0, Math.min(2, Math.floor(score)));
}

function signatureFor(genome) {
  const ordered = [
    genome.formArchetype,
    genome.energyArc,
    genome.rhythmTopology,
    genome.spaceStrategy,
    genome.motifMutation,
    genome.harmonicMotion,
    genome.spotlightRotation,
    genome.registerArc,
    genome.performanceFeel,
    genome.returnStrategy,
    genome.contrastType,
    genome.surpriseBudget,
  ].join("|");
  return hash32(ordered).toString(16).padStart(8, "0");
}

/**
 * Creative Genome is a deterministic strategy brief. Phase 9B consumes Energy
 * Arc + Space Strategy through bounded priors. Phase 9C additionally consumes
 * Motif Mutation + Spotlight Rotation through the engine's existing motif and
 * orchestration stages. Remaining Genome fields stay descriptive until their
 * own independently tested phases consume them.
 */
export function createCreativeGenome(config = {}, {
  kind = "new",
  consumedByComposition = false,
} = {}) {
  const seed = String(config.seed ?? `${config.genre ?? "pop"}:creative-genome`);
  const genre = normalizedGenre(config);
  const creativeRange = normalizeRange(config.creativeRange);
  const variation = clamp(config.variation, 0, 1);
  const evolution = clamp(config.evolution, 0, 1);
  const complexity = clamp(config.complexity, 0, 1);

  const genome = {
    version: CREATIVE_GENOME_VERSION,
    id: "creative-genome-v1",
    kind: String(kind),
    genre,
    creativeRange,
    formArchetype: pick(formPool(genre, creativeRange), seed, "form", creativeRange),
    energyArc: pick(ENERGY_ARCS, seed, `energy:${Math.round(evolution * 10)}`, creativeRange),
    rhythmTopology: pick(RHYTHM_TOPOLOGIES, seed, `rhythm:${Math.round(complexity * 10)}`, creativeRange),
    spaceStrategy: pick(SPACE_STRATEGIES, seed, `space:${Math.round((1 - complexity) * 10)}`, creativeRange),
    motifMutation: pick(MOTIF_MUTATIONS, seed, `motif:${Math.round(variation * 10)}`, creativeRange),
    harmonicMotion: pick(HARMONIC_MOTIONS, seed, `harmony:${Math.round(complexity * 10)}`, creativeRange),
    spotlightRotation: pick(SPOTLIGHT_ROTATIONS, seed, `spotlight:${Math.round(evolution * 10)}`, creativeRange),
    registerArc: pick(REGISTER_ARCS, seed, `register:${Math.round(variation * 10)}`, creativeRange),
    performanceFeel: pick(PERFORMANCE_FEELS, seed, `feel:${genre}`, creativeRange),
    returnStrategy: pick(RETURN_STRATEGIES, seed, `return:${Math.round(evolution * 10)}`, creativeRange),
    contrastType: pick(CONTRAST_TYPES, seed, `contrast:${Math.round(variation * 10)}`, creativeRange),
    surpriseBudget: surpriseBudget(config, seed, creativeRange),
  };

  const signature = signatureFor(genome);
  const consumed = Boolean(consumedByComposition);
  return Object.freeze({
    ...genome,
    signature,
    source: Object.freeze({
      seedHash: hash32(seed).toString(16).padStart(8, "0"),
      variation: Math.round(variation * 1000) / 1000,
      evolution: Math.round(evolution * 1000) / 1000,
      complexity: Math.round(complexity * 1000) / 1000,
    }),
    guardrails: Object.freeze({
      compositionNeutral: !consumed,
      consumedByComposition: consumed,
      consumedFields: Object.freeze(consumed
        ? ["energyArc", "spaceStrategy", "motifMutation", "spotlightRotation"]
        : []),
      preserveDeterminism: true,
      preserveCandidateBudgets: true,
      preserveCriticCalibration: true,
      preserveMidiAndExport: true,
    }),
  });
}
