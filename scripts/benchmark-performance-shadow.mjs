import fs from "node:fs/promises";
import path from "node:path";

import { generateNew } from "../src/music-engine.js";
import { createPerformanceShadowReport } from "../src/core/performance-shadow.js";

function integerFlag(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function numberFlag(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) ? value : fallback;
}

function stringFlag(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : fallback;
}

function average(values, fallback = 0) {
  return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : fallback;
}

function round(value, places = 3) {
  const power = 10 ** places;
  return Math.round((Number(value) + Number.EPSILON) * power) / power;
}

const genres = [
  "hipHop",
  "trap",
  "pop",
  "house",
  "neoSoul",
  "loFiHipHop",
  "jazz",
  "rock",
];
const seedCount = integerFlag("--seeds", 2);
const bars = integerFlag("--bars", 16);
const humanize = Math.max(0, Math.min(1, numberFlag("--humanize", 0.65)));
const jsonPath = stringFlag("--json");
const seeds = Array.from(
  { length: seedCount },
  (_, index) => `performance-shadow-${String(index + 1).padStart(2, "0")}`,
);

const runs = [];
for (const genre of genres) {
  for (const seed of seeds) {
    const song = generateNew({
      genre,
      seed,
      bars,
      humanize,
      candidateCount: 1,
      adaptiveCandidates: false,
      weaknessAwareSearch: false,
      targetedRepair: false,
    });
    const shadow = createPerformanceShadowReport(song, { humanize, seed });
    runs.push({
      genre,
      seed,
      safeToAudition: shadow.safeToAudition,
      promotionCandidate: shadow.promotionCandidate,
      technicalSafety: shadow.technicalSafety,
      grooveSafety: shadow.grooveSafety,
      metrics: shadow.metrics,
      roles: shadow.roles,
    });
  }
}

function summarizeGenre(genre) {
  const rows = runs.filter((run) => run.genre === genre);
  return {
    genre,
    runs: rows.length,
    technicalPassRate: round(average(rows.map((run) => run.safeToAudition ? 1 : 0))),
    promotionCandidateRate: round(average(rows.map((run) => run.promotionCandidate ? 1 : 0))),
    meanAbsTimingMs: round(average(rows.map((run) => run.metrics.timing.meanAbsMs))),
    meanP95TimingMs: round(average(rows.map((run) => run.metrics.timing.p95AbsMs))),
    maxTimingMs: round(Math.max(0, ...rows.map((run) => run.metrics.timing.maxAbsMs))),
    meanVelocityDelta: round(average(rows.map((run) => run.metrics.velocity.meanAbsDelta))),
    maxVelocityDelta: round(Math.max(0, ...rows.map((run) => run.metrics.velocity.maxAbsDelta))),
    meanDurationDeltaPercent: round(average(rows.map((run) => run.metrics.duration.meanAbsPercent))),
    maxDurationDeltaPercent: round(Math.max(0, ...rows.map((run) => run.metrics.duration.maxAbsPercent))),
    articulationChanges: rows.reduce((sum, run) => sum + run.metrics.articulationChanges, 0),
    orderingInversions: rows.reduce((sum, run) => sum + run.metrics.orderingInversions, 0),
    introducedNearCollisions: rows.reduce((sum, run) => sum + run.metrics.introducedNearCollisions, 0),
  };
}

const perGenre = genres.map(summarizeGenre);
const hardFailures = runs.filter((run) => !run.safeToAudition);
const grooveWarnings = runs.filter((run) => !run.promotionCandidate && run.safeToAudition);
const report = {
  labVersion: 1,
  authority: "performance-shadow-v1",
  engine: "performance-engine-v1",
  mode: "diagnostic-only",
  generatedAt: new Date().toISOString(),
  genres,
  seeds,
  bars,
  humanize,
  generations: runs.length,
  hardFailureCount: hardFailures.length,
  grooveWarningCount: grooveWarnings.length,
  perGenre,
  runs,
};

if (jsonPath) {
  const target = path.resolve(jsonPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(report, null, 2) + "\n", "utf8");
}

console.log("\nMIDI Arcade Performance Shadow Matrix");
console.log(
  `${runs.length} songs · ${seedCount} fixed seeds per genre · ${bars} bars · humanize ${humanize} · diagnostic only\n`,
);
console.table(perGenre.map((entry) => ({
  genre: entry.genre,
  technical: `${Math.round(entry.technicalPassRate * 100)}%`,
  promotion: `${Math.round(entry.promotionCandidateRate * 100)}%`,
  timingMeanMs: entry.meanAbsTimingMs,
  timingP95Ms: entry.meanP95TimingMs,
  timingMaxMs: entry.maxTimingMs,
  velocityMean: entry.meanVelocityDelta,
  durationMeanPct: entry.meanDurationDeltaPercent,
  inversions: entry.orderingInversions,
  collisions: entry.introducedNearCollisions,
})));

if (grooveWarnings.length) {
  console.log(`\nGroove warnings: ${grooveWarnings.length} shadow runs need review before promotion.`);
}
if (hardFailures.length) {
  console.error(`\nTechnical safety failures: ${hardFailures.length}`);
  for (const failure of hardFailures) {
    console.error(`- ${failure.genre}/${failure.seed}: ${JSON.stringify(failure.technicalSafety)}`);
  }
  process.exitCode = 1;
} else {
  console.log("\nTechnical shadow safety: PASS — no accepted song output was modified.");
}
