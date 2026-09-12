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
  assert.equal(guide.chord.symbol, "G13");
  assert.equal(guide.chord.roman, "IV");
  assert.deepEqual(guide.chord.notes, ["G", "B", "D", "F", "E"]);
});

test("scale guide preserves legacy fallbacks for sparse songs", () => {
  assert.deepEqual(getScaleChordGuide(null), {
    key: "C",
    mode: "minor",
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
