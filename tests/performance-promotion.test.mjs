import assert from "node:assert/strict";
import test from "node:test";

import { createGenerationExecutor } from "../src/core/generation-executor.js";
import {
  createPerformancePromotion,
  rejectPerformancePromotion,
} from "../src/core/performance-promotion.js";
import { generateNew } from "../src/music-engine.js";

function generatedSong() {
  return generateNew({
    genre: "neoSoul",
    seed: "performance-promotion-contract",
    bars: 8,
    candidateCount: 1,
    adaptiveCandidates: false,
    weaknessAwareSearch: false,
    targetedRepair: false,
  });
}

test("validated performance promotion is deterministic and never mutates the accepted source", { timeout: 120_000 }, () => {
  const song = generatedSong();
  const source = structuredClone(song);
  const first = createPerformancePromotion(song, {
    humanize: 0.65,
    seed: "performance-promotion-fixed",
  });
  const second = createPerformancePromotion(song, {
    humanize: 0.65,
    seed: "performance-promotion-fixed",
  });

  assert.deepEqual(song, source);
  assert.equal(first.status, "promoted", JSON.stringify(first.validation));
  assert.equal(first.validation.valid, true);
  assert.deepEqual(first.after, second.after);
  assert.equal(first.after.performancePromotion.id, "validated-performance-promotion-v1");
  assert.equal(first.after.performancePromotion.mode, "explicit-opt-in");
  assert.equal(first.after.performancePromotion.promotionCandidate, true);
  assert.equal(first.after.performancePromotion.gauntletPassed, true);
  assert.equal(first.after.performancePromotion.ensemblePassed, true);
  assert.equal(first.after.performanceCandidate.accepted, true);
});

test("promotion rejection restores an isolated copy of the pre-performance song", { timeout: 120_000 }, () => {
  const song = generatedSong();
  const transaction = createPerformancePromotion(song, {
    humanize: 0.65,
    seed: "performance-promotion-reject",
  });
  const restored = rejectPerformancePromotion(transaction);

  assert.deepEqual(restored, song);
  assert.notEqual(restored, song);
  assert.notEqual(restored.tracks, song.tracks);
});

test("promotion fails closed for an invalid source instead of inventing a result", () => {
  const transaction = createPerformancePromotion({ id: "invalid" });
  assert.equal(transaction.status, "rejected");
  assert.equal(transaction.after, null);
  assert.equal(transaction.validation.valid, false);
  assert.ok(transaction.validation.issues.includes("performance-promotion:invalid-song"));
});

test("generation executor leaves the legacy path unchanged unless performance promotion is explicitly enabled", async () => {
  const expected = { status: "committed", song: { id: "stable-result" } };
  const executor = createGenerationExecutor({
    fallback: () => structuredClone(expected),
  });

  const result = await executor.run("new", { config: { seed: "default-off" } });
  assert.deepEqual(result, expected);
  assert.equal(result.performancePromotion, undefined);
});

test("generation executor fails closed when an explicitly requested performance candidate cannot be promoted", async () => {
  const executor = createGenerationExecutor({
    fallback: () => ({
      status: "committed",
      song: { id: "no-events", tracks: [] },
    }),
  });

  const result = await executor.run("new", {
    config: {
      seed: "promotion-fail-closed",
      performancePromotion: {
        enabled: true,
        humanize: 0.65,
      },
    },
  });

  assert.equal(result.song.id, "no-events");
  assert.equal(result.song.performancePromotion, undefined);
  assert.equal(result.performancePromotion.requested, true);
  assert.equal(result.performancePromotion.accepted, false);
  assert.equal(result.performancePromotion.status, "candidate-rejected");
});
