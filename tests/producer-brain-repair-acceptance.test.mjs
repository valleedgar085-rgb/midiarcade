import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateRepairAcceptance,
  generateNew,
  selectPreferredRepairAssessment,
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

function dialogueSong(counterpointStart) {
  return {
    tracks: [
      {
        id: "melody",
        notes: [
          { start: 0, duration: 1, pitch: 72 },
          { start: 2, duration: 0.75, pitch: 74 },
        ],
      },
      {
        id: "counterpoint",
        notes: [{ start: counterpointStart, duration: 0.4, pitch: 67 }],
      },
    ],
  };
}

function repairAssessment(overrides = {}, mode = "whole-candidate") {
  return {
    acceptance: {
      accepted: true,
      outcome: "improved-target",
      weaknessGain: 4,
      totalDelta: 0,
      balanceDelta: 0,
      creativeFloorDelta: 0,
      maxCriticalRegression: 0,
      ...overrides,
    },
    repairedReleaseGate: { passed: true },
    song: { criticRepair: { mode } },
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
  assert.equal(result.melodicDialoguePreserved, true);
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

test("register-health repair preserves clean melodic dialogue without blocking cadence repair", () => {
  const sourceEvaluation = evaluation(88, { registerHealth: 52, phraseResolution: 52 });
  const registerRepairEvaluation = evaluation(88.5, { registerHealth: 58, phraseResolution: 52 });
  const cleanSourceSong = dialogueSong(1.4);
  const crowdedRepairSong = dialogueSong(0.45);
  const protectedResult = evaluateRepairAcceptance(
    sourceEvaluation,
    registerRepairEvaluation,
    { weakestDimension: "registerHealth", weakestScore: 52 },
    {
      sourceReleasePassed: true,
      repairedReleasePassed: true,
      sourceSong: cleanSourceSong,
      repairedSong: crowdedRepairSong,
    },
  );

  assert.equal(protectedResult.melodicDialogue.applies, true);
  assert.equal(protectedResult.melodicDialogue.sourceHealthy, true);
  assert.equal(protectedResult.melodicDialogue.repairedHealthy, false);
  assert.equal(protectedResult.melodicDialoguePreserved, false);
  assert.equal(protectedResult.accepted, false);
  assert.ok(protectedResult.reasons.includes("melodic-dialogue-regression"));

  const rebuildResult = evaluateRepairAcceptance(
    sourceEvaluation,
    registerRepairEvaluation,
    { weakestDimension: "registerHealth", weakestScore: 52 },
    {
      sourceReleasePassed: true,
      repairedReleasePassed: true,
      sourceSong: dialogueSong(0.45),
      repairedSong: dialogueSong(0.5),
    },
  );
  assert.equal(rebuildResult.melodicDialogue.sourceHealthy, false);
  assert.equal(rebuildResult.melodicDialoguePreserved, true);
  assert.equal(rebuildResult.accepted, true);

  const cadenceResult = evaluateRepairAcceptance(
    sourceEvaluation,
    evaluation(88.5, { registerHealth: 52, phraseResolution: 59 }),
    { weakestDimension: "phraseResolution", weakestScore: 52 },
    {
      sourceReleasePassed: true,
      repairedReleasePassed: true,
      sourceSong: cleanSourceSong,
      repairedSong: crowdedRepairSong,
    },
  );
  assert.equal(cadenceResult.melodicDialogue.applies, false);
  assert.equal(cadenceResult.melodicDialoguePreserved, true);
  assert.ok(!cadenceResult.reasons.includes("melodic-dialogue-regression"));
  assert.equal(cadenceResult.accepted, true);
});

test("repair acceptance publishes stable producer-facing outcomes", () => {
  const source = evaluation(88, { motif: 52 });
  const targetOnly = evaluateRepairAcceptance(
    source,
    evaluation(88, { motif: 57 }),
    { weakestDimension: "motif", weakestScore: 52 },
  );
  assert.equal(targetOnly.outcome, "improved-target");
  assert.equal(targetOnly.bestSupportingGain, 0);

  const balanced = evaluateRepairAcceptance(
    source,
    evaluation(88.5, { motif: 57, performance: 86 }),
    { weakestDimension: "motif", weakestScore: 52 },
  );
  assert.equal(balanced.outcome, "improved-balance");
  assert.equal(balanced.bestSupportingGain, 2);

  const noGain = evaluateRepairAcceptance(
    source,
    evaluation(88, { motif: 52.1 }),
    { weakestDimension: "motif", weakestScore: 52 },
  );
  assert.equal(noGain.outcome, "rejected-no-gain");

  const regression = evaluateRepairAcceptance(
    source,
    evaluation(88, { motif: 58, groove: 79 }),
    { weakestDimension: "motif", weakestScore: 52 },
  );
  assert.equal(regression.outcome, "rejected-regression");
});

test("repair selection keeps locality unless a whole repair is materially better", () => {
  const surgical = repairAssessment({ weaknessGain: 4 }, "surgical-window");
  const nearWhole = repairAssessment({ weaknessGain: 4.2, totalDelta: 0.2 });
  const close = selectPreferredRepairAssessment(surgical, nearWhole);
  assert.equal(close.mode, "surgical-window");
  assert.equal(close.reason, "surgical-locality-tiebreak");

  const strongerWhole = repairAssessment({ weaknessGain: 6, totalDelta: 1, balanceDelta: 1 });
  const stronger = selectPreferredRepairAssessment(surgical, strongerWhole);
  assert.equal(stronger.mode, "whole-candidate");
  assert.equal(stronger.reason, "whole-materially-better");

  const rejectedSurgical = repairAssessment({
    accepted: false,
    outcome: "rejected-regression",
    weaknessGain: 5,
    maxCriticalRegression: 5,
  }, "surgical-window");
  const acceptedWhole = repairAssessment({ weaknessGain: 2.5 });
  const fallback = selectPreferredRepairAssessment(rejectedSurgical, acceptedWhole);
  assert.equal(fallback.mode, "whole-candidate");
  assert.equal(fallback.reason, "accepted-over-rejected");
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
  assert.ok(repair.acceptanceHistory.every((entry) => [
    "improved-target",
    "improved-balance",
    "rejected-regression",
    "rejected-no-gain",
  ].includes(entry.outcome)));
  assert.ok(repair.acceptanceHistory.every((entry) => typeof entry.selectionReason === "string"));

  const repairCandidates = details.candidateScores.filter((candidate) => candidate.repairGroup);
  assert.equal(repairCandidates.length, repair.attempts);
  assert.ok(repairCandidates.every((candidate) => typeof candidate.repairAccepted === "boolean"));

  const selected = details.candidateScores.find((candidate) => candidate.index === details.selectedCandidate);
  assert.ok(selected);
  assert.notEqual(selected.repairAccepted, false, "a rejected repair must never win candidate ranking");
});
