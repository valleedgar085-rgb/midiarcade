import { finite } from "../utils.js";

const ELECTRONIC_GENRES = new Set(["house", "techno", "drumBass"]);
const LOOP_GENRES = new Set(["loFiHipHop", "ambient"]);
const HOOK_FORWARD_GENRES = new Set(["pop", "popRadio", "synthPopRadio", "synthwave", "rock"]);
const VERSE_FORWARD_GENRES = new Set(["rap", "hipHop", "country"]);

const FAMILIES = Object.freeze({
  hookFirst: Object.freeze({ id: "hook-first", label: "Hook first", character: "Open with identity, then earn a larger return." }),
  verseDriven: Object.freeze({ id: "verse-driven", label: "Verse driven", character: "Build the story before the main payoff." }),
  bridgePayoff: Object.freeze({ id: "bridge-payoff", label: "Bridge payoff", character: "Use contrast in the middle to make the final return feel larger." }),
  slowBloom: Object.freeze({ id: "slow-bloom", label: "Slow bloom", character: "Delay the strongest section and increase pressure across the form." }),
  doublePeak: Object.freeze({ id: "double-peak", label: "Double peak", character: "Two major payoffs separated by a real reset." }),
  earlyImpact: Object.freeze({ id: "early-impact", label: "Early impact", character: "Hit a recognizable peak early, then rebuild toward the final peak." }),
  hypnoticWave: Object.freeze({ id: "hypnotic-wave", label: "Hypnotic wave", character: "Cycle tension and release without literal section cloning." }),
  loopDevelopment: Object.freeze({ id: "loop-development", label: "Loop development", character: "Keep the core loop identity while changing its surrounding context." }),
});

function hash32(value) {
  let hash = 2166136261;
  const text = String(value ?? "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function pick(values, seed) {
  return values[hash32(seed) % values.length];
}

function cloneLayout(layout = []) {
  return layout.map((section) => ({
    name: String(section?.name ?? "idea").toLowerCase(),
    weight: Math.max(0.2, finite(section?.weight, 1)),
  }));
}

function weight(name, amount = 1) {
  return { name, weight: amount };
}

function songFamilyCandidates(genre) {
  if (ELECTRONIC_GENRES.has(genre)) return [FAMILIES.doublePeak, FAMILIES.earlyImpact, FAMILIES.hypnoticWave, FAMILIES.slowBloom];
  if (LOOP_GENRES.has(genre)) return [FAMILIES.loopDevelopment, FAMILIES.slowBloom, FAMILIES.bridgePayoff];
  if (HOOK_FORWARD_GENRES.has(genre)) return [FAMILIES.hookFirst, FAMILIES.bridgePayoff, FAMILIES.slowBloom, FAMILIES.verseDriven];
  if (VERSE_FORWARD_GENRES.has(genre)) return [FAMILIES.verseDriven, FAMILIES.bridgePayoff, FAMILIES.hookFirst];
  return [FAMILIES.verseDriven, FAMILIES.bridgePayoff, FAMILIES.slowBloom, FAMILIES.hookFirst];
}

export function createArrangementEvolution(config = {}) {
  const genre = String(config.genre ?? "pop");
  const bars = Math.max(1, Math.round(finite(config.bars, 16)));
  const seed = String(config.seed ?? `${genre}:arrangement`);
  const enabled = config.arrangementEvolution === true && bars >= 8;
  const candidates = songFamilyCandidates(genre);
  const family = pick(candidates, `${seed}:${genre}:${bars}:family`);
  return Object.freeze({
    enabled,
    version: 1,
    genre,
    bars,
    family: family.id,
    label: family.label,
    character: family.character,
    signature: hash32(`${seed}:${genre}:${bars}:${family.id}`).toString(16).padStart(8, "0"),
  });
}

function electronicLayout(family, bars) {
  const compact = bars <= 15;
  if (family === "early-impact") {
    return compact
      ? [weight("intro", 0.7), weight("drop", 1.7), weight("breakdown", 1), weight("build", 0.8), weight("drop", 1.9)]
      : [weight("intro", 0.7), weight("drop", 1.8), weight("breakdown", 1.2), weight("build", 0.8), weight("drop", 2.2), weight("outro", 0.6)];
  }
  if (family === "slow-bloom") {
    return compact
      ? [weight("intro", 1.2), weight("build", 1.1), weight("breakdown", 0.8), weight("drop", 2.3)]
      : [weight("intro", 1.1), weight("build", 1.2), weight("breakdown", 1), weight("build", 0.9), weight("drop", 2.6), weight("outro", 0.6)];
  }
  if (family === "hypnotic-wave") {
    return compact
      ? [weight("intro", 0.7), weight("drop", 1.5), weight("breakdown", 0.9), weight("drop", 1.8), weight("outro", 0.5)]
      : [weight("intro", 0.7), weight("drop", 1.6), weight("breakdown", 1), weight("drop", 1.9), weight("breakdown", 0.8), weight("drop", 2.1), weight("outro", 0.5)];
  }
  return compact
    ? [weight("intro", 0.7), weight("build", 0.8), weight("drop", 1.8), weight("breakdown", 0.9), weight("drop", 2)]
    : [weight("intro", 0.7), weight("build", 0.8), weight("drop", 1.8), weight("breakdown", 1.1), weight("build", 0.7), weight("drop", 2.2), weight("outro", 0.5)];
}

function loopLayout(family, bars) {
  const compact = bars <= 15;
  if (family === "slow-bloom") {
    return compact
      ? [weight("intro", 1), weight("idea", 1.7), weight("breakdown", 1), weight("theme", 2)]
      : [weight("intro", 1), weight("idea", 1.7), weight("breakdown", 1.1), weight("theme", 2), weight("bridge", 1), weight("idea", 1.8), weight("outro", 0.7)];
  }
  if (family === "bridge-payoff") {
    return compact
      ? [weight("intro", 0.8), weight("idea", 1.8), weight("bridge", 1), weight("idea", 2)]
      : [weight("intro", 0.8), weight("idea", 1.8), weight("breakdown", 0.9), weight("bridge", 1.2), weight("idea", 2.1), weight("outro", 0.7)];
  }
  return compact
    ? [weight("intro", 0.7), weight("idea", 1.8), weight("breakdown", 0.9), weight("idea", 2)]
    : [weight("intro", 0.7), weight("idea", 1.9), weight("breakdown", 1), weight("idea", 1.7), weight("bridge", 1), weight("idea", 2.1), weight("outro", 0.6)];
}

function songLayout(family, bars) {
  const compact = bars <= 15;
  if (family === "hook-first") {
    return compact
      ? [weight("intro", 0.6), weight("chorus", 1.4), weight("verse", 1.8), weight("prechorus", 0.6), weight("chorus", 1.7)]
      : [weight("intro", 0.6), weight("chorus", 1.35), weight("verse", 1.8), weight("prechorus", 0.65), weight("chorus", 1.65), weight("bridge", 1), weight("chorus", 1.9), weight("outro", 0.55)];
  }
  if (family === "bridge-payoff") {
    return compact
      ? [weight("intro", 0.6), weight("verse", 1.7), weight("chorus", 1.4), weight("bridge", 0.9), weight("chorus", 1.8)]
      : [weight("intro", 0.6), weight("verse", 1.8), weight("prechorus", 0.65), weight("chorus", 1.45), weight("bridge", 1.1), weight("verse", 1.35), weight("chorus", 1.95), weight("outro", 0.55)];
  }
  if (family === "slow-bloom") {
    return compact
      ? [weight("intro", 0.8), weight("verse", 1.8), weight("prechorus", 0.8), weight("bridge", 0.8), weight("chorus", 2)]
      : [weight("intro", 0.8), weight("verse", 1.9), weight("verse", 1.45), weight("prechorus", 0.75), weight("bridge", 0.95), weight("chorus", 2.1), weight("outro", 0.55)];
  }
  return compact
    ? [weight("intro", 0.55), weight("verse", 2.1), weight("verse", 1.4), weight("chorus", 1.6), weight("outro", 0.5)]
    : [weight("intro", 0.55), weight("verse", 2.1), weight("verse", 1.55), weight("prechorus", 0.65), weight("chorus", 1.55), weight("bridge", 0.9), weight("chorus", 1.85), weight("outro", 0.5)];
}

/**
 * Replaces only the macro section sequence. Bar allocation, section intensity,
 * Song DNA, phrase memory, orchestration, critic repair, and export safety stay
 * inside their existing engine paths.
 */
export function evolveArrangementLayout(baseLayout = [], config = {}) {
  const source = cloneLayout(baseLayout);
  const evolution = createArrangementEvolution(config);
  if (!evolution.enabled || source.length < 2) return source;

  if (ELECTRONIC_GENRES.has(evolution.genre)) return electronicLayout(evolution.family, evolution.bars);
  if (LOOP_GENRES.has(evolution.genre)) return loopLayout(evolution.family, evolution.bars);
  return songLayout(evolution.family, evolution.bars);
}
