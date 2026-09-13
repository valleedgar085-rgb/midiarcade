function clamp(value, min = 0, max = 1) {
  const numeric = Number(value);
  const fallback = Number.isFinite(numeric) ? numeric : min;
  return Math.min(max, Math.max(min, fallback));
}

function finite(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function average(values, fallback = 0) {
  const valid = values.map(Number).filter(Number.isFinite);
  if (!valid.length) return fallback;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function sourceValue(current, input, key, fallback) {
  const candidates = [
    input?.[key],
    current?.settings?.[key],
    current?.meta?.[key],
    current?.[key],
  ];
  for (const value of candidates) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return fallback;
}

function sourceIdentity(current = {}) {
  return Object.freeze({
    key: current?.meta?.key ?? current?.key ?? current?.settings?.key,
    mode: current?.meta?.mode ?? current?.meta?.scale ?? current?.mode ?? current?.settings?.mode,
    tempo: current?.meta?.tempo ?? current?.bpm ?? current?.settings?.tempo,
    bars: current?.settings?.bars ?? current?.meta?.bars,
  });
}

export const PRODUCER_VARIATION_DIRECTIONS = Object.freeze([
  Object.freeze({
    id: "balanced",
    label: "Balanced",
    description: "Neutral producer pass with controlled energy, density and movement.",
    route: null,
    similarity: 0.84,
    targetEnergy: 0.62,
    targetComplexity: 0.54,
    variationDelta: 0.01,
    evolutionDelta: 0.02,
    surpriseDelta: -0.05,
    syncopationDelta: 0,
    criticDimensions: Object.freeze(["groove", "motif", "harmonic", "storyArc", "production"]),
  }),
  Object.freeze({
    id: "romantic",
    label: "Romantic",
    description: "Warm love-song interpretation with sweeter harmony, softer dynamics and more melodic breathing room.",
    route: "harmony-first",
    similarity: 0.82,
    targetEnergy: 0.5,
    targetComplexity: 0.62,
    variationDelta: 0.04,
    evolutionDelta: 0.08,
    surpriseDelta: -0.08,
    syncopationDelta: -0.05,
    criticDimensions: Object.freeze(["harmonic", "voiceLeading", "motif", "phraseResolution", "performance", "separation"]),
  }),
  Object.freeze({
    id: "club",
    label: "Club",
    description: "High-energy performance version with stronger groove, transitions, low-end motion and impact.",
    route: "groove-first",
    similarity: 0.76,
    targetEnergy: 0.88,
    targetComplexity: 0.6,
    variationDelta: 0.12,
    evolutionDelta: 0.12,
    surpriseDelta: 0.07,
    syncopationDelta: 0.1,
    criticDimensions: Object.freeze(["groove", "drumVariety", "density", "transitions", "production", "stageInterlock"]),
  }),
]);

export function producerVariationDirectionScore(song, direction) {
  const details = song?.meta?.scoreDetails ?? {};
  const subscores = details.subscores ?? details.critic?.subscores ?? {};
  const overall = finite(details.totalScore ?? song?.meta?.qualityScore ?? song?.meta?.score, 0);
  const roleScore = average((direction?.criticDimensions ?? []).map((id) => subscores?.[id]), overall);
  const balance = finite(details.balance?.balanceScore, overall);
  const releasePassed = details.releaseGate?.passed !== false;
  const weighted = overall * 0.5 + roleScore * 0.4 + balance * 0.1;
  return releasePassed ? weighted : weighted - 20;
}

function directionConfig(current, input, direction, seed, candidateCount) {
  const identity = sourceIdentity(current);
  const sourceEnergy = clamp(sourceValue(current, input, "energy", 0.62));
  const sourceComplexity = clamp(sourceValue(current, input, "complexity", 0.54));
  const sourceVariation = clamp(sourceValue(current, input, "variation", 0.42));
  const sourceEvolution = clamp(sourceValue(current, input, "evolution", 0.58));
  const sourceSurprise = clamp(sourceValue(current, input, "surprise", 0.28));
  const sourceSyncopation = clamp(sourceValue(current, input, "syncopation", 0.38));
  const energy = clamp(sourceEnergy * 0.45 + direction.targetEnergy * 0.55);
  const complexity = clamp(sourceComplexity * 0.55 + direction.targetComplexity * 0.45);

  const config = {
    ...input,
    count: undefined,
    candidatesPerVariation: undefined,
    seed,
    candidateCount,
    adaptiveCandidates: false,
    targetedRepair: false,
    similarity: direction.similarity,
    energy,
    complexity,
    variation: clamp(sourceVariation + direction.variationDelta),
    evolution: clamp(sourceEvolution + direction.evolutionDelta),
    surprise: clamp(sourceSurprise + direction.surpriseDelta),
    syncopation: clamp(sourceSyncopation + direction.syncopationDelta),
  };

  if (direction.route) config.compositionRoute = direction.route;
  else delete config.compositionRoute;
  if (identity.key != null) config.key = identity.key;
  if (identity.mode != null) config.mode = identity.mode;
  if (Number.isFinite(Number(identity.tempo))) config.tempo = Number(identity.tempo);
  if (Number.isFinite(Number(identity.bars))) config.bars = Number(identity.bars);
  return config;
}

/**
 * Producer-facing A/B/C interpretations of one existing song. Each role gets
 * the same number of complete auditions, is scored against role-specific
 * critic dimensions, and keeps the source key/tempo identity locked.
 */
export function generateProducerVariationSet(current, input = {}, {
  generateSimilar,
} = {}) {
  if (!current || !Array.isArray(current.tracks) || !current.meta) {
    throw new TypeError("generateProducerVariationSet requires a generated song JSON object");
  }
  if (typeof generateSimilar !== "function") {
    throw new TypeError("generateProducerVariationSet requires generateSimilar");
  }
  const count = Math.min(3, Math.max(1, Math.round(finite(input.count, 3))));
  const candidatesPerVariation = Math.min(4, Math.max(1, Math.round(finite(input.candidatesPerVariation, 2))));
  const sourceSeed = String(input.seed ?? current.seed ?? current.id ?? "song");
  const setId = `producer-variation-${sourceSeed}`;
  const selected = [];

  for (const [index, direction] of PRODUCER_VARIATION_DIRECTIONS.slice(0, count).entries()) {
    const auditions = [];
    for (let candidateIndex = 0; candidateIndex < candidatesPerVariation; candidateIndex += 1) {
      const seed = `${sourceSeed}:producer-variation:${direction.id}:${candidateIndex}`;
      const config = directionConfig(current, input, direction, seed, 1);
      config.recentSongs = [current, ...selected, ...(input.recentSongs ?? [])];
      config.excludeOneShotKitIds = [
        current?.oneShotKit?.id,
        ...selected.map((song) => song?.oneShotKit?.id),
      ].filter(Boolean);
      const song = generateSimilar(current, config);
      auditions.push({
        song,
        score: producerVariationDirectionScore(song, direction),
      });
    }
    auditions.sort((left, right) => right.score - left.score);
    const winner = auditions[0]?.song;
    if (!winner) continue;
    winner.title = current.title;
    winner.parentId = current.id ?? null;
    winner.generation = "song-variation";
    winner.variationSet = {
      version: 2,
      id: setId,
      index,
      total: count,
      sourceSongId: current.id ?? null,
      direction: {
        id: direction.id,
        label: direction.label,
        description: direction.description,
        route: direction.route,
      },
      producerIntent: direction.id,
      directionScore: Number(producerVariationDirectionScore(winner, direction).toFixed(2)),
      auditions: candidatesPerVariation,
      identityLocked: {
        key: true,
        tempo: true,
      },
    };
    selected.push(winner);
  }

  return selected;
}
