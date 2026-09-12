import fs from "node:fs";

const path = new URL("../src/music-engine.js", import.meta.url);
let source = fs.readFileSync(path, "utf8");

const signatureOld = "function repairCandidateSong(sourceCandidate, diagnosis, seed, attempt, surgicalWindow = null) {";
const signatureNew = "function repairCandidateSong(sourceCandidate, diagnosis, seed, attempt, surgicalWindow = null, strategyWindow = surgicalWindow) {";
if (!source.includes(signatureOld)) throw new Error("Missing repairCandidateSong signature anchor.");
source = source.replace(signatureOld, signatureNew);

const strategyOld = `  const repairStrategy = createSpecializedRepairStrategy(\n    sourceCandidate,\n    diagnosis,\n    surgicalWindow,\n    baseConfig,\n  );`;
const strategyNew = `  const repairStrategy = createSpecializedRepairStrategy(\n    sourceCandidate,\n    diagnosis,\n    strategyWindow,\n    baseConfig,\n  );`;
if (!source.includes(strategyOld)) throw new Error("Missing specialized strategy window anchor.");
source = source.replace(strategyOld, strategyNew);

const wholeOld = "    const wholeRepairSong = repairCandidateSong(sourceCandidate, diagnosis, seed, attempt, null);";
const wholeNew = "    const wholeRepairSong = repairCandidateSong(sourceCandidate, diagnosis, seed, attempt, null, surgicalWindow);";
if (!source.includes(wholeOld)) throw new Error("Missing whole repair strategy context anchor.");
source = source.replace(wholeOld, wholeNew);

fs.writeFileSync(path, source);
console.log("Wired surgical window diagnostics into specialized repair strategy without extra generation.");
