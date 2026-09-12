import { runRepairEffectivenessBenchmark } from "../src/repair-effectiveness-benchmark.js";

const report = runRepairEffectivenessBenchmark({
  seeds: ["repair-cal-01", "repair-cal-02"],
  bars: 8,
  thinkingDepth: "standard",
});

const focus = new Set([
  "arrangement-regenerate",
  "harmony-regenerate",
  "density-build",
  "density-thin",
]);

console.log("Phase 2 checkpoint 6 baseline");
console.log(`overall=${Math.round(report.acceptanceRate * 100)}% attempts=${report.repairAttempts}`);
for (const strategy of report.byStrategy) {
  if (!focus.has(strategy.id)) continue;
  console.log("STRATEGY", JSON.stringify(strategy));
}
for (const attempt of report.attempts) {
  if (!focus.has(attempt.strategyId)) continue;
  console.log("ATTEMPT", JSON.stringify(attempt));
}
