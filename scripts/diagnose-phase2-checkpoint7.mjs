import {
  DEFAULT_REPAIR_BENCHMARK_GENRES,
  DEFAULT_REPAIR_BENCHMARK_PROFILES,
  runRepairEffectivenessBenchmark,
} from "../src/repair-effectiveness-benchmark.js";

const seeds = Array.from({ length: 4 }, (_, index) => `repair-cal-${String(index + 1).padStart(2, "0")}`);
const report = runRepairEffectivenessBenchmark({
  genres: DEFAULT_REPAIR_BENCHMARK_GENRES,
  profiles: DEFAULT_REPAIR_BENCHMARK_PROFILES,
  seeds,
  bars: 8,
});

const focus = new Set(["phraseResolution", "stageInterlock", "storyArc"]);
const rows = report.attempts
  .filter((attempt) => focus.has(attempt.dimension))
  .map((attempt) => ({
    seed: attempt.generatedSeed,
    dimension: attempt.dimension,
    strategy: attempt.strategyId,
    accepted: attempt.accepted,
    selected: attempt.selected,
    weaknessGain: attempt.weaknessGain,
    totalDelta: attempt.totalDelta,
    maxCriticalRegression: attempt.maxCriticalRegression,
    surgicalAttempted: attempt.surgicalAttempted,
    surgicalAccepted: attempt.surgicalAccepted,
    wholeFallbackUsed: attempt.wholeFallbackUsed,
    reasons: attempt.reasons.join(",") || "accepted",
  }));

console.log(`Checkpoint 7 focused attempts: ${rows.length}`);
console.table(rows);
for (const dimension of focus) {
  const entries = rows.filter((row) => row.dimension === dimension);
  if (!entries.length) continue;
  console.log(`\n${dimension}: ${entries.filter((row) => row.accepted).length}/${entries.length} accepted`);
  for (const row of entries) console.log(JSON.stringify(row));
}
