import fs from "node:fs";

const path = new URL("../src/music-engine.js", import.meta.url);
let source = fs.readFileSync(path, "utf8");
const startMarker = "export function evaluateRepairAcceptance(";
const endMarker = "function runTargetedCriticRepair(candidates, {";
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0 || end <= start) {
  throw new Error("could not isolate repair acceptance section");
}

const canonical = `export function evaluateRepairAcceptance(
  sourceEvaluation = {},
  repairedEvaluation = {},
  diagnosis = {},
  { sourceReleasePassed = null, repairedReleasePassed = null } = {},
) {
  const dimension = String(diagnosis?.weakestDimension ?? "");
  const sourceSubscores = sourceEvaluation?.subscores ?? {};
  const repairedSubscores = repairedEvaluation?.subscores ?? {};
  const weakestScoreBefore = clamp(
    finite(sourceSubscores[dimension], diagnosis?.weakestScore ?? 0),
    0,
    100,
  );
  const weakestScoreAfter = clamp(
    finite(repairedSubscores[dimension], weakestScoreBefore),
    0,
    100,
  );
  const weaknessGain = round(weakestScoreAfter - weakestScoreBefore);
  const totalDelta = round(
    finite(repairedEvaluation?.score, 0) - finite(sourceEvaluation?.score, 0),
  );
  const sourceBalance = evaluateCandidateBalance(sourceEvaluation);
  const repairedBalance = evaluateCandidateBalance(repairedEvaluation);
  const balanceDelta = repairedBalance.balanceScore - sourceBalance.balanceScore;
  const creativeFloorDelta = repairedBalance.creativeFloor - sourceBalance.creativeFloor;
  const criticalDimensions = ["harmonic", "groove", "separation", "production", "genreAuthenticity"];
  const criticalRegressions = Object.fromEntries(
    criticalDimensions.map((name) => [
      name,
      round(Math.max(
        0,
        clamp(finite(sourceSubscores[name], 70), 0, 100)
          - clamp(finite(repairedSubscores[name], 70), 0, 100),
      )),
    ]),
  );
  const maxCriticalRegression = Math.max(0, ...Object.values(criticalRegressions));
  const sourceQuality = qualityGateForEvaluation(sourceEvaluation);
  const repairedQuality = qualityGateForEvaluation(repairedEvaluation);
  const scaleSafetyPreserved = !sourceQuality.scaleSafe || repairedQuality.scaleSafe;
  const phase9Preserved = !sourceQuality.passed || repairedQuality.passed;
  const releasePreserved = sourceReleasePassed !== true || repairedReleasePassed === true;
  const thresholds = {
    minimumWeaknessGain: 0.5,
    maximumTotalRegression: 1,
    maximumBalanceRegression: 2,
    maximumCreativeFloorRegression: 2,
    maximumCriticalRegression: 3,
  };
  const reasons = [];
  if (!dimension) reasons.push("missing-diagnosis");
  if (weaknessGain < thresholds.minimumWeaknessGain) reasons.push("weakness-not-improved");
  if (totalDelta < -thresholds.maximumTotalRegression) reasons.push("total-score-regression");
  if (balanceDelta < -thresholds.maximumBalanceRegression) reasons.push("balance-regression");
  if (creativeFloorDelta < -thresholds.maximumCreativeFloorRegression) reasons.push("creative-floor-regression");
  if (maxCriticalRegression > thresholds.maximumCriticalRegression) reasons.push("critical-dimension-regression");
  if (!scaleSafetyPreserved) reasons.push("scale-safety-regression");
  if (!phase9Preserved) reasons.push("quality-gate-regression");
  if (!releasePreserved) reasons.push("release-gate-regression");
  return {
    version: 1,
    accepted: reasons.length === 0,
    dimension: dimension || null,
    weakestScoreBefore: round(weakestScoreBefore),
    weakestScoreAfter: round(weakestScoreAfter),
    weaknessGain,
    totalDelta,
    balanceDelta,
    creativeFloorDelta,
    maxCriticalRegression,
    criticalRegressions,
    scaleSafetyPreserved,
    phase9Preserved,
    releasePreserved,
    thresholds,
    reasons,
  };
}`;

const replacement = `${canonical}\n\n`;
const next = source.slice(0, start) + replacement + source.slice(end);
if (next === source) {
  console.log("Repair acceptance section already canonical.");
  process.exit(0);
}
fs.writeFileSync(path, next);
console.log("Rewrote repair acceptance section atomically.");
