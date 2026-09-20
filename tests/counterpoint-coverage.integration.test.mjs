import assert from "node:assert/strict";
import test from "node:test";

import { runGenerationRequest } from "../src/core/generation-api.js";

function generate(genre) {
  return runGenerationRequest("new", {
    config: {
      seed: "counter-cover-1",
      genre,
      bars: 32,
      energy: 0.68,
      complexity: 0.62,
      variation: 0.5,
      evolution: 0.62,
      tracks: { counterpoint: { density: 0.38 } },
    },
  }).song;
}

function activeSections(song) {
  const counterpoint = song.tracks.find((track) => track.id === "counterpoint")?.notes ?? [];
  return song.structure
    .filter((section) => ["verse", "chorus", "bridge", "drop", "solo"].includes(section.name))
    .map((section) => ({
      name: section.name,
      notes: counterpoint.filter((note) => note.start >= section.startBeat && note.start < section.endBeat),
    }));
}

test("counterpoint keeps deterministic answer coverage in active sections", () => {
  for (const genre of ["hipHop", "trap", "pop"]) {
    const song = generate(genre);
    const repeated = generate(genre);
    assert.deepEqual(song, repeated, `${genre}: counterpoint must remain deterministic`);
    for (const section of activeSections(song)) {
      assert.ok(section.notes.length > 0, `${genre} ${section.name}: expected a bounded counterline answer`);
    }
  }
});
