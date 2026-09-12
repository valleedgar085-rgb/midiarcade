import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateRepairAcceptance,
  generateNew,
} from "../src/music-engine.js";

const BASE_SUBSCORES = Object.freeze({
  harmonic: 86,
  groove: 84,
  motif: 82,
  storyArc: 84,
  density: 82,
  voiceLeading: 86,
  separation: 84,
  cadence: 84,
  repetition: 82,
  transitions: 84,
  harmonicJourney: 85,
  performance: 84,
  orchestration: 84,
  memory: 82,
  production: 84,
  phraseResolution: 82,
  tensionFollow: 84,
  drumVariety: 82,
  registerHealth: 84,
  stageInterlock: 86,
  genreAuthenticity: 84,
});

function evaluation(score = 88, overrides = {}) {
  return {
    score,
    subscores: { ...BASE_SUBSCORES, ...overrides },
    diagnostics: { scaleFit: 1 },
  };
}

test("repair acceptance keeps a measurable weakness improvement with stable critical quality", () => {
  const source = evaluation(88, { motif: 52 });
  const repaired = evaluation(88.5, { motif: 57 });
  const result = evaluateRepairAcceptance(
    source,
    repaired,
    { weakestDimension: "motif", weakestScore: 52 },
    { sourceReleasePassed: true, repairedReleasePassed: true },
  );

  assert.equal(result.accepted, true);
  assert.equal(result.dimension, "motif");
  assert.equal(result.weaknessGain, 5);
  assert.equal(result.releasePreserved, true);
  assert.deepEqual(result.reasons, []);
});

test("repair acceptance rejects cosmetic rewrites and collateral critical regressions", () => {
  const source = evaluation(88, { motif: 52 });
  const cosmetic = evaluateRepairAcceptance(
    source,
    evaluation(88.2, { motif: 52.2 }),
    { weakestDimension: "motif", weakestScore: 52 },
  );
  assert.equal(cosmetic.accepted, false);
  assert.ok(cosmetic.reasons.includes("weakness-not-improved"));

  const collateral = evaluateRepairAcceptance(
    source,
    evaluation(88.1, { motif: 58, groove: 79 }),
    { weakestDimension: "motif", weakestScore: 52 },
  );
  assert.equal(collateral.accepted, false);
  assert.equal(collateral.maxCriticalRegression, 5);
  assert.ok(collateral.reasons.includes("critical-dimension-regression"));
});

test("repair acceptance preserves an already-passing release contract", () => {
  const source = evaluation(88, { motif: 52 });
  const repaired = evaluation(89, { motif: 60 });
  const result = evaluateRepairAcceptance(
    source,
    repaired,
    { weakestDimension: "motif", weakestScore: 52 },
    { sourceReleasePassed: true, repairedReleasePassed: false },
  );

  assert.equal(result.accepted, false);
  assert.equal(result.releasePreserved, false);
  assert.ok(result.reasons.includes("release-gate-regression"));
});

test("live Producer Brain repair auditing never commits a rejected targeted repair", () => {
  const input = {
    seed: "weak-c",
    bars: 12,
    genre: "jazz",
    energy: 0.1,
    complexity: 0.1,
  };
  const first = generateNew(input);
  const second = generateNew(input);
  const details = first.meta.scoreDetails;
  const repair = details.criticRepair;

  assert.deepEqual(first, second, "repair acceptance must remain deterministic");
  assert.ok(repair.attempts >= 1 && repair.attempts <= 2);
  assert.equal(repair.accepted + repair.rejected, repair.attempts);
  assert.equal(repair.acceptanceHistory.length, repair.attempts);
  assert.ok(repair.acceptanceHistory.every((entry) => typeof entry.accepted === "boolean"));

  const repairCandidates = details.candidateScores.filter((candidate) => candidate.repairGroup);
  assert.equal(repairCandidates.length, repair.attempts);
  assert.ok(repairCandidates.every((candidate) => typeof candidate.repairAccepted === "boolean"));

  const selected = details.candidateScores.find((candidate) => candidate.index === details.selectedCandidate);
  assert.ok(selected);
  assert.notEqual(selected.repairAccepted, false, "a rejected repair must never win candidate ranking");
});
