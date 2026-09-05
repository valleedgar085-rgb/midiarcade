import { runGenerationBenchmark } from "../src/generation-benchmark.js";

function numericFlag(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

const seedCount = numericFlag("--seeds", 3);
const bars = numericFlag("--bars", 16);
const seeds = Array.from({ length: seedCount }, (_, index) => `quality-lab-${String(index + 1).padStart(2, "0")}`);
const report = runGenerationBenchmark({ seeds, bars });

console.log(`\nMIDI Arcade Music Quality Lab v${report.labVersion}`);
console.log(`${report.generations} generated songs · ${bars} bars · ${seedCount} deterministic seeds per genre\n`);

console.table(report.perGenre.map((genre) => ({
  genre: genre.genre,
  overall: genre.averageOverallScore,
  musical: genre.averageMusicalScore,
  technical: genre.averageTechnicalScore,
  floor: genre.averageCreativeFloor,
  release: `${Math.round(genre.releasePassRate * 100)}%`,
  weakestSubsystem: `${genre.weakestGroup.id} ${genre.weakestGroup.score}`,
  weakestDimension: `${genre.weakestDimension.id} ${genre.weakestDimension.score}`,
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
  `Weakest genre: ${report.weakestGenre?.genre ?? "n/a"}`
  + ` · subsystem: ${report.weakestGroup.id} (${report.weakestGroup.score})`
  + ` · dimension: ${report.weakestDimension.id} (${report.weakestDimension.score})`,
);
for (const recommendation of report.recommendations) console.log(`→ ${recommendation}`);

if (report.failures.length) {
  console.error("\nMusic Quality Lab failures:");
  console.error(report.failures.join("\n"));
  process.exitCode = 1;
}
