import test from "node:test";
import assert from "node:assert/strict";
import { createTasteProfile, learnTasteSignal, tasteGenerationBias } from "../src/core/taste-profile.js";
import { applyAdaptiveGroove, ADAPTIVE_POCKETS } from "../src/core/groove-expression.js";
import { applyPatternVariety, PATTERN_VARIETY_DIRECTIONS } from "../src/core/pattern-variety.js";

const SONG = {
  id: "taste-song",
  seed: "taste-seed",
  title: "Taste Song",
  genre: "funk",
  bpm: 104,
  bars: 32,
  settings: {
    energy: 0.78,
    complexity: 0.66,
    variation: 0.74,
    swing: 0.18,
    humanize: 0.2,
    evolution: 0.82,
    surprise: 0.48,
    syncopation: 0.76,
  },
  tracks: [
    { id: "bass", notes: [{ pitch: 36 }, { pitch: 43 }, { pitch: 39 }, { pitch: 48 }] },
    { id: "melody", notes: [{ pitch: 60 }, { pitch: 67 }, { pitch: 64 }, { pitch: 72 }, { pitch: 65 }] },
  ],
};

const BASE_CONFIG = {
  seed: "adaptive-seed",
  genre: "funk",
  energy: 0.7,
  complexity: 0.58,
  variation: 0.48,
  evolution: 0.58,
  surprise: 0.28,
  swing: 0.12,
  humanize: 0.12,
  syncopation: 0.56,
  drumFills: 0.46,
  similarity: 0.8,
  trackControls: {
    drums: { density: 0.72, variation: 0.52, velocity: 1, humanize: 0.9, feel: 0.9, gate: 0.85 },
    bass: { density: 0.62, variation: 0.4, velocity: 0.94, humanize: 0.8, feel: 0.9, gate: 0.82 },
    chords: { density: 0.58, variation: 0.38, velocity: 0.82, humanize: 0.55, feel: 0.7, gate: 0.9 },
    melody: { density: 0.64, variation: 0.5, velocity: 0.92, humanize: 0.72, feel: 0.62, gate: 0.88 },
    counterpoint: { density: 0.38, variation: 0.55, velocity: 0.76, humanize: 0.58, feel: 0.5, gate: 0.94 },
    pad: { density: 0.82, variation: 0.28, velocity: 0.68, humanize: 0.16, feel: 0.1, gate: 1 },
  },
};

test("taste profile learns strong signals without letting replay spam dominate", () => {
  let profile = createTasteProfile();
  profile = learnTasteSignal(profile, SONG, "like");
  profile = learnTasteSignal(profile, SONG, "favorite");
  for (let index = 0; index < 10; index += 1) profile = learnTasteSignal(profile, SONG, "replay");
  profile = learnTasteSignal(profile, SONG, "export");

  const bias = tasteGenerationBias(profile);
  assert.equal(profile.likes, 1);
  assert.equal(profile.favorites, 1);
  assert.equal(profile.exports, 1);
  assert.equal(profile.replays, 5);
  assert.ok(bias.confidence > 0);
  assert.ok(bias.exploration >= 0.28, "personalization must preserve exploration");
  assert.ok(bias.traits.syncopation.center > 65);
  assert.ok(bias.traits.evolution.center > 70);
});

test("adaptive groove is deterministic, bounded, and protects drum/bass expression", () => {
  const profile = learnTasteSignal(createTasteProfile(), SONG, "favorite");
  const bias = tasteGenerationBias(profile);
  const first = applyAdaptiveGroove(BASE_CONFIG, bias, "groove-seed");
  const repeated = applyAdaptiveGroove(BASE_CONFIG, bias, "groove-seed");
  assert.deepEqual(first, repeated);
  assert.ok(ADAPTIVE_POCKETS.some((pocket) => pocket.id === first.performancePocket.id));
  assert.ok(first.swing >= 0 && first.swing <= 0.52);
  assert.ok(first.humanize >= 0.04 && first.humanize <= 0.34);
  assert.ok(first.syncopation >= 0.22 && first.syncopation <= 0.88);
  assert.ok(first.trackControls.bass.variation > BASE_CONFIG.trackControls.bass.variation);
  assert.ok(first.trackControls.melody.variation > BASE_CONFIG.trackControls.melody.variation);
  assert.equal(first.tracks, first.trackControls);
});

test("pattern director creates several deterministic musical routes across seeds", () => {
  const bias = tasteGenerationBias(learnTasteSignal(createTasteProfile(), SONG, "like"));
  const directions = new Set();
  const routes = new Set();
  for (let index = 0; index < 18; index += 1) {
    const grooved = applyAdaptiveGroove({ ...BASE_CONFIG, seed: `seed-${index}` }, bias, `seed-${index}`);
    const shaped = applyPatternVariety(grooved, bias, `seed-${index}`);
    directions.add(shaped.patternVariety.direction);
    routes.add(shaped.compositionRoute);
    assert.ok(shaped.variation >= 0.48 && shaped.variation <= 0.9);
    assert.ok(shaped.evolution >= 0.5 && shaped.evolution <= 0.94);
    assert.ok(shaped.surprise >= 0.18 && shaped.surprise <= 0.68);
    assert.ok(PATTERN_VARIETY_DIRECTIONS.some((direction) => direction.id === shaped.patternVariety.direction));
  }
  assert.ok(directions.size >= 3, "different seeds should open several pattern families");
  assert.ok(routes.size >= 2, "variety should reach more than one composition route");
});
