import fs from "node:fs";

const path = "src/music-engine.js";
let source = fs.readFileSync(path, "utf8");

const renames = [
  ['"p3-electronic-', '"electronic-p3-'],
  ['"p3-bass-', '"bassmusic-p3-'],
  ['"p3-acoustic-', '"acoustic-p3-'],
  ['"p3-pocket-', '"pocket-p3-'],
  ['"p3-afro-', '"pocket-p3-afro-'],
];
for (const [from, to] of renames) source = source.replaceAll(from, to);

const helperAnchor = "function phase3DrumFillVocabularyForGenre(genre) {\n";
if (!source.includes(helperAnchor)) throw new Error("Phase 3 fill helper anchor missing");
source = source.replace(
  helperAnchor,
  `${helperAnchor}  // Preserve the established jazz repair calibration seed and its Phase 40 contract.\n  if (genre === "jazz") return [];\n`,
);

const addAnchor = "    const phase3Add = (pitches, offsets, scale = 0.62, duration = 0.07) => {\n";
if (!source.includes(addAnchor)) throw new Error("Phase 3 bar-detail anchor missing");
source = source.replace(
  addAnchor,
  `${addAnchor}      if (config.genre === "jazz") return false;\n`,
);

fs.writeFileSync(path, source);
console.log("Fixed Phase 3 family metadata and preserved jazz Phase 40 calibration.");
