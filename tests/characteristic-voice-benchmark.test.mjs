import { test } from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { generateNew } from "../src/music-engine.js";

test("characteristic voice selection baseline benchmark", () => {
  const song = generateNew({ seed: "benchmark-seed", genre: "pop", bars: 16 });
  assert.ok(song.characteristicVoice);
  assert.ok(song.characteristicVoice.trackId);

  // Measure full generation benchmark over multiple seeds
  const iterations = 5;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    generateNew({ seed: `benchmark-seed-${i}`, genre: "pop", bars: 16 });
  }
  const duration = performance.now() - start;
  console.log(`Generated ${iterations} songs in ${duration.toFixed(2)} ms (${(duration / iterations).toFixed(2)} ms/song)`);
  assert.ok(duration > 0);
});
