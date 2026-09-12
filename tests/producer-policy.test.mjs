import assert from "node:assert/strict";
import test from "node:test";
import {
  createProducerSearchPolicy,
  createProductionPriorities,
  normalizeProducerCharacter,
  normalizeProducerKind,
  normalizeProducerTaste,
  normalizeThinkingDepth,
} from "../src/core/producer-policy.js";

const CHARACTER = normalizeProducerCharacter({
  grooveDepth: 0.92,
  bassMotion: 0.86,
  melodyMotion: 0.78,
  harmonicColor: 0.94,
  space: 0.72,
});

const TASTE = normalizeProducerTaste({
  confidence: 0.74,
  variation: 0.79,
  genreAffinity: 0.61,
  rejectionPressure: 0.18,
});

test("producer policy normalizes unsupported request shapes deterministically", () => {
  assert.equal(normalizeProducerKind("similar"), "similar");
  assert.equal(normalizeProducerKind("unknown"), "new");
  assert.equal(normalizeThinkingDepth("standard"), "standard");
  assert.equal(normalizeThinkingDepth("anything-else"), "deep");
  assert.deepEqual(normalizeProducerCharacter({ grooveDepth: 5, space: -2 }), {
    grooveDepth: 1,
    bassMotion: 0,
    melodyMotion: 0,
    harmonicColor: 0,
    space: 0,
  });
});

test("producer search policy preserves the existing deep and explicit candidate budgets", () => {
  const deep = createProducerSearchPolicy({}, "new", "deep");
  assert.deepEqual(deep, {
    depth: "deep",
    adaptive: true,
    targetedRepair: true,
    repairAttempts: 2,
    baseCandidateCount: 6,
    maxCandidateCount: 10,
    candidatesPerVariation: null,
    wholeSongAuditions: 12,
  });

  const explicit = createProducerSearchPolicy({ candidateCount: 3 }, "new", "deep");
  assert.equal(explicit.baseCandidateCount, 3);
  assert.equal(explicit.maxCandidateCount, 3);
  assert.equal(explicit.adaptive, false);
  assert.equal(explicit.targetedRepair, false);
  assert.equal(explicit.repairAttempts, 0);

  const variations = createProducerSearchPolicy({}, "songVariations", "deep");
  assert.equal(variations.candidatesPerVariation, 3);
  assert.equal(variations.wholeSongAuditions, 9);
});

test("production priorities remain bounded, sorted, and taste-aware", () => {
  const first = createProductionPriorities(CHARACTER, TASTE, "new");
  const repeated = createProductionPriorities(CHARACTER, TASTE, "new");
  const similar = createProductionPriorities(CHARACTER, TASTE, "similar");

  assert.deepEqual(first, repeated);
  assert.equal(first.length, 5);
  assert.ok(first.every(({ weight }) => weight >= 0 && weight <= 1));
  assert.ok(first.every((entry, index) => index === 0 || first[index - 1].weight >= entry.weight));
  assert.ok(first.find(({ id }) => id === "novelty").weight > similar.find(({ id }) => id === "novelty").weight);
});
