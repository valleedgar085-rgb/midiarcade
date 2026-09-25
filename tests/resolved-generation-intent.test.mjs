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
  assert.equal(first.resolvedGenerationIntent.controls.variation.requested, 0.44);
  assert.equal(first.resolvedGenerationIntent.controls.variation.final, first.variation);
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
