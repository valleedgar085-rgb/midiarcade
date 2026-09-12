import { runRepairEffectivenessBenchmark } from "../src/repair-effectiveness-benchmark.js";

const report = runRepairEffectivenessBenchmark({
  seeds: ["repair-cal-01", "repair-cal-02", "repair-cal-03", "repair-cal-04"],
  bars: 8,
  thinkingDepth: "standard",
});

const focus = new Set([
  "arrangement-regenerate",
  "arrangement-energy-arc",
  "harmony-regenerate",
  "harmony-voice-leading",
  "harmony-foundation",
  "harmony-journey",
  "harmony-cadence",
  "density-build",
  "density-thin",
]);

console.log("Phase 2 checkpoint 6 expanded diagnostics");
console.log(`overall=${Math.round(report.acceptanceRate * 100)}% attempts=${report.repairAttempts}`);
for (const strategy of report.byStrategy) {
  if (!focus.has(strategy.id)) continue;
  console.log("STRATEGY", JSON.stringify(strategy));
}
for (const attempt of report.attempts) {
  if (!focus.has(attempt.strategyId)) continue;
  console.log("ATTEMPT", JSON.stringify(attempt));
}
