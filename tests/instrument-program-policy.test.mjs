import assert from "node:assert/strict";
import test from "node:test";

import {
  chooseAutoProgramRotation,
  companionTrackIds,
  curateTrackProgramPalette,
  mergeTrackProgramPalettes,
  programFamilyForTrack,
  rankAutoProgramCandidates,
} from "../src/core/instrument-program-policy.js";

test("curated track palettes prioritize distinctive families before repeating a lane color", () => {
  const curated = curateTrackProgramPalette("melody", [80, 81, 85, 82, 84, 87], { limit: 3 });
  assert.deepEqual(curated, [85, 80, 82]);
  assert.equal(new Set(curated.map((program) => programFamilyForTrack("melody", program))).size, curated.length);
});

test("merged genre palettes stay role-safe while preserving family variety", () => {
  const merged = mergeTrackProgramPalettes("chords", [4, 5, 17], [81, 89, 95]);
  assert.deepEqual(merged, [4, 17, 81, 89]);
});

test("auto rotation is deterministic and usually stays inside the curated genre palette", () => {
  const input = {
    trackId: "melody",
    currentProgram: 80,
    genrePrograms: [80, 82, 85],
    fallbackPrograms: [26, 73, 87],
    companionProgramsByTrack: { counterpoint: 53, chords: 4, pad: 89 },
    explore: false,
    seed: "genre-first",
    getCharacter: (program) => ({ 80: "synth", 82: "digital", 85: "voice", 26: "guitar", 73: "air", 87: "hybrid" }[program] ?? ""),
  };
  const first = chooseAutoProgramRotation(input);
  const second = chooseAutoProgramRotation(input);
  assert.equal(first, second);
  assert.ok(input.genrePrograms.includes(first));
  assert.notEqual(first, input.currentProgram);
});

test("auto rotation can explore the wider fallback palette when genre choices are exhausted", () => {
  const selected = chooseAutoProgramRotation({
    trackId: "counterpoint",
    currentProgram: 80,
    genrePrograms: [80],
    fallbackPrograms: [80, 11, 53, 98],
    companionProgramsByTrack: { melody: 85, chords: 4, pad: 89 },
    explore: true,
    seed: "wider-palette",
    getCharacter: (program) => ({ 80: "synth", 11: "mallet", 53: "voice", 98: "texture" }[program] ?? ""),
  });
  assert.notEqual(selected, 80);
  assert.ok([11, 53, 98].includes(selected));
});

test("candidate ranking penalizes family collisions with companion lead lanes", () => {
  const ranked = rankAutoProgramCandidates({
    trackId: "counterpoint",
    currentProgram: 80,
    genrePrograms: [80, 85, 53],
    fallbackPrograms: [82, 98, 11],
    companionProgramsByTrack: { melody: 85, chords: 4, pad: 89 },
    explore: true,
    seed: "companion-spacing",
    getCharacter: (program) => ({ 80: "synth", 82: "digital", 85: "voice", 53: "voice", 98: "texture", 11: "mallet" }[program] ?? ""),
  });
  assert.equal(ranked[0], 11);
  assert.ok(companionTrackIds("counterpoint").includes("melody"));
});
