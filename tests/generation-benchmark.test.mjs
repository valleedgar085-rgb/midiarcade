import assert from "node:assert/strict";
import test from "node:test";
import { QUALITY_DIMENSION_GROUPS, runGenerationBenchmark } from "../src/generation-benchmark.js";
import { GENRE_PROFILES } from "../src/music-engine.js";

test("phase 50 calibration benchmark measures quality, safety, novelty, weakest subsystems, and Phase 6 arrangement evolution", () => {
  const genres = ["rap", "rock", "house"];
  const report = runGenerationBenchmark({
    genres,
    seeds: ["proof-a", "proof-b"],
    bars: 8,
  });
  assert.equal(report.phase, 50);
  assert.equal(report.version, 2);
  assert.equal(report.labVersion, 3);
  assert.equal(report.qualityEvolution, true);
  assert.equal(report.generations, 6);
  assert.equal(report.failures.length, 0);
  assert.ok(report.averageScore >= 58);
  assert.ok(report.minimumScore >= 58);
  assert.ok(report.averageTechnicalScore >= 95);
  assert.ok(report.uniqueFingerprintRatio >= 0.8);
  assert.ok(report.arrangementAttemptRate >= 0 && report.arrangementAttemptRate <= 1);
  assert.ok(report.arrangementAcceptanceRate >= 0 && report.arrangementAcceptanceRate <= 1);
  assert.equal(report.perGenre.length, genres.length);
  assert.ok(genres.includes(report.weakestGenre.genre));
  assert.ok(Object.hasOwn(QUALITY_DIMENSION_GROUPS, report.weakestGroup.id));
  assert.ok(report.weakestDimension.id !== "unknown");
  assert.ok(report.recommendations.length >= 3);
  assert.ok(report.results.every(({ scaleFit, finalChecks, finalAssemblyChecks, exportChecks, outputQualitySignature, arrangementAttempted, arrangementAccepted }) => (
    scaleFit === 1
    && finalChecks
    && finalAssemblyChecks
    && exportChecks
    && Boolean(outputQualitySignature)
    && typeof arrangementAttempted === "boolean"
    && typeof arrangementAccepted === "boolean"
  )));
});

test("generation success rate benchmark evaluates all genre families with high quality floor", () => {
  const allGenres = Object.keys(GENRE_PROFILES);
  const report = runGenerationBenchmark({
    genres: allGenres,
    seeds: ["eval-alpha", "eval-beta"],
    bars: 8,
  });
  assert.equal(report.phase, 50);
  assert.equal(report.labVersion, 3);
  assert.equal(report.qualityEvolution, true);
  assert.equal(report.generations, allGenres.length * 2);
  assert.equal(report.failures.length, 0, `Generation failures detected: ${report.failures.join(", ")}`);
  assert.ok(report.averageScore >= 80, `Expected average score >= 80, got ${report.averageScore}`);
  assert.ok(report.minimumScore >= 75, `Expected minimum score >= 75, got ${report.minimumScore}`);
  assert.ok(report.averageCreativeFloor >= 60, `Expected creative floor >= 60, got ${report.averageCreativeFloor}`);
  assert.ok(report.averageTechnicalScore >= 95, `Expected technical score >= 95, got ${report.averageTechnicalScore}`);
  assert.ok(report.releasePassRate >= 0 && report.releasePassRate <= 1);
  assert.ok(report.uniqueFingerprintRatio >= 0.8, `Expected unique fingerprint ratio >= 0.8, got ${report.uniqueFingerprintRatio}`);
  assert.ok(report.arrangementAttemptRate >= 0 && report.arrangementAttemptRate <= 1);
  assert.ok(report.arrangementAcceptanceRate >= 0 && report.arrangementAcceptanceRate <= 1);
  assert.equal(report.perGenre.length, allGenres.length);
  assert.ok(report.perGenre.every(({ weakestGroup, weakestDimension, averageOverallScore, arrangementAttemptRate, arrangementAcceptanceRate }) => (
    Object.hasOwn(QUALITY_DIMENSION_GROUPS, weakestGroup.id)
    && weakestDimension.id !== "unknown"
    && averageOverallScore >= 0
    && averageOverallScore <= 100
    && arrangementAttemptRate >= 0
    && arrangementAttemptRate <= 1
    && arrangementAcceptanceRate >= 0
    && arrangementAcceptanceRate <= 1
  )));
  assert.ok(
    report.results.every(({ scaleFit, finalChecks, finalAssemblyChecks, exportChecks, outputQualitySignature }) => (
      scaleFit === 1 && finalChecks && finalAssemblyChecks && exportChecks && Boolean(outputQualitySignature)
    )),
    "Every evolved song candidate must retain scale safety, final assembly/export checks, and a Phase 6 quality signature",
  );
});

test("quality lab can still produce an explicit pre-Phase-6 baseline for A/B comparison", () => {
  const baseline = runGenerationBenchmark({
    genres: ["techno"],
    seeds: ["ab-proof"],
    bars: 8,
    qualityEvolution: false,
  });
  const evolved = runGenerationBenchmark({
    genres: ["techno"],
    seeds: ["ab-proof"],
    bars: 8,
    qualityEvolution: true,
  });

  assert.equal(baseline.qualityEvolution, false);
  assert.equal(evolved.qualityEvolution, true);
  assert.equal(baseline.results[0].outputQualitySignature, null);
  assert.equal(baseline.results[0].arrangementAttempted, false);
  assert.ok(evolved.results[0].outputQualitySignature);
  assert.equal(typeof evolved.results[0].arrangementAttempted, "boolean");
  assert.equal(baseline.results[0].scaleFit, 1);
  assert.equal(evolved.results[0].scaleFit, 1);
  assert.equal(baseline.results[0].exportChecks, true);
  assert.equal(evolved.results[0].exportChecks, true);
});
