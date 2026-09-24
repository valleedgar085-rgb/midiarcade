import assert from "node:assert/strict";
import test from "node:test";

import { evaluateCandidateBalance } from "../src/music-engine.js";

function evaluation(overrides = {}) {
  const subscores = {
    harmonic: 92,
    groove: 90,
    motif: 88,
    storyArc: 90,
    density: 84,
    voiceLeading: 91,
    separation: 93,
    cadence: 88,
    repetition: 89,
    transitions: 90,
    harmonicJourney: 91,
    performance: 89,
    orchestration: 90,
    memory: 88,
    production: 92,
    phraseResolution: 86,
    tensionFollow: 89,
    drumVariety: 88,
    registerHealth: 92,
    stageInterlock: 90,
    genreAuthenticity: 91,
    ...overrides,
  };
  return { score: 95, diagnostics: { scaleFit: 1 }, subscores };
}

test("adaptive target cannot hide a severe critical register weakness behind a high aggregate score", () => {
  const balance = evaluateCandidateBalance(evaluation({ registerHealth: 64 }));
  assert.equal(balance.criticalFloor, 64);
  assert.equal(balance.lowestCriticalDimension, "registerHealth");
  assert.equal(balance.truthFloor, 64);
  assert.equal(balance.lowestTruthDimension, "registerHealth");
  assert.equal(balance.minimumTruthFloor, 65);
  assert.equal(balance.aspirationalCriticalFloor, 68);
  assert.equal(balance.passed, false);
  assert.equal(balance.aspirational, false);
});

test("balanced high-quality candidates still qualify for the aspirational target", () => {
  const balance = evaluateCandidateBalance(evaluation());
  assert.ok(balance.criticalFloor >= balance.aspirationalCriticalFloor);
  assert.ok(balance.truthFloor >= balance.aspirationalCriticalFloor);
  assert.equal(balance.passed, true);
  assert.equal(balance.aspirational, true);
});

test("density participates in the truth floor even though it is excluded from the creative floor", () => {
  const balance = evaluateCandidateBalance(evaluation({ density: 52 }));
  assert.equal(balance.truthFloor, 52);
  assert.equal(balance.lowestTruthDimension, "density");
  assert.equal(balance.passed, false);
  assert.equal(balance.aspirational, false);
});
