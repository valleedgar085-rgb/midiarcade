import assert from "node:assert/strict";
import test from "node:test";
import {
  runRepairEffectivenessBenchmark,
  summarizeRepairEffectiveness,
} from "../src/repair-effectiveness-benchmark.js";

test("repair effectiveness summarizer reports deterministic strategy, rejection, and routing metrics", () => {
  const input = {
    attempts: [
      {
        genre: "techno",
        strategyId: "motif-evolution",
        dimension: "repetition",
        accepted: false,
        weaknessGain: 0.2,
        totalDelta: -0.4,
        maxCriticalRegression: 0.6,
        surgicalAttempted: true,
        surgicalAccepted: false,
        wholeFallbackUsed: false,
        reasons: ["weakness-not-improved"],
      },
      {
        genre: "techno",
        strategyId: "motif-evolution",
        dimension: "repetition",
        accepted: true,
        selected: true,
        weaknessGain: 4.2,
        totalDelta: 0.8,
        maxCriticalRegression: 0.4,
        surgicalAttempted: true,
        surgicalAccepted: true,
        wholeFallbackUsed: false,
        reasons: [],
      },
      {
        genre: "jazz",
        strategyId: "density-thin",
        dimension: "density",
        accepted: true,
        weaknessGain: 3,
        totalDelta: 0.5,
        maxCriticalRegression: 0.3,
        surgicalAttempted: true,
        surgicalAccepted: true,
        wholeFallbackUsed: false,
        reasons: [],
      },
    ],
    songs: [
      {
        genre: "techno",
        profile: "sparse",
        candidatesEvaluated: 7,
        repairAttempts: 2,
        acceptedRepairs: 1,
        selectedFromRepair: true,
        skippedGlobalDimensions: [
          { group: "motif", dimension: "repetition", score: 54, reason: "song-level-search-owned" },
          { group: "arrangement", dimension: "drumVariety", score: 58, reason: "song-level-search-owned" },
        ],
      },
      {
        genre: "jazz",
        profile: "balanced",
        candidatesEvaluated: 6,
        repairAttempts: 1,
        acceptedRepairs: 1,
        selectedFromRepair: false,
        skippedGlobalDimensions: [
          { group: "motif", dimension: "repetition", score: 64, reason: "song-level-search-owned" },
        ],
      },
    ],
  };
  const first = summarizeRepairEffectiveness(input);
  const second = summarizeRepairEffectiveness(input);

  assert.deepEqual(first, second);
  assert.equal(first.labVersion, 2);
  assert.equal(first.repairAttempts, 3);
  assert.equal(first.acceptedRepairs, 2);
  assert.equal(first.byStrategy[0].id, "motif-evolution");
  assert.equal(first.byStrategy[0].acceptanceRate, 0.5);
  assert.equal(first.byStrategy[0].selectedWins, 1);
  assert.equal(first.rejectionReasons["weakness-not-improved"], 1);
  assert.equal(first.globalRepairSkips, 3);
  assert.equal(first.songsWithGlobalRepairSkips, 2);
  assert.deepEqual(first.skippedByDimension, [
    { dimension: "repetition", count: 2 },
    { dimension: "drumVariety", count: 1 },
  ]);
  assert.equal(first.maxCandidatesEvaluated, 7);
});

test("live repair calibration stays deterministic in budget and uses public generation metadata", () => {
  const report = runRepairEffectivenessBenchmark({
    genres: ["jazz"],
    seeds: ["repair-benchmark-smoke"],
    profiles: [{ id: "sparse", energy: 0.05, complexity: 0.05 }],
    bars: 8,
  });

  assert.equal(report.totalSongs, 1);
  assert.ok(report.repairAttempts <= 2);
  assert.ok(report.maxCandidatesEvaluated <= 12);
  assert.ok(report.byStrategy.every((strategy) => strategy.attempts > 0));
  assert.ok(report.attempts.every((attempt) => typeof attempt.strategyId === "string"));
  assert.ok(report.globalRepairSkips >= 0);
  assert.ok(report.skippedByDimension.every((entry) => entry.count > 0));
});
