import test from "node:test";
import assert from "node:assert/strict";
import { applyInstrumentMicroTiming } from "../src/core/groove-pocket-refinement.js";

test("applyInstrumentMicroTiming applies laidback snare and bass drag without crossing bar boundaries", () => {
  const song = {
    meta: { beatsPerBar: 4 },
    tracks: [
      { id: "drums", notes: [{ start: 1.0, pitch: 38, velocity: 100 }] }, // Snare at beat 1
      { id: "bass", notes: [{ start: 0.0, pitch: 36, velocity: 90 }] }, // Bass at beat 0
    ],
  };

  const updated = applyInstrumentMicroTiming(song, { genre: "neoSoul", laidBack: true });
  const drumNote = updated.tracks.find((t) => t.id === "drums").notes[0];
  const bassNote = updated.tracks.find((t) => t.id === "bass").notes[0];

  assert.equal(drumNote.start, 1.025);
  assert.equal(drumNote.microTimingShiftBeats, 0.025);
  assert.equal(bassNote.start, 0.015);
  assert.equal(bassNote.microTimingShiftBeats, 0.015);
});
