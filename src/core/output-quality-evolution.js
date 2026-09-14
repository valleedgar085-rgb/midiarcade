import { clampFinite as clamp, finite } from "../utils.js";

const DEFAULT_DEVELOPMENT = Object.freeze({
  grooveEvolution: 0.62,
  phraseDevelopment: 0.62,
  melodicContrast: 0.62,
  sectionMotion: 0.6,
  repetitionGuard: 0.62,
  breathingRoom: 0.58,
});

const GENRE_DEVELOPMENT = Object.freeze({
  neoSoul: { grooveEvolution: 0.86, phraseDevelopment: 0.82, melodicContrast: 0.8, sectionMotion: 0.68, repetitionGuard: 0.76, breathingRoom: 0.82 },
  rnbSoul: { grooveEvolution: 0.8, phraseDevelopment: 0.88, melodicContrast: 0.86, sectionMotion: 0.66, repetitionGuard: 0.78, breathingRoom: 0.88 },
  funk: { grooveEvolution: 0.96, phraseDevelopment: 0.8, melodicContrast: 0.72, sectionMotion: 0.78, repetitionGuard: 0.82, breathingRoom: 0.64 },
  hipHop: { grooveEvolution: 0.88, phraseDevelopment: 0.78, melodicContrast: 0.7, sectionMotion: 0.7, repetitionGuard: 0.82, breathingRoom: 0.8 },
  rap: { grooveEvolution: 0.84, phraseDevelopment: 0.72, melodicContrast: 0.62, sectionMotion: 0.66, repetitionGuard: 0.8, breathingRoom: 0.9 },
  loFiHipHop: { grooveEvolution: 0.78, phraseDevelopment: 0.76, melodicContrast: 0.68, sectionMotion: 0.58, repetitionGuard: 0.72, breathingRoom: 0.88 },
  afrobeats: { grooveEvolution: 0.98, phraseDevelopment: 0.78, melodicContrast: 0.76, sectionMotion: 0.82, repetitionGuard: 0.82, breathingRoom: 0.6 },
  reggaeton: { grooveEvolution: 0.94, phraseDevelopment: 0.72, melodicContrast: 0.68, sectionMotion: 0.78, repetitionGuard: 0.78, breathingRoom: 0.58 },
  jazz: { grooveEvolution: 0.88, phraseDevelopment: 0.94, melodicContrast: 0.94, sectionMotion: 0.74, repetitionGuard: 0.9, breathingRoom: 0.72 },
  house: { grooveEvolution: 0.84, phraseDevelopment: 0.68, melodicContrast: 0.6, sectionMotion: 0.86, repetitionGuard: 0.84, breathingRoom: 0.5 },
  techno: { grooveEvolution: 0.92, phraseDevelopment: 0.72, melodicContrast: 0.58, sectionMotion: 0.94, repetitionGuard: 1, breathingRoom: 0.52 },
  drumBass: { grooveEvolution: 1, phraseDevelopment: 0.78, melodicContrast: 0.68, sectionMotion: 0.9, repetitionGuard: 0.9, breathingRoom: 0.52 },
  trap: { grooveEvolution: 0.92, phraseDevelopment: 0.8, melodicContrast: 0.76, sectionMotion: 0.78, repetitionGuard: 0.86, breathingRoom: 0.8 },
  drill: { grooveEvolution: 0.94, phraseDevelopment: 0.76, melodicContrast: 0.7, sectionMotion: 0.82, repetitionGuard: 0.88, breathingRoom: 0.76 },
  ambient: { grooveEvolution: 0.4, phraseDevelopment: 0.84, melodicContrast: 0.82, sectionMotion: 0.64, repetitionGuard: 0.72, breathingRoom: 1 },
  rock: { grooveEvolution: 0.78, phraseDevelopment: 0.8, melodicContrast: 0.78, sectionMotion: 0.84, repetitionGuard: 0.8, breathingRoom: 0.58 },
  country: { grooveEvolution: 0.74, phraseDevelopment: 0.86, melodicContrast: 0.82, sectionMotion: 0.76, repetitionGuard: 0.8, breathingRoom: 0.7 },
  pop: { grooveEvolution: 0.72, phraseDevelopment: 0.9, melodicContrast: 0.94, sectionMotion: 0.86, repetitionGuard: 0.9, breathingRoom: 0.64 },
  popRadio: { grooveEvolution: 0.74, phraseDevelopment: 0.92, melodicContrast: 0.98, sectionMotion: 0.9, repetitionGuard: 0.92, breathingRoom: 0.62 },
  synthwave: { grooveEvolution: 0.76, phraseDevelopment: 0.76, melodicContrast: 0.82, sectionMotion: 0.84, repetitionGuard: 0.82, breathingRoom: 0.58 },
  synthPopRadio: { grooveEvolution: 0.78, phraseDevelopment: 0.88, melodicContrast: 0.94, sectionMotion: 0.9, repetitionGuard: 0.9, breathingRoom: 0.58 },
});

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function unit(value, fallback = 0) {
  return round(clamp(finite(value, fallback), 0, 1));
}

function cloneRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
}

function hash32(value) {
  let hash = 2166136261;
  const text = String(value ?? "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function centeredSeedUnit(seed, salt) {
  return (hash32(`${seed}:${salt}`) / 0xffffffff) * 2 - 1;
}

export function outputQualityDevelopment(genre = "") {
  return Object.freeze({
    ...DEFAULT_DEVELOPMENT,
    ...(GENRE_DEVELOPMENT[String(genre)] ?? {}),
  });
}

export function createOutputQualityProfile(config = {}, { kind = "new" } = {}) {
  const genre = String(config.genre ?? "pop");
  const development = outputQualityDevelopment(genre);
  const seed = String(config.seed ?? `${genre}:default`);
  const relatedScale = kind === "similar" ? 0.58 : kind === "songVariations" ? 0.82 : 1;
  const grooveJitter = centeredSeedUnit(seed, "groove") * 0.012 * relatedScale;
  const phraseJitter = centeredSeedUnit(seed, "phrase") * 0.012 * relatedScale;
  const melodyJitter = centeredSeedUnit(seed, "melody") * 0.012 * relatedScale;
  const sectionJitter = centeredSeedUnit(seed, "section") * 0.01 * relatedScale;

  return Object.freeze({
    version: 1,
    genre,
    kind,
    grooveEvolution: unit(development.grooveEvolution + grooveJitter, development.grooveEvolution),
    phraseDevelopment: unit(development.phraseDevelopment + phraseJitter, development.phraseDevelopment),
    melodicContrast: unit(development.melodicContrast + melodyJitter, development.melodicContrast),
    sectionMotion: unit(development.sectionMotion + sectionJitter, development.sectionMotion),
    repetitionGuard: unit(development.repetitionGuard - phraseJitter * 0.4, development.repetitionGuard),
    breathingRoom: unit(development.breathingRoom - melodyJitter * 0.25, development.breathingRoom),
    seedSignature: hash32(`${genre}:${seed}:${kind}`).toString(16).padStart(8, "0"),
  });
}

function adjustTrack(trackId, input, profile) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const out = { ...input };
  const variationLift = {
    drums: profile.grooveEvolution * 0.018 + profile.repetitionGuard * 0.012,
    bass: profile.grooveEvolution * 0.016 + profile.phraseDevelopment * 0.012,
    chords: profile.phraseDevelopment * 0.01,
    melody: profile.melodicContrast * 0.02 + profile.phraseDevelopment * 0.014,
    counterpoint: profile.melodicContrast * 0.014 + profile.phraseDevelopment * 0.01,
    pad: profile.sectionMotion * 0.006,
  }[trackId] ?? 0;
  if (Number.isFinite(Number(out.variation))) {
    out.variation = unit(finite(out.variation) + variationLift, finite(out.variation));
  }

  if (Number.isFinite(Number(out.density))) {
    const densityDelta = {
      drums: profile.grooveEvolution * 0.006,
      bass: profile.grooveEvolution * 0.004,
      melody: -profile.breathingRoom * 0.012,
      counterpoint: -profile.breathingRoom * 0.016,
      chords: -profile.breathingRoom * 0.008,
      pad: -profile.breathingRoom * 0.012,
    }[trackId] ?? 0;
    out.density = unit(finite(out.density) + densityDelta, finite(out.density));
  }

  if (Number.isFinite(Number(out.feel))) {
    const feelDelta = {
      drums: profile.grooveEvolution * 0.012,
      bass: profile.grooveEvolution * 0.016,
      melody: profile.phraseDevelopment * 0.008,
      counterpoint: profile.phraseDevelopment * 0.006,
    }[trackId] ?? 0;
    out.feel = unit(finite(out.feel) + feelDelta, finite(out.feel));
  }
  return out;
}

/**
 * Phase 6A uses only controls the existing engine and Producer Brain already
 * understand. Later Phase 6 checkpoints opt fresh generation into bounded
 * candidate-first arrangement, return and density gates. Bass-pocket refinement
 * remains an explicit diagnostic opt-in after calibration showed that density,
 * not bass/kick lock, is the current groove bottleneck.
 */
export function applyOutputQualityEvolution(config = {}, { kind = "new" } = {}) {
  const source = cloneRecord(config);
  if (source.outputQualityEvolution === false) return source;
  const profile = createOutputQualityProfile(source, { kind });
  const freshGeneration = kind === "new";

  const out = {
    ...source,
    arrangementEvolution: typeof source.arrangementEvolution === "boolean"
      ? source.arrangementEvolution
      : freshGeneration,
    returnDevelopment: typeof source.returnDevelopment === "boolean"
      ? source.returnDevelopment
      : freshGeneration,
    densityRefinement: typeof source.densityRefinement === "boolean"
      ? source.densityRefinement
      : freshGeneration,
    groovePocketRefinement: typeof source.groovePocketRefinement === "boolean"
      ? source.groovePocketRefinement
      : false,
    variation: unit(finite(source.variation, 0.5) + profile.repetitionGuard * 0.018 + profile.phraseDevelopment * 0.01, 0.5),
    evolution: unit(finite(source.evolution, 0.58) + profile.sectionMotion * 0.024 + profile.phraseDevelopment * 0.012, 0.58),
    surprise: unit(finite(source.surprise, 0.28) + profile.melodicContrast * 0.008, 0.28),
    syncopation: unit(finite(source.syncopation, 0.5) + profile.grooveEvolution * 0.014, 0.5),
    drumFills: unit(finite(source.drumFills, 0.4) + profile.sectionMotion * 0.016, 0.4),
    harmonicRhythm: unit(finite(source.harmonicRhythm, 0.34) + profile.phraseDevelopment * 0.006, 0.34),
  };

  const providedTracks = cloneRecord(source.tracks ?? source.trackControls ?? source.trackSettings);
  const adjustedTracks = Object.fromEntries(
    Object.entries(providedTracks).map(([trackId, track]) => [trackId, adjustTrack(trackId, track, profile)]),
  );
  if (Object.keys(adjustedTracks).length > 0) {
    out.tracks = adjustedTracks;
    if (source.trackControls) out.trackControls = adjustedTracks;
    if (source.trackSettings) out.trackSettings = adjustedTracks;
  }

  out.outputQuality = profile;
  return out;
}
