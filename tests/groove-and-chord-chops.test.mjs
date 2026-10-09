import test from "node:test";
import assert from "node:assert/strict";
import { generateNew, SCALES } from "../src/music-engine.js";
import { applyModalInterchange, applySecondaryDominants } from "../src/core/advanced-harmony.js";

test("expanded scales are defined and frozen", () => {
  assert.ok(SCALES.neapolitanMajor);
  assert.ok(SCALES.neapolitanMinor);
  assert.ok(SCALES.hungarianMajor);
  assert.ok(SCALES.prometheus);
  assert.ok(SCALES.augmented);
  assert.deepEqual(SCALES.neapolitanMajor, [0, 1, 3, 5, 7, 9, 11]);
  assert.deepEqual(SCALES.prometheus, [0, 2, 4, 6, 9, 10]);
});

test("applyModalInterchange handles minor mode borrowing deterministically", () => {
  const minorProg = [0, 3, 4, 5];
  const borrowed1 = applyModalInterchange(minorProg, "minor", "seed-1");
  const borrowed2 = applyModalInterchange(minorProg, "minor", "seed-1");
  assert.deepEqual(borrowed1, borrowed2);
  assert.equal(borrowed1.length, minorProg.length);
});

test("applySecondaryDominants transforms progressions deterministically", () => {
  const prog = [0, 5, 1, 4];
  const transformed1 = applySecondaryDominants(prog, "seed-2");
  const transformed2 = applySecondaryDominants(prog, "seed-2");
  assert.deepEqual(transformed1, transformed2);
  assert.equal(transformed1.length, prog.length);
});

test("generateNew produces unexpected chord chops for Hip-Hop with high surprise/energy", () => {
  const song = generateNew({
    genre: "hipHop",
    seed: "hiphop-chops-test-seed",
    surprise: 0.6,
    energy: 0.8,
  });
  const chordTrack = song.tracks.find((t) => t.id === "chords");
  assert.ok(chordTrack);
  assert.ok(Array.isArray(chordTrack.notes));
  const chops = chordTrack.notes.filter((n) => n.rhythmicFeature === "chord-chop");
  assert.ok(chops.length > 0, "Expected at least one unexpected chord chop note in Hip-Hop");
  for (const chop of chops) {
    assert.equal(chop.genrePhrase, "unexpected-chop");
    assert.ok(chop.duration <= 0.25, "Chord chop should be short / staccato");
  }
});

test("song generation remains 100% deterministic across seeds", () => {
  const songA = generateNew({ genre: "loFiHipHop", seed: "deterministic-check-100" });
  const songB = generateNew({ genre: "loFiHipHop", seed: "deterministic-check-100" });
  assert.deepEqual(songA.tracks, songB.tracks);
  assert.deepEqual(songA.harmony, songB.harmony);
});
