import fs from "node:fs";

const enginePath = new URL("../src/music-engine.js", import.meta.url);
let source = fs.readFileSync(enginePath, "utf8");
const anchor = `      maxCriticalRegression: acceptance.maxCriticalRegression,\n      repairMode: song.criticRepair?.mode ?? "whole-candidate",`;
const replacement = `      maxCriticalRegression: acceptance.maxCriticalRegression,\n      criticalRegressions: clone(acceptance.criticalRegressions ?? {}),\n      balanceDelta: acceptance.balanceDelta,\n      creativeFloorDelta: acceptance.creativeFloorDelta,\n      weakestScoreBefore: acceptance.weakestScoreBefore,\n      weakestScoreAfter: acceptance.weakestScoreAfter,\n      repairMode: song.criticRepair?.mode ?? "whole-candidate",`;
if (!source.includes(anchor)) throw new Error("cadence diagnostic anchor missing");
source = source.replace(anchor, replacement);
fs.writeFileSync(enginePath, source);

const { runRepairEffectivenessBenchmark } = await import(`../src/repair-effectiveness-benchmark.js?cadence=${Date.now()}`);
const report = runRepairEffectivenessBenchmark({
  genres: ["techno", "drumBass", "jazz", "hipHop", "trap", "popRadio", "house", "afrobeats"],
  seeds: ["repair-cal-01", "repair-cal-02", "repair-cal-03", "repair-cal-04"],
  bars: 8,
  thinkingDepth: "standard",
});
const phrase = report.attempts.filter((entry) => entry.strategyId === "phrase-cadence");
console.log(`Phrase cadence attempts: ${phrase.length}`);
for (const row of phrase) {
  console.log(JSON.stringify(row));
}
const criticalCounts = {};
for (const row of phrase.filter((entry) => !entry.accepted)) {
  for (const [name, value] of Object.entries(row.criticalRegressions ?? {})) {
    if (Number(value) <= 0) continue;
    criticalCounts[name] ??= { count: 0, total: 0, max: 0 };
    criticalCounts[name].count += 1;
    criticalCounts[name].total += Number(value);
    criticalCounts[name].max = Math.max(criticalCounts[name].max, Number(value));
  }
}
console.log("Critical regression summary:", criticalCounts);
