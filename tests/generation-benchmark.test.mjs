import assert from "node:assert/strict";
import test from "node:test";
import { QUALITY_DIMENSION_GROUPS, runGenerationBenchmark } from "../src/generation-benchmark.js";
import { GENRE_PROFILES } from "../src/music-engine.js";

test("phase 50 calibration benchmark measures quality, safety, novelty, and weakest subsystems", () => {
  const genres = ["rap", "rock", "house"];
  const report = runGenerationBenchmark({
    genres,
    seeds: ["proof-a", "proof-b"],
    bars: 8,
  });
  assert.equal(report.phase, 50);
  assert.equal(report.version, 2);
  assert.equal(report.labVersion, 1);
  assert.equal(report.generations, 6);
  assert.equal(report.failures.length, 0);
  assert.ok(report.averageScore >= 58);
  assert.ok(report.minimumScore >= 58);
  assert.ok(report.averageTechnicalScore >= 95);
  assert.ok(report.uniqueFingerprintRatio >= 0.8);
  assert.equal(report.perGenre.length, genres.length);
  assert.ok(genres.includes(report.weakestGenre.genre));
  assert.ok(Object.hasOwn(QUALITY_DIMENSION_GROUPS, report.weakestGroup.id));
  assert.ok(report.weakestDimension.id !== "unknown");
  assert.ok(report.recommendations.length >= 3);
  assert.ok(report.results.every(({ scaleFit, finalChecks, finalAssemblyChecks, exportChecks }) => (
    scaleFit === 1 && finalChecks && finalAssemblyChecks && exportChecks
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
  assert.equal(report.generations, allGenres.length * 2);
  assert.equal(report.failures.length, 0, `Generation failures detected: ${report.failures.join(", ")}`);
  assert.ok(report.averageScore >= 80, `Expected average score >= 80, got ${report.averageScore}`);
  assert.ok(report.minimumScore >= 75, `Expected minimum score >= 75, got ${report.minimumScore}`);
  assert.ok(report.averageCreativeFloor >= 60, `Expected creative floor >= 60, got ${report.averageCreativeFloor}`);
  assert.ok(report.averageTechnicalScore >= 95, `Expected technical score >= 95, got ${report.averageTechnicalScore}`);
  assert.ok(report.releasePassRate >= 0 && report.releasePassRate <= 1);
  assert.ok(report.uniqueFingerprintRatio >= 0.8, `Expected unique fingerprint ratio >= 0.8, got ${report.uniqueFingerprintRatio}`);
  assert.equal(report.perGenre.length, allGenres.length);
  assert.ok(report.perGenre.every(({ weakestGroup, weakestDimension, averageOverallScore }) => (
    Object.hasOwn(QUALITY_DIMENSION_GROUPS, weakestGroup.id)
    && weakestDimension.id !== "unknown"
    && averageOverallScore >= 0
    && averageOverallScore <= 100
  )));
  assert.ok(
    report.results.every(({ scaleFit, finalChecks, finalAssemblyChecks, exportChecks }) => (
      scaleFit === 1 && finalChecks && finalAssemblyChecks && exportChecks
    )),
    "Every song candidate must achieve 100% scale safety and pass final assembly/export checks",
  );
});
