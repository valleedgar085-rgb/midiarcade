import { adaptGenerationConfig } from "./adaptive-generation.js";
import { applyOutputQualityEvolution } from "./output-quality-evolution.js";

const CONTROL_KEYS = Object.freeze([
  "energy",
  "complexity",
  "variation",
  "evolution",
  "surprise",
  "syncopation",
  "drumFills",
  "harmonicRhythm",
  "swing",
  "humanize",
]);

const TRACK_KEYS = Object.freeze([
  "density",
  "variation",
  "feel",
  "humanize",
  "velocity",
]);

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function round(value, digits = 4) {
  const number = finiteOrNull(value);
  if (number == null) return null;
  const factor = 10 ** digits;
  return Math.round((number + Number.EPSILON) * factor) / factor;
}

function record(requested, genreResolved, producer, final) {
  const requestedValue = finiteOrNull(requested);
  const genreValue = finiteOrNull(genreResolved);
  const producerValue = finiteOrNull(producer);
  const finalValue = finiteOrNull(final);
  const genreAdjustment = requestedValue == null || genreValue == null
    ? null
    : round(genreValue - requestedValue);
  const tasteAdjustment = genreValue == null || producerValue == null
    ? null
    : round(producerValue - genreValue);
  const qualityAdjustment = producerValue == null || finalValue == null
    ? null
    : round(finalValue - producerValue);
  return Object.freeze({
    requested: round(requestedValue),
    genre: round(genreValue),
    producer: round(producerValue),
    final: round(finalValue),
    genreAdjustment,
    tasteAdjustment,
    qualityAdjustment,
    // Compatibility aliases for existing debugger consumers.
    producerDelta: requestedValue == null || producerValue == null ? null : round(producerValue - requestedValue),
    qualityDelta: qualityAdjustment,
    equation: "requested + genreAdjustment + tasteAdjustment + qualityAdjustment = final",
  });
}

function trackInputs(config = {}) {
  return config?.tracks ?? config?.trackControls ?? config?.trackSettings ?? {};
}

function createResolvedIntentSnapshot(requested, genreResolved, producer, final, kind) {
  const requestedTracks = trackInputs(requested);
  const genreTracks = trackInputs(genreResolved);
  const producerTracks = trackInputs(producer);
  const finalTracks = trackInputs(final);
  const trackIds = [...new Set([
    ...Object.keys(requestedTracks),
    ...Object.keys(genreTracks),
    ...Object.keys(producerTracks),
    ...Object.keys(finalTracks),
  ])];

  return Object.freeze({
    version: 2,
    id: "resolved-generation-intent-v1",
    kind,
    equation: "user value + genre adjustment + taste adjustment + quality adjustment = final composer value",
    authorities: Object.freeze({
      requested: "user-config",
      genre: "genre-character+producer-brain(neutral-taste)",
      taste: "adaptive-taste+producer-brain",
      producer: "adaptive-generation+producer-brain",
      quality: "output-quality-evolution",
    }),
    controls: Object.freeze(Object.fromEntries(
      CONTROL_KEYS.map((key) => [key, record(requested?.[key], genreResolved?.[key], producer?.[key], final?.[key])]),
    )),
    tracks: Object.freeze(Object.fromEntries(trackIds.map((trackId) => [
      trackId,
      Object.freeze(Object.fromEntries(TRACK_KEYS.map((key) => [
        key,
        record(
          requestedTracks?.[trackId]?.[key],
          genreTracks?.[trackId]?.[key],
          producerTracks?.[trackId]?.[key],
          finalTracks?.[trackId]?.[key],
        ),
      ]))),
    ]))),
  });
}

export function resolveGenerationConfig(config = {}, { kind = "new" } = {}) {
  const requested = config && typeof config === "object" && !Array.isArray(config) ? { ...config } : {};
  // Resolve a neutral-taste checkpoint only for provenance. The actual composer
  // still receives the single existing adaptive-generation result below.
  const genreResolved = adaptGenerationConfig({ ...requested, tasteProfile: {} }, { kind });
  const producerResolved = adaptGenerationConfig(requested, { kind });
  const qualityResolved = applyOutputQualityEvolution(producerResolved, { kind });
  const freshGeneration = kind === "new";
  const final = {
    ...qualityResolved,
    phraseResolutionRefinement: typeof qualityResolved.phraseResolutionRefinement === "boolean"
      ? qualityResolved.phraseResolutionRefinement
      : freshGeneration,
    registerHealthRefinement: typeof qualityResolved.registerHealthRefinement === "boolean"
      ? qualityResolved.registerHealthRefinement
      : freshGeneration,
  };
  final.resolvedGenerationIntent = createResolvedIntentSnapshot(
    requested,
    genreResolved,
    producerResolved,
    final,
    kind,
  );
  return final;
}

export function resolveGenerationRequest(kind, payload = {}) {
  const requestKind = String(kind);
  const source = payload && typeof payload === "object" && !Array.isArray(payload) ? { ...payload } : {};
  if (!["new", "similar", "songVariations"].includes(requestKind)) return source;
  return {
    ...source,
    config: resolveGenerationConfig(source.config ?? {}, { kind: requestKind }),
  };
}
