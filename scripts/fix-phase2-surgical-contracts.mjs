import fs from "node:fs";

const path = new URL("../src/music-engine.js", import.meta.url);
let source = fs.readFileSync(path, "utf8");

const windowsOld = `  const scored = windows.map((window) => ({\n    ...window,\n    focusScore: surgicalWindowDimensionScore(window, diagnosis),\n  }));`;
const windowsNew = `  const eligibleWindows = windows.filter((window) => (\n    window.endBar - window.startBar >= 2 - 1e-6\n    && window.endBar - window.startBar <= 8 + 1e-6\n  ));\n  if (!eligibleWindows.length) return null;\n  const scored = eligibleWindows.map((window) => ({\n    ...window,\n    focusScore: surgicalWindowDimensionScore(window, diagnosis),\n  }));`;
if (!source.includes(windowsOld)) throw new Error("Missing surgical window scoring anchor.");
source = source.replace(windowsOld, windowsNew);

const interlockOld = `  } else {\n    song.harmony = clone(sourceSong.harmony ?? []);\n  }\n  song.meta = { ...sourceSong.meta, ideaFingerprint: null };`;
const interlockNew = `  } else {\n    song.harmony = clone(sourceSong.harmony ?? []);\n  }\n  const sourceInterlock = clone(sourceSong.generationInterlock ?? repairedSong.generationInterlock ?? {});\n  song.generationInterlock = {\n    ...sourceInterlock,\n    version: 2,\n    reconciliation: {\n      phase: 40,\n      repairGroup: diagnosis.group,\n      source: "actual-repaired-song",\n    },\n  };\n  const surgicalNotesById = Object.fromEntries(\n    song.tracks.map((track) => [track.id, track.notes ?? []]),\n  );\n  const reconnected = applyGenerationInterlocks(\n    surgicalNotesById,\n    song.generationInterlock,\n    song.structure,\n    config,\n    { adjustVelocity: false },\n  );\n  song.tracks = song.tracks.map((track) => ({\n    ...track,\n    notes: reconnected[track.id] ?? track.notes,\n  }));\n  song.meta = { ...sourceSong.meta, ideaFingerprint: null };`;
if (!source.includes(interlockOld)) throw new Error("Missing surgical interlock anchor.");
source = source.replace(interlockOld, interlockNew);

fs.writeFileSync(path, source);
console.log("Fixed surgical window minimum and Phase-40 interlock reconciliation.");
