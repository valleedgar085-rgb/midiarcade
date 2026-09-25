import assert from "node:assert/strict";
import test from "node:test";

import { createGenerationFlightRecorder } from "../src/core/generation-flight-recorder.js";
import { createGenerationExecutor } from "../src/core/generation-executor.js";

test("flight recorder preserves primitive arrays and authoritative final score", () => {
  let now = 10;
  const recorder = createGenerationFlightRecorder({ clock: () => now++ });
  const id = recorder.begin("new", { config: { genre: "hipHop", bars: 32 } });
  recorder.mark(id, "finalize", {
    candidateIds: ["cadence-payoff", "full-support", "held-cadence"],
    targetDimensions: ["density", "phraseResolution"],
  });
  recorder.complete(id, {
    id: "debug-proof",
    title: "Debug Proof",
    seed: "debug-proof-seed",
    meta: {
      score: 0,
      qualityScore: 0,
      scoreDetails: { totalScore: 95 },
    },
  });

  const run = recorder.snapshot()[0];
  assert.deepEqual(run.stages[0].detail.candidateIds, [
    "cadence-payoff",
    "full-support",
    "held-cadence",
  ]);
  assert.deepEqual(run.stages[0].detail.targetDimensions, ["density", "phraseResolution"]);
  assert.equal(run.song.score, 95);
});


test("flight recorder counts variation results instead of reporting an empty song", () => {
  const recorder = createGenerationFlightRecorder({ clock: () => 10 });
  const id = recorder.begin("songVariations", { config: { seed: "variation-seed" } });
  recorder.complete(id, {
    status: "committed",
    variations: [
      { id: "variation-a", title: "A", seed: "a", meta: { scoreDetails: { totalScore: 91 } } },
      { id: "variation-b", title: "B", seed: "b", meta: { scoreDetails: { totalScore: 93 } } },
    ],
  });

  const run = recorder.snapshot()[0];
  assert.equal(run.status, "committed");
  assert.equal(run.song, null);
  assert.equal(run.variationCount, 2);
});

test("flight recorder preserves rejection status and reports composition issues", () => {
  const recorder = createGenerationFlightRecorder({ clock: () => 10 });
  const sourceSong = { id: "source", title: "Source" };
  const id = recorder.begin("compositionCandidate", {
    sourceSong,
    config: { seed: "candidate-seed", genre: "pop", bars: 8 },
  });
  recorder.complete(id, {
    status: "rejected",
    transaction: { validation: { valid: false, issues: ["out-of-scale:melody:61"] } },
  });

  const run = recorder.snapshot()[0];
  assert.equal(run.status, "rejected");
  assert.equal(run.sourceSongId, "source");
});

test("executor records atomic variation sets without diagnosing them as unsupported", async () => {
  const executor = createGenerationExecutor({
    fallback: () => ({ status: "committed", variations: [{ id: "variation-one" }] }),
  });
  await executor.run("songVariations", {
    sourceSong: { id: "variation-source" },
    config: { seed: "variation-seed", genre: "hipHop", bars: 16 },
  });

  const run = executor.diagnosticsSnapshot()[0];
  assert.equal(run.variationCount, 1);
  assert.equal(run.config.seed, "variation-seed");
  assert.equal(run.config.genre, "hipHop");
  assert.equal(run.stages.find((stage) => stage.stage === "diagnose").detail.reason, "variation-set-atomic");
});

test("executor marks rejected composition candidates as rejected, with their input config", async () => {
  const executor = createGenerationExecutor({
    fallback: () => ({
      status: "rejected",
      transaction: { validation: { valid: false, issues: ["out-of-scale:melody:61"] } },
    }),
  });
  await executor.run("compositionCandidate", {
    sourceSong: { id: "candidate-source" },
    selection: { target: "track", trackId: "melody" },
    input: { seed: "candidate-seed", genre: "hipHop", bars: 16 },
  });

  const run = executor.diagnosticsSnapshot()[0];
  assert.equal(run.status, "rejected");
  assert.equal(run.config.seed, "candidate-seed");
  assert.equal(run.config.genre, "hipHop");
  assert.equal(run.sourceSongId, "candidate-source");
  assert.deepEqual(run.stages.find((stage) => stage.stage === "diagnose").detail.issues, ["out-of-scale:melody:61"]);
});
