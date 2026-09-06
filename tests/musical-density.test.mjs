import assert from "node:assert/strict";
import test from "node:test";
import { measureMusicalDensity } from "../src/core/musical-density.js";

test("audible density counts rhythm attacks while grouping chord and pad stacks", () => {
  const song = {
    meta: { bars: 2 },
    tracks: [
      {
        id: "drums",
        notes: [
          { start: 0, duration: 0.1, velocity: 100 },
          { start: 0, duration: 0.1, velocity: 80 },
          { start: 1, duration: 0.1, velocity: 95 },
        ],
      },
      {
        id: "bass",
        notes: [
          { start: 0, duration: 0.8, velocity: 90 },
          { start: 1, duration: 0.8, velocity: 90 },
        ],
      },
      {
        id: "chords",
        notes: [48, 52, 55].flatMap((pitch) => [
          { pitch, start: 0, duration: 1, velocity: 75 },
          { pitch, start: 1.02, duration: 1, velocity: 75 },
        ]),
      },
      {
        id: "pad",
        settings: { mute: true },
        notes: [{ start: 0, duration: 2, velocity: 70 }],
      },
    ],
  };

  const result = measureMusicalDensity(song);
  assert.equal(result.totalEvents, 7);
  assert.equal(result.eventsPerBar, 3.5);
  assert.deepEqual(result.perTrackEvents, { drums: 3, bass: 2, chords: 2, pad: 0 });
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.perTrackEvents));
});

test("audible density derives a safe bar count and ignores invalid silent notes", () => {
  const result = measureMusicalDensity({
    structure: [{ startBar: 0, bars: 4 }],
    tracks: [{
      id: "melody",
      notes: [
        { start: 0, duration: 1, velocity: 90 },
        { start: Number.NaN, duration: 1, velocity: 90 },
        { start: 1, duration: 0, velocity: 90 },
        { start: 2, duration: 1, velocity: 0 },
      ],
    }],
  });

  assert.equal(result.bars, 4);
  assert.equal(result.totalEvents, 1);
  assert.equal(result.eventsPerBar, 0.25);
});
