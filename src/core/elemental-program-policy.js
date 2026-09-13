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
    drums: Object.freeze([16, 25, 24, 8, 0]),
    bass: Object.freeze([38, 36, 37, 34, 33, 39, 87]),
    chords: Object.freeze([61, 62, 29, 30, 81, 17, 7, 4, 5]),
    melody: Object.freeze([81, 86, 29, 30, 56, 65, 80, 84]),
    counterpoint: Object.freeze([81, 86, 56, 29, 65, 80, 84, 98]),
    pad: Object.freeze([90, 93, 95, 94, 89, 92]),
  }),
  electric: Object.freeze({
    drums: Object.freeze([24, 25, 16, 0, 8]),
    bass: Object.freeze([39, 87, 38, 36, 33, 34]),
    chords: Object.freeze([90, 95, 81, 17, 7, 62, 5, 4]),
    melody: Object.freeze([82, 84, 85, 87, 80, 81, 86]),
    counterpoint: Object.freeze([82, 84, 98, 85, 80, 81, 86]),
    pad: Object.freeze([94, 95, 93, 99, 90, 92, 88]),
  }),
  drip: Object.freeze({
    drums: Object.freeze([8, 0, 24, 25, 16]),
    bass: Object.freeze([35, 43, 88, 33, 34, 38, 39]),
    chords: Object.freeze([4, 5, 89, 48, 24, 11, 52, 16]),
    melody: Object.freeze([73, 24, 26, 40, 65, 71, 85, 80]),
    counterpoint: Object.freeze([10, 11, 73, 53, 48, 71, 85, 98]),
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
 * interpretation. Strong elements intentionally lock near the top of their
 * own timbral lane so Fire/Electric/Drip remain audibly recognizable instead
 * of randomly collapsing onto the same patch. The chooser never expands
 * beyond the supplied genre/role palette.
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
  if (strength >= 0.8) return candidates[0];

  const focusRatio = strength >= 0.62 ? 0.5 : 0.72;
  const focusCount = Math.max(1, Math.ceil(candidates.length * focusRatio));
  const focused = candidates.slice(0, focusCount);
  return focused[hashNumber(`${seed}:${elementId}:${trackId}:${strength.toFixed(4)}`) % focused.length];
}
