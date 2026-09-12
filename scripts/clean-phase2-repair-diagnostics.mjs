import fs from "node:fs";

const path = new URL("../src/music-engine.js", import.meta.url);
let source = fs.readFileSync(path, "utf8");
const sectionStart = source.indexOf("candidateScores: candidates.map");
const sectionEnd = source.indexOf("    }),\n  };", sectionStart);
if (sectionStart < 0 || sectionEnd < 0) {
  throw new Error("Could not isolate candidate score diagnostics section.");
}

const pair = `        repairAccepted: candidate.repairAccepted ?? null,\n        repairAcceptanceReasons: clone(song.criticRepair?.acceptance?.reasons ?? []),\n`;
let section = source.slice(sectionStart, sectionEnd);
let count = section.split(pair).length - 1;
if (count < 1) throw new Error("Repair acceptance diagnostics pair is missing.");
while (section.includes(pair + pair)) section = section.replace(pair + pair, pair);
const remaining = section.split(pair).length - 1;
if (remaining !== 1) {
  throw new Error(`Expected exactly one repair diagnostics pair after cleanup; found ${remaining}.`);
}
if (count === 1) {
  console.log("Repair diagnostics are already unique.");
  process.exit(0);
}
source = source.slice(0, sectionStart) + section + source.slice(sectionEnd);
fs.writeFileSync(path, source);
console.log(`Collapsed ${count} repeated repair diagnostics pairs to one.`);
