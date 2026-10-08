import assert from "node:assert/strict";
import test from "node:test";
import { evaluateProducerIntentContract, generateNew } from "../src/music-engine.js";

test("evaluateProducerIntentContract performance benchmark", () => {
  const seeds = ["bench-1", "bench-2", "bench-3", "bench-4", "bench-5"];
  const testCases = seeds.map((seed) => {
    const song = generateNew({ seed, bars: 32 });
    return {
      tracks: song.tracks,
      structure: song.structure,
      producerIntent: song.producerIntent,
    };
  });

  // Warmup
  for (let i = 0; i < 100; i += 1) {
    for (const tc of testCases) {
      evaluateProducerIntentContract(tc.tracks, tc.structure, tc.producerIntent);
    }
  }

  const iterations = 5000;
  const startTime = performance.now();
  for (let i = 0; i < iterations; i += 1) {
    for (const tc of testCases) {
      evaluateProducerIntentContract(tc.tracks, tc.structure, tc.producerIntent);
    }
  }
  const endTime = performance.now();
  const totalCalls = iterations * testCases.length; // 25,000 calls
  const elapsedMs = endTime - startTime;
  const timePerCallMs = elapsedMs / totalCalls;

  console.log(`[BENCHMARK] Total calls: ${totalCalls}`);
  console.log(`[BENCHMARK] Total time: ${elapsedMs.toFixed(2)} ms`);
  console.log(`[BENCHMARK] Time per call: ${(timePerCallMs * 1000).toFixed(3)} µs`);

  assert.ok(elapsedMs > 0);
});
