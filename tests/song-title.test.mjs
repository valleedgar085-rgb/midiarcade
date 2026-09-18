import assert from "node:assert/strict";
import test from "node:test";
import { deriveSongTitle } from "../src/core/song-title.js";

test("song titles are deterministic and preserve explicit titles", () => {
  const song = { seed: 42, genre: "trap", songDNA: { id: "dna-a", familyId: "family-a", identity: { genre: "trap", signatureBias: "groove", narrative: "lift-release" } } };
  assert.equal(deriveSongTitle(song), deriveSongTitle(song));
  assert.equal(deriveSongTitle({ ...song, title: "My Track" }), "My Track");
});

test("genre-aware vocabularies produce concise two-word names", () => {
  const trap = deriveSongTitle({ seed: 9, genre: "trap", songDNA: { id: "t", familyId: "tf", identity: { genre: "trap" } } });
  const ambient = deriveSongTitle({ seed: 9, genre: "ambient", songDNA: { id: "a", familyId: "af", identity: { genre: "ambient" } } });
  assert.match(trap, /^\S+ \S+$/);
  assert.match(ambient, /^\S+ \S+$/);
  assert.notEqual(trap, ambient);
});
