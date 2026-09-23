import assert from "node:assert/strict";
import test from "node:test";

import {
  applyHumanGrooveAnchorPrior,
  humanGrooveInfluence,
  humanGroovePriorForGenre,
} from "../src/core/human-groove-priors.js";
import { generateNew } from "../src/music-engine.js";

const alwaysAdjustRng = Object.freeze({
  bool: () => true,
  pick: (values) => values[0],
});

test("human groove priors map only supported evidence-backed genres", () => {
  const hipHop = humanGroovePriorForGenre("hipHop");
  assert.deepEqual(hipHop.sourceStyles, ["hiphop"]);
  assert.ok(hipHop.sampleBars > 800);
  assert.ok(hipHop.confidence > 0.9);
  assert.equal(humanGroovePriorForGenre("ambient"), null);
});

test("human groove influence stays bounded by evidence policy", () => {
  const hipHop = humanGroovePriorForGenre("hipHop");
  const jazz = humanGroovePriorForGenre("jazz");
  assert.ok(humanGrooveInfluence({ genre: "hipHop", variation: 1, evolution: 1 }, hipHop) <= 0.18);
  assert.ok(humanGrooveInfluence({ genre: "jazz", variation: 1, evolution: 1 }, jazz) <= 0.025);
});

test("human groove prior changes at most one secondary anchor", () => {
  const result = applyHumanGrooveAnchorPrior([0, 2], {
    config: { genre: "hipHop", variation: 1, evolution: 1, syncopation: 0.7 },
    barBeats: 4,
    role: "development",
    snareOffsets: [1, 3],
    rng: alwaysAdjustRng,
  });
  assert.equal(result.changed, true);
  assert.equal(result.adjustment, "add-secondary-anchor");
  assert.equal(result.anchors[0], 0);
  assert.equal(result.anchors.length, 3);
});

test("four-floor and Jazz grammar protections cannot be overwritten by research priors", () => {
  const house = applyHumanGrooveAnchorPrior([0, 1, 2, 3, 3.5], {
    config: { genre: "house", variation: 1, evolution: 1, syncopation: 0.8 },
    barBeats: 4,
    role: "development",
    snareOffsets: [1, 3],
    rng: alwaysAdjustRng,
    fourFloor: true,
  });
  for (const beat of [0, 1, 2, 3]) assert.ok(house.anchors.includes(beat));

  const jazzOriginal = [0, 1.5, 2.75];
  const jazz = applyHumanGrooveAnchorPrior(jazzOriginal, {
    config: { genre: "jazz", variation: 1, evolution: 1, syncopation: 0.8 },
    barBeats: 4,
    role: "development",
    snareOffsets: [1, 3],
    rng: alwaysAdjustRng,
  });
  assert.deepEqual(jazz.anchors, jazzOriginal);
  assert.equal(jazz.changed, false);
});

test("generated songs expose deterministic ensemble-level human groove diagnostics", () => {
  const options = {
    genre: "hipHop",
    seed: "human-groove-conductor-integration",
    bars: 16,
    candidateCount: 1,
    professionalUpgrade: true,
    variation: 0.82,
    evolution: 0.72,
  };
  const first = generateNew(options);
  const second = generateNew(options);
  assert.deepEqual(first, second);
  assert.equal(first.grooveConductor.version, 4);
  assert.deepEqual(first.grooveConductor.humanGroovePrior.sourceStyles, ["hiphop"]);
  assert.ok(first.grooveConductor.humanGroovePrior.influence > 0);
  assert.ok(first.grooveConductor.humanGroovePrior.influence <= 0.18);
  for (const bar of first.grooveConductor.bars) {
    assert.ok(["none", "add-secondary-anchor", "remove-secondary-anchor"].includes(bar.humanGrooveAdjustment));
  }
});
