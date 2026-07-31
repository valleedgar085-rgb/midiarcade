import assert from "node:assert/strict";
import test from "node:test";
import { coverArtworkDataUrl, coverArtworkFinish, createCoverArtworkSvg } from "../src/cover-art.js";

const song = {
  seed: "cover-proof",
  title: "Neon Break Line",
  genre: "synthwave",
  meta: { genreLabel: "Synthwave", key: "D", scale: "dorian" },
};

test("cover artwork is deterministic, safe, and can produce bounded visual variants", () => {
  const original = createCoverArtworkSvg(song);
  assert.equal(original, createCoverArtworkSvg(song));
  assert.notEqual(original, createCoverArtworkSvg(song, { variation: 1 }));
  assert.match(original, /data-cover-finish="original"/);
  assert.match(createCoverArtworkSvg(song, { variation: 1 }), /data-cover-finish="matte"/);
  assert.equal(coverArtworkFinish(5).id, "original");
  const originalIdentity = original.match(/MIDI ARCADE · ORIGINAL \d+/)?.[0];
  assert.ok(originalIdentity);
  assert.match(createCoverArtworkSvg(song, { variation: 4 }), new RegExp(originalIdentity));
  assert.match(original, /^<svg/);
  assert.match(original, /Neon Break/);
  assert.match(coverArtworkDataUrl(song), /^data:image\/svg\+xml/);
  assert.doesNotMatch(createCoverArtworkSvg({ ...song, title: "<script>alert(1)</script>" }), /<script>/);
});
