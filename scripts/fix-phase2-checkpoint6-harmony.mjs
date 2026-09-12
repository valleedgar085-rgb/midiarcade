import fs from "node:fs";

const enginePath = new URL("../src/music-engine.js", import.meta.url);
let source = fs.readFileSync(enginePath, "utf8");

const targetedOld = `  if (["separation", "motif"].includes(dimension)) return ["melody", "counterpoint"];\n  if (dimension === "voiceLeading") return ["chords"];\n  if (["harmonic", "harmonicJourney"].includes(dimension)) return ["bass", "chords"];\n  if (dimension === "cadence") return ["bass", "chords", "melody"];\n  if (diagnosis?.group === "harmony") return ["bass", "chords", "melody", "counterpoint", "pad"];`;
const targetedNew = `  if (["separation", "motif"].includes(dimension)) return ["melody", "counterpoint"];\n  if (diagnosis?.group === "harmony") return ["bass", "chords", "melody", "counterpoint", "pad"];`;
if (source.includes(targetedOld)) source = source.replace(targetedOld, targetedNew);

for (const [dimension, id] of [
  ["voiceLeading", "harmony-voice-leading"],
  ["harmonic", "harmony-foundation"],
  ["harmonicJourney", "harmony-journey"],
  ["cadence", "harmony-cadence"],
]) {
  const patterns = dimension === "harmonicJourney"
    ? [`  } else if (dimension === "${dimension}") {\n    id = "${id}";\n    trackIds = ["bass", "chords"];`]
    : dimension === "cadence"
      ? [`  } else if (dimension === "${dimension}") {\n    id = "${id}";\n    trackIds = ["bass", "chords", "melody"];`]
      : dimension === "voiceLeading"
        ? [`  } else if (dimension === "${dimension}") {\n    id = "${id}";\n    trackIds = ["chords"];`]
        : [`  } else if (dimension === "${dimension}") {\n    id = "${id}";\n    trackIds = ["bass", "chords"];`];
  for (const pattern of patterns) {
    if (source.includes(pattern)) {
      source = source.replace(pattern, `  } else if (dimension === "${dimension}") {\n    id = "${id}";\n    trackIds = ["bass", "chords", "melody", "counterpoint", "pad"];`);
    }
  }
}

const directOld = `  if (["storyArc", "tensionFollow"].includes(dimension)) return rebalanceRepairArrangementArc(sourceSong, dimension);\n  if (dimension === "voiceLeading") return smoothRepairVoiceLeading(sourceSong, window);\n  return null;`;
const directNew = `  if (["storyArc", "tensionFollow"].includes(dimension)) return rebalanceRepairArrangementArc(sourceSong, dimension);\n  return null;`;
if (source.includes(directOld)) source = source.replace(directOld, directNew);

const surgicalOld = `    let surgicalRepairSource = wholeRepairSong;\n    if (surgicalWindow && diagnosis.weakestDimension === "phraseResolution") {\n      surgicalRepairSource = reinforceRepairPhraseResolution(\n        sourceCandidate.song,\n        repairConfig,\n        surgicalWindow,\n      );\n      surgicalRepairSource.id = wholeRepairSong.id;\n      surgicalRepairSource.seed = wholeRepairSong.seed;\n      surgicalRepairSource.settings = clone(wholeRepairSong.settings ?? sourceCandidate.song.settings);\n      surgicalRepairSource.criticRepair = clone(wholeRepairSong.criticRepair);\n    }\n    const surgicalSong = surgicalWindow\n      ? applySurgicalRepairWindow(\n        sourceCandidate.song,\n        surgicalRepairSource,\n        repairConfig,\n        diagnosis,\n        sourceCandidate,\n        surgicalWindow,\n        wholeRepairSong.criticRepair?.repairStrategy,\n      )\n      : null;`;
const surgicalNew = `    let surgicalRepairSource = wholeRepairSong;\n    let surgicalRepairStrategy = wholeRepairSong.criticRepair?.repairStrategy ?? null;\n    if (surgicalWindow && diagnosis.weakestDimension === "phraseResolution") {\n      surgicalRepairSource = reinforceRepairPhraseResolution(\n        sourceCandidate.song,\n        repairConfig,\n        surgicalWindow,\n      );\n      surgicalRepairSource.id = wholeRepairSong.id;\n      surgicalRepairSource.seed = wholeRepairSong.seed;\n      surgicalRepairSource.settings = clone(wholeRepairSong.settings ?? sourceCandidate.song.settings);\n      surgicalRepairSource.criticRepair = clone(wholeRepairSong.criticRepair);\n    } else if (surgicalWindow && diagnosis.weakestDimension === "voiceLeading") {\n      surgicalRepairSource = smoothRepairVoiceLeading(sourceCandidate.song, surgicalWindow);\n      surgicalRepairSource.id = wholeRepairSong.id;\n      surgicalRepairSource.seed = wholeRepairSong.seed;\n      surgicalRepairSource.settings = clone(wholeRepairSong.settings ?? sourceCandidate.song.settings);\n      surgicalRepairSource.criticRepair = clone(wholeRepairSong.criticRepair);\n      surgicalRepairStrategy = {\n        ...(surgicalRepairStrategy ?? {}),\n        trackIds: ["chords"],\n      };\n    }\n    const surgicalSong = surgicalWindow\n      ? applySurgicalRepairWindow(\n        sourceCandidate.song,\n        surgicalRepairSource,\n        repairConfig,\n        diagnosis,\n        sourceCandidate,\n        surgicalWindow,\n        surgicalRepairStrategy,\n      )\n      : null;`;
if (!source.includes(surgicalOld) && !source.includes(surgicalNew)) {
  throw new Error("harmony surgical fallback anchor missing");
}
if (source.includes(surgicalOld)) source = source.replace(surgicalOld, surgicalNew);

fs.writeFileSync(enginePath, source);
console.log("Restored broad harmony fallback and isolated voice-leading precision to the surgical alternative.");
