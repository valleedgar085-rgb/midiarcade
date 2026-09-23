import assert from "node:assert/strict";
import test from "node:test";
import {
  evaluateProfessionalQualityGate,
  generateNew,
} from "../src/music-engine.js";
import { createGenerationFlightRecorder } from "../src/core/generation-flight-recorder.js";

function strongEvaluation(overrides = {}) {
  const subscores = {
    harmonic: 95,
    groove: 95,
    density: 95,
    registerHealth: 95,
    separation: 95,
    phraseResolution: 95,
    storyArc: 95,
    transitions: 95,
    orchestration: 95,
    stageInterlock: 95,
    genreAuthenticity: 95,
    ...(overrides.subscores ?? {}),
  };
  return {
    score: overrides.score ?? 95,
    subscores,
    diagnostics: {
      densityTarget: 21,
      densityObserved: 20,
      scaleFit: 1,
      ...(overrides.diagnostics ?? {}),
    },
  };
}

test("professional gate rejects high averages with critical register and density failures", () => {
  const evaluation = strongEvaluation({
    score: 93,
    subscores: {
      registerHealth: 64,
      density: 80,
    },
    diagnostics: {
      densityTarget: 21,
      densityObserved: 11.1,
    },
  });

  const gate = evaluateProfessionalQualityGate(evaluation);
  assert.equal(gate.passed, false);
  assert.ok(gate.failures.some((failure) => failure.startsWith("registerHealth:")));
  assert.ok(gate.failures.some((failure) => failure.startsWith("density:")));
  assert.ok(gate.failures.some((failure) => failure.startsWith("densityCoverage:")));
});

test("professional gate passes a balanced candidate inside the density envelope", () => {
  const gate = evaluateProfessionalQualityGate(strongEvaluation());
  assert.equal(gate.passed, true);
  assert.equal(gate.failures.length, 0);
  assert.ok(gate.densityCoverage >= gate.densityCoverageMinimum);
});

test("generation recorder preserves primitive provenance and reports the critic score", () => {
  let now = 0;
  const recorder = createGenerationFlightRecorder({ clock: () => ++now });
  const id = recorder.begin("new", { config: { seed: "telemetry-regression", genre: "hipHop" } });
  recorder.mark(id, "finalize", {
    candidateIds: ["light-support", "balanced-support", "full-support"],
    targetDimensions: ["density"],
    zero: 0,
  });
  recorder.complete(id, {
    id: "song",
    meta: {
      score: 0,
      scoreDetails: {
        totalScore: 93,
        selectedCandidate: 2,
        professionalGate: { passed: false, failures: ["density:80<88"] },
        candidateSearch: {
          targetReached: false,
          candidatesEvaluated: 6,
          focusDimension: "density",
        },
      },
    },
  });

  const [entry] = recorder.snapshot();
  assert.deepEqual(entry.stages[0].detail.candidateIds, ["light-support", "balanced-support", "full-support"]);
  assert.deepEqual(entry.stages[0].detail.targetDimensions, ["density"]);
  assert.equal(entry.stages[0].detail.zero, 0);
  assert.equal(entry.song.score, 93);
  assert.equal(entry.song.selectedCandidate, 2);
  assert.equal(entry.song.candidateSearch.focusDimension, "density");
});

test("Hip-Hop regression seeds only declare target reached when the selected candidate reached it", () => {
  const seeds = [
    "arcade-mudy55wf-1-uv4u9o",
    "arcade-mudyjt2n-2-1tobzwo",
  ];

  for (const seed of seeds) {
    const song = generateNew({
      seed,
      genre: "hipHop",
      bars: 32,
      thinkingDepth: "deep",
      adaptiveCandidates: true,
      weaknessAwareSearch: true,
      targetedRepair: true,
    });
    const details = song.meta?.scoreDetails;
    const selected = details?.candidateScores?.find((candidate) => candidate.index === details.selectedCandidate);
    assert.ok(selected, `${seed}: selected candidate must have provenance`);
    assert.equal(
      details.candidateSearch.targetReached,
      selected.adaptiveTarget,
      `${seed}: search target must describe the committed candidate, not another audition`,
    );
    if (details.candidateSearch.targetReached) {
      assert.equal(selected.professionalPassed, true, `${seed}: professional floor must be part of target authority`);
    }
  }
});
