import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  adaptGenerationConfig,
  adaptGenerationRequest,
  generationCharacter,
  tasteConfidence,
  tasteVector,
} from "../src/core/adaptive-generation.js";
import { createGenerationExecutor } from "../src/core/generation-executor.js";

const BASE = {
  seed: "phase6:adaptive",
  genre: "funk",
  energy: 0.62,
  complexity: 0.58,
  variation: 0.5,
  evolution: 0.55,
  surprise: 0.24,
  syncopation: 0.54,
  drumFills: 0.42,
  chordExtensions: 0.52,
  harmonicRhythm: 0.38,
  swing: 0.08,
  humanize: 0.12,
  similarity: 0.78,
  tracks: {
    drums: { density: 0.68, variation: 0.36, humanize: 1, feel: 1, velocity: 1 },
    bass: { density: 0.58, variation: 0.44, humanize: 0.8, feel: 0.9, velocity: 0.94 },
    chords: { density: 0.48, variation: 0.31, humanize: 0.55, feel: 0.7, velocity: 0.82 },
    melody: { density: 0.52, variation: 0.52, humanize: 0.72, feel: 0.62, velocity: 0.92 },
    counterpoint: { density: 0.28, variation: 0.63, humanize: 0.58, feel: 0.5, velocity: 0.76 },
    pad: { density: 0.34, variation: 0.24, humanize: 0.16, feel: 0.1, velocity: 0.68 },
  },
};

const STRONG_TASTE = {
  ratings: 12,
  likes: 8,
  rejects: 1,
  favorites: 2,
  energyTotal: 1020,
  complexityTotal: 888,
  variationTotal: 1080,
  genreVotes: { funk: 10, ambient: -1 },
};

test("adaptive steering is deterministic, pure, and seed preserving", () => {
  const input = structuredClone({ ...BASE, tasteProfile: STRONG_TASTE });
  const before = structuredClone(input);
  const first = adaptGenerationConfig(input);
  const second = adaptGenerationConfig(input);

  assert.deepEqual(first, second);
  assert.deepEqual(input, before, "adaptive steering must not mutate caller config");
  assert.equal(first.seed, BASE.seed);
  assert.equal(first.genre, BASE.genre);
  assert.equal(first.adaptiveTaste.version, 1);
  assert.ok(first.adaptiveTaste.confidence > 0.5);
});

test("empty taste stays neutral while genre character adds bounded musical identity", () => {
  const result = adaptGenerationConfig({ ...BASE, tasteProfile: {} });
  assert.equal(result.adaptiveTaste.confidence, 0);
  assert.equal(result.energy, BASE.energy);
  assert.equal(result.complexity, BASE.complexity);
  assert.ok(result.syncopation > BASE.syncopation, "funk should deepen syncopation without needing taste data");
  assert.ok(result.tracks.bass.variation > BASE.tracks.bass.variation);
  assert.ok(result.tracks.melody.variation > BASE.tracks.melody.variation);
  assert.ok(result.tracks.pad.density < BASE.tracks.pad.density, "backing density should make more space instead of only adding notes");
});

test("explicit positive taste gently changes priors without collapsing diversity", () => {
  const neutral = adaptGenerationConfig({ ...BASE, tasteProfile: {} });
  const learned = adaptGenerationConfig({ ...BASE, tasteProfile: STRONG_TASTE });

  assert.ok(learned.energy > neutral.energy);
  assert.ok(learned.complexity > neutral.complexity);
  assert.ok(learned.variation > neutral.variation);
  assert.ok(learned.syncopation >= neutral.syncopation);
  assert.ok(learned.similarity >= 0.5 && learned.similarity <= 0.94);
  assert.ok(learned.adaptiveTaste.genreAffinity > 0);
  assert.equal(tasteVector(STRONG_TASTE, "funk").variation, 0.9);
  assert.ok(tasteConfidence(STRONG_TASTE) <= 1);
});

test("all adaptive performance values remain bounded", () => {
  const result = adaptGenerationConfig({
    ...BASE,
    energy: 99,
    complexity: -99,
    variation: 99,
    swing: 99,
    humanize: -99,
    tasteProfile: { ...STRONG_TASTE, genreVotes: { funk: 9999 } },
    tracks: Object.fromEntries(Object.entries(BASE.tracks).map(([id, track]) => [id, {
      ...track,
      density: id === "pad" ? -9 : 9,
      variation: 9,
      humanize: 9,
      feel: -9,
      velocity: 9,
    }])),
  });

  for (const key of ["energy", "complexity", "variation", "evolution", "surprise", "syncopation", "drumFills", "chordExtensions", "harmonicRhythm", "swing", "humanize"]) {
    assert.ok(result[key] >= 0 && result[key] <= 1, `${key} must stay normalized`);
  }
  for (const [id, track] of Object.entries(result.tracks)) {
    for (const key of ["density", "variation", "humanize", "feel", "velocity"]) {
      assert.ok(track[key] >= 0 && track[key] <= 1, `${id}.${key} must stay normalized`);
    }
  }
});

test("section-only variation requests remain surgically untouched", () => {
  const payload = {
    sourceSong: { id: "song" },
    sectionId: "verse-1",
    input: { variation: 0.44, seed: "section" },
  };
  assert.deepEqual(adaptGenerationRequest("sectionVariations", payload), payload);
});

test("worker and fallback receive the same single adaptive request", async () => {
  const listeners = new Map();
  let posted;
  const worker = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    postMessage(message) {
      posted = message;
      queueMicrotask(() => listeners.get("message")?.({
        data: { requestId: message.requestId, ok: false, error: "force fallback" },
      }));
    },
    terminate() {},
  };
  let fallbackPayload;
  const executor = createGenerationExecutor({
    workerFactory: () => worker,
    fallback: (_kind, payload) => {
      fallbackPayload = payload;
      return { status: "committed", song: { id: "fallback" } };
    },
  });

  const payload = { config: { ...BASE, tasteProfile: STRONG_TASTE } };
  await executor.run("new", payload);
  assert.equal(posted.payload.config.adaptiveTaste.version, 1);
  assert.deepEqual(fallbackPayload, posted.payload, "worker recovery must reuse the exact adapted payload, not adapt twice");
  assert.equal(payload.config.adaptiveTaste, undefined, "caller payload must remain untouched");
});

test("genre character registry encodes distinct groove personalities", () => {
  const funk = generationCharacter("funk");
  const ambient = generationCharacter("ambient");
  assert.ok(funk.grooveDepth > ambient.grooveDepth);
  assert.ok(funk.bassMotion > ambient.bassMotion);
  assert.ok(ambient.space > funk.space);
});

test("adaptive generation contains no unseeded randomness", () => {
  const source = fs.readFileSync(new URL("../src/core/adaptive-generation.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Math\.random/);
});
