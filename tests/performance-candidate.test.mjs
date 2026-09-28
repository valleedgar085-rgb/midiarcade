// Combined Phase 1 + adaptive candidate APK validation.
import assert from "node:assert/strict";
import test from "node:test";

import { generateNew } from "../src/music-engine.js";
import {
  acceptPerformanceCandidate,
  createPerformanceCandidate,
  rejectPerformanceCandidate,
  validatePerformanceCandidate,
} from "../src/core/performance-candidate.js";

function generatedSong() {
  return generateNew({
    genre: "neoSoul",
    seed: "performance-candidate-contract",
    bars: 8,
    candidateCount: 1,
    adaptiveCandidates: false,
    weaknessAwareSearch: false,
    targetedRepair: false,
  });
}

test("Trap performance candidate fails closed until listener benefit is proven", { timeout: 120_000 }, () => {
  const song = generatedSong();
  song.genre = "trap";
  song.meta.genre = "trap";
  const transaction = createPerformanceCandidate(song, {
    humanize: 1,
    seed: "trap-listener-benefit-unproven",
  });

  assert.equal(transaction.status, "rejected");
  assert.equal(transaction.validation.valid, false);
  assert.ok(transaction.validation.issues.includes("performance:listener-benefit-unproven"));
  assert.equal(transaction.attempts.length, 0);
});

test("performance candidate is explicit, deterministic, and does not mutate the source", { timeout: 120_000 }, () => {
  const song = generatedSong();
  const before = structuredClone(song);
  const first = createPerformanceCandidate(song, {
    humanize: 0.65,
    seed: "performance-candidate-fixed",
  });
  const second = createPerformanceCandidate(song, {
    humanize: 0.65,
    seed: "performance-candidate-fixed",
  });

  assert.deepEqual(song, before);
  assert.equal(
    first.status,
    "candidate",
    JSON.stringify({
      validation: first.validation,
      attempts: first.attempts,
      ensembleHardIssues: first.ensemble?.hardIssues,
      ensembleWarnings: first.ensemble?.warnings,
      ensembleChecks: first.ensemble?.checks,
      judgeHardIssues: first.ensemble?.judge?.hardIssues,
      judgeWarnings: first.ensemble?.judge?.warnings,
    }),
  );
  assert.equal(first.validation.valid, true);
  assert.deepEqual(first.after, second.after);
  assert.equal(first.after.performanceAudition, undefined);
  assert.equal(first.after.performanceCandidate.mode, "explicit-accept-only");
  assert.equal(first.after.performanceCandidate.promotionCandidate, true);
  assert.ok(first.selectedHumanize > 0);
  assert.ok(first.selectedHumanize <= 0.65);
  assert.ok(first.attempts.length >= 1);
  assert.equal(first.attempts.at(-1).valid, true);
  assert.equal(first.report.promotionCandidate, true);
  assert.equal(first.gauntlet.passed, true);
  assert.equal(first.ensemble.passed, true);
});

test("accepted performance candidate becomes a clone while rejection restores the source snapshot", { timeout: 120_000 }, () => {
  const song = generatedSong();
  const transaction = createPerformanceCandidate(song, {
    humanize: 0.65,
    seed: "performance-candidate-accept",
  });
  const accepted = acceptPerformanceCandidate(transaction);
  const rejected = rejectPerformanceCandidate(transaction);

  assert.notEqual(accepted, transaction.after);
  assert.equal(accepted.performanceCandidate.accepted, true);
  assert.deepEqual(rejected, song);
  assert.notEqual(rejected, song);
  assert.equal(validatePerformanceCandidate(transaction).valid, true);
});

test("candidate gate fails closed if shadow promotion safety is not present", { timeout: 120_000 }, () => {
  const song = generatedSong();
  const transaction = createPerformanceCandidate(song, {
    humanize: 0.65,
    seed: "performance-candidate-invalid",
  });
  const invalid = {
    ...transaction,
    report: {
      ...transaction.report,
      promotionCandidate: false,
    },
  };
  const validation = validatePerformanceCandidate(invalid);

  assert.equal(validation.valid, false);
  assert.ok(validation.issues.includes("performance:shadowPromotionSafety"));
  assert.throws(
    () => acceptPerformanceCandidate(invalid),
    /Cannot accept invalid performance candidate/,
  );
});

test("candidate gate preserves note count, track identity, and pitch identity", { timeout: 120_000 }, () => {
  const song = generatedSong();
  const transaction = createPerformanceCandidate(song, {
    humanize: 0.8,
    seed: "performance-candidate-parity",
  });

  assert.equal(transaction.validation.checks.noteCountParity, true);
  assert.equal(transaction.validation.checks.trackIdentityParity, true);
  assert.equal(transaction.validation.checks.pitchIdentityParity, true);
  assert.equal(transaction.validation.checks.gauntletAuthority, true);
  assert.equal(
    transaction.validation.checks.ensembleAuthority,
    true,
    JSON.stringify({
      attempts: transaction.attempts,
      hardIssues: transaction.ensemble?.hardIssues,
      warnings: transaction.ensemble?.warnings,
      checks: transaction.ensemble?.checks,
      judgeHardIssues: transaction.ensemble?.judge?.hardIssues,
    }),
  );
});

test("zero-intensity performance cannot be promoted as a meaningful candidate", { timeout: 120_000 }, () => {
  const song = generatedSong();
  const transaction = createPerformanceCandidate(song, {
    humanize: 0,
    seed: "performance-candidate-zero",
  });

  assert.equal(transaction.status, "rejected");
  assert.equal(transaction.validation.valid, false);
  assert.ok(
    transaction.validation.issues.includes("performance:no-promotable-intensity")
      || transaction.validation.issues.includes("performance:meaningfulPerformance"),
  );
});
