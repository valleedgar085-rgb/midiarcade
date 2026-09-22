import {
  evaluateSongCandidate,
  evaluateSongReleaseGate,
  generateNew,
} from "../src/music-engine.js";
import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import { applySongOutputQualityPipeline } from "../src/core/output-quality-pipeline-register.js";
import { analyzeJazzQuality } from "../src/core/jazz-quality-lab.js";

function argument(name, fallback) {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) ? value : fallback;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

const seedCount = Math.max(1, Math.round(argument("seeds", 32)));
const bars = Math.max(8, Math.round(argument("bars", 16)));
const rows = [];

for (let index = 0; index < seedCount; index += 1) {
  const seed = `jazz-quality-lab-${String(index + 1).padStart(4, "0")}`;
  const config = {
    ...applyOutputQualityEvolution({
      genre: "jazz",
      seed,
      bars,
      candidateCount: 1,
    }, { kind: "new" }),
    phraseResolutionRefinement: true,
    registerHealthRefinement: true,
    genreIdentityRefinement: false,
  };
  const processed = applySongOutputQualityPipeline(generateNew(config), config);
  const song = processed.song;
  const critic = evaluateSongCandidate(song);
  const release = evaluateSongReleaseGate(song, critic);
  const jazz = analyzeJazzQuality(song);
  rows.push({
    seed,
    releasePassed: Boolean(release.passed),
    criticScore: Number(critic.score ?? 0),
    guideTones: Number(jazz?.scores?.guideTones ?? 0),
    walkingBass: Number(jazz?.scores?.walkingBass ?? 0),
    swing: Number(jazz?.scores?.swing ?? 0),
    comping: Number(jazz?.scores?.comping ?? 0),
    phrase: Number(jazz?.scores?.phrase ?? 0),
    chromaticism: Number(jazz?.scores?.chromaticism ?? 0),
    jazzOverall: Number(jazz?.scores?.overall ?? 0),
  });
}

const metrics = [
  "criticScore",
  "guideTones",
  "walkingBass",
  "swing",
  "comping",
  "phrase",
  "chromaticism",
  "jazzOverall",
];
const summary = Object.fromEntries(metrics.map((metric) => {
  const values = rows.map((row) => row[metric]);
  return [metric, {
    min: Math.min(...values),
    average: Math.round(average(values) * 100) / 100,
    max: Math.max(...values),
  }];
}));
const releaseFailures = rows.filter((row) => !row.releasePassed);

console.log("JAZZ_QUALITY_LAB_SUMMARY", JSON.stringify({
  version: 1,
  seedCount,
  bars,
  releaseFailures: releaseFailures.length,
  metrics: summary,
}));
if (releaseFailures.length) {
  console.log("JAZZ_QUALITY_LAB_RELEASE_FAILURES", JSON.stringify(releaseFailures.slice(0, 20)));
  process.exitCode = 1;
}
