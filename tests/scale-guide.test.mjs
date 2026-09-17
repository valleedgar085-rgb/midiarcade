import assert from "node:assert/strict";
import test from "node:test";
import { getScaleChordGuide } from "../src/core/scale-guide.js";

test("scale guide resolves active harmony and mode-safe scale notes", () => {
  const song = {
    global: { key: "D", mode: "dorian" },
    harmony: [
      { startBeat: 0, duration: 4, symbol: "Dm9", roman: "i", quality: "minor9", notes: ["D", "F", "A", "C", "E"] },
      { startBeat: 4, duration: 4, symbol: "G13", roman: "IV", quality: "dominant13", notes: ["G", "B", "D", "F", "E"] },
    ],
  };

  const guide = getScaleChordGuide(song, 5);
  assert.deepEqual(guide.scaleNotes, ["D", "E", "F", "G", "A", "B", "C"]);
  assert.deepEqual(guide.scalePitchClasses, [2, 4, 5, 7, 9, 11, 0]);
  assert.equal(guide.chord.symbol, "G13");
  assert.equal(guide.chord.roman, "IV");
  assert.deepEqual(guide.chord.notes, ["G", "B", "D", "F", "E"]);
});

test("scale guide preserves legacy fallbacks for sparse songs", () => {
  assert.deepEqual(getScaleChordGuide(null), {
    key: "C",
    mode: "minor",
    scaleIntervals: [0, 2, 3, 5, 7, 8, 10],
    scalePitchClasses: [0, 2, 3, 5, 7, 8, 10],
    scaleNotes: ["C", "D", "D#", "F", "G", "G#", "A#"],
    chord: {
      symbol: "C",
      roman: "i",
      quality: "triad",
      notes: ["C"],
    },
  });

  const nested = getScaleChordGuide({
    meta: { key: "A", mode: "harmonicMinor" },
    harmony: [{ chord: { symbol: "E7", roman: "V", quality: "dominant", notes: ["E", "G#", "B", "D"] } }],
  });
  assert.equal(nested.chord.symbol, "E7");
  assert.deepEqual(nested.scaleNotes, ["A", "B", "C", "D", "E", "F", "G#"]);
});

test("scale guide honors stored scale intervals and nested global key metadata for extended modes", () => {
  const guide = getScaleChordGuide({
    global: { key: { tonic: "F#", mode: "wholeTone" } },
    meta: { scale: "wholeTone", scaleIntervals: [0, 2, 4, 6, 8, 10] },
    harmony: [{ startBeat: 0, duration: 4, symbol: "F#7#11", roman: "I", notes: ["F#", "A#", "C", "E"] }],
  });
  assert.equal(guide.key, "F#");
  assert.equal(guide.mode, "wholeTone");
  assert.deepEqual(guide.scaleIntervals, [0, 2, 4, 6, 8, 10]);
  assert.deepEqual(guide.scalePitchClasses, [6, 8, 10, 0, 2, 4]);
  assert.deepEqual(guide.scaleNotes, ["F#", "G#", "A#", "C", "D", "E"]);
});

test("scale guide falls back to mode intervals when stored scale metadata is malformed", () => {
  const guide = getScaleChordGuide({
    global: { key: { tonic: "E", mode: "phrygian" } },
    meta: { scaleIntervals: ["bad", null] },
  });
  assert.deepEqual(guide.scaleIntervals, [0, 1, 3, 5, 7, 8, 10]);
  assert.deepEqual(guide.scaleNotes, ["E", "F", "G", "A", "B", "C", "D"]);
});

test("scale guide normalizes valid stored interval sets before using them", () => {
  const guide = getScaleChordGuide({
    global: { key: { tonic: "C", mode: "major" } },
    meta: { scaleIntervals: [7, 2, 0, 11, 7, 4] },
  });
  assert.deepEqual(guide.scaleIntervals, [0, 2, 4, 7, 11]);
  assert.deepEqual(guide.scalePitchClasses, [0, 2, 4, 7, 11]);
  assert.deepEqual(guide.scaleNotes, ["C", "D", "E", "G", "B"]);
});

test("scale guide normalizes flat and lowercase tonic spellings from stored metadata", () => {
  const guide = getScaleChordGuide({
    global: { key: { tonic: "gb", mode: "major" } },
  });
  assert.equal(guide.key, "F#");
  assert.deepEqual(guide.scaleNotes, ["F#", "G#", "A#", "B", "C#", "D#", "F"]);
});

test("scale guide normalizes stored mode aliases before resolving intervals", () => {
  const guide = getScaleChordGuide({
    global: { key: { tonic: "C", mode: "whole_tone" } },
  });
  assert.equal(guide.mode, "wholeTone");
  assert.deepEqual(guide.scaleIntervals, [0, 2, 4, 6, 8, 10]);
});
