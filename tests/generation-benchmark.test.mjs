import assert from "node:assert/strict";
import test from "node:test";
import { runGenerationBenchmark } from "../src/generation-benchmark.js";
import { GENRE_PROFILES } from "../src/music-engine.js";

test("phase 50 calibration benchmark measures quality, safety, and novelty across genres", () => {
  const report = runGenerationBenchmark({
    genres: ["rap", "rock", "house"],
    seeds: ["proof-a", "proof-b"],
    bars: 8,
  });
  assert.equal(report.phase, 50);
  assert.equal(report.generations, 6);
  assert.equal(report.failures.length, 0);
  assert.ok(report.averageScore >= 58);
  assert.ok(report.minimumScore >= 58);
  assert.ok(report.uniqueFingerprintRatio >= 0.8);
  assert.ok(report.results.every(({ scaleFit, finalChecks }) => scaleFit === 1 && finalChecks));
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
  assert.ok(report.uniqueFingerprintRatio >= 0.8, `Expected unique fingerprint ratio >= 0.8, got ${report.uniqueFingerprintRatio}`);
  assert.ok(
    report.results.every(({ scaleFit, finalChecks }) => scaleFit === 1 && finalChecks),
    "Every song candidate must achieve 100% scale safety and pass all final master checks",
  );
});
