import assert from "node:assert/strict";
import test from "node:test";

import { createGenerationFlightRecorder } from "../src/core/generation-flight-recorder.js";

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
