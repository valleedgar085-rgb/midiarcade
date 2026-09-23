const SCALE_CHARACTER = Object.freeze({
  major: Object.freeze({ brightness: 0.92, tension: 0.18, color: 0.28 }),
  minor: Object.freeze({ brightness: 0.28, tension: 0.58, color: 0.42 }),
  dorian: Object.freeze({ brightness: 0.54, tension: 0.46, color: 0.78 }),
  phrygian: Object.freeze({ brightness: 0.12, tension: 0.84, color: 0.72 }),
  lydian: Object.freeze({ brightness: 0.82, tension: 0.56, color: 0.9 }),
  mixolydian: Object.freeze({ brightness: 0.7, tension: 0.42, color: 0.7 }),
  harmonicMinor: Object.freeze({ brightness: 0.2, tension: 0.92, color: 0.68 }),
  melodicMinor: Object.freeze({ brightness: 0.46, tension: 0.74, color: 0.86 }),
  majorPentatonic: Object.freeze({ brightness: 0.86, tension: 0.16, color: 0.62 }),
  minorPentatonic: Object.freeze({ brightness: 0.34, tension: 0.3, color: 0.7 }),
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function genreColor(genre, chordPath) {
  const token = `${String(genre ?? "")} ${String(chordPath ?? "")}`.toLowerCase();
  if (/trap|drill|phrygian|dark/.test(token)) return 0.68;
  if (/hiphop|rap|lofi|soul|rnb|neo/.test(token)) return 0.76;
  if (/pop|house|anthem/.test(token)) return 0.42;
  if (/jazz|ambient/.test(token)) return 0.88;
  return 0.56;
}

/**
 * Choose a scale for Auto mode from the requested musical intent.
 * Explicit scale selections never use this helper.
 */
export function resolveAutoScale({
  candidates = [],
  seed = "",
  genre = "",
  chordPath = "",
  energy = 0.7,
  complexity = 0.58,
  surprise = 0.28,
  mood = "neutral",
} = {}) {
  const choices = [...new Set(candidates)].filter((scale) => SCALE_CHARACTER[scale]);
  if (!choices.length) return "minor";

  const targetBrightness = clamp(
    0.2 + finite(energy, 0.7) * 0.62 + (mood === "intense" ? 0.04 : mood === "calm" ? -0.04 : 0),
    0,
    1,
  );
  const targetTension = clamp(
    finite(complexity, 0.58) * 0.42 + finite(surprise, 0.28) * 0.48
      + (/trap|drill/.test(`${genre} ${chordPath}`.toLowerCase()) ? 0.1 : 0),
    0,
    1,
  );
  const targetColor = genreColor(genre, chordPath);
  const scored = choices.map((scale) => {
    const character = SCALE_CHARACTER[scale];
    const distance = Math.abs(character.brightness - targetBrightness) * 0.38
      + Math.abs(character.tension - targetTension) * 0.38
      + Math.abs(character.color - targetColor) * 0.24;
    return { scale, distance };
  });

  const ranked = [...scored].sort((left, right) => (
    left.distance - right.distance || left.scale.localeCompare(right.scale)
  ));
  if (ranked.length === 1) return ranked[0].scale;

  // When musical intent clearly favors one scale, keep it authoritative.
  // Otherwise rotate deterministically across the genre-approved pool so
  // one flexible mode (especially Mixolydian) cannot dominate every seed.
  if (ranked[1].distance - ranked[0].distance >= 0.22) return ranked[0].scale;

  const weighted = scored.map(({ scale, distance }) => {
    const fit = clamp(1 - distance, 0, 1);
    return {
      scale,
      weight: 0.35 + fit * fit * 0.65,
    };
  });
  const totalWeight = weighted.reduce((sum, entry) => sum + entry.weight, 0);
  const roll = (hashSeed(`${seed}::auto-scale-rotation`) / 4294967296) * totalWeight;
  let cursor = 0;
  for (const entry of weighted) {
    cursor += entry.weight;
    if (roll < cursor) return entry.scale;
  }
  return weighted.at(-1).scale;
}

export const SCALE_INTENT_VERSION = "1.1";
