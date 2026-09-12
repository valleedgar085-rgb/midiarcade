import fs from "node:fs";

const path = new URL("../src/music-engine.js", import.meta.url);
let source = fs.readFileSync(path, "utf8");
const original = source;

function replaceExact(before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) {
    if (source.includes(after)) return;
    throw new Error(`Phase 2 repair-acceptance codemod could not find ${label}`);
  }
  if (source.indexOf(before, index + before.length) >= 0) {
    throw new Error(`Phase 2 repair-acceptance codemod found multiple ${label} blocks`);
  }
  source = source.slice(0, index) + after + source.slice(index + before.length);
}

replaceExact(
`function candidateMeetsAdaptiveTarget(candidate, generation) {
  const balance = evaluateCandidateBalance(candidate?.evaluation);
`,
`function candidateMeetsAdaptiveTarget(candidate, generation) {
  if (candidate?.repairAccepted === false) return false;
  const balance = evaluateCandidateBalance(candidate?.evaluation);
`,
"rejected repair adaptive guard",
);

replaceExact(
`function rankCandidates(candidates) {
  return [...candidates].sort(
`,
`function rankCandidates(candidates) {
  return [...candidates]
    .filter((candidate) => candidate?.repairAccepted !== false)
    .sort(
`,
"repair eligibility ranking filter",
);

replaceExact(
`        repairGroup: song.criticRepair?.group ?? null,
        repairSourceCandidate: song.criticRepair?.sourceCandidate ?? null,
`,
`        repairGroup: song.criticRepair?.group ?? null,
        repairSourceCandidate: song.criticRepair?.sourceCandidate ?? null,
        repairAccepted: candidate.repairAccepted ?? null,
        repairAcceptanceReasons: clone(song.criticRepair?.acceptance?.reasons ?? []),
`,
"candidate repair acceptance diagnostics",
);

replaceExact(
`      attempts: criticRepair.attempts,
      groups: criticRepair.groups,
      selectedGroup: selected.repair?.group ?? null,
`,
`      attempts: criticRepair.attempts,
      accepted: criticRepair.accepted ?? 0,
      rejected: criticRepair.rejected ?? 0,
      groups: criticRepair.groups,
      selectedGroup: selected.repair?.group ?? null,
`,
"idea phase repair acceptance counts",
);

replaceExact(
`function runTargetedCriticRepair(candidates, {
`,
`export function evaluateRepairAcceptance(
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
}

function runTargetedCriticRepair(candidates, {
`,
"repair acceptance evaluator",
);

replaceExact(
`    attempts: 0,
    groups: [],
    targetReached: candidates.some((candidate) => candidateMeetsAdaptiveTarget(candidate, generation)),
`,
`    attempts: 0,
    accepted: 0,
    rejected: 0,
    groups: [],
    acceptanceHistory: [],
    targetReached: candidates.some((candidate) => candidateMeetsAdaptiveTarget(candidate, generation)),
`,
"repair summary acceptance fields",
);

replaceExact(
`    song.criticRepair.totalScoreBefore = sourceCandidate.evaluation.score;
    song.criticRepair.totalScoreAfter = evaluation.score;
    const candidate = {
      index: candidates.length,
      song,
      evaluation,
      novelty,
      repair: song.criticRepair,
      targetTrack: sourceCandidate.targetTrack ?? null,
      contextTracks: sourceCandidate.contextTracks ?? null,
      selectionScore: candidateSelectionScore(evaluation, novelty, generation),
    };
    candidates.push(candidate);
    summary.attempts += 1;
    summary.groups.push(diagnosis.group);
    summary.targetReached = candidateMeetsAdaptiveTarget(candidate, generation);
`,
`    song.criticRepair.totalScoreBefore = sourceCandidate.evaluation.score;
    song.criticRepair.totalScoreAfter = evaluation.score;
    const repairedReleaseGate = evaluateSongReleaseGate(song, evaluation);
    const acceptance = evaluateRepairAcceptance(
      sourceCandidate.evaluation,
      evaluation,
      diagnosis,
      {
        sourceReleasePassed: candidateReleaseGate(sourceCandidate).passed,
        repairedReleasePassed: repairedReleaseGate.passed,
      },
    );
    song.criticRepair.acceptance = acceptance;
    const candidate = {
      index: candidates.length,
      song,
      evaluation,
      novelty,
      repair: song.criticRepair,
      repairAccepted: acceptance.accepted,
      releaseGate: repairedReleaseGate,
      targetTrack: sourceCandidate.targetTrack ?? null,
      contextTracks: sourceCandidate.contextTracks ?? null,
      selectionScore: candidateSelectionScore(evaluation, novelty, generation),
    };
    candidates.push(candidate);
    summary.attempts += 1;
    summary.groups.push(diagnosis.group);
    if (acceptance.accepted) summary.accepted += 1;
    else summary.rejected += 1;
    summary.acceptanceHistory.push({
      attempt: attempt + 1,
      group: diagnosis.group,
      sourceCandidate: sourceCandidate.index,
      accepted: acceptance.accepted,
      dimension: acceptance.dimension,
      weaknessGain: acceptance.weaknessGain,
      totalDelta: acceptance.totalDelta,
      maxCriticalRegression: acceptance.maxCriticalRegression,
      reasons: clone(acceptance.reasons),
    });
    summary.targetReached = candidateMeetsAdaptiveTarget(candidate, generation);
`,
"repair acceptance wiring",
);

if (source === original) {
  console.log("Phase 2 repair-acceptance codemod: no changes required.");
  process.exit(0);
}

fs.writeFileSync(path, source);
console.log(`Phase 2 repair-acceptance codemod updated src/music-engine.js (${original.length} -> ${source.length} bytes).`);
