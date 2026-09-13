export const AUTO_GENERATION_RANGE_IDS = Object.freeze([
  "tempoControl",
  "energyControl",
  "complexityControl",
  "swingControl",
  "humanizeControl",
  "tripletControl",
  "rollControl",
  "variationControl",
  "evolutionControl",
  "surpriseControl",
]);

export const AUTO_SELECT_IDS = Object.freeze([
  "keyControl",
  "modeControl",
  "barsControl",
  "grooveControl",
  "chordPathControl",
]);

export const AUTO_TRACK_RANGE_KEYS = Object.freeze([
  "volume",
  "density",
  "variation",
  "octave",
  "velocity",
  "gate",
  "pan",
  "reverb",
  "cutoff",
  "resonance",
]);

export const AUTO_TRACK_SELECT_KEYS = Object.freeze([
  "program",
]);

export const DEFAULT_AUTO_TRACK_IDS = Object.freeze([
  "drums",
  "bass",
  "chords",
  "melody",
  "counterpoint",
  "pad",
]);

export function trackAutoControlKey(trackId, key) {
  const id = String(trackId || "");
  const control = String(key || "");
  if (!id || !control) return null;
  return `track:${id}:${control}`;
}

export function isAutoTrackControl(autoControls, trackId, key) {
  const token = trackAutoControlKey(trackId, key);
  return Boolean(token && autoControls?.has?.(token));
}

export function createDefaultAutoControls(trackIds = DEFAULT_AUTO_TRACK_IDS) {
  const keys = new Set([...AUTO_GENERATION_RANGE_IDS, ...AUTO_SELECT_IDS]);
  for (const trackId of trackIds) {
    const id = String(trackId || "");
    if (!id) continue;
    for (const key of [...AUTO_TRACK_RANGE_KEYS, ...AUTO_TRACK_SELECT_KEYS]) {
      keys.add(`track:${id}:${key}`);
    }
  }
  return keys;
}

export function sanitizeAutoControls(value, {
  trackIds = DEFAULT_AUTO_TRACK_IDS,
  defaultToAuto = false,
} = {}) {
  const allowed = createDefaultAutoControls(trackIds);
  if (!Array.isArray(value)) return defaultToAuto ? allowed : new Set();
  const sanitized = new Set();
  for (const key of value) {
    if (typeof key === "string" && allowed.has(key)) sanitized.add(key);
  }
  return sanitized;
}
