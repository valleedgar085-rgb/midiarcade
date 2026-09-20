import assert from "node:assert/strict";
import test from "node:test";

import { runGenerationRequest } from "../src/core/generation-api.js";

function generate(genre, overrides = {}) {
  return runGenerationRequest("new", {
    config: {
      seed: `predrop-${genre}`,
      genre,
      bars: 32,
      energy: 0.8,
      complexity: 0.72,
      variation: 0.7,
      evolution: 0.8,
      ...overrides,
    },
  }).song;
}

function punctuation(song) {
  return song.tracks.find((track) => track.id === "drums")?.notes
    .filter((note) => note.preDropPunctuation || String(note.rhythmicFeature ?? "").startsWith("pre-drop-"))
    .map(({ start, pitch, velocity, rhythmicFeature }) => ({ start, pitch, velocity, rhythmicFeature })) ?? [];
}

test("Trap and Hip-Hop use bounded deterministic pre-drop punctuation", () => {
  for (const genre of ["trap", "hipHop"]) {
    const song = generate(genre);
    const repeated = generate(genre);
    const notes = punctuation(song);
    assert.ok(notes.length >= 3 && notes.length <= 8, `${genre}: expected one or two bounded punctuation figures`);
    assert.ok(notes.some((note) => note.rhythmicFeature === "pre-drop-hat-burst"));
    assert.ok(notes.some((note) => note.rhythmicFeature === "pre-drop-snare-pickup"));
    assert.deepEqual(notes, punctuation(repeated), `${genre}: punctuation must be deterministic`);
  }
});

test("Pre-drop punctuation stays off when drum fills or evolution are zero", () => {
  for (const genre of ["trap", "hipHop"]) {
    assert.deepEqual(punctuation(generate(genre, { drumFills: 0 })), []);
    assert.deepEqual(punctuation(generate(genre, { evolution: 0 })), []);
  }
});
