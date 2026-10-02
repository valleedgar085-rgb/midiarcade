export const REFERENCE_PROFILE_VERSION = 1;
export const REFERENCE_ENGINE_VERSION = 1;
export const MAX_REFERENCE_STRENGTH = 0.35;
export const DEFAULT_REFERENCE_STRENGTH = 0.22;

const GROOVE_CHOICES = Object.freeze({
  drumGroove: Object.freeze(["fourFloor", "backbeat", "halfTime", "breakbeat", "electro"]),
  bassGroove: Object.freeze(["root", "syncopated", "pulse", "walking"]),
  chordMotion: Object.freeze(["sustain", "pulse", "offbeat", "arpeggio"]),
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, finite(value, min)));
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function scalar(value) {
  return value == null ? null : round(clamp(value));
}

function boundedBars(value) {
  if (value == null) return null;
  return Math.min(8, Math.max(2, Math.round(finite(value, 4))));
}

function normalizeWeights(value, allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return Object.freeze({});
  const entries = Object.entries(value)
    .filter(([key]) => allowed.includes(key))
    .map(([key, weight]) => [key, round(clamp(weight))])
    .filter(([, weight]) => weight > 0);
  return Object.freeze(Object.fromEntries(entries));
}

export function normalizeReferenceProfile(profile, { genre = null } = {}) {
  if (!profile || typeof profile !== "object") return null;
  const profileGenre = String(profile.genre ?? "").trim();
  const expectedGenre = String(genre ?? "").trim();
  const traits = profile.traits && typeof profile.traits === "object" ? profile.traits : {};
  const style = profile.stylePreferences && typeof profile.stylePreferences === "object"
    ? profile.stylePreferences
    : {};
  const sourceCount = Math.max(0, Math.min(999, Math.round(finite(profile.sourceCount, 0))));
  const confidence = clamp(profile.confidence, sourceCount >= 3 ? 0.8 : sourceCount ? 0.62 : 0.5);

  return Object.freeze({
    version: REFERENCE_PROFILE_VERSION,
    id: String(profile.id ?? `reference-${profileGenre || expectedGenre || "profile"}`).slice(0, 100),
    genre: profileGenre || expectedGenre || null,
    sourceCount,
    confidence: round(confidence),
    traits: Object.freeze({
      syncopation: scalar(traits.syncopation),
      swing: scalar(traits.swing),
      humanize: scalar(traits.humanize),
      phraseBars: boundedBars(traits.phraseBars),
      density: scalar(traits.density),
      bassActivity: scalar(traits.bassActivity),
      bassLock: scalar(traits.bassLock),
      melodySpace: scalar(traits.melodySpace),
      supportRestraint: scalar(traits.supportRestraint),
      introRestraint: scalar(traits.introRestraint),
      payoffLift: scalar(traits.payoffLift),
      transitionBreath: scalar(traits.transitionBreath),
    }),
    stylePreferences: Object.freeze({
      drumGroove: normalizeWeights(style.drumGroove, GROOVE_CHOICES.drumGroove),
      bassGroove: normalizeWeights(style.bassGroove, GROOVE_CHOICES.bassGroove),
      chordMotion: normalizeWeights(style.chordMotion, GROOVE_CHOICES.chordMotion),
    }),
  });
}

function blendScalar(base, target, amount) {
  if (target == null) return round(base);
  return round(clamp(finite(base) + (finite(target) - finite(base)) * clamp(amount)));
}

function explicitMap(input = {}) {
  const present = (key) => input[key] !== undefined && input[key] !== null && input[key] !== "";
  return Object.freeze({
    syncopation: present("syncopation"),
    swing: present("swing"),
    humanize: present("humanize"),
    phraseBars: present("phraseBars"),
    groove: present("groove") && String(input.groove).trim().toLowerCase() !== "auto",
    energy: present("energy"),
    complexity: present("complexity"),
    variation: present("variation"),
    evolution: present("evolution"),
    surprise: present("surprise"),
    key: present("key"),
    scale: present("scale") || present("mode"),
  });
}

export function resolveReferenceInfluence(input = {}, {
  genre,
  defaults = {},
} = {}) {
  const profile = normalizeReferenceProfile(input.referenceProfile, { genre });
  const explicit = explicitMap(input);
  const requestedStrength = input.referenceStrength == null
    ? DEFAULT_REFERENCE_STRENGTH
    : finite(input.referenceStrength, DEFAULT_REFERENCE_STRENGTH);
  const strength = round(Math.min(MAX_REFERENCE_STRENGTH, Math.max(0, requestedStrength)));
  const genreMatches = !profile?.genre || !genre || String(profile.genre) === String(genre);
  const active = Boolean(profile && genreMatches && strength > 0);
  const confidenceWeight = active ? round(strength * clamp(profile.confidence, 0.35, 1)) : 0;
  const traits = profile?.traits ?? {};

  const syncopation = explicit.syncopation || !active
    ? finite(input.syncopation, defaults.syncopation)
    : blendScalar(defaults.syncopation, traits.syncopation, confidenceWeight);
  const swing = explicit.swing || !active
    ? finite(input.swing, defaults.swing)
    : blendScalar(defaults.swing, traits.swing, confidenceWeight);
  const humanize = explicit.humanize || !active
    ? finite(input.humanize, defaults.humanize)
    : blendScalar(defaults.humanize, traits.humanize, confidenceWeight);

  const phraseBars = explicit.phraseBars || !active || traits.phraseBars == null
    ? null
    : Math.round(
      finite(defaults.phraseBars, traits.phraseBars)
      + (traits.phraseBars - finite(defaults.phraseBars, traits.phraseBars)) * confidenceWeight,
    );

  return Object.freeze({
    version: REFERENCE_ENGINE_VERSION,
    authority: "reference-profile-engine-v1",
    active,
    reason: !profile ? "no-profile"
      : !genreMatches ? "genre-mismatch"
        : strength <= 0 ? "disabled"
          : "soft-bias",
    profile,
    genre: genre ?? null,
    strength,
    confidenceWeight,
    explicit,
    controls: Object.freeze({
      syncopation: round(clamp(syncopation)),
      swing: round(clamp(swing)),
      humanize: round(clamp(humanize)),
      phraseBars: phraseBars == null ? null : Math.min(8, Math.max(2, phraseBars)),
    }),
    arrangement: Object.freeze({
      density: active ? traits.density : null,
      bassActivity: active ? traits.bassActivity : null,
      bassLock: active ? traits.bassLock : null,
      melodySpace: active ? traits.melodySpace : null,
      supportRestraint: active ? traits.supportRestraint : null,
      introRestraint: active ? traits.introRestraint : null,
      payoffLift: active ? traits.payoffLift : null,
      transitionBreath: active ? traits.transitionBreath : null,
    }),
    stylePreferences: active ? profile.stylePreferences : Object.freeze({
      drumGroove: Object.freeze({}),
      bassGroove: Object.freeze({}),
      chordMotion: Object.freeze({}),
    }),
    protectedAuthorities: Object.freeze([
      "key",
      "scale",
      "groove-pocket",
      "structure-director",
      "groove-dna",
      "explicit-user-controls",
    ]),
  });
}

export function referenceStyleBonus(influence, field, choice, scale = 1) {
  if (!influence?.active) return 0;
  const weight = finite(influence?.stylePreferences?.[field]?.[choice], 0);
  return round(weight * influence.confidenceWeight * Math.max(0, finite(scale, 1)));
}

export function referenceStageEnergyNudge(influence, stage) {
  if (!influence?.active) return 0;
  const arrangement = influence.arrangement ?? {};
  if (stage === "establish") {
    return round(-0.08 * finite(arrangement.introRestraint, 0.5) * influence.confidenceWeight);
  }
  if (stage === "payoff") {
    return round(0.08 * finite(arrangement.payoffLift, 0.5) * influence.confidenceWeight);
  }
  if (stage === "reset" || stage === "resolve") {
    return round(-0.05 * finite(arrangement.transitionBreath, 0.5) * influence.confidenceWeight);
  }
  return 0;
}

export function referenceSilenceBudgetNudge(influence, purpose) {
  if (!influence?.active) return 0;
  const arrangement = influence.arrangement ?? {};
  const melodySpace = finite(arrangement.melodySpace, 0.5);
  const restraint = finite(arrangement.supportRestraint, 0.5);
  const transitionBreath = finite(arrangement.transitionBreath, 0.5);
  const base = purpose === "payoff"
    ? melodySpace * 0.3
    : purpose === "reset" || purpose === "resolve"
      ? transitionBreath
      : (melodySpace + restraint) / 2;
  return round((base - 0.5) * 0.12 * influence.confidenceWeight);
}

export function referenceDensityNudge(influence, purpose) {
  if (!influence?.active) return 0;
  const density = finite(influence?.arrangement?.density, 0.5);
  const restraint = finite(influence?.arrangement?.supportRestraint, 0.5);
  const direction = (density - 0.5) * 0.12 - (restraint - 0.5) * 0.08;
  const payoffMultiplier = purpose === "payoff" ? 1.15 : purpose === "establish" ? 0.75 : 1;
  return round(direction * payoffMultiplier * influence.confidenceWeight);
}
