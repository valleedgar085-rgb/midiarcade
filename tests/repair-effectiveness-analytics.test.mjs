import assert from "node:assert/strict";
import test from "node:test";

import { summarizeRepairEffectiveness } from "../src/core/repair-effectiveness-analytics.js";

test("repair analytics computes before/after deltas and acceptance by genre and repair type", () => {
  const summary = summarizeRepairEffectiveness([
    {
      id: "r1",
      generation_run_id: "run-1",
      genre: "hipHop",
      repair_type: "register-health",
      target_scope: "track",
      target_id: "melody",
      accepted: 1,
      before_metrics_json: JSON.stringify({ registerHealth: 64, density: 80 }),
      after_metrics_json: JSON.stringify({ registerHealth: 92, density: 80 }),
    },
    {
      id: "r2",
      generation_run_id: "run-2",
      genre: "hipHop",
      repair_type: "register-health",
      target_scope: "track",
      target_id: "melody",
      accepted: 0,
      before_metrics_json: JSON.stringify({ registerHealth: 70 }),
      after_metrics_json: JSON.stringify({ registerHealth: 74 }),
    },
  ]);

  assert.equal(summary.repairCount, 2);
  assert.equal(summary.repairs[0].metrics.find((metric) => metric.metric === "registerHealth").delta, 28);
  assert.equal(summary.groups.length, 1);
  assert.equal(summary.groups[0].attempts, 2);
  assert.equal(summary.groups[0].accepted, 1);
  assert.equal(summary.groups[0].acceptanceRate, 0.5);
  assert.equal(summary.groups[0].averageDeltas.registerHealth, 16);
  assert.equal(summary.groups[0].averageDeltas.density, 0);
});

test("repair analytics ignores non-numeric metric fields safely", () => {
  const summary = summarizeRepairEffectiveness([{
    repair_type: "density",
    accepted: 1,
    before_metrics_json: JSON.stringify({ density: 72, note: "before" }),
    after_metrics_json: JSON.stringify({ density: 84, note: "after" }),
  }]);
  assert.deepEqual(summary.repairs[0].metrics, [
    { metric: "density", before: 72, after: 84, delta: 12 },
  ]);
});
