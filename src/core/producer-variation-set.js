import {
  ELEMENT_PROFILES,
  applyElementToGeneration,
  elementDisplayReading,
  resolveElementIntensity,
  resolveMoodIntent,
} from "./elemental-producer-system.js";

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
    chordPath: current?.settings?.chordPath ?? current?.meta?.chordPath ?? current?.chordPath,
  });
}

function familyFingerprint(current = {}) {
  const identity = sourceIdentity(current);
  return [
    current?.id ?? current?.seed ?? "song",
    identity.key ?? "auto-key",
    identity.mode ?? "auto-mode",
    identity.tempo ?? "auto-tempo",
    identity.bars ?? "auto-bars",
    identity.chordPath ?? "auto-chords",
  ].join(":");
}

// Compatibility export: callers can keep the old name while the semantics are
// now elemental personalities rather than mood-specific A/B/C roles.
export const PRODUCER_VARIATION_DIRECTIONS = ELEMENT_PROFILES;
export { ELEMENT_PROFILES };

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

function directionConfig(current, input, direction, seed, candidateCount, moodIntent, intensity) {
  const identity = sourceIdentity(current);
  const base = {
    ...input,
    count: undefined,
    candidatesPerVariation: undefined,
    elementIntensity: undefined,
    moodIntent: undefined,
    seed,
    candidateCount,
    adaptiveCandidates: false,
    targetedRepair: false,
    energy: clamp(sourceValue(current, input, "energy", moodIntent.targetEnergy)),
    complexity: clamp(sourceValue(current, input, "complexity", moodIntent.targetComplexity)),
    variation: clamp(sourceValue(current, input, "variation", 0.42)),
    evolution: clamp(sourceValue(current, input, "evolution", 0.58)),
    surprise: clamp(sourceValue(current, input, "surprise", 0.28)),
    syncopation: clamp(sourceValue(current, input, "syncopation", 0.38)),
  };
  const config = applyElementToGeneration(base, direction, {
    intensity,
    mood: moodIntent,
  });

  if (!config.compositionRoute) delete config.compositionRoute;
  if (identity.key != null) config.key = identity.key;
  if (identity.mode != null) config.mode = identity.mode;
  if (Number.isFinite(Number(identity.tempo))) config.tempo = Number(identity.tempo);
  if (Number.isFinite(Number(identity.bars))) config.bars = Number(identity.bars);
  if (identity.chordPath != null) config.chordPath = identity.chordPath;
  return config;
}

/**
 * Elemental Producer System: three recognizable interpretations of one parent
 * song. Mood describes what the song is; Fire/Electric/Drip describe how that
 * same song is produced. Each role auditions a bounded number of complete
 * arrangements, uses role-specific critic dimensions, and locks family identity.
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
  const moodIntent = resolveMoodIntent(input.moodIntent ?? current?.variationSet?.moodIntent ?? "balanced");
  const setId = `elemental-variation-${sourceSeed}`;
  const selected = [];

  for (const [index, direction] of ELEMENT_PROFILES.slice(0, count).entries()) {
    const intensity = resolveElementIntensity(direction, {
      seed: sourceSeed,
      requested: input.elementIntensity,
    });
    const reading = elementDisplayReading(direction, intensity);
    const auditions = [];
    for (let candidateIndex = 0; candidateIndex < candidatesPerVariation; candidateIndex += 1) {
      const seed = `${sourceSeed}:element:${direction.id}:${candidateIndex}`;
      const config = directionConfig(current, input, direction, seed, 1, moodIntent, intensity);
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
      version: 3,
      id: setId,
      index,
      total: count,
      sourceSongId: current.id ?? null,
      familyFingerprint: familyFingerprint(current),
      moodIntent: {
        id: moodIntent.id,
        label: moodIntent.label,
        description: moodIntent.description,
      },
      element: {
        id: direction.id,
        label: direction.label,
        symbol: direction.symbol,
        description: direction.description,
        intensity: Number(intensity.toFixed(4)),
        meter: reading,
      },
      // Keep the legacy direction field until the UI fully migrates.
      direction: {
        id: direction.id,
        label: direction.label,
        description: direction.description,
        route: directionConfig(current, input, direction, sourceSeed, 1, moodIntent, intensity).compositionRoute ?? null,
      },
      producerIntent: direction.id,
      directionScore: Number(producerVariationDirectionScore(winner, direction).toFixed(2)),
      auditions: candidatesPerVariation,
      identityLocked: {
        key: true,
        mode: true,
        tempo: true,
        bars: true,
        chordPath: sourceIdentity(current).chordPath != null,
      },
    };
    selected.push(winner);
  }

  return selected;
}
