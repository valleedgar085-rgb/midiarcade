import fs from "node:fs";

const path = new URL("../src/music-engine.js", import.meta.url);
let source = fs.readFileSync(path, "utf8");

function replaceOnce(from, to, label) {
  if (!source.includes(from)) throw new Error(`Missing ${label} anchor.`);
  source = source.replace(from, to);
}

function removeBetween(start, end, label) {
  const startIndex = source.indexOf(start);
  if (startIndex < 0) throw new Error(`Missing ${label} start anchor.`);
  const endIndex = source.indexOf(end, startIndex);
  if (endIndex < 0) throw new Error(`Missing ${label} end anchor.`);
  source = source.slice(0, startIndex) + source.slice(endIndex);
}

// The direct material experiment improved the 48-song repair matrix only from
// 8% to 9% and left memory at 0%. Remove it rather than keep low-yield engine
// complexity; the calibrated critic-aligned strategy from the previous pass stays.
removeBetween(
  "function copiedDrumNoteForBar(note, sourceBar, targetBar, barBeats) {",
  "function applySurgicalRepairWindow(sourceSong, repairedSong, config, diagnosis, sourceCandidate, window, repairStrategy = null) {",
  "low-yield direct repair material",
);
replaceOnce(
  "  applyDirectSurgicalRepairMaterial(song, window, repairStrategy);\n",
  "",
  "direct repair material call",
);

const routingHelpers = `const SONG_LEVEL_REPAIR_DIMENSIONS = new Set([
  "memory",
  "repetition",
  "drumVariety",
]);

function localTargetedRepairEligible(diagnosis = {}) {
  return !SONG_LEVEL_REPAIR_DIMENSIONS.has(String(diagnosis?.weakestDimension ?? ""));
}

`;
replaceOnce(
  "function runTargetedCriticRepair(candidates, {",
  routingHelpers + "function runTargetedCriticRepair(candidates, {",
  "repair routing helper insertion",
);

replaceOnce(
  "    acceptanceHistory: [],\n    targetReached:",
  "    acceptanceHistory: [],\n    skippedGlobalDimensions: [],\n    targetReached:",
  "repair summary skip diagnostics",
);

const loopStart = `  const attemptedGroups = [];
  for (
    let attempt = 0;
    attempt < search.repairAttempts && candidates.length < MAX_CANDIDATE_COUNT;
    attempt += 1
  ) {
    const sourceCandidate = rankCandidates(candidates)[0];
    const diagnosis = diagnoseCandidateRepair(sourceCandidate.evaluation, attemptedGroups);
    if (!diagnosis) {
      summary.reason = "no-repair-group";
      break;
    }
    attemptedGroups.push(diagnosis.group);
    const seed = candidateSeed(baseSeed, \`repair-\${diagnosis.group}\`, attempt);`;
const loopReplacement = `  const attemptedGroups = [];
  let attempt = 0;
  let diagnosticPasses = 0;
  while (
    attempt < search.repairAttempts
    && candidates.length < MAX_CANDIDATE_COUNT
    && diagnosticPasses < 8
  ) {
    const sourceCandidate = rankCandidates(candidates)[0];
    const diagnosis = diagnoseCandidateRepair(sourceCandidate.evaluation, attemptedGroups);
    if (!diagnosis) {
      summary.reason = "no-repair-group";
      break;
    }
    diagnosticPasses += 1;
    attemptedGroups.push(diagnosis.group);
    if (!localTargetedRepairEligible(diagnosis)) {
      summary.skippedGlobalDimensions.push({
        group: diagnosis.group,
        dimension: diagnosis.weakestDimension,
        score: diagnosis.weakestScore,
        reason: "song-level-search-owned",
      });
      continue;
    }
    const seed = candidateSeed(baseSeed, \`repair-\${diagnosis.group}\`, attempt);`;
replaceOnce(loopStart, loopReplacement, "targeted repair loop routing");

replaceOnce(
  `    summary.targetReached = candidateMeetsAdaptiveTarget(candidate, generation);
    if (summary.targetReached) {`,
  `    attempt += 1;
    summary.targetReached = candidateMeetsAdaptiveTarget(candidate, generation);
    if (summary.targetReached) {`,
  "repair attempt increment",
);

replaceOnce(
  `  if (!summary.reason) {
    summary.reason = candidates.length >= MAX_CANDIDATE_COUNT
      ? "candidate-budget-reached"
      : "repair-budget-reached";
  }`,
  `  if (!summary.reason) {
    summary.reason = candidates.length >= MAX_CANDIDATE_COUNT
      ? "candidate-budget-reached"
      : attempt >= search.repairAttempts
        ? "repair-budget-reached"
        : summary.skippedGlobalDimensions.length
          ? "song-level-weakness-search-owned"
          : "no-repair-group";
  }`,
  "repair routing completion reason",
);

fs.writeFileSync(path, source);
console.log("Applied Phase 2 global-vs-local repair routing and removed low-yield direct material experiment.");
