import assert from "node:assert/strict";
import test from "node:test";
import { deriveSongTitle } from "../src/core/song-title.js";

test("song titles are deterministic and preserve explicit titles", () => {
  const song = { seed: 42, genre: "trap", songDNA: { id: "dna-a", familyId: "family-a", identity: { genre: "trap", signatureBias: "groove", narrative: "lift-release" } } };
  assert.equal(deriveSongTitle(song), deriveSongTitle(song));
  assert.equal(deriveSongTitle({ ...song, title: "My Track" }), "My Track");
});

test("different musical identities can select different title structures", () => {
  const titles = new Set(Array.from({ length: 24 }, (_, index) => deriveSongTitle({
    seed: index,
    genre: index % 2 ? "trap" : "ambient",
    songDNA: { id: `dna-${index}`, familyId: `family-${index}`, identity: { genre: index % 2 ? "trap" : "ambient", signatureBias: ["hook", "groove", "harmony", "dialogue"][index % 4], narrative: index % 3 ? "lift-release" : "slow-burn" } },
  })));
  assert.ok(titles.size >= 12, `expected broad naming variety, got ${titles.size}`);
  assert.ok([...titles].some((title) => title.split(/\s+/).length === 1), "expected one-word title structure");
  assert.ok([...titles].some((title) => title.split(/\s+/).length >= 3), "expected phrase title structure");
});

test("genre remains part of deterministic identity", () => {
  const dna = { id: "same", familyId: "same-family", identity: { signatureBias: "groove", narrative: "lift-release" } };
  assert.notEqual(deriveSongTitle({ seed: 9, genre: "trap", songDNA: { ...dna, identity: { ...dna.identity, genre: "trap" } } }), deriveSongTitle({ seed: 9, genre: "ambient", songDNA: { ...dna, identity: { ...dna.identity, genre: "ambient" } } }));
});
