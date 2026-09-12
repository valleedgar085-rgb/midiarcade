import fs from "node:fs";

const enginePath = new URL("../src/music-engine.js", import.meta.url);
let source = fs.readFileSync(enginePath, "utf8");
source = source.replaceAll('"density-precision-build"', '"density-build"');
source = source.replaceAll('"density-precision-thin"', '"density-thin"');
fs.writeFileSync(enginePath, source);
console.log("Preserved stable density repair diagnostic ids.");
