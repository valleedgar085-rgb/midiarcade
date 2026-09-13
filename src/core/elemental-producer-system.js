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
    autoIntensity: Object.freeze([0.72, 0.92]),
    similarity: 0.84,
    targetEnergyDelta: 0.16,
    targetComplexityDelta: 0.02,
    variationDelta: 0.08,
    evolutionDelta: 0.06,
    surpriseDelta: 0.04,
    syncopationDelta: 0.02,
    balancedRoute: "groove-first",
    criticDimensions: Object.freeze(["groove", "drumVariety", "density", "transitions", "production", "stageInterlock"]),
  }),
  Object.freeze({
    id: "electric",
    label: "Electric",
    symbol: "⚡",
    metricLabel: "Charge",
    unit: "V",
    description: "Motion, spark and energy: brighter synthesis, quicker rhythmic movement and animated detail.",
    autoIntensity: Object.freeze([0.62, 0.86]),
    similarity: 0.82,
    targetEnergyDelta: 0.08,
    targetComplexityDelta: 0.1,
    variationDelta: 0.12,
    evolutionDelta: 0.14,
    surpriseDelta: 0.1,
    syncopationDelta: 0.12,
    balancedRoute: null,
    criticDimensions: Object.freeze(["motif", "performance", "separation", "transitions", "production", "storyArc"]),
  }),
  Object.freeze({
    id: "drip",
    label: "Drip",
    symbol: "💧",
    metricLabel: "Flow",
    unit: "mL/min",
    description: "Flow, space and emotion: smoother attacks, longer phrasing and more spatial breathing room.",
    autoIntensity: Object.freeze([0.7, 0.94]),
    similarity: 0.86,
    targetEnergyDelta: -0.08,
    targetComplexityDelta: 0.04,
    variationDelta: 0.05,
    evolutionDelta: 0.08,
    surpriseDelta: -0.04,
    syncopationDelta: -0.02,
    balancedRoute: "harmony-first",
    criticDimensions: Object.freeze(["harmonic", "voiceLeading", "motif", "phraseResolution", "performance", "separation"]),
  }),
]);

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
  return moodIntent.route ?? profile.balancedRoute ?? null;
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
    compositionRoute: elementRoute(profile, moodIntent),
    moodIntent: moodIntent.id,
    element: profile.id,
    elementIntensity: strength,
  };
}
