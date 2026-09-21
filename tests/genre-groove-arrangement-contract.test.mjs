import assert from "node:assert/strict";
import test from "node:test";

import { generateNew } from "../src/music-engine.js";

function kicks(song) {
  return song.tracks.find((track) => track.id === "drums").notes
    .filter((note) => [35, 36].includes(Math.round(note.pitch)));
}

function kickFingerprint(song) {
  return kicks(song)
    .map((note) => `${Math.floor(note.start / 4)}:${(note.start % 4).toFixed(2)}`)
    .join("|");
}

test("half-time songs establish the verse before the first earned hook", () => {
  for (const genre of ["trap", "drill"]) {
    const song = generateNew({ genre, bars: 32, seed: `verse-first-${genre}`, candidateCount: 1 });
    const names = song.structure.map((section) => section.name);
    assert.ok(names.indexOf("verse") < names.indexOf("chorus"), `${genre} must establish before payoff`);
    assert.ok(names.lastIndexOf("chorus") > names.indexOf("bridge"), `${genre} must return to its hook after contrast`);
  }
});

test("genre-native kick density stays bounded while seeds retain distinct pockets", () => {
  const limits = { ambient: 7, jazz: 9, hipHop: 9, trap: 9, house: 8, funk: 9 };
  for (const [genre, maximum] of Object.entries(limits)) {
    const songs = ["a", "b", "c"].map((seed) => generateNew({
      genre,
      bars: 16,
      seed: `native-pocket-${genre}-${seed}`,
      candidateCount: 1,
      variation: 0.78,
      professionalUpgrade: true,
    }));
    for (const song of songs) {
      assert.ok(kicks(song).length / 16 <= maximum, `${genre} kick writing must keep breathable identity`);
    }
    assert.equal(new Set(songs.map(kickFingerprint)).size, songs.length, `${genre} seeds must keep distinct pockets`);
  }
});

test("long special-form genres expose more than one coherent arrangement route", () => {
  for (const genre of ["trap", "loFiHipHop", "jazz", "ambient", "country", "rock", "funk"]) {
    const forms = ["a", "b", "c", "d", "e", "f"].map((seed) => generateNew({
      genre,
      bars: 32,
      seed: `long-form-${genre}-${seed}`,
      candidateCount: 1,
    }).structure.map((section) => section.name).join(">"));
    assert.ok(new Set(forms).size >= 2, `${genre} must expose multiple long-form routes`);
  }
});
