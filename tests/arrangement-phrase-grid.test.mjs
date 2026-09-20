import assert from "node:assert/strict";
import test from "node:test";

import { generateNew } from "../src/music-engine.js";

const GENRES = ["trap", "hipHop", "pop", "neoSoul"];
const TRANSITIONS = new Set(["intro", "prechorus", "build", "bridge", "breakdown", "outro"]);

test("Trap uses a verse-first, hook-led form", () => {
  const song = generateNew({
    genre: "trap",
    seed: "arrangement-phrase-grid-trap",
    bars: 32,
    professionalUpgrade: true,
    candidateCount: 1,
  });
  assert.deepEqual(
    song.structure.map((section) => section.name),
    ["intro", "verse", "prechorus", "chorus", "verse", "bridge", "chorus", "outro"],
  );
  assert.ok(song.structure.findIndex((section) => section.name === "verse") < song.structure.findIndex((section) => section.name === "chorus"));
});

test("long-form sections avoid odd phrase fragments across core genres", () => {
  for (const genre of GENRES) {
    const song = generateNew({
      genre,
      seed: `arrangement-phrase-grid-${genre}`,
      bars: 32,
      professionalUpgrade: true,
      candidateCount: 1,
    });
    for (const section of song.structure) {
      assert.equal(section.bars % 2, 0, `${genre}/${section.id} must use an even bar length`);
      if (!TRANSITIONS.has(section.name)) {
        assert.equal(section.bars % 4, 0, `${genre}/${section.id} must use a four-bar phrase unit`);
      }
    }
  }
});

test("phrase-grid arrangement remains deterministic", () => {
  const input = {
    genre: "trap",
    seed: "arrangement-phrase-grid-deterministic",
    bars: 32,
    professionalUpgrade: true,
    candidateCount: 1,
  };
  const first = generateNew(input);
  const second = generateNew(input);
  assert.deepEqual(first.structure, second.structure);
  assert.deepEqual(first.tracks, second.tracks);
});
