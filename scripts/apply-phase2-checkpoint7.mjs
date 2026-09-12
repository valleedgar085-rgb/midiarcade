import fs from "node:fs";

const enginePath = new URL("../src/music-engine.js", import.meta.url);
let source = fs.readFileSync(enginePath, "utf8");

const routedMarker = `const SONG_LEVEL_REPAIR_DIMENSIONS = new Set([\n  "memory",\n  "repetition",\n  "drumVariety",\n  "stageInterlock",\n]);`;
if (source.includes(routedMarker) && source.includes("resolutionValue: Number(chordTone) * 0.32")) {
  console.log("Phase 2 checkpoint 7 already applied.");
  process.exit(0);
}

const cadenceOld = `    const candidates = pitchClasses.map((pitchClass, priority) => {\n      const pitch = nearestRepairPitch(landing.pitch, [pitchClass]);\n      return {\n        pitch,\n        priority,\n        collisions: collisionCount(pitch, currentDuration),\n        distance: Math.abs(pitch - landing.pitch),\n      };\n    }).sort((left, right) => (\n      left.collisions - right.collisions\n      || left.priority - right.priority\n      || left.distance - right.distance\n      || left.pitch - right.pitch\n    ));`;
const cadenceNew = `    const candidates = pitchClasses.map((pitchClass, priority) => {\n      const pitch = nearestRepairPitch(landing.pitch, [pitchClass]);\n      const pitchClassAtLanding = mod(pitch, 12);\n      const chordTone = Boolean(chord?.tones?.includes(pitchClassAtLanding));\n      const tonicCandidate = pitchClassAtLanding === tonic;\n      return {\n        pitch,\n        priority,\n        collisions: collisionCount(pitch, currentDuration),\n        resolutionValue: Number(chordTone) * 0.32 + Number(tonicCandidate) * 0.18,\n        distance: Math.abs(pitch - landing.pitch),\n      };\n    }).sort((left, right) => (\n      left.collisions - right.collisions\n      || right.resolutionValue - left.resolutionValue\n      || left.priority - right.priority\n      || left.distance - right.distance\n      || left.pitch - right.pitch\n    ));`;
if (!source.includes(cadenceOld)) throw new Error("checkpoint 7 cadence candidate anchor missing");
source = source.replace(cadenceOld, cadenceNew);

const routingOld = `const SONG_LEVEL_REPAIR_DIMENSIONS = new Set([\n  "memory",\n  "repetition",\n  "drumVariety",\n]);`;
if (!source.includes(routingOld)) throw new Error("checkpoint 7 song-level routing anchor missing");
source = source.replace(routingOld, routedMarker);

fs.writeFileSync(enginePath, source);
console.log("Applied Phase 2 checkpoint 7 cadence scoring and stage-interlock search routing.");
