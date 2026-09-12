import fs from "node:fs";

const enginePath = new URL("../src/music-engine.js", import.meta.url);
let source = fs.readFileSync(enginePath, "utf8");
source = source.replaceAll('"density-precision-build"', '"density-build"');
source = source.replaceAll('"density-precision-thin"', '"density-thin"');
source = source.replace(
  `    trackIds = direction > 0\n      ? ["chords", "pad", "counterpoint"]\n      : ["pad", "counterpoint", "chords"];`,
  `    trackIds = direction > 0\n      ? ["bass", "chords", "counterpoint"]\n      : ["bass", "counterpoint", "pad"];`,
);
source = source.replaceAll(
  `(repaired.tracks ?? []).filter((track) => allowed.has(track.id))`,
  `(repaired.tracks ?? []).filter((track) => allowed.has(track.id) && track.id !== "bass")`,
);
fs.writeFileSync(enginePath, source);
console.log("Preserved stable density repair ids and surgical lane contract.");
