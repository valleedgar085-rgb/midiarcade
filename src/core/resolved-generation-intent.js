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

function record(requested, producer, final) {
  const requestedValue = finiteOrNull(requested);
  const producerValue = finiteOrNull(producer);
  const finalValue = finiteOrNull(final);
  return Object.freeze({
    requested: round(requestedValue),
    producer: round(producerValue),
    final: round(finalValue),
    producerDelta: requestedValue == null || producerValue == null ? null : round(producerValue - requestedValue),
    qualityDelta: producerValue == null || finalValue == null ? null : round(finalValue - producerValue),
  });
}

function trackInputs(config = {}) {
  return config?.tracks ?? config?.trackControls ?? config?.trackSettings ?? {};
}

function createResolvedIntentSnapshot(requested, producer, final, kind) {
  const requestedTracks = trackInputs(requested);
  const producerTracks = trackInputs(producer);
  const finalTracks = trackInputs(final);
  const trackIds = [...new Set([
    ...Object.keys(requestedTracks),
    ...Object.keys(producerTracks),
    ...Object.keys(finalTracks),
  ])];

  return Object.freeze({
    version: 1,
    id: "resolved-generation-intent-v1",
    kind,
    authorities: Object.freeze({
      requested: "user-config",
      producer: "adaptive-generation+producer-brain",
      quality: "output-quality-evolution",
    }),
    controls: Object.freeze(Object.fromEntries(
      CONTROL_KEYS.map((key) => [key, record(requested?.[key], producer?.[key], final?.[key])]),
    )),
    tracks: Object.freeze(Object.fromEntries(trackIds.map((trackId) => [
      trackId,
      Object.freeze(Object.fromEntries(TRACK_KEYS.map((key) => [
        key,
        record(requestedTracks?.[trackId]?.[key], producerTracks?.[trackId]?.[key], finalTracks?.[trackId]?.[key]),
      ]))),
    ]))),
  });
}

export function resolveGenerationConfig(config = {}, { kind = "new" } = {}) {
  const requested = config && typeof config === "object" && !Array.isArray(config) ? { ...config } : {};
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
