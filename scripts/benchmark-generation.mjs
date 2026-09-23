import fs from "node:fs/promises";
import path from "node:path";
import { runGenerationBenchmark } from "../src/generation-benchmark.js";

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

const seedCount = numericFlag("--seeds", 3);
const bars = numericFlag("--bars", 16);
const seeds = Array.from({ length: seedCount }, (_, index) => `quality-lab-${String(index + 1).padStart(2, "0")}`);
const report = runGenerationBenchmark({ seeds, bars });
const jsonPath = stringFlag("--json");
if (jsonPath) {
  const target = path.resolve(jsonPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(report, null, 2) + "\n", "utf8");
}

console.log(`\nMIDI Arcade Music Quality Lab v${report.labVersion}`);
console.log(`${report.generations} generated songs · ${bars} bars · ${seedCount} deterministic seeds per genre\n`);

console.table(report.perGenre.map((genre) => ({
  genre: genre.genre,
  overall: genre.averageOverallScore,
  musical: genre.averageMusicalScore,
  technical: genre.averageTechnicalScore,
  floor: genre.averageCreativeFloor,
  density: `${genre.averageNotesPerBar}/${genre.averageDensityTarget}`,
  densityDelta: genre.averageDensityDelta,
  densityRefine: `${Math.round(genre.densityRefinementAcceptanceRate * 100)}%/${Math.round(genre.densityRefinementAttemptRate * 100)}%`,
  densityGain: genre.averageDensityRefinementDelta,
  phraseRefine: `${Math.round(genre.phraseResolutionRefinementAcceptanceRate * 100)}%/${Math.round(genre.phraseResolutionRefinementAttemptRate * 100)}%`,
  phraseGain: genre.averagePhraseResolutionRefinementDelta,
  repetitionRefine: `${Math.round(genre.repetitionRefinementAcceptanceRate * 100)}%/${Math.round(genre.repetitionRefinementAttemptRate * 100)}%`,
  repetitionGain: genre.averageRepetitionRefinementDelta,
  registerRefine: `${Math.round(genre.registerHealthRefinementAcceptanceRate * 100)}%/${Math.round(genre.registerHealthRefinementAttemptRate * 100)}%`,
  registerGain: genre.averageRegisterHealthRefinementDelta,
  release: `${Math.round(genre.releasePassRate * 100)}%`,
  arrangement: `${Math.round(genre.arrangementAcceptanceRate * 100)}%/${Math.round(genre.arrangementAttemptRate * 100)}%`,
  returns: `${Math.round(genre.returnDevelopmentAcceptanceRate * 100)}%/${Math.round(genre.returnDevelopmentAttemptRate * 100)}%`,
  pocket: `${Math.round(genre.groovePocketAcceptanceRate * 100)}%/${Math.round(genre.groovePocketAttemptRate * 100)}%`,
  pocketDelta: genre.averageGroovePocketDelta,
  weakestSubsystem: `${genre.weakestGroup.id} ${genre.weakestGroup.score}`,
  weakestDimension: `${genre.weakestDimension.id} ${genre.weakestDimension.score}`,
  floorBreaches: genre.floorBreachCount,
  weakestVariety: `${genre.variety.weakestAxis} ${Math.round(genre.variety.weakestRatio * 100)}%`,
  band: genre.healthBand,
})));

console.table(Object.entries(report.groupAverages).map(([subsystem, score]) => ({ subsystem, score })));
console.log(
  `Overall ${report.averageOverallScore} · musical ${report.averageMusicalScore}`
  + ` · technical ${report.averageTechnicalScore} · creative floor ${report.averageCreativeFloor}`
  + ` · release ${Math.round(report.releasePassRate * 100)}%`
  + ` · unique ${(report.uniqueFingerprintRatio * 100).toFixed(1)}%`,
);
console.log(
  `Density fit: ${report.averageNotesPerBar}/${report.averageDensityTarget} pitched notes per bar`
  + ` · signed delta ${report.averageDensityDelta}`,
);
console.log(
  `Density refinement: ${Math.round(report.densityRefinementAcceptanceRate * 100)}% accepted`
  + ` of ${Math.round(report.densityRefinementAttemptRate * 100)}% attempted candidates`
  + ` · average critic gain ${report.averageDensityRefinementDelta}`,
);
console.log(
  `Phrase resolution refinement: ${Math.round(report.phraseResolutionRefinementAcceptanceRate * 100)}% accepted`
  + ` of ${Math.round(report.phraseResolutionRefinementAttemptRate * 100)}% attempted candidates`
  + ` · average critic gain ${report.averagePhraseResolutionRefinementDelta}`,
);
console.log(
  `Repetition refinement: ${Math.round(report.repetitionRefinementAcceptanceRate * 100)}% accepted`
  + ` of ${Math.round(report.repetitionRefinementAttemptRate * 100)}% attempted candidates`
  + ` · average critic gain ${report.averageRepetitionRefinementDelta}`
  + ` · average signed error delta ${report.averageRepetitionErrorDelta}`,
);
console.log(
  `Register health refinement: ${Math.round(report.registerHealthRefinementAcceptanceRate * 100)}% accepted`
  + ` of ${Math.round(report.registerHealthRefinementAttemptRate * 100)}% attempted candidates`
  + ` · average critic gain ${report.averageRegisterHealthRefinementDelta}`,
);
console.log(
  `Arrangement evolution: ${Math.round(report.arrangementAcceptanceRate * 100)}% accepted`
  + ` of ${Math.round(report.arrangementAttemptRate * 100)}% attempted candidates`,
);
console.log(
  `Return development: ${Math.round(report.returnDevelopmentAcceptanceRate * 100)}% accepted`
  + ` of ${Math.round(report.returnDevelopmentAttemptRate * 100)}% attempted candidates`,
);
console.log(
  `Groove pocket: ${Math.round(report.groovePocketAcceptanceRate * 100)}% accepted`
  + ` of ${Math.round(report.groovePocketAttemptRate * 100)}% attempted candidates`
  + ` · average accepted/selected delta ${report.averageGroovePocketDelta}`,
);
console.log(
  `Weakest genre: ${report.weakestGenre?.genre ?? "n/a"}`
  + ` · subsystem: ${report.weakestGroup.id} (${report.weakestGroup.score})`
  + ` · dimension: ${report.weakestDimension.id} (${report.weakestDimension.score})`,
);
if (report.attentionMap?.length) {
  console.log("\nPhase 5 attention map (lowest critic dimensions first):");
  console.table(report.attentionMap.slice(0, 10).map((entry) => ({
    genre: entry.genre,
    overall: entry.averageOverallScore,
    minimum: entry.minimumMusicalScore,
    creativeFloor: entry.averageCreativeFloor,
    weakestSubsystem: `${entry.weakestGroup.id} ${entry.weakestGroup.score}`,
    weakestDimension: `${entry.weakestDimension.id} ${entry.weakestDimension.score}`,
    weakestVariety: `${entry.weakestVarietyAxis} ${Math.round(entry.weakestVarietyRatio * 100)}%`,
  })));
}

if (report.failureMap.length) {
  console.log("\nPhase 5 genre failure map:");
  console.table(report.failureMap.map((entry) => ({
    genre: entry.genre,
    release: `${Math.round(entry.releasePassRate * 100)}%`,
    weakestSubsystem: `${entry.weakestGroup.id} ${entry.weakestGroup.score}`,
    weakestDimension: `${entry.weakestDimension.id} ${entry.weakestDimension.score}`,
    floorBreaches: entry.floorBreaches.map((breach) => `${breach.dimension}:${breach.score}<${breach.floor}`).join(", "),
    weakestVariety: `${entry.weakestVarietyAxis} ${Math.round(entry.weakestVarietyRatio * 100)}%`,
  })));
} else {
  console.log("\nPhase 5 genre failure map: no diagnostic floor breaches.");
}
for (const recommendation of report.recommendations) console.log(`→ ${recommendation}`);

if (report.failures.length) {
  console.error("\nMusic Quality Lab failures:");
  console.error(report.failures.join("\n"));
  process.exitCode = 1;
}
