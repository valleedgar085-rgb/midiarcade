import assert from "node:assert/strict";
import test from "node:test";
import { captureManualGenerationControls } from "../src/core/manual-generation-controls.js";
import { resolveGenerationConfig } from "../src/core/resolved-generation-intent.js";
import { normalizeConfig } from "../src/music-engine.js";

test("manual and Auto direction controls resolve independently across seeds, genres, and request kinds", () => {
  for (const genre of ["pop", "techno", "hipHop"]) {
    for (const kind of ["new", "similar", "songVariations"]) {
      for (const seed of ["manual-first", "manual-next"]) {
        const input = {
          genre, seed, secondaryGenre: genre === "pop" ? "techno" : null,
          variation: 0, evolution: 1, surprise: 0.4,
          manualGenerationControls: { variation: 0, evolution: 1 },
          creativeRange: "wild",
          tasteProfile: { ratings: 4, likes: 4, variationTotal: 360 },
        };
        const before = structuredClone(input);
        const resolved = resolveGenerationConfig(input, { kind });
        assert.deepEqual(input, before);
        assert.equal(resolved.variation, 0);
        assert.equal(resolved.evolution, 1);
        assert.notEqual(resolved.surprise, input.surprise, "Auto surprise must still adapt");
        for (const key of ["variation", "evolution"]) {
          const trace = resolved.resolvedGenerationIntent.controls[key];
          assert.equal(trace.final, input[key]);
          assert.equal(trace.genreAdjustment, 0);
          assert.equal(trace.tasteAdjustment, 0);
          assert.equal(trace.qualityAdjustment, 0);
        }
        const candidate = normalizeConfig({ ...resolved, variation: 0.8, evolution: 0.2 });
        assert.equal(candidate.variation, 0, "candidate repairs cannot override manual variation");
        assert.equal(candidate.evolution, 1, "candidate repairs cannot override manual evolution");
      }
    }
  }
});

test("only controls with Auto off are captured as manual values", () => {
  assert.deepEqual(captureManualGenerationControls(new Set(["evolutionControl"]), {
    variation: 0.4, evolution: 0.6, surprise: 0.2,
  }), { variation: 0.4, surprise: 0.2 });
});

test("all three manual directions survive producer and quality steering", () => {
  const values = { variation: 0.4, evolution: 0.58, surprise: 0.28 };
  const resolved = resolveGenerationConfig({ genre: "pop", seed: "all-manual", ...values, manualGenerationControls: values });
  for (const key of Object.keys(values)) assert.equal(resolved[key], values[key]);
});
