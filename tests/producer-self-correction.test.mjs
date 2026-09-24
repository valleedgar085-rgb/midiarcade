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
  criticalFloor = floor,
  lowestCriticalDimension = "groove",
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
          balance: { creativeFloor: floor, criticalFloor, lowestCriticalDimension },
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
  assert.equal(variations.reason, "unsupported-kind");
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


test("critical-first diagnosis overrides a lower creative search focus when aggregate score masks phrase weakness", () => {
  const diagnosis = diagnoseGenerationOutcome("new", result("masked-phrase", {
    score: 94,
    floor: 75,
    criticalFloor: 79,
    lowestCriticalDimension: "phraseResolution",
    focusRoute: "groove-first",
    focusDimension: "drumVariety",
    focusGroup: "groove",
  }), ENABLED_CONFIG);

  assert.equal(diagnosis.shouldRetry, true);
  assert.equal(diagnosis.reason, "critical-focus-retry");
  assert.equal(diagnosis.focusSource, "critical");
  assert.equal(diagnosis.criticalPriority, true);
  assert.equal(diagnosis.criticalFloorGap, 15);
  assert.equal(diagnosis.focusRoute, "hook-first");
  assert.equal(diagnosis.focusDimension, "phraseResolution");
  assert.equal(diagnosis.focusGroup, "motif");
  assert.equal(diagnosis.searchFocusRoute, "groove-first");
  assert.equal(diagnosis.searchFocusDimension, "drumVariety");
});

test("critical-first diagnosis leaves the ordinary weakness route alone when the critical gap is not material", () => {
  const diagnosis = diagnoseGenerationOutcome("new", result("balanced-enough", {
    score: 94,
    floor: 75,
    criticalFloor: 86,
    lowestCriticalDimension: "phraseResolution",
    focusRoute: "groove-first",
    focusDimension: "drumVariety",
    focusGroup: "groove",
  }), ENABLED_CONFIG);

  assert.equal(diagnosis.shouldRetry, true);
  assert.equal(diagnosis.reason, "critic-focus-retry");
  assert.equal(diagnosis.focusSource, "search");
  assert.equal(diagnosis.criticalPriority, false);
  assert.equal(diagnosis.focusRoute, "groove-first");
  assert.equal(diagnosis.focusDimension, "drumVariety");
});

test("critical-first diagnosis never invents a composition route for an unsupported critical dimension", () => {
  const diagnosis = diagnoseGenerationOutcome("new", result("stage-interlock", {
    score: 94,
    floor: 75,
    criticalFloor: 78,
    lowestCriticalDimension: "stageInterlock",
    focusRoute: "groove-first",
    focusDimension: "density",
    focusGroup: "groove",
  }), ENABLED_CONFIG);

  assert.equal(diagnosis.focusSource, "search");
  assert.equal(diagnosis.focusRoute, "groove-first");
  assert.equal(diagnosis.focusDimension, "density");
});

test("self-correction comparison accepts a meaningful critical-floor repair even when aggregate and creative-floor scores stay flat", () => {
  const original = result("critical-original", {
    score: 94,
    floor: 75,
    criticalFloor: 79,
    lowestCriticalDimension: "phraseResolution",
  });
  const corrected = result("critical-corrected", {
    score: 94,
    floor: 75,
    criticalFloor: 83,
    lowestCriticalDimension: "phraseResolution",
    targetReached: true,
  });

  const comparison = selectSelfCorrectedResult(original, corrected);
  assert.equal(comparison.result, corrected);
  assert.equal(comparison.selected, "corrected");
  assert.equal(comparison.reason, "critical-floor-improved");
  assert.equal(comparison.scoreDelta, 0);
  assert.equal(comparison.creativeFloorDelta, 0);
  assert.equal(comparison.criticalFloorDelta, 4);
});

test("executor reroutes the second pass from drum variety to critical phrase resolution and records the win", async () => {
  const calls = [];
  const original = result("critical-first-original", {
    score: 94,
    floor: 75,
    criticalFloor: 79,
    lowestCriticalDimension: "phraseResolution",
    targetReached: false,
    focusRoute: "groove-first",
    focusDimension: "drumVariety",
    focusGroup: "groove",
  });
  const corrected = result("critical-first-corrected", {
    score: 94,
    floor: 75,
    criticalFloor: 83,
    lowestCriticalDimension: "phraseResolution",
    targetReached: true,
    focusRoute: "hook-first",
    focusDimension: "phraseResolution",
    focusGroup: "motif",
  });
  const executor = createGenerationExecutor({
    fallback: (_kind, payload) => {
      calls.push(payload);
      return calls.length === 1 ? original : corrected;
    },
  });

  const output = await executor.run("new", {
    config: { seed: "critical-first-pop", genre: "pop", thinkingDepth: "deep" },
  });

  assert.equal(output, corrected);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].config.compositionRoute, "hook-first");
  assert.equal(calls[1].config.producerCorrection.focusDimension, "phraseResolution");
  assert.equal(calls[1].config.producerCorrection.focusGroup, "motif");

  const stages = executor.diagnosticsSnapshot()[0].stages;
  const diagnose = stages.find(({ stage }) => stage === "diagnose").detail;
  const repair = stages.find(({ stage }) => stage === "repair").detail;
  const compare = stages.find(({ stage }) => stage === "compare").detail;
  assert.equal(diagnose.focusSource, "critical");
  assert.equal(diagnose.criticalPriority, true);
  assert.equal(diagnose.criticalFloorGap, 15);
  assert.equal(repair.focusRoute, "hook-first");
  assert.equal(repair.criticalPriority, true);
  assert.equal(compare.selected, "corrected");
  assert.equal(compare.reason, "critical-floor-improved");
  assert.equal(compare.criticalFloorDelta, 4);
});
