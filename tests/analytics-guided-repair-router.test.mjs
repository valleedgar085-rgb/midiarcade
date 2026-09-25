import assert from "node:assert/strict";
import test from "node:test";

import {
  createAnalyticsGuidedRepairHint,
  rankRepairEvidence,
} from "../src/core/analytics-guided-repair-router.js";

const diagnosis = {
  group: "motif",
  route: "hook-first",
  weakestDimension: "registerHealth",
  weakestScore: 61,
};

test("repair router prefers proven same-genre repair evidence for the current weakest dimension", () => {
  const analytics = {
    groups: [
      {
        genre: "hipHop",
        repairType: "register-shift",
        attempts: 10,
        acceptanceRate: 0.8,
        averageDeltas: { registerHealth: 14 },
      },
      {
        genre: "hipHop",
        repairType: "phrase-register",
        attempts: 6,
        acceptanceRate: 0.5,
        averageDeltas: { registerHealth: 5 },
      },
      {
        genre: "trap",
        repairType: "register-shift",
        attempts: 20,
        acceptanceRate: 0.95,
        averageDeltas: { registerHealth: 20 },
      },
    ],
  };

  const ranked = rankRepairEvidence({ diagnosis, analytics, genre: "hipHop" });
  assert.equal(ranked.recommendedRepairType, "register-shift");
  assert.equal(ranked.evidence.length, 2);

  const hint = createAnalyticsGuidedRepairHint({ diagnosis, analytics, genre: "hipHop" });
  assert.equal(hint.group, "motif");
  assert.equal(hint.route, "hook-first");
  assert.equal(hint.historicalRepairType, "register-shift");
  assert.ok(hint.historicalEvidenceScore > 0);
});

test("repair router refuses weak or negative historical evidence", () => {
  const analytics = {
    groups: [
      {
        genre: "hipHop",
        repairType: "weak-sample",
        attempts: 2,
        acceptanceRate: 1,
        averageDeltas: { registerHealth: 20 },
      },
      {
        genre: "hipHop",
        repairType: "bad-direction",
        attempts: 12,
        acceptanceRate: 0.8,
        averageDeltas: { registerHealth: -4 },
      },
    ],
  };

  const ranked = rankRepairEvidence({ diagnosis, analytics, genre: "hipHop" });
  assert.equal(ranked.recommendedRepairType, null);
  assert.equal(ranked.evidenceScore, 0);
  assert.deepEqual(ranked.evidence, []);
});

test("repair router is deterministic for identical inputs", () => {
  const analytics = {
    groups: [
      {
        genre: "pop",
        repairType: "register-a",
        attempts: 6,
        acceptanceRate: 0.6,
        averageDeltas: { registerHealth: 8 },
      },
      {
        genre: "pop",
        repairType: "register-b",
        attempts: 6,
        acceptanceRate: 0.6,
        averageDeltas: { registerHealth: 8 },
      },
    ],
  };
  assert.deepEqual(
    rankRepairEvidence({ diagnosis, analytics, genre: "pop" }),
    rankRepairEvidence({ diagnosis, analytics, genre: "pop" }),
  );
});
