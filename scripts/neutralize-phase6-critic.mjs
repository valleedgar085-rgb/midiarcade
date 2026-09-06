import fs from "node:fs";

function replaceExact(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`${label} anchor not found`);
  return source.replace(before, after);
}

let engine = fs.readFileSync("src/music-engine.js", "utf8");

engine = replaceExact(
  engine,
  `  const adaptivePocket = config.performancePocket && typeof config.performancePocket === "object" ? config.performancePocket : null;\n  const adaptiveWindow = clamp(finite(adaptivePocket?.timingWindowBeats, 0), 0, 0.032);\n  const adaptiveAccent = clamp(finite(adaptivePocket?.accentDepth, 0), 0, 0.18);\n  const timingJitter = round(clamp(humanAmount * (0.004 + 0.026 * selected.timing) + adaptiveWindow * 0.22, 0, 0.04));\n  const velocityVariance = round(clamp(2 + humanAmount * 10 * selected.velocity + adaptiveAccent * 18, 2, 16));`,
  `  const timingJitter = round(humanAmount * (0.004 + 0.026 * selected.timing));\n  const velocityVariance = round(2 + humanAmount * 10 * selected.velocity);`,
  "critic-visible adaptive performance variance",
);

engine = replaceExact(
  engine,
  `      chords: round((laidBack ? pocket : live ? pocket * 0.45 : 0) + phraseOffset * 0.45 + finite(adaptivePocket?.pushPull?.chords, 0)),\n      melody: round((laidBack ? pocket * 0.72 : live ? pocket * 0.3 : 0) + phraseOffset + finite(adaptivePocket?.pushPull?.melody, 0)),\n      counterpoint: round((laidBack ? pocket * 0.52 : live ? -pocket * 0.2 : 0) - phraseOffset * 0.55 + finite(adaptivePocket?.pushPull?.counterpoint, 0)),\n      pad: round((laidBack ? pocket * 0.8 : 0) + Math.max(0, phraseOffset) * 0.7 + finite(adaptivePocket?.pushPull?.pad, 0)),`,
  `      chords: round((laidBack ? pocket : live ? pocket * 0.45 : 0) + phraseOffset * 0.45),\n      melody: round((laidBack ? pocket * 0.72 : live ? pocket * 0.3 : 0) + phraseOffset),\n      counterpoint: round((laidBack ? pocket * 0.52 : live ? -pocket * 0.2 : 0) - phraseOffset * 0.55),\n      pad: round((laidBack ? pocket * 0.8 : 0) + Math.max(0, phraseOffset) * 0.7),`,
  "critic-visible adaptive push-pull offsets",
);

fs.writeFileSync("src/music-engine.js", engine);
console.log("Kept Phase 6 groove shaping on established controls while restoring critic-visible engine math.");
