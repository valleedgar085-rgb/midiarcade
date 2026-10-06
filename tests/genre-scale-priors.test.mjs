import test from "node:test";
import assert from "node:assert/strict";

import {
  GENRE_SCALE_PRIORS,
  MAX_GENRE_SCALE_BONUS,
  genreScalePalette,
  genreScalePriorBonus,
  genreScalePriorRank,
  normalizeGenreScalePriorId,
} from "../src/core/genre-scale-priors.js";

test("genre scale priors expose six ranked choices per researched genre", () => {
  for (const [genre, palette] of Object.entries(GENRE_SCALE_PRIORS)) {
    assert.equal(palette.length, 6, `${genre} should expose six scale choices`);
    assert.deepEqual(palette.map((entry) => entry.rank), [1, 2, 3, 4, 5, 6]);
  }
});

test("genre scale bonuses stay intentionally modest", () => {
  for (const palette of Object.values(GENRE_SCALE_PRIORS)) {
    for (const entry of palette) {
      assert.ok(entry.bonus > 0);
      assert.ok(entry.bonus <= MAX_GENRE_SCALE_BONUS);
    }
    assert.ok(palette[0].bonus > palette.at(-1).bonus);
  }
});

test("research rankings use current engine names where equivalents exist", () => {
  assert.deepEqual(
    genreScalePalette("jazz").map((entry) => entry.scale),
    ["dorian", "mixolydian", "major", "lydian", "altered", "melodicMinor"],
  );
  assert.deepEqual(
    genreScalePalette("metal").map((entry) => entry.scale),
    ["minor", "phrygian", "minorPentatonic", "harmonicMinor", "dorian", "phrygianDominant"],
  );
});

test("genre aliases normalize without forcing unrelated MIDI Arcade genres", () => {
  assert.equal(normalizeGenreScalePriorId("Latin Jazz"), "afroCubanLatinJazz");
  assert.equal(normalizeGenreScalePriorId("Metal"), "metal");
  assert.equal(normalizeGenreScalePriorId("Blues"), "blues");
  assert.equal(normalizeGenreScalePriorId("hip hop"), "hipHop");
  assert.deepEqual(genreScalePalette("hipHop"), []);
});

test("prior lookup is deterministic, soft, and neutral for unknown choices", () => {
  assert.equal(genreScalePriorBonus("pop", "major"), 0.08);
  assert.equal(genreScalePriorBonus("pop", "dorian"), 0.03);
  assert.equal(genreScalePriorBonus("pop", "altered"), 0);
  assert.equal(genreScalePriorBonus("hipHop", "minor"), 0);
  assert.equal(genreScalePriorRank("jazz", "altered"), 5);
  assert.equal(genreScalePriorRank("jazz", "blues"), null);
});


test("genre prior lookup ignores inherited object properties", () => {
  for (const unsupported of ["constructor", "toString", "__proto__"]) {
    assert.deepEqual(genreScalePalette(unsupported), []);
    assert.equal(genreScalePriorBonus(unsupported, "major"), 0);
    assert.equal(genreScalePriorRank(unsupported, "major"), null);
  }
});
