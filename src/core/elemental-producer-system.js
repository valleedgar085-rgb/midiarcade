function clamp(value, min = 0, max = 1) {
  const numeric = Number(value);
  const fallback = Number.isFinite(numeric) ? numeric : min;
  return Math.min(max, Math.max(min, fallback));
}

function hashUnit(value) {
  let hash = 2166136261;
  const text = String(value ?? "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967295;
}

function offsetTrackValue(value, delta, strength, min = 0, max = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return clamp(numeric + Number(delta || 0) * strength, min, max);
}

export const ELEMENT_DISPLAY_MAX = 3000;

export const MOOD_INTENTS = Object.freeze({
  balanced: Object.freeze({
    id: "balanced",
    label: "Balanced",
    description: "Controlled energy, density and movement with no single production trait dominating.",
    route: null,
    targetEnergy: 0.62,
    targetComplexity: 0.54,
    variationDelta: 0,
    evolutionDelta: 0,
    surpriseDelta: 0,
    syncopationDelta: 0,
  }),
  romantic: Object.freeze({
    id: "romantic",
    label: "Romantic",
    description: "Warm, expressive intent with sweeter harmony, softer dynamics and more melodic breathing room.",
    route: "harmony-first",
    targetEnergy: 0.5,
    targetComplexity: 0.62,
    variationDelta: 0.03,
    evolutionDelta: 0.06,
    surpriseDelta: -0.06,
    syncopationDelta: -0.04,
  }),
  club: Object.freeze({
    id: "club",
    label: "Club",
    description: "Dance-floor intent with stronger groove, transitions, low-end motion and impact.",
    route: "groove-first",
    targetEnergy: 0.86,
    targetComplexity: 0.6,
    variationDelta: 0.08,
    evolutionDelta: 0.08,
    surpriseDelta: 0.04,
    syncopationDelta: 0.08,
  }),
});

export const ELEMENT_PROFILES = Object.freeze([
  Object.freeze({
    id: "fire",
    label: "Fire",
    symbol: "🔥",
    metricLabel: "Heat",
    unit: "°F",
    description: "Heat, punch and impact: harder transients, stronger low-end accents and bigger transitions.",
    autoIntensity: Object.freeze([0.76, 0.96]),
    similarity: 0.74,
    targetEnergyDelta: 0.2,
    targetComplexityDelta: 0.01,
    variationDelta: 0.12,
    evolutionDelta: 0.08,
    surpriseDelta: 0.05,
    syncopationDelta: 0.04,
    balancedRoute: "groove-first",
    criticDimensions: Object.freeze(["groove", "drumVariety", "density", "transitions", "production", "stageInterlock"]),
  }),
  Object.freeze({
    id: "electric",
    label: "Electric",
    symbol: "⚡",
    metricLabel: "Voltage",
    unit: "V",
    description: "Motion, spark and energy: brighter synthesis, quicker rhythmic movement and animated detail.",
    autoIntensity: Object.freeze([0.7, 0.92]),
    similarity: 0.7,
    targetEnergyDelta: 0.12,
    targetComplexityDelta: 0.16,
    variationDelta: 0.18,
    evolutionDelta: 0.2,
    surpriseDelta: 0.16,
    syncopationDelta: 0.2,
    balancedRoute: "hook-first",
    criticDimensions: Object.freeze(["motif", "performance", "separation", "transitions", "production", "storyArc"]),
  }),
  Object.freeze({
    id: "drip",
    label: "Drip",
    symbol: "💧",
    metricLabel: "Flow",
    unit: "mL/min",
    description: "Flow, space and emotion: smoother attacks, longer phrasing and more spatial breathing room.",
    autoIntensity: Object.freeze([0.74, 0.96]),
    similarity: 0.76,
    targetEnergyDelta: -0.14,
    targetComplexityDelta: 0.06,
    variationDelta: 0.06,
    evolutionDelta: 0.12,
    surpriseDelta: -0.08,
    syncopationDelta: -0.06,
    balancedRoute: "harmony-first",
    criticDimensions: Object.freeze(["harmonic", "voiceLeading", "motif", "phraseResolution", "performance", "separation"]),
  }),
]);

const ELEMENT_TRACK_SHAPES = Object.freeze({
  fire: Object.freeze({
    drums: Object.freeze({ density: 0.14, variation: 0.12, humanize: -0.04 }),
    bass: Object.freeze({ density: 0.1, variation: 0.08, humanize: -0.02 }),
    chords: Object.freeze({ density: -0.04, variation: 0.03, humanize: -0.02 }),
    melody: Object.freeze({ density: 0.02, variation: 0.06, humanize: -0.01 }),
    counterpoint: Object.freeze({ density: -0.04, variation: 0.04, humanize: -0.02 }),
    pad: Object.freeze({ density: -0.12, variation: -0.02, humanize: -0.02 }),
  }),
  electric: Object.freeze({
    drums: Object.freeze({ density: 0.08, variation: 0.18, humanize: 0.04 }),
    bass: Object.freeze({ density: 0.1, variation: 0.16, humanize: 0.04 }),
    chords: Object.freeze({ density: 0.07, variation: 0.16, humanize: 0.05 }),
    melody: Object.freeze({ density: 0.12, variation: 0.22, humanize: 0.06 }),
    counterpoint: Object.freeze({ density: 0.16, variation: 0.24, humanize: 0.06 }),
    pad: Object.freeze({ density: 0.05, variation: 0.16, humanize: 0.04 }),
  }),
  drip: Object.freeze({
    drums: Object.freeze({ density: -0.12, variation: -0.04, humanize: 0.06 }),
    bass: Object.freeze({ density: -0.07, variation: 0.02, humanize: 0.05 }),
    chords: Object.freeze({ density: -0.08, variation: 0.05, humanize: 0.05 }),
    melody: Object.freeze({ density: -0.08, variation: 0.08, humanize: 0.07 }),
    counterpoint: Object.freeze({ density: -0.14, variation: 0.06, humanize: 0.07 }),
    pad: Object.freeze({ density: 0.08, variation: 0.04, humanize: 0.04 }),
  }),
});

function applyElementTrackShape(tracks, elementId, strength) {
  if (!tracks || typeof tracks !== "object") return tracks;
  const shape = ELEMENT_TRACK_SHAPES[elementId];
  if (!shape) return tracks;
  return Object.fromEntries(Object.entries(tracks).map(([id, source]) => {
    const deltas = shape[id];
    if (!deltas || !source || typeof source !== "object") return [id, source];
    return [id, {
      ...source,
      density: offsetTrackValue(source.density, deltas.density, strength),
      variation: offsetTrackValue(source.variation, deltas.variation, strength),
      humanize: offsetTrackValue(source.humanize, deltas.humanize, strength),
    }];
  }));
}

export function resolveMoodIntent(value) {
  const source = typeof value === "object" && value !== null ? value.id : value;
  const id = String(source ?? "balanced").trim().toLowerCase();
  return MOOD_INTENTS[id] ?? MOOD_INTENTS.balanced;
}

export function resolveElementProfile(value) {
  const id = typeof value === "object" ? value?.id : value;
  return ELEMENT_PROFILES.find((profile) => profile.id === String(id ?? "").toLowerCase()) ?? ELEMENT_PROFILES[0];
}

export function resolveElementIntensity(element, {
  seed = "song",
  requested,
} = {}) {
  const profile = resolveElementProfile(element);
  const direct = typeof requested === "object" && requested !== null
    ? requested[profile.id]
    : requested;
  if (Number.isFinite(Number(direct))) return clamp(Number(direct));
  const [min, max] = profile.autoIntensity;
  return clamp(min + (max - min) * hashUnit(`${seed}:element-intensity:${profile.id}`));
}

export function elementDisplayReading(element, intensity) {
  const profile = resolveElementProfile(element);
  const normalized = clamp(intensity);
  return Object.freeze({
    element: profile.id,
    label: profile.metricLabel,
    value: Math.round(normalized * ELEMENT_DISPLAY_MAX),
    unit: profile.unit,
    max: ELEMENT_DISPLAY_MAX,
  });
}

export function elementRoute(element, mood) {
  const profile = resolveElementProfile(element);
  const moodIntent = resolveMoodIntent(mood);
  // Element is the production/composition personality. Mood still changes the
  // numeric targets, but must not collapse all three Elements onto one route.
  return profile.balancedRoute ?? moodIntent.route ?? null;
}

export function applyElementToGeneration(base, element, {
  intensity,
  mood = "balanced",
} = {}) {
  const profile = resolveElementProfile(element);
  const moodIntent = resolveMoodIntent(mood);
  const strength = clamp(intensity);
  const sourceEnergy = clamp(base.energy ?? moodIntent.targetEnergy);
  const sourceComplexity = clamp(base.complexity ?? moodIntent.targetComplexity);
  const moodEnergy = clamp(sourceEnergy * 0.45 + moodIntent.targetEnergy * 0.55);
  const moodComplexity = clamp(sourceComplexity * 0.55 + moodIntent.targetComplexity * 0.45);
  return {
    ...base,
    similarity: profile.similarity,
    energy: clamp(moodEnergy + profile.targetEnergyDelta * strength),
    complexity: clamp(moodComplexity + profile.targetComplexityDelta * strength),
    variation: clamp((base.variation ?? 0.42) + moodIntent.variationDelta + profile.variationDelta * strength),
    evolution: clamp((base.evolution ?? 0.58) + moodIntent.evolutionDelta + profile.evolutionDelta * strength),
    surprise: clamp((base.surprise ?? 0.28) + moodIntent.surpriseDelta + profile.surpriseDelta * strength),
    syncopation: clamp((base.syncopation ?? 0.38) + moodIntent.syncopationDelta + profile.syncopationDelta * strength),
    tracks: applyElementTrackShape(base.tracks, profile.id, strength),
    compositionRoute: elementRoute(profile, moodIntent),
    moodIntent: moodIntent.id,
    element: profile.id,
    elementIntensity: strength,
  };
}
