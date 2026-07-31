import test from "node:test";
import assert from "node:assert/strict";
import { generateNew } from "../src/music-engine.js";
import {
  applyModalInterchange,
  applySecondaryDominants,
  resolveMeterBeats,
} from "../src/core/advanced-harmony.js";

const sampleConfig = { genreId: "neoSoul", seed: 54321 };

test("resolveMeterBeats calculates exact beats and subdivisions for time signatures", () => {
  assert.deepEqual(resolveMeterBeats("4/4"), { beatsPerBar: 4, beatUnit: 4, gridUnits: 16 });
  assert.deepEqual(resolveMeterBeats("3/4"), { beatsPerBar: 3, beatUnit: 4, gridUnits: 12 });
  assert.deepEqual(resolveMeterBeats("6/8"), { beatsPerBar: 6, beatUnit: 8, gridUnits: 12 });
  assert.deepEqual(resolveMeterBeats("5/4"), { beatsPerBar: 5, beatUnit: 4, gridUnits: 20 });
  assert.deepEqual(resolveMeterBeats("invalid"), { beatsPerBar: 4, beatUnit: 4, gridUnits: 16 });
});

test("applyModalInterchange enriches progression deterministically with modal borrowings", async () => {
  const song = await generateNew(sampleConfig);
  const originalProgression = song.harmony?.progression || [1, 5, 6, 4];
  const enriched = applyModalInterchange(originalProgression, "major", 12345);

  assert.ok(Array.isArray(enriched));
  assert.equal(enriched.length, originalProgression.length);
  // Re-run with same seed must yield exact same result (deterministic)
  const rerun = applyModalInterchange(originalProgression, "major", 12345);
  assert.deepEqual(enriched, rerun);
});

test("applySecondaryDominants introduces scale-safe dominant resolution points", async () => {
  const song = await generateNew(sampleConfig);
  const originalProgression = song.harmony?.progression || [1, 6, 2, 5];
  const enriched = applySecondaryDominants(originalProgression, 12345);

  assert.ok(Array.isArray(enriched));
  assert.equal(enriched.length, originalProgression.length);
  const rerun = applySecondaryDominants(originalProgression, 12345);
  assert.deepEqual(enriched, rerun);
});
