import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveGenerationConfig,
  resolveGenerationRequest,
} from "../src/core/resolved-generation-intent.js";

test("resolved generation intent records requested, producer, and final control authority", () => {
  const input = {
    seed: "resolved-intent-proof",
    genre: "hipHop",
    variation: 0.44,
    evolution: 0.52,
    syncopation: 0.48,
    tasteProfile: {
      ratings: 4,
      likes: 3,
      favorites: 1,
      energyTotal: 300,
      complexityTotal: 230,
      variationTotal: 280,
      genreVotes: { hipHop: 3 },
    },
    tracks: {
      drums: { density: 0.7, variation: 0.5, feel: 0.55 },
      bass: { density: 0.6, variation: 0.46, feel: 0.58 },
    },
  };
  const before = structuredClone(input);
  const first = resolveGenerationConfig(input, { kind: "new" });
  const second = resolveGenerationConfig(input, { kind: "new" });

  assert.deepEqual(input, before, "intent resolution must not mutate caller config");
  assert.deepEqual(first, second, "same request must resolve deterministically");
  assert.equal(first.resolvedGenerationIntent.id, "resolved-generation-intent-v1");
  assert.equal(first.resolvedGenerationIntent.kind, "new");
  assert.equal(first.resolvedGenerationIntent.version, 2);
  assert.match(first.resolvedGenerationIntent.equation, /genre adjustment.*taste adjustment.*quality adjustment/);
  const variationTrace = first.resolvedGenerationIntent.controls.variation;
  assert.equal(variationTrace.requested, 0.44);
  assert.equal(variationTrace.final, first.variation);
  assert.equal(typeof variationTrace.genreAdjustment, "number");
  assert.equal(typeof variationTrace.tasteAdjustment, "number");
  assert.equal(typeof variationTrace.qualityAdjustment, "number");
  const reconstructedVariation = variationTrace.requested
    + variationTrace.genreAdjustment
    + variationTrace.tasteAdjustment
    + variationTrace.qualityAdjustment;
  assert.ok(Math.abs(reconstructedVariation - variationTrace.final) < 0.0015, "intent deltas must reconstruct final value");
  assert.equal(first.resolvedGenerationIntent.tracks.drums.density.requested, 0.7);
  assert.equal(first.phraseResolutionRefinement, true);
  assert.equal(first.registerHealthRefinement, true);
});

test("non-song generation requests bypass global intent steering", () => {
  const payload = {
    sourceSong: { id: "source" },
    sectionId: "verse-1",
    input: { seed: "section", variation: 0.4 },
  };
  assert.deepEqual(resolveGenerationRequest("sectionVariations", payload), payload);
});
