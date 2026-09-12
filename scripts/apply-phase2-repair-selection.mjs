import fs from "node:fs";

const enginePath = new URL("../src/music-engine.js", import.meta.url);
const testPath = new URL("../tests/producer-brain-repair-acceptance.test.mjs", import.meta.url);
let source = fs.readFileSync(enginePath, "utf8");
let tests = fs.readFileSync(testPath, "utf8");

function replaceOnce(text, from, to, label) {
  if (!text.includes(from)) throw new Error(`Missing ${label} anchor.`);
  return text.replace(from, to);
}

source = replaceOnce(
  source,
  `  if (!releasePreserved) reasons.push("release-gate-regression");\n  if (!melodicDialogue.preserved) reasons.push("melodic-dialogue-regression");\n  return {\n    version: 1,\n    accepted: reasons.length === 0,\n    dimension: dimension || null,`,
  `  if (!releasePreserved) reasons.push("release-gate-regression");\n  if (!melodDialogue.preserved) reasons.push("melodic-dialogue-regression");\n  const regressionReasons = reasons.filter((reason) => reason.includes("regression"));\n  const supportingGains = Object.keys(repairedSubscores)\n    .filter((name) => name !== dimension)\n    .map((name) => round(\n      clamp(finite(repairedSubscores[name], 70), 0, 100)\n        - clamp(finite(sourceSubscores[name], 70), 0, 100),\n    ));\n  const bestSupportingGain = Math.max(0, ...supportingGains);\n  const outcome = reasons.length\n    ? regressionReasons.length ? "rejected-regression" : "rejected-no-gain"\n    : (bestSupportingGain >= 1 ? "improved-balance" : "improved-target");\n  return {\n    version: 2,\n    accepted: reasons.length === 0,\n    outcome,\n    bestSupportingGain: round(bestSupportingGain),\n    dimension: dimension || null,`,
  "repair acceptance outcome",
);

const selector = `\nfunction repairAssessmentUtility(assessment) {\n  if (!assessment) return -Infinity;\n  const acceptance = assessment.acceptance ?? {};\n  return round(\n    Number(Boolean(acceptance.accepted)) * 1000\n      + Number(Boolean(assessment.repairedReleaseGate?.passed)) * 100\n      + finite(acceptance.weaknessGain, 0) * 4\n      + finite(acceptance.totalDelta, 0) * 2\n      + finite(acceptance.balanceDelta, 0)\n      + finite(acceptance.creativeFloorDelta, 0) * 0.5\n      - finite(acceptance.maxCriticalRegression, 0) * 1.5,\n  );\n}\n\n/**\n * Compare the already-generated surgical and whole-candidate repair options.\n * Accepted repairs always beat rejected repairs. When both are acceptable,\n * surgical locality wins close calls; a whole rewrite must be materially better\n * to justify touching more of the song.\n */\nexport function selectPreferredRepairAssessment(surgicalAssessment = null, wholeAssessment = null) {\n  if (!surgicalAssessment && !wholeAssessment) {\n    return { assessment: null, mode: null, reason: "no-repair-assessment", utilityDelta: 0 };\n  }\n  if (!surgicalAssessment) {\n    return {\n      assessment: wholeAssessment,\n      mode: "whole-candidate",\n      reason: "whole-only",\n      utilityDelta: null,\n    };\n  }\n  if (!wholeAssessment) {\n    return {\n      assessment: surgicalAssessment,\n      mode: "surgical-window",\n      reason: "surgical-only",\n      utilityDelta: null,\n    };\n  }\n\n  const surgicalAccepted = Boolean(surgicalAssessment.acceptance?.accepted);\n  const wholeAccepted = Boolean(wholeAssessment.acceptance?.accepted);\n  if (surgicalAccepted !== wholeAccepted) {\n    const chooseWhole = wholeAccepted;\n    return {\n      assessment: chooseWhole ? wholeAssessment : surgicalAssessment,\n      mode: chooseWhole ? "whole-candidate" : "surgical-window",\n      reason: "accepted-over-rejected",\n      utilityDelta: round(repairAssessmentUtility(wholeAssessment) - repairAssessmentUtility(surgicalAssessment)),\n    };\n  }\n\n  const surgicalUtility = repairAssessmentUtility(surgicalAssessment);\n  const wholeUtility = repairAssessmentUtility(wholeAssessment);\n  const utilityDelta = round(wholeUtility - surgicalUtility);\n  const wholeMateriallyBetter = utilityDelta > 2;\n  if (wholeMateriallyBetter) {\n    return {\n      assessment: wholeAssessment,\n      mode: "whole-candidate",\n      reason: wholeAccepted ? "whole-materially-better" : "whole-less-regressive",\n      utilityDelta,\n    };\n  }\n  return {\n    assessment: surgicalAssessment,\n    mode: "surgical-window",\n    reason: surgicalAccepted ? "surgical-locality-tiebreak" : "surgical-less-regressive",\n    utilityDelta,\n  };\n}\n\n`;
source = replaceOnce(
  source,
  `\nconst SONG_LEVEL_REPAIR_DIMENSIONS = new Set([`,
  `${selector}const SONG_LEVEL_REPAIR_DIMENSIONS = new Set([`,
  "repair assessment selector insertion",
);

source = replaceOnce(
  source,
  `    const surgicalAssessment = surgicalSong ? assessRepair(surgicalSong) : null;\n    let assessment = surgicalAssessment ?? assessRepair(wholeRepairSong);\n    let wholeFallbackUsed = false;\n    if (surgicalAssessment && !surgicalAssessment.acceptance.accepted) {\n      const wholeAssessment = assessRepair(wholeRepairSong);\n      if (wholeAssessment.acceptance.accepted) {\n        assessment = wholeAssessment;\n        wholeFallbackUsed = true;\n      }\n    }`,
  `    const surgicalAssessment = surgicalSong ? assessRepair(surgicalSong) : null;\n    const wholeAssessment = assessRepair(wholeRepairSong);\n    const repairSelection = selectPreferredRepairAssessment(surgicalAssessment, wholeAssessment);\n    const assessment = repairSelection.assessment ?? wholeAssessment;\n    const wholeFallbackUsed = Boolean(\n      surgicalAssessment\n      && !surgicalAssessment.acceptance.accepted\n      && wholeAssessment.acceptance.accepted\n      && assessment === wholeAssessment\n    );`,
  "live repair selection",
);

source = replaceOnce(
  source,
  `    candidate.repairFallback = {\n      surgicalAttempted: Boolean(surgicalAssessment),\n      surgicalAccepted: surgicalAssessment?.acceptance.accepted ?? null,\n      wholeFallbackUsed,\n    };`,
  `    candidate.repairFallback = {\n      surgicalAttempted: Boolean(surgicalAssessment),\n      surgicalAccepted: surgicalAssessment?.acceptance.accepted ?? null,\n      wholeAccepted: wholeAssessment.acceptance.accepted,\n      surgicalOutcome: surgicalAssessment?.acceptance.outcome ?? null,\n      wholeOutcome: wholeAssessment.acceptance.outcome ?? null,\n      wholeFallbackUsed,\n      selectedMode: repairSelection.mode,\n      selectionReason: repairSelection.reason,\n      selectionUtilityDelta: repairSelection.utilityDelta,\n    };`,
  "repair fallback diagnostics",
);

source = replaceOnce(
  source,
  `      accepted: acceptance.accepted,\n      dimension: acceptance.dimension,`,
  `      accepted: acceptance.accepted,\n      outcome: acceptance.outcome,\n      dimension: acceptance.dimension,`,
  "acceptance outcome history",
);

source = replaceOnce(
  source,
  `      surgicalAttempted: Boolean(surgicalAssessment),\n      surgicalAccepted: surgicalAssessment?.acceptance.accepted ?? null,\n      wholeFallbackUsed,\n      repairStrategyId:`,
  `      surgicalAttempted: Boolean(surgicalAssessment),\n      surgicalAccepted: surgicalAssessment?.acceptance.accepted ?? null,\n      wholeAccepted: wholeAssessment.acceptance.accepted,\n      wholeFallbackUsed,\n      selectedRepairMode: repairSelection.mode,\n      selectionReason: repairSelection.reason,\n      selectionUtilityDelta: repairSelection.utilityDelta,\n      repairStrategyId:`,
  "repair selection history",
);

tests = replaceOnce(
  tests,
  `  evaluateRepairAcceptance,\n  generateNew,`,
  `  evaluateRepairAcceptance,\n  generateNew,\n  selectPreferredRepairAssessment,`,
  "test import",
);

const helperAnchor = `function dialogueSong(counterpointStart) {\n  return {\n    tracks: [\n      {\n        id: "melody",\n        notes: [\n          { start: 0, duration: 1, pitch: 72 },\n          { start: 2, duration: 0.75, pitch: 74 },\n        ],\n      },\n      {\n        id: "counterpoint",\n        notes: [{ start: counterpointStart, duration: 0.4, pitch: 67 }],\n      },\n    ],\n  };\n}\n`;
const helperAddition = `${helperAnchor}\nfunction repairAssessment(overrides = {}, mode = "whole-candidate") {\n  return {\n    acceptance: {\n      accepted: true,\n      outcome: "improved-target",\n      weaknessGain: 4,\n      totalDelta: 0,\n      balanceDelta: 0,\n      creativeFloorDelta: 0,\n      maxCriticalRegression: 0,\n      ...overrides,\n    },\n    repairedReleaseGate: { passed: true },\n    song: { criticRepair: { mode } },\n  };\n}\n`;
tests = replaceOnce(tests, helperAnchor, helperAddition, "test repair assessment helper");

const insertionAnchor = `test("live Producer Brain repair auditing never commits a rejected targeted repair", () => {`;
const newTests = `test("repair acceptance publishes stable producer-facing outcomes", () => {\n  const source = evaluation(88, { motif: 52 });\n  const targetOnly = evaluateRepairAcceptance(\n    source,\n    evaluation(88, { motif: 57 }),\n    { weakestDimension: "motif", weakestScore: 52 },\n  );\n  assert.equal(targetOnly.outcome, "improved-target");\n  assert.equal(targetOnly.bestSupportingGain, 0);\n\n  const balanced = evaluateRepairAcceptance(\n    source,\n    evaluation(88.5, { motif: 57, performance: 86 }),\n    { weakestDimension: "motif", weakestScore: 52 },\n  );\n  assert.equal(balanced.outcome, "improved-balance");\n  assert.equal(balanced.bestSupportingGain, 2);\n\n  const noGain = evaluateRepairAcceptance(\n    source,\n    evaluation(88, { motif: 52.1 }),\n    { weakestDimension: "motif", weakestScore: 52 },\n  );\n  assert.equal(noGain.outcome, "rejected-no-gain");\n\n  const regression = evaluateRepairAcceptance(\n    source,\n    evaluation(88, { motif: 58, groove: 79 }),\n    { weakestDimension: "motif", weakestScore: 52 },\n  );\n  assert.equal(regression.outcome, "rejected-regression");\n});\n\ntest("repair selection keeps locality unless a whole repair is materially better", () => {\n  const surgical = repairAssessment({ weaknessGain: 4 }, "surgical-window");\n  const nearWhole = repairAssessment({ weaknessGain: 4.2, totalDelta: 0.2 });\n  const close = selectPreferredRepairAssessment(surgical, nearWhole);\n  assert.equal(close.mode, "surgical-window");\n  assert.equal(close.reason, "surgical-locality-tiebreak");\n\n  const strongerWhole = repairAssessment({ weaknessGain: 6, totalDelta: 1, balanceDelta: 1 });\n  const stronger = selectPreferredRepairAssessment(surgical, strongerWhole);\n  assert.equal(stronger.mode, "whole-candidate");\n  assert.equal(stronger.reason, "whole-materially-better");\n\n  const rejectedSurgical = repairAssessment({\n    accepted: false,\n    outcome: "rejected-regression",\n    weaknessGain: 5,\n    maxCriticalRegression: 5,\n  }, "surgical-window");\n  const acceptedWhole = repairAssessment({ weaknessGain: 2.5 });\n  const fallback = selectPreferredRepairAssessment(rejectedSurgical, acceptedWhole);\n  assert.equal(fallback.mode, "whole-candidate");\n  assert.equal(fallback.reason, "accepted-over-rejected");\n});\n\n${insertionAnchor}`;
tests = replaceOnce(tests, insertionAnchor, newTests, "new repair selection tests");

tests = replaceOnce(
  tests,
  `  assert.ok(repair.acceptanceHistory.every((entry) => typeof entry.accepted === "boolean"));`,
  `  assert.ok(repair.acceptanceHistory.every((entry) => typeof entry.accepted === "boolean"));\n  assert.ok(repair.acceptanceHistory.every((entry) => [\n    "improved-target",\n    "improved-balance",\n    "rejected-regression",\n    "rejected-no-gain",\n  ].includes(entry.outcome)));\n  assert.ok(repair.acceptanceHistory.every((entry) => typeof entry.selectionReason === "string"));`,
  "live repair history assertions",
);

fs.writeFileSync(enginePath, source);
fs.writeFileSync(testPath, tests);
console.log("Applied Phase 2 repair outcome and surgical-vs-whole selection policy.");
