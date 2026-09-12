import assert from "node:assert/strict";
import test from "node:test";
import { generateNew } from "../src/music-engine.js";

test("density weakness uses a bass-focused surgical strategy with signed local diagnostics", () => {
  const song = generateNew({
    seed: "surgical-accept-jazz-8-0",
    bars: 8,
    genre: "jazz",
    energy: 0.05,
    complexity: 0.05,
  });
  const repair = song.meta?.scoreDetails?.criticRepair;
  const densityAttempt = repair?.acceptanceHistory?.find((entry) => entry.dimension === "density");

  assert.ok(densityAttempt, "expected the verified seed to expose a density repair attempt");
  assert.match(densityAttempt.repairStrategyId ?? "", /^density-(build|thin)$/);
  assert.deepEqual(densityAttempt.surgicalTracks, ["bass"]);
  assert.ok(densityAttempt.surgicalWindow?.bars >= 2 && densityAttempt.surgicalWindow?.bars <= 8);
  assert.ok(Number.isFinite(densityAttempt.surgicalWindow?.diagnostics?.density));
  assert.ok(Number.isFinite(densityAttempt.surgicalWindow?.diagnostics?.densityTarget));
  assert.ok(Number.isFinite(densityAttempt.surgicalWindow?.diagnostics?.densityDelta));
});

test("specialized repair metadata is deterministic and remains bounded by the existing repair budget", () => {
  const input = {
    seed: "surgical-accept-jazz-8-0",
    bars: 8,
    genre: "jazz",
    energy: 0.05,
    complexity: 0.05,
  };
  const first = generateNew(input);
  const second = generateNew(input);
  const firstRepair = first.meta?.scoreDetails?.criticRepair;
  const secondRepair = second.meta?.scoreDetails?.criticRepair;

  assert.deepEqual(firstRepair, secondRepair);
  assert.ok(firstRepair.attempts <= 2, `repair attempts exceeded policy: ${firstRepair.attempts}`);
  assert.ok(first.meta.scoreDetails.candidatesEvaluated <= 12);
  assert.ok(firstRepair.acceptanceHistory.every((entry) => (
    !entry.repairStrategyId || typeof entry.repairStrategyId === "string"
  )));
});
