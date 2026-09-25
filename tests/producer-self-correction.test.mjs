import assert from "node:assert/strict";
import test from "node:test";
import { createGenerationExecutor } from "../src/core/generation-executor.js";
import {
  createSelfCorrectionPayload,
  diagnoseGenerationOutcome,
  selectSelfCorrectedResult,
} from "../src/core/generation-self-correction.js";

function result(id, {
  score = 88,
  floor = 72,
  targetReached = false,
  focusRoute = "groove-first",
  focusDimension = "density",
  focusGroup = "groove",
  releasePassed = true,
} = {}) {
  return {
    status: "committed",
    song: {
      id,
      tracks: [],
      meta: {
        scoreDetails: {
          totalScore: score,
          balance: { creativeFloor: floor },
          releaseGate: { passed: releasePassed },
          candidateSearch: {
            targetReached,
            focusRoute,
            focusDimension,
            focusGroup,
            focusScore: floor,
          },
        },
      },
    },
  };
}

const ENABLED_CONFIG = Object.freeze({
  producerBrain: Object.freeze({
    adaptiveLoop: Object.freeze({ enabled: true }),
  }),
});

test("self-correction diagnosis retries only an unresolved critic focus and preserves explicit routes", () => {
  const missed = diagnoseGenerationOutcome("new", result("missed"), ENABLED_CONFIG);
  assert.equal(missed.shouldRetry, true);
  assert.equal(missed.focusRoute, "groove-first");
  assert.equal(missed.focusDimension, "density");

  const explicit = diagnoseGenerationOutcome("new", result("explicit"), {
    ...ENABLED_CONFIG,
    compositionRoute: "harmony-first",
  });
  assert.equal(explicit.shouldRetry, false);
  assert.equal(explicit.reason, "explicit-route-preserved");

  const passed = diagnoseGenerationOutcome("new", result("passed", { targetReached: true }), ENABLED_CONFIG);
  assert.equal(passed.shouldRetry, false);
  assert.equal(passed.reason, "target-already-reached");

  const variations = diagnoseGenerationOutcome("songVariations", result("variations"), ENABLED_CONFIG);
  assert.equal(variations.shouldRetry, false);
  assert.equal(variations.reason, "variation-set-atomic");
});

test("correction payload focuses one route without mutating the original request", () => {
  const payload = {
    sourceSong: { id: "source" },
    config: { seed: "focus-me", weaknessAwareSearch: true, targetedRepair: true },
  };
  const before = structuredClone(payload);
  const corrected = createSelfCorrectionPayload(payload, {
    focusRoute: "hook-first",
    focusDimension: "motif",
    focusGroup: "phrasing",
  });

  assert.deepEqual(payload, before);
  assert.equal(corrected.config.compositionRoute, "hook-first");
  assert.equal(corrected.config.weaknessAwareSearch, false);
  assert.equal(corrected.config.targetedRepair, true);
  assert.deepEqual(corrected.config.producerCorrection, {
    version: 1,
    pass: 1,
    reason: "critic-focus",
    focusRoute: "hook-first",
    focusDimension: "motif",
    focusGroup: "phrasing",
  });
});

test("self-correction comparison accepts measurable improvement and rejects regressions", () => {
  const original = result("original", { score: 88, floor: 70, releasePassed: true });
  const stronger = result("stronger", { score: 89, floor: 74, releasePassed: true });
  const accepted = selectSelfCorrectedResult(original, stronger);
  assert.equal(accepted.result, stronger);
  assert.equal(accepted.selected, "corrected");
  assert.equal(accepted.reason, "score-improved");
  assert.equal(accepted.scoreDelta, 1);

  const weaker = result("weaker", { score: 87.8, floor: 71, releasePassed: true });
  const retained = selectSelfCorrectedResult(original, weaker);
  assert.equal(retained.result, original);
  assert.equal(retained.selected, "original");

  const releaseRegression = result("regression", { score: 92, floor: 80, releasePassed: false });
  const protectedResult = selectSelfCorrectedResult(original, releaseRegression);
  assert.equal(protectedResult.result, original);
  assert.equal(protectedResult.reason, "release-regression-rejected");
});

test("executor performs exactly one focused correction and records the full adaptive loop", async () => {
  const calls = [];
  const original = result("first", { score: 88, floor: 70, targetReached: false });
  const corrected = result("second", { score: 89.2, floor: 74, targetReached: true });
  const executor = createGenerationExecutor({
    fallback: (_kind, payload) => {
      calls.push(payload);
      return calls.length === 1 ? original : corrected;
    },
  });

  const output = await executor.run("new", {
    config: { seed: "phase3-self-correct", genre: "techno", thinkingDepth: "deep" },
  });

  assert.equal(output, corrected, "the improved second pass must preserve the exact result object");
  assert.equal(calls.length, 2, "self-correction must be bounded to one retry");
  assert.equal(calls[1].config.compositionRoute, "groove-first");
  assert.equal(calls[1].config.weaknessAwareSearch, false);
  assert.equal(calls[1].config.producerCorrection.pass, 1);

  const diagnostics = executor.diagnosticsSnapshot();
  assert.equal(diagnostics.length, 1);
  assert.equal(diagnostics[0].status, "committed");
  assert.deepEqual(
    diagnostics[0].stages.map(({ stage }) => stage),
    ["plan", "compose", "diagnose", "repair", "compare", "finalize"],
  );
  assert.equal(diagnostics[0].stages.find(({ stage }) => stage === "compare").detail.selected, "corrected");
});

test("executor skips correction after the target is reached and keeps its stable result contract", async () => {
  let calls = 0;
  const expected = result("already-good", { score: 92, floor: 80, targetReached: true });
  const executor = createGenerationExecutor({
    fallback: () => {
      calls += 1;
      return expected;
    },
  });

  const output = await executor.run("new", {
    config: { seed: "phase3-no-retry", genre: "pop" },
  });
  assert.equal(output, expected);
  assert.equal(calls, 1);
  const stages = executor.diagnosticsSnapshot()[0].stages;
  assert.equal(stages.some(({ stage }) => stage === "repair"), false);
  assert.equal(stages.find(({ stage }) => stage === "compare").detail.skipped, true);
});
