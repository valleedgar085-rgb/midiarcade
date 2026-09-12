import {
  DEFAULT_REPAIR_BENCHMARK_GENRES,
  runRepairEffectivenessBenchmark,
} from "../src/repair-effectiveness-benchmark.js";

function numericFlag(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) && value > 0 ? Math.round(value) : fallback;
}

function listFlag(name, fallback) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const values = String(process.argv[index + 1] ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return values.length ? values : fallback;
}

const seedCount = numericFlag("--seeds", 2);
const bars = numericFlag("--bars", 8);
const genres = listFlag("--genres", DEFAULT_REPAIR_BENCHMARK_GENRES);
const thinkingDepth = process.argv.includes("--deep") ? "deep" : "standard";
const seeds = Array.from({ length: seedCount }, (_, index) => `repair-cal-${String(index + 1).padStart(2, "0")}`);
const report = runRepairEffectivenessBenchmark({ genres, seeds, bars, thinkingDepth });

console.log(`\nMIDI Arcade Repair Effectiveness Lab v${report.labVersion}`);
console.log(
  `${report.totalSongs} songs · ${report.repairAttempts} repair attempts · ${bars} bars`
  + ` · ${seedCount} seeds · ${thinkingDepth} search\n`,
);

console.table(report.byStrategy.map((strategy) => ({
  strategy: strategy.id,
  attempts: strategy.attempts,
  accepted: strategy.accepted,
  acceptance: `${Math.round(strategy.acceptanceRate * 100)}%`,
  acceptedGain: strategy.acceptedWeaknessGain,
  totalDelta: strategy.averageTotalDelta,
  surgical: `${Math.round(strategy.surgicalAcceptanceRate * 100)}%`,
  fallbacks: `${Math.round(strategy.fallbackRate * 100)}%`,
  selectedWins: strategy.selectedWins,
})));

console.table(report.byDimension.map((dimension) => ({
  dimension: dimension.id,
  attempts: dimension.attempts,
  accepted: dimension.accepted,
  acceptance: `${Math.round(dimension.acceptanceRate * 100)}%`,
  acceptedGain: dimension.acceptedWeaknessGain,
  totalDelta: dimension.averageTotalDelta,
  selectedWins: dimension.selectedWins,
})));

console.table(report.byGenre.map((genre) => ({
  genre: genre.id,
  attempts: genre.attempts,
  accepted: genre.accepted,
  acceptance: `${Math.round(genre.acceptanceRate * 100)}%`,
  acceptedGain: genre.acceptedWeaknessGain,
  selectedWins: genre.selectedWins,
})));

console.log(
  `Repairs observed in ${report.songsWithRepair}/${report.totalSongs} songs`
  + ` · accepted in ${report.songsWithAcceptedRepair}`
  + ` · final selection came from repair in ${report.songsSelectedFromRepair}`
  + ` · average candidates ${report.averageCandidatesEvaluated}`
  + ` · max candidates ${report.maxCandidatesEvaluated}`,
);
console.log(`Overall repair acceptance: ${Math.round(report.acceptanceRate * 100)}%`);
if (Object.keys(report.rejectionReasons).length) {
  console.log("Rejection reasons:", report.rejectionReasons);
}
for (const recommendation of report.recommendations) console.log(`→ ${recommendation}`);
