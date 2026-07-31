import { runGenerationBenchmark } from "../src/generation-benchmark.js";

const report = runGenerationBenchmark();
console.table(report.results.map(({ genre, seed, score, creativeFloor, scaleFit, finalChecks }) => ({
  genre,
  seed,
  score,
  creativeFloor,
  scaleFit,
  finalChecks,
})));
console.log(
  `Phase 50 · ${report.generations} ideas · average ${report.averageScore}`
  + ` · floor ${report.minimumScore} · unique ${(report.uniqueFingerprintRatio * 100).toFixed(1)}%`,
);
if (report.failures.length) {
  console.error(report.failures.join("\n"));
  process.exitCode = 1;
}
