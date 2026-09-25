import fs from "node:fs/promises";
import path from "node:path";

import { generateNew } from "../src/music-engine.js";
import { evaluateEnsembleCoordinationAuthority } from "../src/core/ensemble-coordination-authority.js";

function numericFlag(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function stringFlag(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : fallback;
}

function average(values, fallback = 0) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function round(value, places = 4) {
  const power = 10 ** places;
  return Math.round((Number(value) + Number.EPSILON) * power) / power;
}

const genres = ["hipHop", "pop", "trap"];
const seedCount = numericFlag("--seeds", 4);
const bars = numericFlag("--bars", 16);
const jsonPath = stringFlag("--json");
const seeds = Array.from(
  { length: seedCount },
  (_, index) => `ensemble-matrix-${String(index + 1).padStart(2, "0")}`,
);

const runs = [];
for (const genre of genres) {
  for (const seed of seeds) {
    const song = generateNew({
      genre,
      seed,
      bars,
      candidateCount: 1,
      targetedRepair: false,
    });
    const report = evaluateEnsembleCoordinationAuthority(song);
    runs.push({
      genre,
      seed,
      score: report.score,
      passed: report.passed,
      weakestSection: report.weakestSection,
      metrics: report.metrics,
    });
  }
}

const positiveMetrics = [
  "rhythmFoundation",
  "bassIndependence",
  "leadDialogue",
  "callResponseTiming",
  "phraseSeparation",
  "leadHarmonySeparation",
  "supportRestraint",
  "sectionRoleEvolution",
  "arrangementBreathingRoom",
];
const negativeMetrics = [
  "kickBassCloneRatio",
  "melodyChordCrowding",
  "leadPhraseOverlap",
  "supportForegroundOverlap",
];

function summarizeGenre(genre) {
  const genreRuns = runs.filter((run) => run.genre === genre);
  const metricAverages = Object.fromEntries([
    ...positiveMetrics,
    ...negativeMetrics,
  ].map((metric) => [
    metric,
    round(average(genreRuns.map((run) => Number(run.metrics?.[metric] ?? 0)))),
  ]));
  const health = [
    ...positiveMetrics.map((metric) => ({
      metric,
      health: metricAverages[metric],
      average: metricAverages[metric],
      direction: "higher-is-better",
    })),
    ...negativeMetrics.map((metric) => ({
      metric,
      health: 1 - metricAverages[metric],
      average: metricAverages[metric],
      direction: "lower-is-better",
    })),
  ].sort((left, right) => left.health - right.health);

  return {
    genre,
    runs: genreRuns.length,
    averageScore: round(average(genreRuns.map((run) => run.score)), 2),
    passRate: round(average(genreRuns.map((run) => run.passed ? 1 : 0))),
    allLayersAlwaysOnRate: round(average(
      genreRuns.map((run) => run.metrics?.allLayersAlwaysOn ? 1 : 0),
    )),
    metrics: metricAverages,
    weakestSignals: health.slice(0, 4),
  };
}

const perGenre = genres.map(summarizeGenre);
const recommendations = [];
for (const entry of perGenre) {
  const weak = entry.weakestSignals[0];
  if (weak && weak.health < 0.58) {
    recommendations.push(
      `${entry.genre}: inspect ${weak.metric} before promoting ensemble diagnostics into a hard gate.`,
    );
  }
  if (entry.allLayersAlwaysOnRate > 0) {
    recommendations.push(
      `${entry.genre}: some fixed seeds keep nearly every layer active; inspect section-role evolution and breathing room.`,
    );
  }
}
if (!recommendations.length) {
  recommendations.push(
    "No severe fixed-seed ensemble weakness detected; keep diagnostics observational until the seed matrix is expanded.",
  );
}

const report = {
  labVersion: 1,
  authority: "ensemble-coordination-v1",
  mode: "diagnostic-only",
  generatedAt: new Date().toISOString(),
  genres,
  seeds,
  bars,
  generations: runs.length,
  perGenre,
  runs,
  recommendations,
};

if (jsonPath) {
  const target = path.resolve(jsonPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(report, null, 2) + "\n", "utf8");
}

console.log("\nMIDI Arcade Ensemble Intelligence Matrix");
console.log(`${runs.length} songs · ${seedCount} fixed seeds per genre · ${bars} bars · diagnostic only\n`);
console.table(perGenre.map((entry) => ({
  genre: entry.genre,
  score: entry.averageScore,
  pass: `${Math.round(entry.passRate * 100)}%`,
  bassIndependent: entry.metrics.bassIndependence,
  kickBassClone: entry.metrics.kickBassCloneRatio,
  leadDialogue: entry.metrics.leadDialogue,
  callResponse: entry.metrics.callResponseTiming,
  phraseSpace: entry.metrics.phraseSeparation,
  leadHarmonySpace: entry.metrics.leadHarmonySeparation,
  supportRestraint: entry.metrics.supportRestraint,
  roleEvolution: entry.metrics.sectionRoleEvolution,
  breathingRoom: entry.metrics.arrangementBreathingRoom,
  allLayersOn: `${Math.round(entry.allLayersAlwaysOnRate * 100)}%`,
})));

for (const entry of perGenre) {
  console.log(
    `${entry.genre} weakest signals: `
    + entry.weakestSignals.map((item) => `${item.metric}=${item.average}`).join(", "),
  );
}
for (const recommendation of recommendations) console.log(`→ ${recommendation}`);
