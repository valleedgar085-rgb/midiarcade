import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  applyProducerBrainConfig,
  createProducerBrainPlan,
  decorateProducerBrainResult,
} from "../src/core/producer-brain.js";
import { adaptGenerationConfig } from "../src/core/adaptive-generation.js";

const CHARACTER = {
  grooveDepth: 0.92,
  bassMotion: 0.86,
  melodyMotion: 0.78,
  harmonicColor: 0.94,
  space: 0.72,
};

const TASTE = {
  confidence: 0.74,
  energy: 0.82,
  complexity: 0.67,
  variation: 0.79,
  genreAffinity: 0.61,
  rejectionPressure: 0.18,
};

test("producer brain planning is deterministic and uses the deep audition budget", () => {
  const config = { seed: "phase8-brain", genre: "neoSoul", thinkingDepth: "deep" };
  const first = createProducerBrainPlan(config, { kind: "new", character: CHARACTER, taste: TASTE });
  const second = createProducerBrainPlan(config, { kind: "new", character: CHARACTER, taste: TASTE });

  assert.deepEqual(first, second);
  assert.equal(first.version, 1);
  assert.equal(first.id, "producer-brain-v1");
  assert.equal(first.mode, "deep-audition");
  assert.equal(first.search.baseCandidateCount, 6);
  assert.equal(first.search.maxCandidateCount, 10);
  assert.equal(first.search.repairAttempts, 2);
  assert.equal(first.search.wholeSongAuditions, 12);
  assert.equal(first.qualityIntent.preserveKeySafety, true);
  assert.equal(first.qualityIntent.preserveCriticCalibration, true);
  assert.equal(first.qualityIntent.avoidBackToBackIdentity, true);
  assert.ok(first.priorities.length >= 5);
});

test("explicit candidate budgets remain authoritative and disable automatic expansion", () => {
  const plan = createProducerBrainPlan(
    { candidateCount: 3, thinkingDepth: "deep" },
    { kind: "new", character: CHARACTER, taste: TASTE },
  );
  assert.equal(plan.search.baseCandidateCount, 3);
  assert.equal(plan.search.maxCandidateCount, 3);
  assert.equal(plan.search.adaptive, false);
  assert.equal(plan.search.targetedRepair, false);
  assert.equal(plan.search.repairAttempts, 0);
});

test("three-version generation auditions three candidates for each musical direction", () => {
  const plan = createProducerBrainPlan(
    { thinkingDepth: "deep" },
    { kind: "songVariations", character: CHARACTER, taste: TASTE },
  );
  assert.equal(plan.search.candidatesPerVariation, 3);
  assert.equal(plan.search.wholeSongAuditions, 9);
  assert.equal(plan.qualityIntent.preserveSongFamily, true);
});

test("producer brain config preserves explicit user search controls", () => {
  const input = {
    seed: "manual-budget",
    thinkingDepth: "standard",
    adaptiveCandidates: false,
    targetedRepair: false,
    repairAttempts: 0,
    candidatesPerVariation: 1,
  };
  const result = applyProducerBrainConfig(input, { kind: "songVariations", character: CHARACTER, taste: TASTE });
  assert.equal(result.thinkingDepth, "standard");
  assert.equal(result.adaptiveCandidates, false);
  assert.equal(result.targetedRepair, false);
  assert.equal(result.repairAttempts, 0);
  assert.equal(result.candidatesPerVariation, 1);
  assert.equal(result.producerBrain.mode, "balanced-audition");
});

test("adaptive generation publishes the producer brain without mutating the caller", () => {
  const input = {
    seed: "phase8-adaptive-integration",
    genre: "funk",
    energy: 0.64,
    complexity: 0.58,
    variation: 0.51,
    thinkingDepth: "deep",
    tasteProfile: {
      ratings: 8,
      likes: 6,
      rejects: 1,
      favorites: 1,
      energyTotal: 640,
      complexityTotal: 480,
      variationTotal: 560,
      genreVotes: { funk: 6 },
    },
  };
  const before = structuredClone(input);
  const result = adaptGenerationConfig(input, { kind: "new" });

  assert.deepEqual(input, before);
  assert.equal(result.producerBrain.version, 1);
  assert.equal(result.producerBrain.search.baseCandidateCount, 6);
  assert.equal(result.producerBrain.search.maxCandidateCount, 10);
  assert.equal(result.producerBrain.qualityIntent.preserveDeterminism, true);
});

test("committed songs and variation directions retain the exact producer plan", () => {
  const plan = createProducerBrainPlan(
    { thinkingDepth: "deep" },
    { kind: "songVariations", character: CHARACTER, taste: TASTE },
  );
  const source = {
    status: "committed",
    variations: [
      { id: "p", meta: {}, variationSet: { direction: { id: "pocket" }, candidatesAuditioned: 3 } },
      { id: "h", meta: {}, variationSet: { direction: { id: "hook" }, candidatesAuditioned: 3 } },
      { id: "j", meta: {}, variationSet: { direction: { id: "journey" }, candidatesAuditioned: 3 } },
    ],
  };
  const result = decorateProducerBrainResult(source, plan);

  assert.equal(result.producerBrain, plan);
  assert.deepEqual(result.variations.map((song) => song.meta.producerBrain.variationSelection.direction), [
    "pocket",
    "hook",
    "journey",
  ]);
  assert.deepEqual(result.variations.map((song) => song.meta.producerBrain.variationSelection.index), [0, 1, 2]);
  assert.ok(source.variations.every((song) => song.meta.producerBrain == null), "decoration must not mutate worker results");
});

test("producer brain orchestration contains no unseeded randomness", () => {
  const source = fs.readFileSync(new URL("../src/core/producer-brain.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Math\.random|crypto\.getRandomValues/);
});
