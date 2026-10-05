import { normalizeGenreId } from "./genre-contract.js";

export const MAX_GENRE_SCALE_BONUS = 0.08;

const RANK_BONUS = Object.freeze([0.08, 0.07, 0.06, 0.05, 0.04, 0.03]);

const GENRE_ALIASES = Object.freeze({
  "afro cuban latin jazz": "afroCubanLatinJazz",
  "afro-cuban latin jazz": "afroCubanLatinJazz",
  "afro-cuban/latin jazz": "afroCubanLatinJazz",
  "latin jazz": "afroCubanLatinJazz",
  latinjazz: "afroCubanLatinJazz",
  afrocubanlatinjazz: "afroCubanLatinJazz",
});

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

function aliasKey(value) {
  return String(value ?? "")
    .trim()
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function ranked(scales) {
  return Object.freeze(scales.map((scale, index) => Object.freeze({
    scale,
    rank: index + 1,
    bonus: RANK_BONUS[index] ?? 0,
  })));
}

/**
 * Research-backed genre priors.
 *
 * These are intentionally soft preferences, not legality rules. The maximum
 * bonus is only +0.08 so chord fit, melody fit, voice leading, and phrase
 * context can override genre preference.
 *
 * Engine naming is used where an equivalent exists:
 * - Ionian -> major
 * - Aeolian -> minor
 * - half-whole diminished -> diminishedHalfWhole
 *
 * Two blues research labels (majorBlues, majorMinorHybrid) are retained even
 * though the current scale guide does not yet expose them. They therefore
 * receive no effect unless a future candidate set explicitly includes them.
 */
export const GENRE_SCALE_PRIORS = Object.freeze({
  jazz: ranked([
    "dorian",
    "mixolydian",
    "major",
    "lydian",
    "altered",
    "melodicMinor",
  ]),
  rock: ranked([
    "minorPentatonic",
    "major",
    "mixolydian",
    "blues",
    "minor",
    "dorian",
  ]),
  blues: ranked([
    "minorPentatonic",
    "blues",
    "majorPentatonic",
    "majorBlues",
    "mixolydian",
    "majorMinorHybrid",
  ]),
  pop: ranked([
    "major",
    "minor",
    "majorPentatonic",
    "minorPentatonic",
    "mixolydian",
    "dorian",
  ]),
  metal: ranked([
    "minor",
    "phrygian",
    "minorPentatonic",
    "harmonicMinor",
    "dorian",
    "phrygianDominant",
  ]),
  afroCubanLatinJazz: ranked([
    "mixolydian",
    "dorian",
    "major",
    "blues",
    "altered",
    "harmonicMinor",
  ]),
});

export function normalizeGenreScalePriorId(value) {
  const canonical = normalizeGenreId(value);
  if (hasOwn(GENRE_SCALE_PRIORS, canonical)) return canonical;

  const direct = Object.keys(GENRE_SCALE_PRIORS)
    .find((id) => id.toLowerCase() === String(canonical ?? "").trim().toLowerCase());
  if (direct) return direct;

  const key = aliasKey(value);
  return hasOwn(GENRE_ALIASES, key) ? GENRE_ALIASES[key] : canonical;
}

export function genreScalePalette(genre) {
  const id = normalizeGenreScalePriorId(genre);
  return hasOwn(GENRE_SCALE_PRIORS, id)
    ? GENRE_SCALE_PRIORS[id]
    : Object.freeze([]);
}

export function genreScalePriorBonus(genre, scale) {
  const target = String(scale ?? "").trim();
  if (!target) return 0;
  return genreScalePalette(genre).find((entry) => entry.scale === target)?.bonus ?? 0;
}

export function genreScalePriorRank(genre, scale) {
  const target = String(scale ?? "").trim();
  if (!target) return null;
  return genreScalePalette(genre).find((entry) => entry.scale === target)?.rank ?? null;
}

export const GENRE_SCALE_PRIORS_VERSION = "1.0";
