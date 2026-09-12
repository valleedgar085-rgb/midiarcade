import { clampFinite as clamp, finite } from "../utils.js";

const SUPPORTED_KINDS = Object.freeze(new Set(["new", "similar", "songVariations"]));
const MAX_ENGINE_CANDIDATES = 12;
const STANDARD_BASE_CANDIDATES = 4;
const DEEP_BASE_CANDIDATES = 6;
const STANDARD_ADAPTIVE_CANDIDATES = 3;
const DEEP_ADAPTIVE_CANDIDATES = 4;
const MAX_REPAIR_ATTEMPTS = 2;

export function roundProducerValue(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

export function normalizeProducerKind(kind) {
  return SUPPORTED_KINDS.has(String(kind)) ? String(kind) : "new";
}

export function normalizeThinkingDepth(value) {
  return value === "standard" ? "standard" : "deep";
}

export function normalizeProducerCharacter(character = {}) {
  return Object.freeze({
    grooveDepth: clamp(character.grooveDepth, 0, 1),
    bassMotion: clamp(character.bassMotion, 0, 1),
    melodyMotion: clamp(character.melodyMotion, 0, 1),
    harmonicColor: clamp(character.harmonicColor, 0, 1),
    space: clamp(character.space, 0, 1),
  });
}

export function normalizeProducerTaste(taste = {}) {
  const nullable = (value) => Number.isFinite(Number(value)) ? clamp(value, 0, 1) : null;
  return Object.freeze({
    confidence: clamp(taste.confidence, 0, 1),
    energy: nullable(taste.energy),
    complexity: nullable(taste.complexity),
    variation: nullable(taste.variation),
    genreAffinity: clamp(taste.genreAffinity, -1, 1),
    rejectionPressure: clamp(taste.rejectionPressure, 0, 1),
  });
}

export function createProducerSearchPolicy(config = {}, kind = "new", depth = "deep") {
  const explicitCandidateCount = Number.isFinite(Number(config.candidateCount));
  const baseCandidateCount = explicitCandidateCount
    ? clamp(Math.round(finite(config.candidateCount, 1)), 1, MAX_ENGINE_CANDIDATES)
    : depth === "deep" ? DEEP_BASE_CANDIDATES : STANDARD_BASE_CANDIDATES;
  const adaptive = !explicitCandidateCount && config.adaptiveCandidates !== false;
  const adaptiveExpansion = adaptive
    ? depth === "deep" ? DEEP_ADAPTIVE_CANDIDATES : STANDARD_ADAPTIVE_CANDIDATES
    : 0;
  const maxCandidateCount = Math.min(MAX_ENGINE_CANDIDATES, baseCandidateCount + adaptiveExpansion);
  const targetedRepair = adaptive && config.targetedRepair !== false;
  const repairAttempts = targetedRepair
    ? clamp(Math.round(finite(config.repairAttempts, MAX_REPAIR_ATTEMPTS)), 0, MAX_REPAIR_ATTEMPTS)
    : 0;
  const candidatesPerVariation = kind === "songVariations"
    ? clamp(Math.round(finite(config.candidatesPerVariation, depth === "deep" ? 3 : 2)), 1, 4)
    : null;

  return Object.freeze({
    depth,
    adaptive,
    targetedRepair,
    repairAttempts,
    baseCandidateCount,
    maxCandidateCount,
    candidatesPerVariation,
    wholeSongAuditions: kind === "songVariations" ? candidatesPerVariation * 3 : maxCandidateCount + repairAttempts,
  });
}

export function createProductionPriorities(character, taste, kind = "new") {
  const entries = [
    ["groove", roundProducerValue(character.grooveDepth * 0.58 + character.bassMotion * 0.42)],
    ["hook", roundProducerValue(character.melodyMotion)],
    ["harmony", roundProducerValue(character.harmonicColor)],
    ["space", roundProducerValue(character.space)],
  ];
  const confidence = taste.confidence;
  const variationPreference = taste.variation == null ? 0.5 : taste.variation;
  entries.push(["novelty", roundProducerValue(clamp(
    (kind === "new" ? 0.72 : kind === "similar" ? 0.48 : 0.6)
      + (variationPreference - 0.5) * confidence * 0.18
      + taste.rejectionPressure * confidence * 0.08,
    0.32,
    0.92,
  ))]);
  return Object.freeze(entries
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([id, weight]) => Object.freeze({ id, weight })));
}
