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

const DIRECTIONS = Object.freeze([
  {
    id: "groove-dialogue",
    route: "groove-first",
    bassFamily: "syncopated-answer",
    melodyFamily: "short-call-response",
    phraseFamily: "question-answer",
    drumFamily: "pocket-with-turnarounds",
    focus: ["drums", "bass", "melody"],
  },
  {
    id: "bass-story",
    route: "groove-first",
    bassFamily: "melodic-walk-and-jump",
    melodyFamily: "sparse-hook",
    phraseFamily: "bass-led-conversation",
    drumFamily: "deep-pocket",
    focus: ["bass", "drums", "counterpoint"],
  },
  {
    id: "hook-evolution",
    route: "hook-first",
    bassFamily: "root-octave-bounce",
    melodyFamily: "motif-sequence-and-answer",
    phraseFamily: "hook-transform",
    drumFamily: "supportive-lift",
    focus: ["melody", "counterpoint", "bass"],
  },
  {
    id: "rhythmic-fragments",
    route: "groove-first",
    bassFamily: "broken-syncopation",
    melodyFamily: "rhythmic-fragment",
    phraseFamily: "fragment-reassemble",
    drumFamily: "broken-bounce",
    focus: ["drums", "bass", "counterpoint"],
  },
  {
    id: "emotional-arc",
    route: "harmony-first",
    bassFamily: "voice-leading-support",
    melodyFamily: "long-short-arc",
    phraseFamily: "tension-release",
    drumFamily: "breathing-pocket",
    focus: ["melody", "chords", "bass"],
  },
  {
    id: "open-space",
    route: "harmony-first",
    bassFamily: "pedal-and-answer",
    melodyFamily: "wide-rested-phrases",
    phraseFamily: "space-and-return",
    drumFamily: "minimal-pocket",
    focus: ["melody", "pad", "bass"],
  },
]);

const GENRE_DIRECTION_BIAS = Object.freeze({
  funk: ["groove-dialogue", "bass-story", "rhythmic-fragments", "hook-evolution"],
  neoSoul: ["emotional-arc", "groove-dialogue", "bass-story", "open-space"],
  rnbSoul: ["emotional-arc", "open-space", "groove-dialogue", "hook-evolution"],
  jazz: ["bass-story", "emotional-arc", "groove-dialogue", "rhythmic-fragments"],
  hipHop: ["groove-dialogue", "rhythmic-fragments", "bass-story", "hook-evolution"],
  rap: ["groove-dialogue", "bass-story", "rhythmic-fragments", "open-space"],
  trap: ["rhythmic-fragments", "bass-story", "hook-evolution", "open-space"],
  drill: ["rhythmic-fragments", "bass-story", "groove-dialogue", "hook-evolution"],
  afrobeats: ["groove-dialogue", "rhythmic-fragments", "hook-evolution", "bass-story"],
  reggaeton: ["groove-dialogue", "hook-evolution", "bass-story", "rhythmic-fragments"],
  house: ["hook-evolution", "groove-dialogue", "rhythmic-fragments", "emotional-arc"],
  techno: ["rhythmic-fragments", "groove-dialogue", "open-space", "hook-evolution"],
  drumBass: ["rhythmic-fragments", "bass-story", "hook-evolution", "groove-dialogue"],
  ambient: ["open-space", "emotional-arc", "hook-evolution"],
  pop: ["hook-evolution", "emotional-arc", "groove-dialogue", "open-space"],
  country: ["emotional-arc", "hook-evolution", "bass-story", "groove-dialogue"],
  rock: ["hook-evolution", "groove-dialogue", "emotional-arc", "bass-story"],
});

function directionFor(config, seed) {
  const genre = String(config.genre || "pop");
  const ids = GENRE_DIRECTION_BIAS[genre] || DIRECTIONS.map((item) => item.id);
  const id = ids[hash32(`${seed}:pattern-direction:${genre}`) % ids.length];
  return DIRECTIONS.find((item) => item.id === id) || DIRECTIONS[0];
}

function shapeTrack(id, track = {}, direction, exploration) {
  const copy = { ...track };
  const focusIndex = direction.focus.indexOf(id);
  const focus = focusIndex >= 0 ? 1 - focusIndex * 0.18 : 0.28;
  const baseVariation = clamp(copy.variation ?? 0.5, 0, 1);
  const lift = (0.055 + exploration * 0.11) * focus;
  copy.variation = clamp(baseVariation + lift, 0.18, 0.96);

  const baseDensity = clamp(copy.density ?? 0.55, 0, 1);
  const densityDelta = direction.id === "open-space"
    ? -0.1 * focus
    : direction.id === "rhythmic-fragments"
      ? 0.07 * focus
      : direction.id === "bass-story" && id === "bass"
        ? 0.08
        : direction.id === "hook-evolution" && id === "melody"
          ? 0.055
          : 0.018 * focus;
  copy.density = clamp(baseDensity + densityDelta, id === "pad" ? 0.18 : 0.16, 0.94);
  return copy;
}

export function applyPatternVariety(config = {}, tasteBias = {}, seed = config.seed ?? "variety") {
  const direction = directionFor(config, seed);
  const exploration = clamp(tasteBias?.exploration ?? 0.45, 0.25, 0.55);
  const confidence = clamp(tasteBias?.confidence ?? 0, 0, 1);
  const sourceTracks = config.trackControls || config.tracks || {};
  const tracks = Object.fromEntries(Object.entries(sourceTracks).map(([id, track]) => [
    id,
    shapeTrack(id, track, direction, exploration),
  ]));

  const variationFloor = 0.56 + exploration * 0.12;
  const evolutionFloor = 0.62 + exploration * 0.16;
  const surpriseFloor = 0.24 + exploration * 0.16;
  const learnedVariation = Number(tasteBias?.traits?.variation?.center) / 100;
  const learnedEvolution = Number(tasteBias?.traits?.evolution?.center) / 100;
  const learnedSurprise = Number(tasteBias?.traits?.surprise?.center) / 100;

  const variation = clamp(Math.max(config.variation ?? 0.5, variationFloor) + (Number.isFinite(learnedVariation) ? (learnedVariation - 0.5) * confidence * 0.08 : 0), 0.48, 0.9);
  const evolution = clamp(Math.max(config.evolution ?? 0.58, evolutionFloor) + (Number.isFinite(learnedEvolution) ? (learnedEvolution - 0.5) * confidence * 0.08 : 0), 0.5, 0.94);
  const surprise = clamp(Math.max(config.surprise ?? 0.28, surpriseFloor) + (Number.isFinite(learnedSurprise) ? (learnedSurprise - 0.5) * confidence * 0.06 : 0), 0.18, 0.68);

  return {
    ...config,
    compositionRoute: config.compositionRoute || direction.route,
    variation,
    evolution,
    surprise,
    similarity: clamp(Math.min(config.similarity ?? 0.78, 0.86 - exploration * 0.16), 0.58, 0.9),
    trackControls: tracks,
    tracks,
    patternVariety: {
      version: 1,
      direction: direction.id,
      bassFamily: direction.bassFamily,
      melodyFamily: direction.melodyFamily,
      phraseFamily: direction.phraseFamily,
      drumFamily: direction.drumFamily,
      route: direction.route,
      exploration,
      focusTracks: [...direction.focus],
    },
  };
}

export const PATTERN_VARIETY_DIRECTIONS = DIRECTIONS;
