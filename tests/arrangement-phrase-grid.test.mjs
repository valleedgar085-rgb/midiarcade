import assert from "node:assert/strict";
import test from "node:test";

import { generateNew } from "../src/music-engine.js";

const GENRES = ["hipHop", "pop", "neoSoul"];
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

test("the final peak hook keeps the melody foreground while preserving feature rotation", () => {
  for (const genre of ["trap", "hipHop", "pop", "neoSoul"]) {
    const song = generateNew({
      genre,
      seed: `arrangement-peak-hook-${genre}`,
      bars: 32,
      professionalUpgrade: true,
      candidateCount: 1,
    });
    const peak = song.songBlueprint.sectionPlans.find((plan) => plan.role === "peak");
    const scene = song.songBlueprint.producerIntent.scenes.find((entry) => entry.sectionId === peak?.sectionId);
    assert.ok(peak && ["chorus", "drop"].includes(peak.sectionName));
    assert.equal(scene?.foregroundTrack, "melody", `${genre} final payoff must return the hook`);
  }
});
