import { clampFinite as clamp, finite } from "../utils.js";
import { normalizeGenreId } from "./genre-contract.js";

const TARGET_GENRES = Object.freeze(["pop", "hipHop", "rap"]);
const TARGET_SET = new Set(TARGET_GENRES);

const round = (value, digits = 4) => {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
};

export function popHipHopRapFusionContext(config = {}) {
  const primaryGenre = normalizeGenreId(config?.genre ?? "pop");
  const secondaryGenre = normalizeGenreId(config?.secondaryGenre);
  if (!TARGET_SET.has(primaryGenre) || !TARGET_SET.has(secondaryGenre) || primaryGenre === secondaryGenre) return null;
  const blend = round(clamp(finite(config?.fusionBlend, 0.5), 0, 1));
  return Object.freeze({
    primaryGenre,
    secondaryGenre,
    blend,
    balanceStrength: round(2 * Math.min(blend, 1 - blend)),
  });
}

function blendNumericRecords(primary = {}, secondary = {}, blend = 0.5) {
  const keys = new Set([...Object.keys(primary), ...Object.keys(secondary)]);
  const out = {};
  for (const key of keys) {
    const first = primary[key];
    const second = secondary[key];
    if (Number.isFinite(Number(first)) && Number.isFinite(Number(second))) {
      out[key] = round(finite(first) * (1 - blend) + finite(second) * blend);
    } else if (blend >= 0.5 && second !== undefined) out[key] = second;
    else if (first !== undefined) out[key] = first;
  }
  return out;
}

function roleNudges(context, kind) {
  const genres = new Set([context.primaryGenre, context.secondaryGenre]);
  const strength = context.balanceStrength * (kind === "similar" ? 0.55 : kind === "songVariations" ? 0.8 : 1);
  const character = {};
  const development = {};

  if (genres.has("pop")) {
    character.melodyMotion = 0.012 * strength;
    development.phraseDevelopment = 0.012 * strength;
    development.melodicContrast = 0.008 * strength;
    development.repetitionGuard = 0.012 * strength;
  }
  if (genres.has("hipHop")) {
    character.grooveDepth = 0.012 * strength;
    character.bassMotion = 0.01 * strength;
    development.grooveEvolution = 0.012 * strength;
    development.repetitionGuard = (development.repetitionGuard ?? 0) + 0.01 * strength;
  }
  if (genres.has("rap")) {
    character.space = 0.018 * strength;
    character.fillDelta = -0.004 * strength;
    development.breathingRoom = 0.02 * strength;
    development.phraseDevelopment = (development.phraseDevelopment ?? 0) + 0.012 * strength;
    development.repetitionGuard = (development.repetitionGuard ?? 0) + 0.012 * strength;
  }
  return { character, development };
}

function applyNudges(record, nudges) {
  const out = { ...record };
  for (const [key, delta] of Object.entries(nudges)) {
    if (!Number.isFinite(Number(out[key]))) continue;
    out[key] = round(clamp(finite(out[key]) + finite(delta), key.endsWith("Delta") ? -1 : 0, 1));
  }
  return out;
}

export function fusionCharacter(config = {}, resolver, { kind = "new" } = {}) {
  const context = popHipHopRapFusionContext(config);
  if (!context || typeof resolver !== "function") return null;
  const blended = blendNumericRecords(
    resolver(context.primaryGenre),
    resolver(context.secondaryGenre),
    context.blend,
  );
  return Object.freeze(applyNudges(blended, roleNudges(context, kind).character));
}

export function fusionDevelopment(config = {}, resolver, { kind = "new" } = {}) {
  const context = popHipHopRapFusionContext(config);
  if (!context || typeof resolver !== "function") return null;
  const blended = blendNumericRecords(
    resolver(context.primaryGenre),
    resolver(context.secondaryGenre),
    context.blend,
  );
  return Object.freeze(applyNudges(blended, roleNudges(context, kind).development));
}
