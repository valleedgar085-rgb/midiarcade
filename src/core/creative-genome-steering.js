export const CREATIVE_GENOME_STEERING_VERSION = 1;

const ENERGY_STEERING = Object.freeze({
  rising: Object.freeze({ energy: 0.012, evolution: 0.038, variation: 0.012, drumFills: 0.008 }),
  "early-peak": Object.freeze({ energy: 0.024, evolution: -0.014, variation: 0.006, surprise: 0.008 }),
  "two-waves": Object.freeze({ energy: 0.008, evolution: 0.046, variation: 0.026, drumFills: 0.016 }),
  "valley-payoff": Object.freeze({ energy: -0.006, evolution: 0.054, variation: 0.018, surprise: 0.014 }),
  "hypnotic-flat": Object.freeze({ energy: -0.008, evolution: -0.044, variation: -0.022, surprise: -0.012 }),
});

const SPACE_STEERING = Object.freeze({
  "continuous-bed": Object.freeze({ complexity: 0.012, chordDensity: 0.016, counterpointDensity: 0.012, padDensity: 0.02 }),
  breathing: Object.freeze({ complexity: -0.012, chordDensity: -0.026, counterpointDensity: -0.018, padDensity: -0.034 }),
  "strategic-dropouts": Object.freeze({ complexity: -0.024, variation: 0.012, chordDensity: -0.042, counterpointDensity: -0.04, padDensity: -0.052 }),
  "vacuum-before-payoff": Object.freeze({ complexity: -0.032, evolution: 0.018, surprise: 0.01, chordDensity: -0.05, counterpointDensity: -0.046, padDensity: -0.06, bassDensity: -0.012 }),
  "sectional-reset": Object.freeze({ complexity: -0.018, evolution: 0.026, drumFills: 0.014, chordDensity: -0.03, counterpointDensity: -0.026, padDensity: -0.04 }),
});

const RANGE_STRENGTH = Object.freeze({ familiar: 0.55, fresh: 1, wild: 1.28 });
const KIND_STRENGTH = Object.freeze({ new: 1, similar: 0.35, songVariations: 0.58 });
const TRACK_DENSITY_KEYS = Object.freeze({
  drums: "drumsDensity",
  bass: "bassDensity",
  chords: "chordDensity",
  counterpoint: "counterpointDensity",
  pad: "padDensity",
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

export function isCreativeGenomeFusionProtected(config = {}) {
  const primary = String(config.genre ?? "");
  const secondary = String(config.secondaryGenre ?? "");
  return Boolean(secondary && secondary !== primary);
}

function scalarDelta(energy, space, key) {
  return finite(energy?.[key]) + finite(space?.[key]);
}

/**
 * Phase 9B is deliberately a bounded prior-steering layer. It does not touch
 * finished MIDI events, candidate ceilings, critic thresholds, release gates,
 * route authority, key/mode, or export behavior. Existing engine grammar still
 * owns composition; Genome only nudges the controls that grammar already uses.
 */
export function applyCreativeGenomeSteering(config = {}, genome = null, {
  kind = "new",
  enabled = true,
} = {}) {
  const source = cloneRecord(config);
  const protectedFusion = isCreativeGenomeFusionProtected(source);
  if (!enabled || !genome || protectedFusion) {
    return Object.freeze({
      config: source,
      diagnostics: Object.freeze({
        version: CREATIVE_GENOME_STEERING_VERSION,
        applied: false,
        reason: !enabled ? "disabled" : !genome ? "missing-genome" : "fusion-contract-protected",
        energyArc: genome?.energyArc ?? null,
        spaceStrategy: genome?.spaceStrategy ?? null,
        strength: 0,
        scalarDeltas: Object.freeze({}),
        trackDensityDeltas: Object.freeze({}),
      }),
    });
  }

  const energy = ENERGY_STEERING[genome.energyArc] ?? {};
  const space = SPACE_STEERING[genome.spaceStrategy] ?? {};
  const rangeStrength = RANGE_STRENGTH[genome.creativeRange] ?? RANGE_STRENGTH.fresh;
  const kindStrength = KIND_STRENGTH[kind] ?? 1;
  const strength = round(rangeStrength * kindStrength);
  const out = { ...source };
  const scalarDeltas = {};

  for (const [key, fallback] of [
    ["energy", 0.68],
    ["complexity", 0.54],
    ["variation", 0.42],
    ["evolution", 0.58],
    ["surprise", 0.28],
    ["drumFills", 0.4],
  ]) {
    const delta = round(scalarDelta(energy, space, key) * strength);
    if (Math.abs(delta) <= 1e-9) continue;
    out[key] = round(clamp(finite(source[key], fallback) + delta, 0, 1));
    scalarDeltas[key] = round(out[key] - finite(source[key], fallback));
  }

  const providedTracks = cloneRecord(source.tracks ?? source.trackControls ?? source.trackSettings);
  const adjustedTracks = { ...providedTracks };
  const trackDensityDeltas = {};
  for (const [trackId, deltaKey] of Object.entries(TRACK_DENSITY_KEYS)) {
    const settings = providedTracks[trackId];
    if (!settings || !Number.isFinite(Number(settings.density))) continue;
    const delta = round(finite(space?.[deltaKey]) * strength);
    if (Math.abs(delta) <= 1e-9) continue;
    adjustedTracks[trackId] = {
      ...settings,
      density: round(clamp(finite(settings.density) + delta, 0.08, 1)),
    };
    trackDensityDeltas[trackId] = round(adjustedTracks[trackId].density - finite(settings.density));
  }
  if (Object.keys(trackDensityDeltas).length) {
    out.tracks = adjustedTracks;
    if (source.trackControls) out.trackControls = adjustedTracks;
    if (source.trackSettings) out.trackSettings = adjustedTracks;
  }

  const diagnostics = Object.freeze({
    version: CREATIVE_GENOME_STEERING_VERSION,
    applied: true,
    reason: "energy-space-priors",
    genomeSignature: genome.signature ?? null,
    energyArc: genome.energyArc ?? null,
    spaceStrategy: genome.spaceStrategy ?? null,
    creativeRange: genome.creativeRange ?? "fresh",
    kind,
    strength,
    scalarDeltas: Object.freeze({ ...scalarDeltas }),
    trackDensityDeltas: Object.freeze({ ...trackDensityDeltas }),
    preserves: Object.freeze({
      seed: source.seed ?? null,
      key: source.key ?? null,
      scale: source.scale ?? source.mode ?? null,
      bars: source.bars ?? null,
      candidateCount: source.candidateCount ?? null,
      repairAttempts: source.repairAttempts ?? null,
    }),
  });
  return Object.freeze({ config: out, diagnostics });
}
