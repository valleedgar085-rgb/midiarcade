import fs from "node:fs";
import { execFileSync } from "node:child_process";

const enginePath = new URL("../src/music-engine.js", import.meta.url);
let source = fs.readFileSync(enginePath, "utf8");

const diagnosticsAnchor = `      maxCriticalRegression: acceptance.maxCriticalRegression,\n      repairMode: song.criticRepair?.mode ?? "whole-candidate",`;
const diagnosticsReplacement = `      maxCriticalRegression: acceptance.maxCriticalRegression,\n      criticalRegressions: clone(acceptance.criticalRegressions ?? {}),\n      balanceDelta: acceptance.balanceDelta,\n      creativeFloorDelta: acceptance.creativeFloorDelta,\n      weakestScoreBefore: acceptance.weakestScoreBefore,\n      weakestScoreAfter: acceptance.weakestScoreAfter,\n      repairMode: song.criticRepair?.mode ?? "whole-candidate",`;
if (!source.includes(diagnosticsAnchor)) throw new Error("cadence diagnostic anchor missing");
source = source.replace(diagnosticsAnchor, diagnosticsReplacement);

const repairAnchor = `  const config = specializedRepairConfig(baseConfig, repairStrategy);\n  const arrangementRepair = diagnosis.group === "arrangement";`;
const repairReplacement = `  const config = specializedRepairConfig(baseConfig, repairStrategy);\n  if (repairStrategy.dimension === "phraseResolution" && surgicalWindow) {\n    const directCadence = reinforceRepairPhraseResolution(sourceSong, config, surgicalWindow);\n    directCadence.id = "song-" + hashSeed(String(sourceSong.id ?? sourceSong.seed) + "|" + seed + "|phrase-cadence-precision").toString(36);\n    directCadence.seed = seed;\n    directCadence.settings = clone(sourceSong.settings ?? publicSettings(config));\n    directCadence.title = sourceSong.title;\n    directCadence.precisionRepair = {\n      ...(directCadence.precisionRepair ?? {}),\n      cadence: { version: 1, windowId: surgicalWindow.id },\n    };\n    directCadence.criticRepair = {\n      phase: 20,\n      version: 1,\n      status: "awaiting-critic",\n      attempt: attempt + 1,\n      group: diagnosis.group,\n      weakestDimension: diagnosis.weakestDimension,\n      weakestScoreBefore: diagnosis.weakestScore,\n      sourceCandidate: sourceCandidate.index,\n      repairStrategy: specializedRepairSummary(repairStrategy),\n    };\n    return applySurgicalRepairWindow(\n      sourceSong,\n      directCadence,\n      config,\n      diagnosis,\n      sourceCandidate,\n      surgicalWindow,\n      repairStrategy,\n    );\n  }\n  const arrangementRepair = diagnosis.group === "arrangement";`;
if (!source.includes(repairAnchor)) throw new Error("cadence precision repair anchor missing");
source = source.replace(repairAnchor, repairReplacement);
fs.writeFileSync(enginePath, source);

execFileSync(process.execPath, [
  "--test",
  "tests/producer-brain-specialized-repair.test.mjs",
  "tests/producer-brain-repair-acceptance.test.mjs",
  "tests/producer-brain-surgical-repair.test.mjs",
  "tests/music-engine.test.mjs",
], { stdio: "inherit" });

const { generateNew } = await import(`../src/music-engine.js?cadence=${Date.now()}`);
const genres = ["techno", "drumBass", "jazz", "hipHop", "trap", "popRadio", "house", "afrobeats"];
const profiles = [
  { id: "sparse", energy: 0.12, complexity: 0.18 },
  { id: "balanced", energy: 0.55, complexity: 0.55 },
  { id: "dense", energy: 0.88, complexity: 0.82 },
];
const seeds = ["repair-cal-01", "repair-cal-02", "repair-cal-03", "repair-cal-04"];
const phrase = [];
for (const genre of genres) {
  for (const profile of profiles) {
    for (const seed of seeds) {
      const song = generateNew({
        genre,
        seed: `${seed}:${genre}:${profile.id}`,
        bars: 8,
        energy: profile.energy,
        complexity: profile.complexity,
      });
      for (const entry of song.meta?.scoreDetails?.criticRepair?.acceptanceHistory ?? []) {
        if (entry.repairStrategyId !== "phrase-cadence") continue;
        phrase.push({ genre, seed, profile: profile.id, ...entry });
      }
    }
  }
}
const accepted = phrase.filter((entry) => entry.accepted);
console.log(`Phrase cadence attempts: ${phrase.length}`);
console.log(`Phrase cadence accepted: ${accepted.length}/${phrase.length} (${Math.round(accepted.length / Math.max(1, phrase.length) * 100)}%)`);
console.log(`Accepted average weakness gain: ${accepted.length ? (accepted.reduce((sum, entry) => sum + Number(entry.weaknessGain ?? 0), 0) / accepted.length).toFixed(2) : "0.00"}`);
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
console.log("Critical regression summary:", JSON.stringify(criticalCounts));
for (const row of phrase) console.log(JSON.stringify(row));
