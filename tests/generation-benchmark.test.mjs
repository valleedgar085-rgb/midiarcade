import assert from "node:assert/strict";
import test from "node:test";
import { PHASE5_DIMENSION_FLOORS, QUALITY_DIMENSION_GROUPS, runGenerationBenchmark } from "../src/generation-benchmark.js";
import { GENRE_PROFILES } from "../src/music-engine.js";

test("phase 50 calibration benchmark measures quality, safety, novelty, and Phase 6 postprocess evolution", () => {
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
  assert.ok(report.returnDevelopmentAttemptRate >= 0 && report.returnDevelopmentAttemptRate <= 1);
  assert.ok(report.returnDevelopmentAcceptanceRate >= 0 && report.returnDevelopmentAcceptanceRate <= 1);
  assert.equal(report.perGenre.length, genres.length);
  assert.ok(genres.includes(report.weakestGenre.genre));
  assert.ok(Object.hasOwn(QUALITY_DIMENSION_GROUPS, report.weakestGroup.id));
  assert.ok(report.weakestDimension.id !== "unknown");
  assert.ok(report.recommendations.length >= 3);
  assert.deepEqual(report.phase5Floors, PHASE5_DIMENSION_FLOORS);
  assert.ok(Array.isArray(report.failureMap));
  assert.ok(Array.isArray(report.attentionMap));
  assert.equal(report.attentionMap.length, genres.length);
  assert.ok(report.attentionMap.every((entry) => entry.weakestDimension.id !== "unknown"));
  assert.ok(report.repetitionRefinementAttemptRate >= 0 && report.repetitionRefinementAttemptRate <= 1);
  assert.ok(report.repetitionRefinementAcceptanceRate >= 0 && report.repetitionRefinementAcceptanceRate <= 1);
  assert.ok(report.perGenre.every((entry) => (
    entry.repetitionRefinementAttemptRate >= 0
    && entry.repetitionRefinementAttemptRate <= 1
    && entry.repetitionRefinementAcceptanceRate >= 0
    && entry.repetitionRefinementAcceptanceRate <= 1
    &&
    entry.minimumDimensionScores
    && Array.isArray(entry.floorBreaches)
    && Number.isInteger(entry.floorBreachCount)
    && entry.variety
    && typeof entry.variety.weakestAxis === "string"
    && entry.variety.weakestRatio >= 0
    && entry.variety.weakestRatio <= 1
  )));
  assert.ok(report.results.every(({ varietySignatures }) => (
    varietySignatures
    && typeof varietySignatures.arrangement === "string"
    && typeof varietySignatures.featuredOrder === "string"
    && typeof varietySignatures.compositionRoute === "string"
    && typeof varietySignatures.kickRhythm === "string"
    && typeof varietySignatures.bassRhythm === "string"
    && typeof varietySignatures.melodyContour === "string"
  )));
  assert.ok(report.results.every(({
    scaleFit,
    finalChecks,
    finalAssemblyChecks,
    exportChecks,
    outputQualitySignature,
    arrangementAttempted,
    arrangementAccepted,
    returnDevelopmentAttempted,
    returnDevelopmentAccepted,
  }) => (
    scaleFit === 1
    && finalChecks
    && finalAssemblyChecks
    && exportChecks
    && Boolean(outputQualitySignature)
    && typeof arrangementAttempted === "boolean"
    && typeof arrangementAccepted === "boolean"
    && typeof returnDevelopmentAttempted === "boolean"
    && typeof returnDevelopmentAccepted === "boolean"
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
  assert.ok(report.returnDevelopmentAttemptRate >= 0 && report.returnDevelopmentAttemptRate <= 1);
  assert.ok(report.returnDevelopmentAcceptanceRate >= 0 && report.returnDevelopmentAcceptanceRate <= 1);
  assert.equal(report.perGenre.length, allGenres.length);
  assert.ok(report.perGenre.every(({
    weakestGroup,
    weakestDimension,
    averageOverallScore,
    arrangementAttemptRate,
    arrangementAcceptanceRate,
    returnDevelopmentAttemptRate,
    returnDevelopmentAcceptanceRate,
  }) => (
    Object.hasOwn(QUALITY_DIMENSION_GROUPS, weakestGroup.id)
    && weakestDimension.id !== "unknown"
    && averageOverallScore >= 0
    && averageOverallScore <= 100
    && arrangementAttemptRate >= 0
    && arrangementAttemptRate <= 1
    && arrangementAcceptanceRate >= 0
    && arrangementAcceptanceRate <= 1
    && returnDevelopmentAttemptRate >= 0
    && returnDevelopmentAttemptRate <= 1
    && returnDevelopmentAcceptanceRate >= 0
    && returnDevelopmentAcceptanceRate <= 1
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
  assert.equal(baseline.results[0].returnDevelopmentAttempted, false);
  assert.ok(evolved.results[0].outputQualitySignature);
  assert.equal(typeof evolved.results[0].arrangementAttempted, "boolean");
  assert.equal(typeof evolved.results[0].returnDevelopmentAttempted, "boolean");
  assert.equal(baseline.results[0].scaleFit, 1);
  assert.equal(evolved.results[0].scaleFit, 1);
  assert.equal(baseline.results[0].exportChecks, true);
  assert.equal(evolved.results[0].exportChecks, true);
});

test("quality lab reports density in critic units and explains skipped groove-pocket refinement", () => {
  const report = runGenerationBenchmark({
    genres: ["drumBass", "pop"],
    seeds: ["diagnostic-proof"],
    bars: 8,
  });

  const drumBass = report.results.find(({ genre }) => genre === "drumBass");
  const pop = report.results.find(({ genre }) => genre === "pop");
  assert.equal(drumBass.densityMetric, "ensemble-events");
  assert.equal(pop.densityMetric, "pitched-notes");
  assert.deepEqual(report.densityMetrics, { "ensemble-events": 1, "pitched-notes": 1 });
  for (const result of report.results) {
    assert.ok(Number.isFinite(result.notesPerBar));
    assert.ok(Number.isFinite(result.densityObserved));
    assert.ok(Number.isFinite(result.densityTarget));
    assert.equal(result.densityDelta, Number((result.densityObserved - result.densityTarget).toFixed(2)));
    assert.equal(result.groovePocketReason, "disabled");
  }
  assert.deepEqual(report.groovePocketReasons, { disabled: 2 });
  assert.deepEqual(report.perGenre.find(({ genre }) => genre === "pop").groovePocketReasons, { disabled: 1 });
});
