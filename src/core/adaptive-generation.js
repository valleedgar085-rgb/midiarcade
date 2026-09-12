import { clampFinite as clamp, finite } from "../utils.js";
import { applyProducerBrainConfig } from "./producer-brain.js";

const TRACK_IDS = Object.freeze(["drums", "bass", "chords", "melody", "counterpoint", "pad"]);

const CHARACTER_DEFAULT = Object.freeze({
  grooveDepth: 0.62,
  bassMotion: 0.58,
  melodyMotion: 0.58,
  harmonicColor: 0.56,
  space: 0.5,
  syncopationDelta: 0.012,
  swingDelta: 0,
  humanizeDelta: 0.008,
  fillDelta: 0.012,
});

const GENRE_CHARACTER = Object.freeze({
  neoSoul: { grooveDepth: 0.92, bassMotion: 0.86, melodyMotion: 0.78, harmonicColor: 0.94, space: 0.72, syncopationDelta: 0.045, swingDelta: 0.018, humanizeDelta: 0.025, fillDelta: 0.008 },
  rnbSoul: { grooveDepth: 0.88, bassMotion: 0.78, melodyMotion: 0.84, harmonicColor: 0.96, space: 0.78, syncopationDelta: 0.032, swingDelta: 0.014, humanizeDelta: 0.022, fillDelta: -0.004 },
  funk: { grooveDepth: 1, bassMotion: 1, melodyMotion: 0.72, harmonicColor: 0.72, space: 0.56, syncopationDelta: 0.06, swingDelta: 0.01, humanizeDelta: 0.018, fillDelta: 0.02 },
  hipHop: { grooveDepth: 0.9, bassMotion: 0.82, melodyMotion: 0.7, harmonicColor: 0.62, space: 0.72, syncopationDelta: 0.038, swingDelta: 0.012, humanizeDelta: 0.02, fillDelta: 0.008 },
  rap: { grooveDepth: 0.86, bassMotion: 0.76, melodyMotion: 0.56, harmonicColor: 0.5, space: 0.82, syncopationDelta: 0.034, swingDelta: 0.006, humanizeDelta: 0.018, fillDelta: 0 },
  loFiHipHop: { grooveDepth: 0.84, bassMotion: 0.7, melodyMotion: 0.66, harmonicColor: 0.82, space: 0.8, syncopationDelta: 0.025, swingDelta: 0.022, humanizeDelta: 0.03, fillDelta: -0.01 },
  afrobeats: { grooveDepth: 0.98, bassMotion: 0.88, melodyMotion: 0.78, harmonicColor: 0.66, space: 0.58, syncopationDelta: 0.055, swingDelta: 0.006, humanizeDelta: 0.014, fillDelta: 0.014 },
  reggaeton: { grooveDepth: 0.94, bassMotion: 0.84, melodyMotion: 0.7, harmonicColor: 0.6, space: 0.58, syncopationDelta: 0.04, swingDelta: 0, humanizeDelta: 0.01, fillDelta: 0.012 },
  jazz: { grooveDepth: 0.9, bassMotion: 0.9, melodyMotion: 0.9, harmonicColor: 1, space: 0.66, syncopationDelta: 0.034, swingDelta: 0.025, humanizeDelta: 0.03, fillDelta: 0.008 },
  house: { grooveDepth: 0.9, bassMotion: 0.82, melodyMotion: 0.62, harmonicColor: 0.58, space: 0.48, syncopationDelta: 0.02, swingDelta: 0, humanizeDelta: 0, fillDelta: 0.018 },
  techno: { grooveDepth: 0.92, bassMotion: 0.78, melodyMotion: 0.52, harmonicColor: 0.5, space: 0.5, syncopationDelta: 0.024, swingDelta: 0, humanizeDelta: -0.006, fillDelta: 0.022 },
  drumBass: { grooveDepth: 0.98, bassMotion: 0.9, melodyMotion: 0.62, harmonicColor: 0.54, space: 0.5, syncopationDelta: 0.052, swingDelta: 0, humanizeDelta: 0.006, fillDelta: 0.03 },
  trap: { grooveDepth: 0.9, bassMotion: 0.9, melodyMotion: 0.66, harmonicColor: 0.56, space: 0.72, syncopationDelta: 0.032, swingDelta: 0, humanizeDelta: 0.004, fillDelta: 0.025 },
  drill: { grooveDepth: 0.94, bassMotion: 0.94, melodyMotion: 0.58, harmonicColor: 0.5, space: 0.7, syncopationDelta: 0.04, swingDelta: 0, humanizeDelta: 0.002, fillDelta: 0.03 },
  ambient: { grooveDepth: 0.34, bassMotion: 0.42, melodyMotion: 0.62, harmonicColor: 0.94, space: 1, syncopationDelta: -0.025, swingDelta: 0, humanizeDelta: 0.015, fillDelta: -0.025 },
  rock: { grooveDepth: 0.86, bassMotion: 0.74, melodyMotion: 0.74, harmonicColor: 0.52, space: 0.52, syncopationDelta: 0.012, swingDelta: 0, humanizeDelta: 0.016, fillDelta: 0.02 },
  country: { grooveDepth: 0.82, bassMotion: 0.68, melodyMotion: 0.76, harmonicColor: 0.6, space: 0.66, syncopationDelta: 0.01, swingDelta: 0.012, humanizeDelta: 0.02, fillDelta: 0.012 },
  pop: { grooveDepth: 0.78, bassMotion: 0.68, melodyMotion: 0.86, harmonicColor: 0.64, space: 0.58, syncopationDelta: 0.018, swingDelta: 0, humanizeDelta: 0.008, fillDelta: 0.012 },
  popRadio: { grooveDepth: 0.8, bassMotion: 0.7, melodyMotion: 0.9, harmonicColor: 0.64, space: 0.56, syncopationDelta: 0.018, swingDelta: 0, humanizeDelta: 0.006, fillDelta: 0.014 },
  synthwave: { grooveDepth: 0.82, bassMotion: 0.76, melodyMotion: 0.76, harmonicColor: 0.72, space: 0.54, syncopationDelta: 0.012, swingDelta: 0, humanizeDelta: -0.002, fillDelta: 0.016 },
  synthPopRadio: { grooveDepth: 0.82, bassMotion: 0.72, melodyMotion: 0.86, harmonicColor: 0.72, space: 0.54, syncopationDelta: 0.016, swingDelta: 0, humanizeDelta: -0.002, fillDelta: 0.016 },
});

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function mix(from, to, amount) {
  const t = clamp(amount);
  return finite(from) * (1 - t) + finite(to) * t;
}

function unit(value, fallback) {
  return round(clamp(finite(value, fallback), 0, 1));
}

function cloneRecord(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? { ...value } : {};
}

export function normalizeTasteProfile(profile = {}) {
  const source = cloneRecord(profile);
  return Object.freeze({
    ratings: Math.max(0, finite(source.ratings, 0)),
    likes: Math.max(0, finite(source.likes, 0)),
    rejects: Math.max(0, finite(source.rejects, 0)),
    favorites: Math.max(0, finite(source.favorites, 0)),
    energyTotal: Math.max(0, finite(source.energyTotal, 0)),
    complexityTotal: Math.max(0, finite(source.complexityTotal, 0)),
    variationTotal: Math.max(0, finite(source.variationTotal, 0)),
    genreVotes: cloneRecord(source.genreVotes),
  });
}

export function tasteConfidence(profile = {}) {
  const taste = normalizeTasteProfile(profile);
  const signals = taste.likes + taste.rejects * 0.72 + taste.favorites * 1.65;
  return round(clamp(signals / 12, 0, 1));
}

export function tasteVector(profile = {}, genre = "") {
  const taste = normalizeTasteProfile(profile);
  const confidence = tasteConfidence(taste);
  const positiveWeight = Math.max(0, taste.ratings);
  const energy = positiveWeight > 0 ? clamp(taste.energyTotal / positiveWeight / 100) : null;
  const complexity = positiveWeight > 0 ? clamp(taste.complexityTotal / positiveWeight / 100) : null;
  const variation = positiveWeight > 0 ? clamp(taste.variationTotal / positiveWeight / 100) : null;
  const vote = finite(taste.genreVotes[String(genre)] ?? 0, 0);
  const voteScale = Math.max(2, taste.likes + taste.favorites * 2 + taste.rejects);
  const genreAffinity = round(clamp(vote / voteScale, -1, 1));
  const rejectionPressure = round(clamp(
    taste.rejects / Math.max(1, taste.likes + taste.rejects + taste.favorites),
    0,
    1,
  ));
  return Object.freeze({ confidence, energy, complexity, variation, genreAffinity, rejectionPressure });
}

export function generationCharacter(genre = "") {
  return Object.freeze({ ...CHARACTER_DEFAULT, ...(GENRE_CHARACTER[String(genre)] ?? {}) });
}

function adjustTrack(trackId, input, context) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return input;
  const out = { ...input };
  const { character, vector, variationLift, grooveLift } = context;
  const variationWeight = {
    drums: 0.052 * character.grooveDepth,
    bass: 0.075 * character.bassMotion,
    chords: 0.032 * character.harmonicColor,
    melody: 0.07 * character.melodyMotion,
    counterpoint: 0.045 * character.melodyMotion,
    pad: 0.018 * character.harmonicColor,
  }[trackId] ?? 0;

  if (Number.isFinite(Number(out.variation))) {
    out.variation = unit(finite(out.variation) + variationWeight + variationLift * 0.12, finite(out.variation));
  }
  if (Number.isFinite(Number(out.humanize))) {
    const lane = { drums: 1, bass: 0.92, chords: 0.58, melody: 0.82, counterpoint: 0.68, pad: 0.28 }[trackId] ?? 0.5;
    out.humanize = unit(finite(out.humanize) + character.humanizeDelta * lane + grooveLift * 0.014 * lane, finite(out.humanize));
  }
  if (Number.isFinite(Number(out.feel))) {
    const lane = { drums: 0.8, bass: 1, chords: 0.58, melody: 0.7, counterpoint: 0.52, pad: 0.18 }[trackId] ?? 0.5;
    out.feel = unit(finite(out.feel) + 0.03 * character.grooveDepth * lane + vector.genreAffinity * vector.confidence * 0.018 * lane, finite(out.feel));
  }
  if (Number.isFinite(Number(out.density))) {
    const densityDelta = trackId === "pad"
      ? -0.04 * character.space
      : trackId === "counterpoint"
        ? -0.028 * character.space
        : trackId === "chords"
          ? -0.015 * character.space
          : 0;
    out.density = unit(finite(out.density) + densityDelta, finite(out.density));
  }
  if (Number.isFinite(Number(out.velocity))) {
    const velocityDelta = trackId === "drums" ? 0.012 * character.grooveDepth
      : trackId === "bass" ? 0.008 * character.bassMotion
        : trackId === "melody" ? 0.006 * character.melodyMotion : 0;
    out.velocity = unit(finite(out.velocity) + velocityDelta, finite(out.velocity));
  }
  return out;
}

/**
 * Deterministic, bounded taste + genre steering. The engine still owns note
 * grammar, critic selection and Song DNA; this layer only improves the priors
 * supplied to those systems. Same seed + same taste snapshot stays replayable.
 */
export function adaptGenerationConfig(config = {}, { kind = "new" } = {}) {
  const source = cloneRecord(config);
  const genre = String(source.genre ?? "pop");
  const character = generationCharacter(genre);
  const vector = tasteVector(source.tasteProfile, genre);
  const tasteStrength = vector.confidence * 0.2;

  const baseEnergy = unit(source.energy, 0.68);
  const baseComplexity = unit(source.complexity, 0.54);
  const baseVariation = unit(source.variation, 0.42);
  const learnedEnergy = vector.energy == null ? baseEnergy : mix(baseEnergy, vector.energy, tasteStrength);
  const learnedComplexity = vector.complexity == null ? baseComplexity : mix(baseComplexity, vector.complexity, tasteStrength);
  const learnedVariation = vector.variation == null ? baseVariation : mix(baseVariation, vector.variation, tasteStrength);

  const variationLift = (character.bassMotion + character.melodyMotion + character.grooveDepth) / 3 - 0.58;
  const grooveLift = character.grooveDepth - 0.62;
  const dislikeNovelty = vector.rejectionPressure * vector.confidence * 0.03;
  const fillTaste = vector.variation == null ? 0 : (vector.variation - baseVariation) * tasteStrength * 0.08;
  const related = kind === "similar";

  const out = {
    ...source,
    energy: round(clamp(learnedEnergy, 0, 1)),
    complexity: round(clamp(learnedComplexity, 0, 1)),
    variation: round(clamp(learnedVariation + variationLift * 0.11 + dislikeNovelty, 0.12, 0.94)),
    evolution: round(clamp(finite(source.evolution, 0.58) + variationLift * 0.07 + vector.confidence * 0.018, 0, 1)),
    surprise: round(clamp(finite(source.surprise, 0.28) + character.melodyMotion * 0.022 + dislikeNovelty, 0, 0.78)),
    syncopation: round(clamp(finite(source.syncopation, 0.5) + character.syncopationDelta + vector.genreAffinity * vector.confidence * 0.018, 0, 1)),
    drumFills: round(clamp(finite(source.drumFills, 0.4) + character.fillDelta + fillTaste, 0, 1)),
    chordExtensions: round(clamp(finite(source.chordExtensions, 0.46) + (character.harmonicColor - 0.56) * 0.055 + (learnedComplexity - baseComplexity) * 0.05, 0, 1)),
    harmonicRhythm: round(clamp(finite(source.harmonicRhythm, 0.34) + grooveLift * 0.018 + (learnedComplexity - baseComplexity) * 0.04, 0.08, 0.88)),
    swing: round(clamp(finite(source.swing, 0) + character.swingDelta, 0, 0.72)),
    humanize: round(clamp(finite(source.humanize, 0.12) + character.humanizeDelta, 0, 0.72)),
  };

  if (Number.isFinite(Number(source.similarity))) {
    const loosen = clamp((out.variation - baseVariation) * 0.16 + dislikeNovelty, 0, related ? 0.045 : 0.08);
    out.similarity = round(clamp(finite(source.similarity) - loosen, related ? 0.58 : 0.5, 0.94));
  }

  const providedTracks = cloneRecord(source.tracks ?? source.trackControls ?? source.trackSettings);
  const adjustedTracks = {};
  for (const trackId of TRACK_IDS) {
    if (!(trackId in providedTracks)) continue;
    adjustedTracks[trackId] = adjustTrack(trackId, providedTracks[trackId], {
      character,
      vector,
      variationLift,
      grooveLift,
    });
  }
  if (Object.keys(adjustedTracks).length > 0) {
    out.tracks = adjustedTracks;
    if (source.trackControls) out.trackControls = adjustedTracks;
    if (source.trackSettings) out.trackSettings = adjustedTracks;
  }

  out.adaptiveTaste = Object.freeze({
    version: 1,
    confidence: vector.confidence,
    genreAffinity: vector.genreAffinity,
    learned: {
      energy: vector.energy == null ? null : round(vector.energy),
      complexity: vector.complexity == null ? null : round(vector.complexity),
      variation: vector.variation == null ? null : round(vector.variation),
    },
    character: {
      grooveDepth: round(character.grooveDepth),
      bassMotion: round(character.bassMotion),
      melodyMotion: round(character.melodyMotion),
      harmonicColor: round(character.harmonicColor),
      space: round(character.space),
    },
  });
  return applyProducerBrainConfig(out, { kind, character, taste: vector });
}

export function adaptGenerationRequest(kind, payload = {}) {
  const source = cloneRecord(payload);
  if (!["new", "similar", "songVariations"].includes(kind)) return source;
  return {
    ...source,
    config: adaptGenerationConfig(source.config ?? {}, { kind }),
  };
}
