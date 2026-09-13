import { clampFinite as clamp, finite } from "../utils.js";

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function unit(value, fallback = 0.5) {
  return round(clamp(finite(value, fallback), 0, 1));
}

function normalizedBars(value) {
  return Math.round(clamp(finite(value, 16), 4, 128));
}

function priorityIds(priorities = []) {
  return priorities
    .map((entry) => String(entry?.id ?? ""))
    .filter(Boolean);
}

/**
 * Producer blueprint is a deterministic pre-composition brief. It does not
 * generate notes or replace the calibrated critic. Instead it gives the
 * existing engine a compact statement of musical intent that can be logged,
 * compared and gradually consumed by search/repair routing.
 */
export function createSongBlueprint(config = {}, {
  kind = "new",
  character = {},
  taste = {},
  priorities = [],
} = {}) {
  const bars = normalizedBars(config.bars);
  const energy = unit(config.energy, 0.68);
  const complexity = unit(config.complexity, 0.54);
  const variation = unit(config.variation, 0.42);
  const evolution = unit(config.evolution, 0.58);
  const surprise = unit(config.surprise, 0.28);
  const grooveDepth = unit(character.grooveDepth, 0.62);
  const melodyMotion = unit(character.melodyMotion, 0.58);
  const harmonicColor = unit(character.harmonicColor, 0.56);
  const space = unit(character.space, 0.5);
  const learnedVariation = Number.isFinite(Number(taste.variation))
    ? unit(taste.variation, variation)
    : variation;
  const rankedPriorities = priorityIds(priorities);

  const openingEnergy = unit(energy * (0.68 + evolution * 0.12), energy);
  const bodyEnergy = unit(energy * (0.92 + grooveDepth * 0.08), energy);
  const peakEnergy = unit(Math.max(bodyEnergy, energy + evolution * 0.16 + surprise * 0.05), energy);
  const releaseEnergy = unit(Math.max(0.18, openingEnergy - 0.08 - space * 0.08), openingEnergy);
  const contrast = unit(variation * 0.5 + evolution * 0.34 + surprise * 0.16, variation);
  const hookPressure = unit(melodyMotion * 0.55 + energy * 0.25 + (1 - space) * 0.2, melodyMotion);
  const harmonicMotion = unit(harmonicColor * 0.58 + complexity * 0.32 + evolution * 0.1, harmonicColor);
  const groovePressure = unit(grooveDepth * 0.68 + energy * 0.22 + complexity * 0.1, grooveDepth);
  const spaceReserve = unit(space * 0.72 + (1 - complexity) * 0.28, space);
  const novelty = unit(
    (kind === "new" ? 0.62 : 0.42) * 0.5
      + learnedVariation * 0.28
      + surprise * 0.22,
    variation,
  );

  return Object.freeze({
    version: 1,
    id: "producer-blueprint-v1",
    kind: String(kind),
    genre: String(config.genre ?? "pop"),
    bars,
    intent: Object.freeze({
      energyArc: Object.freeze({
        opening: openingEnergy,
        body: bodyEnergy,
        peak: peakEnergy,
        release: releaseEnergy,
      }),
      contrast,
      hookPressure,
      harmonicMotion,
      groovePressure,
      spaceReserve,
      novelty,
    }),
    repairFocus: Object.freeze(rankedPriorities.slice(0, 3)),
    guardrails: Object.freeze({
      preserveKeySafety: true,
      preserveDeterminism: true,
      preferLocalRepair: true,
      maximumRepairScope: "surgical",
      minimumSectionContrast: round(0.18 + contrast * 0.16),
    }),
  });
}
