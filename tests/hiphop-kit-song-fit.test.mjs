import test from "node:test";
import assert from "node:assert/strict";

import { generateNew } from "../src/music-engine.js";

function generateHipHop(overrides) {
  return generateNew({
    genre: "hipHop",
    bars: 4,
    seed: overrides.seed,
    tempo: overrides.tempo,
    energy: overrides.energy,
    swing: overrides.swing,
    candidateCount: 1,
    adaptiveCandidates: false,
    weaknessAwareSearch: false,
    targetedRepair: false,
  });
}

test("Hip-Hop real drum kits follow the song feel instead of seed-only rotation", () => {
  const tight = generateHipHop({
    seed: "kit-fit-tight",
    tempo: 104,
    energy: 0.95,
    swing: 0.05,
  });
  const laidBack = generateHipHop({
    seed: "kit-fit-laid-back",
    tempo: 82,
    energy: 0.2,
    swing: 0.35,
  });

  assert.equal(tight.oneShotKit.id, "basement-knock");
  assert.equal(laidBack.oneShotKit.id, "dusty-tape");
});
