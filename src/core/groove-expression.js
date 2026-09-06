function clamp(value, min, max) {
  return Math.max(min, Math.min(max, Number(value) || 0));
}

function hash32(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

const POCKETS = Object.freeze([
  {
    id: "elastic-funk",
    swing: 0.16,
    humanize: 0.16,
    syncopation: 0.72,
    drumFills: 0.58,
    bassVariation: 0.16,
    melodyVariation: 0.1,
    velocityShape: "accented-16ths",
    pushPull: { drums: -0.004, bass: 0.009, chords: 0.012, melody: -0.002 },
  },
  {
    id: "deep-pocket",
    swing: 0.1,
    humanize: 0.12,
    syncopation: 0.58,
    drumFills: 0.46,
    bassVariation: 0.11,
    melodyVariation: 0.08,
    velocityShape: "deep-backbeat",
    pushPull: { drums: 0, bass: 0.012, chords: 0.01, melody: 0.004 },
  },
  {
    id: "laidback-soul",
    swing: 0.22,
    humanize: 0.19,
    syncopation: 0.61,
    drumFills: 0.42,
    bassVariation: 0.13,
    melodyVariation: 0.12,
    velocityShape: "breathing",
    pushPull: { drums: 0.006, bass: 0.014, chords: 0.018, melody: 0.01 },
  },
  {
    id: "broken-bounce",
    swing: 0.08,
    humanize: 0.14,
    syncopation: 0.78,
    drumFills: 0.66,
    bassVariation: 0.18,
    melodyVariation: 0.14,
    velocityShape: "syncopated-pulse",
    pushPull: { drums: -0.003, bass: -0.006, chords: 0.008, melody: -0.008 },
  },
  {
    id: "forward-drive",
    swing: 0.04,
    humanize: 0.09,
    syncopation: 0.48,
    drumFills: 0.54,
    bassVariation: 0.1,
    melodyVariation: 0.09,
    velocityShape: "forward-accent",
    pushPull: { drums: -0.006, bass: -0.004, chords: 0.002, melody: -0.006 },
  },
  {
    id: "open-air",
    swing: 0.13,
    humanize: 0.18,
    syncopation: 0.44,
    drumFills: 0.34,
    bassVariation: 0.08,
    melodyVariation: 0.16,
    velocityShape: "wide-arc",
    pushPull: { drums: 0.002, bass: 0.006, chords: 0.014, melody: 0.008 },
  },
]);

const GENRE_POCKET_BIAS = Object.freeze({
  funk: ["elastic-funk", "deep-pocket", "broken-bounce"],
  neoSoul: ["laidback-soul", "elastic-funk", "deep-pocket"],
  rnbSoul: ["laidback-soul", "deep-pocket", "open-air"],
  hipHop: ["deep-pocket", "laidback-soul", "broken-bounce"],
  rap: ["deep-pocket", "broken-bounce", "forward-drive"],
  afrobeats: ["elastic-funk", "broken-bounce", "open-air"],
  reggaeton: ["deep-pocket", "broken-bounce", "forward-drive"],
  jazz: ["laidback-soul", "elastic-funk", "open-air"],
  country: ["forward-drive", "deep-pocket", "open-air"],
  rock: ["forward-drive", "deep-pocket", "broken-bounce"],
  house: ["forward-drive", "elastic-funk", "deep-pocket"],
  techno: ["forward-drive", "deep-pocket", "broken-bounce"],
  trap: ["broken-bounce", "deep-pocket", "forward-drive"],
  drill: ["broken-bounce", "forward-drive", "deep-pocket"],
  drumBass: ["broken-bounce", "forward-drive", "elastic-funk"],
  ambient: ["open-air", "laidback-soul", "deep-pocket"],
});

function selectPocket(genre, seed, favoriteGrooves = []) {
  const candidates = GENRE_POCKET_BIAS[genre] || ["deep-pocket", "elastic-funk", "open-air", "broken-bounce"];
  const favoriteHint = favoriteGrooves.find((value) => POCKETS.some((pocket) => pocket.id === value));
  const id = favoriteHint && (hash32(`${seed}:favorite-pocket`) % 4 !== 0)
    ? favoriteHint
    : candidates[hash32(`${seed}:pocket:${genre}`) % candidates.length];
  return POCKETS.find((pocket) => pocket.id === id) || POCKETS[0];
}

function blend(base, target, amount) {
  return Number(base) * (1 - amount) + Number(target) * amount;
}

function tasteUnit(tasteBias, key, fallback) {
  const center = Number(tasteBias?.traits?.[key]?.center);
  return Number.isFinite(center) ? center / 100 : fallback;
}

function shapeTrack(id, source = {}, pocket, tasteBias) {
  const track = { ...source };
  const confidence = clamp(tasteBias?.confidence ?? 0, 0, 1);
  const exploration = clamp(tasteBias?.exploration ?? 0.45, 0.25, 0.55);
  const variationLift = id === "bass"
    ? pocket.bassVariation
    : id === "melody" || id === "counterpoint"
      ? pocket.melodyVariation
      : id === "drums"
        ? 0.09
        : 0.04;
  const tasteMotion = id === "bass"
    ? tasteUnit(tasteBias, "bassMovement", 0.58)
    : tasteUnit(tasteBias, "melodyMotion", 0.58);
  const existingVariation = clamp(track.variation ?? 0.5, 0, 1);
  track.variation = clamp(existingVariation + variationLift * (0.55 + exploration * 0.55) + (tasteMotion - 0.5) * confidence * 0.12, 0.18, 0.96);

  const baseHumanize = clamp(track.humanize ?? 0.6, 0, 1);
  const expressionTarget = id === "drums" ? 0.82 : id === "bass" ? 0.88 : id === "melody" ? 0.78 : 0.62;
  track.humanize = clamp(blend(baseHumanize, expressionTarget, 0.18 + exploration * 0.08), 0.08, 1);

  const baseFeel = clamp(track.feel ?? 0.6, 0, 1);
  const feelTarget = id === "drums" || id === "bass" ? 0.92 : id === "melody" ? 0.74 : 0.64;
  track.feel = clamp(blend(baseFeel, feelTarget, 0.22), 0.08, 1);

  const baseVelocity = clamp(track.velocity ?? 1, 0.1, 1.5);
  const velocityTarget = id === "drums" ? 1.04 : id === "bass" ? 0.99 : id === "melody" ? 0.96 : baseVelocity;
  track.velocity = clamp(blend(baseVelocity, velocityTarget, 0.16), 0.55, 1.22);

  if (id === "bass") track.gate = clamp(blend(track.gate ?? 0.82, pocket.id === "elastic-funk" ? 0.7 : 0.8, 0.2), 0.5, 1.02);
  if (id === "melody") track.gate = clamp(blend(track.gate ?? 0.88, pocket.id === "open-air" ? 1.02 : 0.9, 0.16), 0.62, 1.08);
  return track;
}

export function applyAdaptiveGroove(config = {}, tasteBias = {}, seed = config.seed ?? "groove") {
  const genre = String(config.genre || "pop");
  const pocket = selectPocket(genre, seed, tasteBias.favoriteGrooves);
  const confidence = clamp(tasteBias.confidence ?? 0, 0, 1);
  const exploration = clamp(tasteBias.exploration ?? 0.45, 0.25, 0.55);
  const tasteSwing = tasteUnit(tasteBias, "swing", config.swing ?? pocket.swing);
  const tasteHumanize = tasteUnit(tasteBias, "humanize", config.humanize ?? pocket.humanize);
  const tasteSyncopation = tasteUnit(tasteBias, "syncopation", config.syncopation ?? pocket.syncopation);
  const tasteAmount = Math.min(0.28, confidence * 0.28);
  const tracks = Object.fromEntries(Object.entries(config.trackControls || config.tracks || {}).map(([id, track]) => [
    id,
    shapeTrack(id, track, pocket, tasteBias),
  ]));

  return {
    ...config,
    swing: clamp(blend(blend(config.swing ?? pocket.swing, pocket.swing, 0.22), tasteSwing, tasteAmount), 0, 0.52),
    humanize: clamp(blend(blend(config.humanize ?? pocket.humanize, pocket.humanize, 0.26), tasteHumanize, tasteAmount), 0.04, 0.34),
    syncopation: clamp(blend(blend(config.syncopation ?? pocket.syncopation, pocket.syncopation, 0.22 + exploration * 0.08), tasteSyncopation, tasteAmount), 0.22, 0.88),
    drumFills: clamp(blend(config.drumFills ?? pocket.drumFills, pocket.drumFills, 0.2), 0.22, 0.78),
    trackControls: tracks,
    tracks,
    performancePocket: {
      version: 1,
      id: pocket.id,
      velocityShape: pocket.velocityShape,
      pushPull: { ...pocket.pushPull },
      exploration,
      timingWindowBeats: clamp(0.012 + (config.humanize ?? pocket.humanize) * 0.05, 0.012, 0.032),
      accentDepth: clamp(0.08 + (config.energy ?? 0.68) * 0.08, 0.08, 0.17),
    },
  };
}

export const ADAPTIVE_POCKETS = POCKETS;
