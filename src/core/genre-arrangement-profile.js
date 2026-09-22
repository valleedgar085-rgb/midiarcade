function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function pickWeighted(entries = [], rng) {
  const clean = entries
    .map((entry) => ({ ...entry, weight: Number(entry?.weight ?? 0) }))
    .filter((entry) => entry.weight > 0);
  if (!clean.length) return entries[0] ?? null;
  const total = clean.reduce((sum, entry) => sum + entry.weight, 0);
  let cursor = (rng?.float?.() ?? 0) * total;
  for (const entry of clean) {
    cursor -= entry.weight;
    if (cursor <= 0) return entry;
  }
  return clean[clean.length - 1];
}

const DEFAULT_PROFILE = Object.freeze({
  id: "general",
  phraseBars: [4],
  rhythmTemplates: [
    { id: "grid-pocket", weight: 1, steps: [0, 4, 8, 12], syncopationBias: 0.24 },
  ],
  harmonicGoals: [
    { id: "I-IV-V-I", weight: 1, sections: ["verse", "chorus", "idea", "theme"], moods: ["calm", "neutral", "intense"], progression: [0, 3, 4, 0] },
  ],
  melodyMotion: { stepBias: 0.72, legatoBias: 0.34, staccatoBias: 0.2 },
  humanization: { laidBackOffsetBeats: 0, gridJitterAttenuation: 0.5, velocityVarianceScale: 1 },
  optionalLayers: [
    { id: "pad-swells", trackId: "pad", instrument: "pads", sections: ["intro", "chorus", "bridge", "breakdown", "outro"], probability: 0.18, durationBeats: 2, startOffsets: [0], velocityRange: [52, 84], degreeOffsets: [0, 3, 4] },
  ],
});

const PROFILES = Object.freeze({
  pop: {
    id: "pop",
    phraseBars: [4, 8],
    rhythmTemplates: [
      { id: "anthem-grid", weight: 1.8, steps: [0, 4, 8, 12], syncopationBias: 0.24 },
      { id: "lifted-offbeat", weight: 1.2, steps: [0, 6, 8, 12, 14], syncopationBias: 0.34 },
    ],
    harmonicGoals: [
      { id: "I-V-vi-IV", weight: 1.5, sections: ["verse", "chorus", "drop", "theme"], moods: ["neutral", "intense"], progression: [0, 4, 5, 3] },
      { id: "I-IV-V-I", weight: 1.3, sections: ["verse", "chorus", "idea"], moods: ["calm", "neutral", "intense"], progression: [0, 3, 4, 0] },
      { id: "prechorus-lift", weight: 1.25, sections: ["prechorus"], moods: ["calm", "neutral", "intense"], progression: [3, 4, 4, 4] },
      { id: "ii-V-I", weight: 0.7, sections: ["bridge"], moods: ["neutral", "intense"], progression: [1, 4, 0, 0] },
    ],
    melodyMotion: { stepBias: 0.7, legatoBias: 0.32, staccatoBias: 0.24 },
    humanization: { laidBackOffsetBeats: 0, gridJitterAttenuation: 0.54, velocityVarianceScale: 0.96 },
    optionalLayers: [
      { id: "pad-swells", trackId: "pad", instrument: "pads", sections: ["intro", "chorus", "bridge", "outro"], probability: 0.18, durationBeats: 3.5, startOffsets: [0], velocityRange: [56, 88], degreeOffsets: [0, 3, 4] },
      { id: "bells", trackId: "melody", instrument: "bells", sections: ["chorus", "drop"], probability: 0.11, durationBeats: 0.5, startOffsets: [1.5, 3], velocityRange: [62, 96], degreeOffsets: [4, 5] },
      { id: "perc-spark", trackId: "drums", instrument: "percussion", sections: ["verse", "chorus", "drop"], probability: 0.14, durationBeats: 0.12, startOffsets: [0.75, 2.75], velocityRange: [54, 92], drumPitches: [56, 75] },
    ],
  },
  hipHopTrap: {
    id: "hipHopTrap",
    phraseBars: [4, 8],
    rhythmTemplates: [
      { id: "half-time-pocket", weight: 1.8, steps: [0, 3, 8, 11, 14], syncopationBias: 0.46 },
      { id: "triplet-turn", weight: 1.2, steps: [0, 2, 5, 8, 10, 13], syncopationBias: 0.58 },
    ],
    harmonicGoals: [
      { id: "i-bVII-bVI", weight: 1.4, sections: ["verse", "chorus", "drop"], moods: ["neutral", "intense"], progression: [0, 6, 5, 0] },
      { id: "i-iv-v-i", weight: 1.1, sections: ["verse", "bridge"], moods: ["calm", "neutral"], progression: [0, 3, 4, 0] },
      { id: "I-bVII-IV-I", weight: 1.35, sections: ["verse", "chorus", "bridge"], moods: ["neutral", "intense"], progression: [0, 6, 3, 0] },
      { id: "i-bVII-bVI-bVII", weight: 1.05, sections: ["verse", "bridge"], moods: ["calm", "neutral", "intense"], progression: [0, 6, 5, 6] },
    ],
    melodyMotion: { stepBias: 0.76, legatoBias: 0.36, staccatoBias: 0.22 },
    humanization: { laidBackOffsetBeats: 0.016, gridJitterAttenuation: 0.5, velocityVarianceScale: 1.04 },
    optionalLayers: [
      { id: "bass-stabs", trackId: "bass", instrument: "bass-stabs", sections: ["verse", "chorus", "drop"], probability: 0.2, durationBeats: 0.45, startOffsets: [0.5, 2.5, 3.5], velocityRange: [62, 102], degreeOffsets: [0, 4] },
      { id: "plucks", trackId: "counterpoint", instrument: "plucks", sections: ["verse", "chorus"], probability: 0.14, durationBeats: 0.3, startOffsets: [1.25, 2.75], velocityRange: [58, 92], degreeOffsets: [2, 4, 5] },
      { id: "fx-hit", trackId: "pad", instrument: "fx", sections: ["build", "drop"], probability: 0.12, durationBeats: 1.5, startOffsets: [3], velocityRange: [44, 78], degreeOffsets: [4, 6] },
    ],
  },
  lofi: {
    id: "lofi",
    phraseBars: [4, 8],
    rhythmTemplates: [
      { id: "dusty-swing", weight: 1.6, steps: [0, 5, 8, 11, 14], syncopationBias: 0.42 },
      { id: "lazy-loop", weight: 1.1, steps: [0, 4, 7, 10, 13], syncopationBias: 0.38 },
    ],
    harmonicGoals: [
      { id: "ii-V-I", weight: 1.2, sections: ["verse", "bridge", "idea"], moods: ["calm", "neutral"], progression: [1, 4, 0, 0] },
      { id: "I-IV-V-I", weight: 1, sections: ["verse", "chorus"], moods: ["neutral"], progression: [0, 3, 4, 0] },
      { id: "modal-interchange", weight: 1.1, sections: ["bridge", "breakdown"], moods: ["calm", "intense"], progression: [0, 5, 6, 4] },
    ],
    melodyMotion: { stepBias: 0.82, legatoBias: 0.42, staccatoBias: 0.14 },
    humanization: { laidBackOffsetBeats: 0.016, gridJitterAttenuation: 0.64, velocityVarianceScale: 1.1 },
    optionalLayers: [
      { id: "pad-swells", trackId: "pad", instrument: "pads", sections: ["intro", "verse", "bridge", "outro"], probability: 0.24, durationBeats: 3.8, startOffsets: [0], velocityRange: [48, 78], degreeOffsets: [0, 3, 5] },
      { id: "bells", trackId: "counterpoint", instrument: "bells", sections: ["bridge", "breakdown"], probability: 0.1, durationBeats: 0.5, startOffsets: [1.5, 3.5], velocityRange: [54, 84], degreeOffsets: [4, 5, 6] },
    ],
  },
  edm: {
    id: "edm",
    phraseBars: [8],
    rhythmTemplates: [
      { id: "four-floor-drive", weight: 1.9, steps: [0, 4, 8, 12], syncopationBias: 0.2 },
      { id: "club-sync", weight: 1.1, steps: [0, 3, 7, 8, 12, 15], syncopationBias: 0.34 },
    ],
    harmonicGoals: [
      { id: "I-IV-V-I", weight: 1.4, sections: ["verse", "chorus", "drop", "build"], moods: ["neutral", "intense"], progression: [0, 3, 4, 0] },
      { id: "ii-V-I", weight: 0.9, sections: ["build", "bridge"], moods: ["intense"], progression: [1, 4, 0, 0] },
      { id: "modal-interchange", weight: 1, sections: ["breakdown"], moods: ["calm", "neutral"], progression: [0, 6, 5, 4] },
    ],
    melodyMotion: { stepBias: 0.66, legatoBias: 0.28, staccatoBias: 0.3 },
    humanization: { laidBackOffsetBeats: 0, gridJitterAttenuation: 0.46, velocityVarianceScale: 0.92 },
    optionalLayers: [
      { id: "pluck-riff", trackId: "counterpoint", instrument: "plucks", sections: ["chorus", "drop", "build"], probability: 0.16, durationBeats: 0.25, startOffsets: [0.5, 1.5, 2.5, 3.5], velocityRange: [62, 104], degreeOffsets: [0, 2, 4] },
      { id: "fx-hit", trackId: "pad", instrument: "fx", sections: ["build", "drop"], probability: 0.18, durationBeats: 1.2, startOffsets: [3], velocityRange: [40, 72], degreeOffsets: [5, 6] },
      { id: "perc-spark", trackId: "drums", instrument: "percussion", sections: ["verse", "chorus", "drop"], probability: 0.12, durationBeats: 0.12, startOffsets: [0.75, 1.75, 2.75, 3.75], velocityRange: [58, 98], drumPitches: [56, 70, 75] },
    ],
  },
  techno: {
    id: "techno",
    phraseBars: [8],
    rhythmTemplates: [
      { id: "machine-drive", weight: 2.2, steps: [0, 4, 8, 12], syncopationBias: 0.12 },
      { id: "offbeat-pressure", weight: 1.5, steps: [0, 4, 6, 8, 12, 14], syncopationBias: 0.24 },
      { id: "rolling-eighths", weight: 1.1, steps: [0, 2, 4, 6, 8, 10, 12, 14], syncopationBias: 0.18 },
    ],
    harmonicGoals: [
      { id: "pedal-minor", weight: 1.8, sections: ["build", "drop", "breakdown"], moods: ["calm", "neutral", "intense"], progression: [0, 0, 5, 0] },
      { id: "i-bVII-cycle", weight: 1.5, sections: ["build", "drop"], moods: ["neutral", "intense"], progression: [0, 6, 0, 6] },
      { id: "modal-pressure", weight: 1.1, sections: ["breakdown", "build"], moods: ["calm", "neutral", "intense"], progression: [0, 5, 6, 0] },
    ],
    melodyMotion: { stepBias: 0.78, legatoBias: 0.2, staccatoBias: 0.48 },
    humanization: { laidBackOffsetBeats: 0, gridJitterAttenuation: 0.34, velocityVarianceScale: 0.86 },
    optionalLayers: [
      { id: "machine-pulse", trackId: "counterpoint", instrument: "sequence", sections: ["build", "drop"], probability: 0.2, durationBeats: 0.22, startOffsets: [0.5, 1.5, 2.5, 3.5], velocityRange: [58, 94], degreeOffsets: [0, 2, 4] },
      { id: "rave-fx", trackId: "pad", instrument: "fx", sections: ["build", "drop", "breakdown"], probability: 0.22, durationBeats: 1.4, startOffsets: [2.5, 3], velocityRange: [40, 72], degreeOffsets: [5, 6] },
      { id: "metal-perc", trackId: "drums", instrument: "percussion", sections: ["build", "drop"], probability: 0.14, durationBeats: 0.1, startOffsets: [0.75, 1.75, 2.75, 3.75], velocityRange: [54, 90], drumPitches: [56, 70, 75] },
    ],
  },
  rnb: {
    id: "rnb",
    phraseBars: [4, 8],
    rhythmTemplates: [
      { id: "silk-push", weight: 1.6, steps: [0, 5, 8, 10, 14], syncopationBias: 0.5 },
      { id: "breathing-pocket", weight: 1.2, steps: [0, 4, 9, 12, 15], syncopationBias: 0.44 },
    ],
    harmonicGoals: [
      { id: "ii-V-I", weight: 1.5, sections: ["verse", "chorus", "bridge"], moods: ["calm", "neutral", "intense"], progression: [1, 4, 0, 0] },
      { id: "I-IV-V-I", weight: 1.1, sections: ["verse", "chorus"], moods: ["neutral"], progression: [0, 3, 4, 0] },
      { id: "modal-interchange", weight: 1.1, sections: ["bridge", "breakdown"], moods: ["calm", "intense"], progression: [0, 5, 6, 4] },
    ],
    melodyMotion: { stepBias: 0.78, legatoBias: 0.44, staccatoBias: 0.18 },
    humanization: { laidBackOffsetBeats: 0.016, gridJitterAttenuation: 0.58, velocityVarianceScale: 1.06 },
    optionalLayers: [
      { id: "pad-swells", trackId: "pad", instrument: "pads", sections: ["intro", "verse", "chorus", "bridge", "outro"], probability: 0.22, durationBeats: 3.6, startOffsets: [0], velocityRange: [50, 82], degreeOffsets: [0, 3, 4] },
      { id: "bells", trackId: "melody", instrument: "bells", sections: ["chorus", "bridge"], probability: 0.1, durationBeats: 0.4, startOffsets: [2.5, 3.25], velocityRange: [58, 88], degreeOffsets: [4, 6] },
    ],
  },
  jazz: {
    id: "jazz",
    phraseBars: [8],
    rhythmTemplates: [
      { id: "ride-swing", weight: 1.7, steps: [0, 4, 6, 8, 11, 14], syncopationBias: 0.62 },
      { id: "comp-push", weight: 1.1, steps: [0, 3, 7, 10, 12, 15], syncopationBias: 0.58 },
      { id: "ride-comp-dialogue", weight: 1.35, steps: [0, 4, 6, 8, 10, 14], syncopationBias: 0.66 },
    ],
    harmonicGoals: [
      { id: "ii-V-I", weight: 1.8, sections: ["verse", "chorus", "bridge", "solo"], moods: ["calm", "neutral", "intense"], progression: [1, 4, 0, 0] },
      { id: "I-IV-V-I", weight: 1, sections: ["theme", "idea"], moods: ["neutral"], progression: [0, 3, 4, 0] },
      { id: "modal-interchange", weight: 1.2, sections: ["bridge", "breakdown"], moods: ["calm", "intense"], progression: [0, 2, 5, 4] },
      { id: "bebop-turnaround", weight: 1.45, sections: ["theme", "solo", "bridge"], moods: ["neutral", "intense"], progression: [0, 5, 1, 4] },
    ],
    melodyMotion: { stepBias: 0.74, legatoBias: 0.46, staccatoBias: 0.2 },
    humanization: { laidBackOffsetBeats: 0.012, gridJitterAttenuation: 0.65, velocityVarianceScale: 1.12 },
    optionalLayers: [
      { id: "brush-perc", trackId: "drums", instrument: "percussion", sections: ["verse", "bridge", "solo"], probability: 0.16, durationBeats: 0.12, startOffsets: [0.5, 1.5, 2.5, 3.5], velocityRange: [50, 86], drumPitches: [51, 59] },
      { id: "vibes-pluck", trackId: "counterpoint", instrument: "plucks", sections: ["theme", "solo"], probability: 0.11, durationBeats: 0.38, startOffsets: [1.25, 2.75], velocityRange: [54, 88], degreeOffsets: [2, 4, 5] },
    ],
  },
  ambient: {
    id: "ambient",
    phraseBars: [8],
    rhythmTemplates: [
      { id: "slow-orbit", weight: 1.7, steps: [0, 8, 12], syncopationBias: 0.14 },
      { id: "breathing-sparse", weight: 1.1, steps: [0, 6, 11, 14], syncopationBias: 0.22 },
    ],
    harmonicGoals: [
      { id: "I-IV-V-I", weight: 1, sections: ["intro", "verse", "outro"], moods: ["calm", "neutral"], progression: [0, 3, 4, 0] },
      { id: "modal-interchange", weight: 1.4, sections: ["bridge", "breakdown", "chorus"], moods: ["calm", "neutral", "intense"], progression: [0, 5, 6, 4] },
      { id: "ii-V-I", weight: 0.7, sections: ["bridge"], moods: ["intense"], progression: [1, 4, 0, 0] },
    ],
    melodyMotion: { stepBias: 0.86, legatoBias: 0.52, staccatoBias: 0.08 },
    humanization: { laidBackOffsetBeats: 0.01, gridJitterAttenuation: 0.72, velocityVarianceScale: 1.08 },
    optionalLayers: [
      { id: "pad-swells", trackId: "pad", instrument: "pads", sections: ["intro", "verse", "bridge", "breakdown", "outro"], probability: 0.3, durationBeats: 4, startOffsets: [0], velocityRange: [42, 70], degreeOffsets: [0, 4, 5] },
      { id: "fx-hit", trackId: "pad", instrument: "fx", sections: ["bridge", "breakdown"], probability: 0.12, durationBeats: 2.2, startOffsets: [2], velocityRange: [36, 60], degreeOffsets: [6] },
    ],
  },
  rock: {
    id: "rock",
    phraseBars: [4, 8],
    rhythmTemplates: [
      { id: "backbeat-drive", weight: 1.8, steps: [0, 4, 8, 11, 14], syncopationBias: 0.28 },
      { id: "anthem-push", weight: 1.1, steps: [0, 3, 8, 12, 15], syncopationBias: 0.3 },
    ],
    harmonicGoals: [
      { id: "I-IV-V-I", weight: 1.7, sections: ["verse", "chorus", "drop"], moods: ["neutral", "intense"], progression: [0, 3, 4, 0] },
      { id: "modal-interchange", weight: 1, sections: ["bridge"], moods: ["calm", "intense"], progression: [0, 5, 6, 4] },
      { id: "ii-V-I", weight: 0.8, sections: ["bridge", "prechorus"], moods: ["intense"], progression: [1, 4, 0, 0] },
    ],
    melodyMotion: { stepBias: 0.64, legatoBias: 0.3, staccatoBias: 0.32 },
    humanization: { laidBackOffsetBeats: 0, gridJitterAttenuation: 0.56, velocityVarianceScale: 1 },
    optionalLayers: [
      { id: "guitar-response", trackId: "counterpoint", instrument: "electric-guitar", sections: ["verse", "chorus", "bridge"], probability: 0.18, durationBeats: 0.45, startOffsets: [0.5, 2.5], velocityRange: [64, 104], degreeOffsets: [0, 3, 4] },
      { id: "perc-spark", trackId: "drums", instrument: "percussion", sections: ["verse", "chorus"], probability: 0.1, durationBeats: 0.1, startOffsets: [1.75, 3.75], velocityRange: [58, 95], drumPitches: [54, 56] },
    ],
  },
  cinematic: {
    id: "cinematic",
    phraseBars: [8],
    rhythmTemplates: [
      { id: "long-arc", weight: 1.6, steps: [0, 6, 8, 12], syncopationBias: 0.2 },
      { id: "trailer-pulse", weight: 1.2, steps: [0, 4, 7, 11, 15], syncopationBias: 0.3 },
    ],
    harmonicGoals: [
      { id: "I-IV-V-I", weight: 1.2, sections: ["intro", "build", "chorus", "outro"], moods: ["calm", "neutral", "intense"], progression: [0, 3, 4, 0] },
      { id: "ii-V-I", weight: 0.8, sections: ["bridge", "build"], moods: ["intense"], progression: [1, 4, 0, 0] },
      { id: "modal-interchange", weight: 1.3, sections: ["breakdown", "bridge", "chorus"], moods: ["neutral", "intense"], progression: [0, 5, 6, 4] },
    ],
    melodyMotion: { stepBias: 0.72, legatoBias: 0.5, staccatoBias: 0.18 },
    humanization: { laidBackOffsetBeats: 0, gridJitterAttenuation: 0.6, velocityVarianceScale: 1.02 },
    optionalLayers: [
      { id: "pad-swells", trackId: "pad", instrument: "pads", sections: ["intro", "build", "chorus", "bridge", "outro"], probability: 0.27, durationBeats: 4, startOffsets: [0], velocityRange: [46, 76], degreeOffsets: [0, 3, 5] },
      { id: "fx-hit", trackId: "pad", instrument: "fx", sections: ["build", "breakdown", "chorus"], probability: 0.14, durationBeats: 2, startOffsets: [3], velocityRange: [38, 64], degreeOffsets: [6] },
      { id: "bells", trackId: "melody", instrument: "bells", sections: ["bridge", "chorus"], probability: 0.11, durationBeats: 0.5, startOffsets: [1.5, 2.5], velocityRange: [54, 86], degreeOffsets: [4, 5, 6] },
    ],
  },
});

const PROFILE_BY_GENRE = Object.freeze({
  pop: "pop",
  popRadio: "pop",
  hipHop: "hipHopTrap",
  rap: "hipHopTrap",
  trap: "hipHopTrap",
  drill: "hipHopTrap",
  loFiHipHop: "lofi",
  house: "edm",
  techno: "techno",
  drumBass: "edm",
  synthwave: "edm",
  synthPopRadio: "edm",
  reggaeton: "edm",
  afrobeats: "pop",
  rnbSoul: "rnb",
  neoSoul: "rnb",
  funk: "rnb",
  jazz: "jazz",
  ambient: "ambient",
  rock: "rock",
  country: "rock",
});

export function genreArrangementProfile(genre) {
  const mapped = PROFILE_BY_GENRE[String(genre)] ?? "cinematic";
  const profile = PROFILES[mapped] ?? DEFAULT_PROFILE;
  return {
    ...DEFAULT_PROFILE,
    ...profile,
    phraseBars: Array.isArray(profile.phraseBars) && profile.phraseBars.length ? profile.phraseBars : DEFAULT_PROFILE.phraseBars,
    rhythmTemplates: Array.isArray(profile.rhythmTemplates) && profile.rhythmTemplates.length
      ? profile.rhythmTemplates
      : DEFAULT_PROFILE.rhythmTemplates,
    harmonicGoals: Array.isArray(profile.harmonicGoals) && profile.harmonicGoals.length
      ? profile.harmonicGoals
      : DEFAULT_PROFILE.harmonicGoals,
    optionalLayers: Array.isArray(profile.optionalLayers) ? profile.optionalLayers : DEFAULT_PROFILE.optionalLayers,
    melodyMotion: { ...DEFAULT_PROFILE.melodyMotion, ...(profile.melodyMotion ?? {}) },
    humanization: { ...DEFAULT_PROFILE.humanization, ...(profile.humanization ?? {}) },
  };
}


function blendProfileNumber(primary, secondary, amount, fallback) {
  const left = Number.isFinite(Number(primary)) ? Number(primary) : fallback;
  const right = Number.isFinite(Number(secondary)) ? Number(secondary) : fallback;
  return left * (1 - amount) + right * amount;
}

function mergeWeightedProfileEntries(primaryEntries = [], secondaryEntries = [], amount = 0.5, keyForEntry = (entry) => entry?.id) {
  const merged = new Map();
  const append = (entries, contribution) => {
    for (const entry of entries ?? []) {
      const key = String(keyForEntry(entry) ?? "");
      if (!key) continue;
      const weighted = Number(entry?.weight ?? 1) * contribution;
      const previous = merged.get(key);
      if (previous) {
        previous.weight += weighted;
      } else {
        merged.set(key, { ...entry, weight: weighted });
      }
    }
  };
  append(primaryEntries, 1 - amount);
  append(secondaryEntries, amount);
  return [...merged.values()].filter((entry) => entry.weight > 0);
}

function mergeOptionalLayers(primaryLayers = [], secondaryLayers = [], amount = 0.5) {
  const merged = new Map();
  const append = (layers, contribution, source) => {
    for (const layer of layers ?? []) {
      const key = `${layer?.trackId ?? ""}:${layer?.id ?? ""}`;
      if (key === ":") continue;
      const probability = clamp(Number(layer?.probability ?? 0) * contribution, 0, 1);
      const previous = merged.get(key);
      if (previous) {
        previous.probability = clamp(previous.probability + probability, 0, 1);
        previous.fusionSources = [...new Set([...(previous.fusionSources ?? []), source])];
      } else {
        merged.set(key, {
          ...layer,
          probability,
          fusionSources: [source],
        });
      }
    }
  };
  append(primaryLayers, 1 - amount, "primary");
  append(secondaryLayers, amount, "secondary");
  return [...merged.values()].filter((layer) => layer.probability > 0);
}

/**
 * Blend the arrangement grammar as well as the core genre profile. This keeps
 * fusion songs from inheriting only the primary genre's phrase, harmony,
 * humanization and optional-layer rules.
 */
export function fusedGenreArrangementProfile(primaryGenre, secondaryGenre, blend = 0.5) {
  const primary = genreArrangementProfile(primaryGenre);
  const secondary = genreArrangementProfile(secondaryGenre);
  const amount = clamp(Number.isFinite(Number(blend)) ? Number(blend) : 0.5, 0, 1);
  if (!secondaryGenre || String(primaryGenre) === String(secondaryGenre) || amount <= 0) return primary;
  if (amount >= 1) return secondary;

  const phraseBars = [...new Set([...(primary.phraseBars ?? []), ...(secondary.phraseBars ?? [])])];
  const rhythmTemplates = mergeWeightedProfileEntries(
    primary.rhythmTemplates,
    secondary.rhythmTemplates,
    amount,
    (entry) => entry?.id,
  );
  const harmonicGoals = mergeWeightedProfileEntries(
    primary.harmonicGoals,
    secondary.harmonicGoals,
    amount,
    (entry) => `${entry?.id ?? ""}:${(entry?.progression ?? []).join(",")}`,
  );

  return {
    ...DEFAULT_PROFILE,
    id: `fusion:${primary.id}+${secondary.id}`,
    phraseBars: phraseBars.length ? phraseBars : DEFAULT_PROFILE.phraseBars,
    rhythmTemplates: rhythmTemplates.length ? rhythmTemplates : DEFAULT_PROFILE.rhythmTemplates,
    harmonicGoals: harmonicGoals.length ? harmonicGoals : DEFAULT_PROFILE.harmonicGoals,
    optionalLayers: mergeOptionalLayers(primary.optionalLayers, secondary.optionalLayers, amount),
    melodyMotion: {
      stepBias: blendProfileNumber(primary.melodyMotion?.stepBias, secondary.melodyMotion?.stepBias, amount, DEFAULT_PROFILE.melodyMotion.stepBias),
      legatoBias: blendProfileNumber(primary.melodyMotion?.legatoBias, secondary.melodyMotion?.legatoBias, amount, DEFAULT_PROFILE.melodyMotion.legatoBias),
      staccatoBias: blendProfileNumber(primary.melodyMotion?.staccatoBias, secondary.melodyMotion?.staccatoBias, amount, DEFAULT_PROFILE.melodyMotion.staccatoBias),
    },
    humanization: {
      laidBackOffsetBeats: blendProfileNumber(primary.humanization?.laidBackOffsetBeats, secondary.humanization?.laidBackOffsetBeats, amount, DEFAULT_PROFILE.humanization.laidBackOffsetBeats),
      gridJitterAttenuation: blendProfileNumber(primary.humanization?.gridJitterAttenuation, secondary.humanization?.gridJitterAttenuation, amount, DEFAULT_PROFILE.humanization.gridJitterAttenuation),
      velocityVarianceScale: blendProfileNumber(primary.humanization?.velocityVarianceScale, secondary.humanization?.velocityVarianceScale, amount, DEFAULT_PROFILE.humanization.velocityVarianceScale),
    },
  };
}

export function moodFromEnergy(energy = 0.5) {
  if (energy <= 0.42) return "calm";
  if (energy >= 0.76) return "intense";
  return "neutral";
}

export function progressionGoalsFor(profile, sectionName = "verse", mood = "neutral") {
  const section = String(sectionName || "verse").toLowerCase();
  return (profile?.harmonicGoals ?? []).filter((goal) => {
    const sections = Array.isArray(goal.sections) ? goal.sections : [];
    const moods = Array.isArray(goal.moods) ? goal.moods : [];
    return (sections.length === 0 || sections.includes(section))
      && (moods.length === 0 || moods.includes(mood));
  });
}

export function pickGenreRhythmTemplate(profile, rng, syncopation = 0.4) {
  const templates = profile?.rhythmTemplates ?? DEFAULT_PROFILE.rhythmTemplates;
  const weighted = templates.map((template) => ({
    ...template,
    weight: Number(template.weight ?? 1) * (0.8 + clamp(syncopation, 0, 1) * clamp(Number(template.syncopationBias ?? 0.25), 0, 1)),
  }));
  return pickWeighted(weighted, rng) ?? DEFAULT_PROFILE.rhythmTemplates[0];
}

export function legatoIntervalBias(stepBias = 0.72, interval = 0) {
  const bias = clamp(Number(stepBias) || 0.72, 0.05, 0.95);
  const semitones = Math.abs(Math.round(Number(interval) || 0));
  if (semitones <= 1) return 0.06 + bias * 0.18;
  if (semitones === 2) return bias * 0.1;
  if (semitones === 3) return bias * 0.03 - 0.02;
  if (semitones === 4) return -0.04 - (1 - bias) * 0.05;
  return -0.1 - (1 - bias) * 0.08;
}

export function layerDensityMode(mode, variation = 0.5, averageTrackDensity = 0.5) {
  const key = String(mode || "auto").toLowerCase();
  const manual = {
    off: 0,
    subtle: 0.32,
    medium: 0.56,
    high: 0.82,
  }[key];
  if (manual != null) return manual;
  return clamp(0.2 + variation * 0.45 + averageTrackDensity * 0.35, 0, 1);
}
