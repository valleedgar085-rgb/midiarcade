import assert from "node:assert/strict";
import test from "node:test";

import {
  humanGrooveInfluence,
  humanGroovePriorForGenre,
} from "../src/core/human-groove-priors.js";
import { generateNew } from "../src/music-engine.js";

test("human groove priors remain evidence metadata, not rhythm authority", () => {
  const hipHop = humanGroovePriorForGenre("hipHop");
  assert.deepEqual(hipHop.sourceStyles, ["hiphop"]);
  assert.ok(hipHop.sampleBars > 800);
  assert.ok(hipHop.confidence > 0.9);
  assert.equal(humanGroovePriorForGenre("ambient"), null);
});

test("human groove influence stays bounded as performance metadata", () => {
  const hipHop = humanGroovePriorForGenre("hipHop");
  const jazz = humanGroovePriorForGenre("jazz");
  assert.ok(humanGrooveInfluence({ genre: "hipHop", variation: 1, evolution: 1 }, hipHop) <= 0.18);
  assert.ok(humanGrooveInfluence({ genre: "jazz", variation: 1, evolution: 1 }, jazz) <= 0.025);
});

test("generated songs expose deterministic human-groove diagnostics without mutating Groove DNA anchors", () => {
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
  assert.equal(first.grooveConductor.version, 5);
  assert.deepEqual(first.grooveConductor.humanGroovePrior.sourceStyles, ["hiphop"]);
  assert.ok(first.grooveConductor.humanGroovePrior.influence > 0);
  assert.ok(first.grooveConductor.humanGroovePrior.influence <= 0.18);
  for (const bar of first.grooveConductor.bars) {
    assert.equal(bar.humanGrooveAdjustment, "groove-dna-authority");
  }
});
