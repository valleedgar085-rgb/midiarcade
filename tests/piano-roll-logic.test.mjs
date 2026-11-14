import assert from "node:assert/strict";
import test from "node:test";
import {
  hasPianoRollOnset,
  pianoRollPointToNote,
} from "../src/ui/piano-roll-logic.js";

test("grid hit testing snaps a touch to the selected section and pitch row", () => {
  const hit = pianoRollPointToNote({
    clientX: 202, clientY: 156, left: 100, top: 100,
    beatWidth: 64, rowHeight: 22, rows: [72, 71, 70, 69],
    startBeat: 16, endBeat: 32, grid: 0.25,
  });
  assert.deepEqual(hit, { pitch: 70, start: 17.5 });
});

test("grid hit testing never draws past the selected section", () => {
  const hit = pianoRollPointToNote({
    clientX: 4000, clientY: 1000, left: 100, top: 100,
    beatWidth: 64, rowHeight: 22, rows: [60, 59],
    startBeat: 4, endBeat: 8, grid: 0.5,
  });
  assert.deepEqual(hit, { pitch: 59, start: 7.5 });
});

test("grid hit testing rejects invalid coordinates or geometry", () => {
  assert.equal(pianoRollPointToNote({
    clientX: NaN, clientY: 10, left: 0, top: 0,
    beatWidth: 64, rowHeight: 22, rows: [60],
    startBeat: 0, endBeat: 4, grid: 0.25,
  }), null);
  assert.equal(pianoRollPointToNote({
    clientX: 10, clientY: 10, left: 0, top: 0,
    beatWidth: 0, rowHeight: 22, rows: [60],
    startBeat: 0, endBeat: 4, grid: 0.25,
  }), null);
  assert.equal(pianoRollPointToNote({
    clientX: 10, clientY: 10, left: 0, top: 0,
    beatWidth: 64, rowHeight: 22, rows: [60],
    startBeat: 0, endBeat: 0.1, grid: 0.25,
  }), null);
});

test("drawing a note avoids double-tap duplicates without erasing existing notes", () => {
  const notes = [
    { pitch: 60, start: 4.016, duration: 0.5, velocity: 96 },
    { note: 62, time: 5.0, duration: 0.25, velocity: 100 },
  ];
  assert.equal(hasPianoRollOnset(notes, 60, 4, 0.25), true);
  assert.equal(hasPianoRollOnset(notes, 62, 5, 0.25), true);
  assert.equal(hasPianoRollOnset(notes, 60, 4.5, 0.25), false);
  assert.equal(hasPianoRollOnset(notes, 64, 4, 0.25), false);
  assert.deepEqual(notes[0], { pitch: 60, start: 4.016, duration: 0.5, velocity: 96 });
});
