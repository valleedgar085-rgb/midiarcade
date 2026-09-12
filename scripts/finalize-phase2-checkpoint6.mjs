import fs from "node:fs";

const enginePath = new URL("../src/music-engine.js", import.meta.url);
const testPath = new URL("../tests/producer-brain-specialized-repair.test.mjs", import.meta.url);
let source = fs.readFileSync(enginePath, "utf8");
let tests = fs.readFileSync(testPath, "utf8");

// The expanded calibration proved the octave-only voice-leading surgical candidate
// never wins. Keep the proven whole harmony fallback and remove dead surgery.
const smoothStart = source.indexOf("function smoothRepairVoiceLeading(song, window) {");
const smoothEnd = source.indexOf("\nfunction directSpecializedRepairSource(", smoothStart);
if (smoothStart >= 0 && smoothEnd > smoothStart) {
  source = source.slice(0, smoothStart) + source.slice(smoothEnd + 1);
}

const voiceLeadingBranch = `    } else if (surgicalWindow && diagnosis.weakestDimension === "voiceLeading") {\n      surgicalRepairSource = smoothRepairVoiceLeading(sourceCandidate.song, surgicalWindow);\n      surgicalRepairSource.id = wholeRepairSong.id;\n      surgicalRepairSource.seed = wholeRepairSong.seed;\n      surgicalRepairSource.settings = clone(wholeRepairSong.settings ?? sourceCandidate.song.settings);\n      surgicalRepairSource.criticRepair = clone(wholeRepairSong.criticRepair);\n      surgicalRepairStrategy = {\n        ...(surgicalRepairStrategy ?? {}),\n        trackIds: ["chords"],\n      };\n    }\n`;
if (source.includes(voiceLeadingBranch)) {
  source = source.replace(voiceLeadingBranch, "    }\n");
}

const testAnchor = `test("song-level statistical weaknesses do not consume local surgical repair attempts", () => {`;
if (!tests.includes("checkpoint 6 precision arrangement arc improves tension without collateral regression")) {
  const additions = `test("checkpoint 6 precision arrangement arc improves tension without collateral regression", () => {\n  const song = generateNew({\n    genre: "trap",\n    seed: "repair-cal-02:trap:sparse",\n    bars: 8,\n    energy: 0.12,\n    complexity: 0.18,\n  });\n  const entry = song.meta?.scoreDetails?.criticRepair?.acceptanceHistory\n    ?.find((attempt) => attempt.repairStrategyId === "arrangement-energy-arc");\n\n  assert.ok(entry, "verified seed should expose arrangement-energy-arc repair");\n  assert.equal(entry.dimension, "tensionFollow");\n  assert.equal(entry.accepted, true);\n  assert.equal(entry.surgicalAttempted, false);\n  assert.ok(entry.weaknessGain >= 1);\n  assert.ok(entry.totalDelta >= 0);\n  assert.equal(entry.maxCriticalRegression, 0);\n});\n\ntest("checkpoint 6 density repair wins surgically without broad fallback", () => {\n  const song = generateNew({\n    genre: "jazz",\n    seed: "repair-cal-02:jazz:balanced",\n    bars: 8,\n    energy: 0.55,\n    complexity: 0.55,\n  });\n  const entry = song.meta?.scoreDetails?.criticRepair?.acceptanceHistory\n    ?.find((attempt) => attempt.dimension === "density");\n\n  assert.ok(entry, "verified seed should expose density repair");\n  assert.equal(entry.repairStrategyId, "density-build");\n  assert.equal(entry.accepted, true);\n  assert.equal(entry.surgicalAttempted, true);\n  assert.equal(entry.surgicalAccepted, true);\n  assert.equal(entry.wholeFallbackUsed, false);\n  assert.equal(entry.selectedRepairMode, "surgical-window");\n  assert.ok(entry.weaknessGain >= 1);\n  assert.ok(entry.surgicalWindow?.bars >= 2 && entry.surgicalWindow?.bars <= 8);\n});\n\ntest("checkpoint 6 harmony keeps the proven whole repair when surgery cannot improve the target", () => {\n  const song = generateNew({\n    genre: "drumBass",\n    seed: "repair-cal-01:drumBass:sparse",\n    bars: 8,\n    energy: 0.12,\n    complexity: 0.18,\n  });\n  const entry = song.meta?.scoreDetails?.criticRepair?.acceptanceHistory\n    ?.find((attempt) => attempt.repairStrategyId === "harmony-foundation");\n\n  assert.ok(entry, "verified seed should expose harmony foundation repair");\n  assert.equal(entry.dimension, "harmonic");\n  assert.equal(entry.accepted, true);\n  assert.equal(entry.surgicalAttempted, true);\n  assert.equal(entry.surgicalAccepted, false);\n  assert.equal(entry.wholeAccepted, true);\n  assert.equal(entry.wholeFallbackUsed, true);\n  assert.equal(entry.selectedRepairMode, "whole-candidate");\n  assert.ok(entry.weaknessGain >= 1);\n});\n\n${testAnchor}`;
  if (!tests.includes(testAnchor)) throw new Error("checkpoint 6 test insertion anchor missing");
  tests = tests.replace(testAnchor, additions);
}

fs.writeFileSync(enginePath, source);
fs.writeFileSync(testPath, tests);
console.log("Finalized checkpoint 6 and added permanent regression coverage.");
