const PROFILE_VERSION = 2;
const MAX_SONG_SIGNALS = 96;

const TRAIT_DEFAULTS = Object.freeze({
  tempo: 112,
  energy: 68,
  complexity: 54,
  variation: 58,
  swing: 14,
  humanize: 16,
  evolution: 64,
  surprise: 36,
  syncopation: 52,
  bassMovement: 58,
  melodyMotion: 58,
  phraseDensity: 54,
});

const SIGNAL_WEIGHTS = Object.freeze({
  favorite: 2.8,
  export: 2.2,
  like: 1.35,
  similar: 0.8,
  replay: 0.32,
  reject: -1.7,
  regenerate: -0.55,
});

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function blankTrait() {
  return { positiveWeight: 0, negativeWeight: 0, sum: 0, sumSq: 0 };
}

function defaultTraits() {
  return Object.fromEntries(Object.keys(TRAIT_DEFAULTS).map((key) => [key, blankTrait()]));
}

export function createTasteProfile(source = {}) {
  const profile = {
    version: PROFILE_VERSION,
    ratings: Math.max(0, finite(source.ratings)),
    likes: Math.max(0, finite(source.likes)),
    rejects: Math.max(0, finite(source.rejects)),
    favorites: Math.max(0, finite(source.favorites)),
    exports: Math.max(0, finite(source.exports)),
    replays: Math.max(0, finite(source.replays)),
    similarRequests: Math.max(0, finite(source.similarRequests)),
    regenerations: Math.max(0, finite(source.regenerations)),
    energyTotal: Math.max(0, finite(source.energyTotal)),
    complexityTotal: Math.max(0, finite(source.complexityTotal)),
    variationTotal: Math.max(0, finite(source.variationTotal)),
    genreVotes: { ...(source.genreVotes || {}) },
    grooveVotes: { ...(source.grooveVotes || {}) },
    traits: defaultTraits(),
    songRatings: { ...(source.songRatings || {}) },
    songSignals: { ...(source.songSignals || {}) },
  };

  for (const key of Object.keys(profile.traits)) {
    const incoming = source.traits?.[key];
    if (!incoming) continue;
    profile.traits[key] = {
      positiveWeight: Math.max(0, finite(incoming.positiveWeight)),
      negativeWeight: Math.max(0, finite(incoming.negativeWeight)),
      sum: finite(incoming.sum),
      sumSq: Math.max(0, finite(incoming.sumSq)),
    };
  }
  return profile;
}

function songTraitValues(song = {}) {
  const settings = song.settings || song.config || {};
  const dna = song.songDNA || song.dna || song.songBlueprint?.songDNA || {};
  const rhythmic = dna.rhythmic || {};
  const melodic = dna.melodic || {};
  const bass = (song.tracks || []).find((track) => track?.id === "bass");
  const melody = (song.tracks || []).find((track) => track?.id === "melody");
  const noteMotion = (track, fallback) => {
    const notes = Array.isArray(track?.notes) ? track.notes : [];
    if (notes.length < 2) return fallback;
    const leaps = notes.slice(1).map((note, index) => Math.abs(finite(note.pitch, 60) - finite(notes[index].pitch, 60)));
    return clamp(leaps.reduce((sum, value) => sum + value, 0) / leaps.length * 11, 0, 100);
  };
  const density = (track, fallback) => {
    const notes = Array.isArray(track?.notes) ? track.notes : [];
    const bars = Math.max(1, finite(song.bars ?? song.meta?.bars ?? settings.bars, 32));
    return notes.length ? clamp(notes.length / bars * 14, 0, 100) : fallback;
  };

  return {
    tempo: clamp(song.bpm ?? song.tempo ?? song.meta?.tempo ?? settings.tempo ?? TRAIT_DEFAULTS.tempo, 55, 200),
    energy: clamp(finite(settings.energy ?? song.meta?.energy, TRAIT_DEFAULTS.energy / 100) * (finite(settings.energy ?? song.meta?.energy, 1) <= 1 ? 100 : 1), 0, 100),
    complexity: clamp(finite(settings.complexity, TRAIT_DEFAULTS.complexity / 100) * (finite(settings.complexity, 1) <= 1 ? 100 : 1), 0, 100),
    variation: clamp(finite(settings.variation, TRAIT_DEFAULTS.variation / 100) * (finite(settings.variation, 1) <= 1 ? 100 : 1), 0, 100),
    swing: clamp(finite(settings.swing ?? rhythmic.swing, TRAIT_DEFAULTS.swing / 100) * (finite(settings.swing ?? rhythmic.swing, 1) <= 1 ? 100 : 1), 0, 65),
    humanize: clamp(finite(settings.humanize, TRAIT_DEFAULTS.humanize / 100) * (finite(settings.humanize, 1) <= 1 ? 100 : 1), 0, 40),
    evolution: clamp(finite(settings.evolution, TRAIT_DEFAULTS.evolution / 100) * (finite(settings.evolution, 1) <= 1 ? 100 : 1), 0, 100),
    surprise: clamp(finite(settings.surprise, TRAIT_DEFAULTS.surprise / 100) * (finite(settings.surprise, 1) <= 1 ? 100 : 1), 0, 100),
    syncopation: clamp(finite(settings.syncopation ?? rhythmic.syncopation, TRAIT_DEFAULTS.syncopation / 100) * (finite(settings.syncopation ?? rhythmic.syncopation, 1) <= 1 ? 100 : 1), 0, 100),
    bassMovement: noteMotion(bass, TRAIT_DEFAULTS.bassMovement),
    melodyMotion: noteMotion(melody, clamp(finite(melodic.range, 10) * 5, 20, 90)),
    phraseDensity: density(melody, TRAIT_DEFAULTS.phraseDensity),
  };
}

function updateCounter(profile, signal) {
  if (signal === "favorite") profile.favorites += 1;
  if (signal === "like") profile.likes += 1;
  if (signal === "reject") profile.rejects += 1;
  if (signal === "export") profile.exports += 1;
  if (signal === "replay") profile.replays += 1;
  if (signal === "similar") profile.similarRequests += 1;
  if (signal === "regenerate") profile.regenerations += 1;
}

export function learnTasteSignal(sourceProfile, song, signal, { occurrence = 1 } = {}) {
  const profile = createTasteProfile(sourceProfile);
  const weight = finite(SIGNAL_WEIGHTS[signal]);
  if (!weight || !song) return profile;
  const songId = String(song.id ?? `${song.seed ?? "song"}:${song.title ?? "untitled"}`);
  const signalKey = `${songId}:${signal}`;
  const previous = Math.max(0, finite(profile.songSignals[signalKey]));
  const cappedOccurrence = signal === "replay" ? Math.min(5, previous + Math.max(1, occurrence)) : 1;
  if (signal !== "replay" && previous >= 1) return profile;
  const effectiveWeight = signal === "replay"
    ? weight * Math.max(0, cappedOccurrence - previous)
    : weight;
  if (!effectiveWeight) return profile;

  profile.songSignals[signalKey] = cappedOccurrence;
  profile.songSignals = Object.fromEntries(Object.entries(profile.songSignals).slice(-MAX_SONG_SIGNALS));
  updateCounter(profile, signal);

  if (["like", "favorite", "reject"].includes(signal)) {
    profile.songRatings[songId] = signal;
    profile.songRatings = Object.fromEntries(Object.entries(profile.songRatings).slice(-64));
  }

  const genre = String(song.genre ?? song.meta?.genre ?? "unknown");
  const groove = String(song.groove ?? song.settings?.groove ?? song.style?.rhythmIdentity?.id ?? "unknown");
  profile.genreVotes[genre] = finite(profile.genreVotes[genre]) + effectiveWeight;
  profile.grooveVotes[groove] = finite(profile.grooveVotes[groove]) + effectiveWeight;

  const values = songTraitValues(song);
  for (const [key, value] of Object.entries(values)) {
    const trait = profile.traits[key] || (profile.traits[key] = blankTrait());
    if (effectiveWeight > 0) {
      trait.positiveWeight += effectiveWeight;
      trait.sum += value * effectiveWeight;
      trait.sumSq += value * value * effectiveWeight;
    } else {
      trait.negativeWeight += Math.abs(effectiveWeight);
    }
  }

  if (effectiveWeight > 0) {
    profile.ratings += effectiveWeight;
    profile.energyTotal += values.energy * effectiveWeight;
    profile.complexityTotal += values.complexity * effectiveWeight;
    profile.variationTotal += values.variation * effectiveWeight;
  }
  return profile;
}

function traitCenter(profile, key) {
  const trait = profile.traits?.[key];
  if (!trait || trait.positiveWeight <= 0) return TRAIT_DEFAULTS[key];
  return trait.sum / trait.positiveWeight;
}

function traitSpread(profile, key) {
  const trait = profile.traits?.[key];
  if (!trait || trait.positiveWeight <= 0) return key === "tempo" ? 14 : 18;
  const mean = trait.sum / trait.positiveWeight;
  const variance = Math.max(0, trait.sumSq / trait.positiveWeight - mean * mean);
  return Math.max(key === "tempo" ? 5 : 8, Math.sqrt(variance));
}

export function tasteGenerationBias(sourceProfile) {
  const profile = createTasteProfile(sourceProfile);
  const positive = Object.values(profile.traits).reduce((sum, trait) => sum + trait.positiveWeight, 0);
  const negative = Object.values(profile.traits).reduce((sum, trait) => sum + trait.negativeWeight, 0);
  const confidence = clamp(positive / 48, 0, 1) * clamp(1 - negative / Math.max(20, positive * 3), 0.55, 1);
  const exploration = clamp(0.52 - confidence * 0.22, 0.28, 0.52);
  const traits = Object.fromEntries(Object.keys(TRAIT_DEFAULTS).map((key) => [key, {
    center: traitCenter(profile, key),
    spread: traitSpread(profile, key),
  }]));
  const favoriteGenres = Object.entries(profile.genreVotes)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([key]) => key);
  const favoriteGrooves = Object.entries(profile.grooveVotes)
    .filter(([, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([key]) => key);
  return { version: PROFILE_VERSION, confidence, exploration, traits, favoriteGenres, favoriteGrooves };
}

export function blendTasteValue(selected, learned, confidence, { maxInfluence = 0.34 } = {}) {
  const influence = clamp(confidence * maxInfluence, 0, maxInfluence);
  return finite(selected) * (1 - influence) + finite(learned, selected) * influence;
}
