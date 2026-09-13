function hashNumber(value) {
  let hash = 2166136261;
  const text = String(value ?? "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clamp01(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(1, Math.max(0, numeric));
}

function uniquePrograms(values = []) {
  return [...new Set(values.map(Number).filter((value) => Number.isFinite(value) && value >= 0 && value <= 127))];
}

export const ELEMENT_PROGRAM_PRIORITIES = Object.freeze({
  fire: Object.freeze({
    drums: Object.freeze([16, 24, 25, 8, 0]),
    bass: Object.freeze([38, 39, 36, 37, 34, 33, 87]),
    chords: Object.freeze([61, 62, 81, 17, 7, 29, 30, 4, 5]),
    melody: Object.freeze([81, 86, 84, 29, 30, 56, 65, 80]),
    counterpoint: Object.freeze([81, 84, 86, 56, 29, 65, 80, 98]),
    pad: Object.freeze([90, 93, 95, 94, 89, 92]),
  }),
  electric: Object.freeze({
    drums: Object.freeze([24, 25, 16, 0, 8]),
    bass: Object.freeze([39, 38, 87, 36, 33, 34]),
    chords: Object.freeze([90, 81, 95, 5, 17, 7, 62, 4]),
    melody: Object.freeze([82, 84, 85, 86, 81, 80, 87]),
    counterpoint: Object.freeze([82, 84, 85, 98, 81, 80, 86]),
    pad: Object.freeze([93, 94, 95, 90, 92, 88, 99]),
  }),
  drip: Object.freeze({
    drums: Object.freeze([8, 0, 24, 25, 16]),
    bass: Object.freeze([35, 33, 38, 43, 88, 39, 34]),
    chords: Object.freeze([4, 5, 89, 48, 24, 11, 52, 16]),
    melody: Object.freeze([73, 85, 24, 26, 40, 65, 80, 71]),
    counterpoint: Object.freeze([10, 11, 73, 85, 53, 48, 98, 71]),
    pad: Object.freeze([88, 89, 91, 92, 96, 99, 94, 95]),
  }),
});

export function elementProgramCandidates(trackId, elementId, palette = []) {
  const safePalette = uniquePrograms(palette);
  if (!safePalette.length) return [];
  const priorities = ELEMENT_PROGRAM_PRIORITIES[String(elementId || "").toLowerCase()]?.[trackId] ?? [];
  const preferred = priorities.filter((program) => safePalette.includes(program));
  const remaining = safePalette.filter((program) => !preferred.includes(program));
  return [...preferred, ...remaining];
}

/**
 * Deterministically chooses a role-safe instrument program for one elemental
 * interpretation. Intensity only changes how tightly the chooser stays near
 * the element's preferred timbres; it never expands beyond the supplied
 * genre/role palette.
 */
export function chooseElementProgram({
  trackId,
  elementId,
  intensity = 0.75,
  palette = [],
  seed = "song",
  currentProgram,
} = {}) {
  let candidates = elementProgramCandidates(trackId, elementId, palette);
  if (!candidates.length) return Number.isFinite(Number(currentProgram)) ? Number(currentProgram) : null;

  const current = Number(currentProgram);
  const alternatives = candidates.filter((program) => program !== current);
  if (alternatives.length) candidates = alternatives;

  const strength = clamp01(intensity);
  const focusRatio = strength >= 0.82 ? 0.42 : strength >= 0.62 ? 0.68 : 1;
  const focusCount = Math.max(1, Math.ceil(candidates.length * focusRatio));
  const focused = candidates.slice(0, focusCount);
  return focused[hashNumber(`${seed}:${elementId}:${trackId}:${strength.toFixed(4)}`) % focused.length];
}
