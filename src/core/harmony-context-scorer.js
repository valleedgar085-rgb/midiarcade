import { genreScalePriorBonus } from "./genre-scale-priors.js";

export const HARMONY_CONTEXT_WEIGHTS = Object.freeze({
  chordFit: 0.30,
  guideToneFit: 0.20,
  commonToneFit: 0.16,
  semitoneResolution: 0.14,
  melodyFit: 0.12,
  colorFit: 0.08,
});

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, finite(value, min)));
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function mod12(value) {
  return ((Math.round(finite(value)) % 12) + 12) % 12;
}

function pitchClassSet(values = []) {
  return new Set((Array.isArray(values) ? values : [])
    .filter((value) => Number.isFinite(Number(value)))
    .map(mod12));
}

function chordRoot(event = {}) {
  const explicit = [
    event?.rootPc,
    event?.root,
    event?.rootPitchClass,
    event?.tonicPc,
  ].find((value) => Number.isFinite(Number(value)));
  if (explicit != null) return mod12(explicit);
  const tones = [...pitchClassSet(event?.tones)];
  return tones.length ? tones[0] : null;
}

function chordClasses(event = {}) {
  const tones = pitchClassSet(event?.tones);
  const root = chordRoot(event);
  if (root != null) tones.add(root);
  return tones;
}

function guideToneClasses(event = {}) {
  const root = chordRoot(event);
  const tones = chordClasses(event);
  if (root == null || !tones.size) return new Set();
  const candidates = [root + 3, root + 4, root + 10, root + 11].map(mod12);
  return new Set(candidates.filter((pitchClass) => tones.has(pitchClass)));
}

function coverage(candidateClasses, targets) {
  if (!targets?.size) return null;
  let matched = 0;
  for (const target of targets) if (candidateClasses.has(target)) matched += 1;
  return matched / targets.size;
}

function intersection(left, right) {
  const result = new Set();
  for (const value of left) if (right.has(value)) result.add(value);
  return result;
}

function union(...sets) {
  const result = new Set();
  for (const set of sets) for (const value of set ?? []) result.add(value);
  return result;
}

function commonToneTargets(currentChord, previousChord, nextChord) {
  const current = chordClasses(currentChord);
  if (!current.size) return new Set();
  return union(
    intersection(current, chordClasses(previousChord)),
    intersection(current, chordClasses(nextChord)),
  );
}

function semitoneResolutionPotential(candidateClasses, nextChord) {
  const guides = guideToneClasses(nextChord);
  const targets = guides.size ? guides : chordClasses(nextChord);
  if (!targets.size) return null;

  let supported = 0;
  for (const target of targets) {
    const below = mod12(target - 1);
    const above = mod12(target + 1);
    if (candidateClasses.has(below) || candidateClasses.has(above)) supported += 1;
  }
  return supported / targets.size;
}

function normalizedCandidate(candidate = {}) {
  const scale = String(candidate?.scale ?? candidate?.id ?? "").trim();
  const pitchClasses = pitchClassSet(candidate?.pitchClasses ?? candidate?.scalePitchClasses);
  return Object.freeze({ scale, pitchClasses });
}

function weightedBaseScore(metrics) {
  let weighted = 0;
  let weightTotal = 0;
  for (const [key, weight] of Object.entries(HARMONY_CONTEXT_WEIGHTS)) {
    const value = metrics[key];
    if (!Number.isFinite(value)) continue;
    weighted += clamp(value) * weight;
    weightTotal += weight;
  }
  return weightTotal > 0 ? weighted / weightTotal : 0.5;
}

/**
 * Score one scale candidate against local harmonic context.
 *
 * Genre influence is deliberately additive and small. The research-backed
 * prior can nudge a close decision, but chord/melody/voice-leading context
 * remains authoritative.
 */
export function scoreHarmonyScaleCandidate({
  genre = "",
  candidate = {},
  chord = null,
  previousChord = null,
  nextChord = null,
  melodyPitchClasses = [],
  characteristicPitchClasses = [],
} = {}) {
  const normalized = normalizedCandidate(candidate);
  const candidateClasses = normalized.pitchClasses;
  const currentChordClasses = chordClasses(chord);
  const guides = guideToneClasses(chord);
  const commonTargets = commonToneTargets(chord, previousChord, nextChord);
  const melodyTargets = pitchClassSet(melodyPitchClasses);
  const colorTargets = pitchClassSet(characteristicPitchClasses);

  const metrics = Object.freeze({
    chordFit: coverage(candidateClasses, currentChordClasses),
    guideToneFit: coverage(candidateClasses, guides),
    commonToneFit: coverage(candidateClasses, commonTargets),
    semitoneResolution: semitoneResolutionPotential(candidateClasses, nextChord),
    melodyFit: coverage(candidateClasses, melodyTargets),
    colorFit: coverage(candidateClasses, colorTargets),
  });

  const baseScore = weightedBaseScore(metrics);
  const genreBonus = genreScalePriorBonus(genre, normalized.scale);
  const score = clamp(baseScore + genreBonus);

  return Object.freeze({
    version: 1,
    scale: normalized.scale,
    score: round(score),
    baseScore: round(baseScore),
    genreBonus: round(genreBonus),
    metrics: Object.freeze(Object.fromEntries(
      Object.entries(metrics).map(([key, value]) => [key, value == null ? null : round(value)]),
    )),
  });
}

/**
 * Deterministically rank scale candidates for a single harmony context.
 */
export function rankHarmonyScaleCandidates({
  genre = "",
  candidates = [],
  chord = null,
  previousChord = null,
  nextChord = null,
  melodyPitchClasses = [],
  characteristicPitchClasses = [],
} = {}) {
  return Object.freeze(candidates
    .map((candidate) => scoreHarmonyScaleCandidate({
      genre,
      candidate,
      chord,
      previousChord,
      nextChord,
      melodyPitchClasses,
      characteristicPitchClasses,
    }))
    .sort((left, right) => (
      right.score - left.score
      || right.baseScore - left.baseScore
      || left.scale.localeCompare(right.scale)
    )));
}

export const HARMONY_CONTEXT_SCORER_VERSION = "1.0";
