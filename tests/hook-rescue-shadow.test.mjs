import assert from "node:assert/strict";
import test from "node:test";
import { encodeMidiVerified } from "../src/music-engine.js";
import {
  inspectHookMutation, inspectHookExport, blindVariant,
} from "../scripts/lib/hook-rescue-shadow.mjs";

function makeSong() {
  return {
    id: "shadow-test",
    title: "Hook Shadow Fixture",
    genre: "rap",
    meta: {
      genre: "rap", tempo: 105, ppq: 480, beatsPerBar: 4,
      totalBeats: 16, timeSignature: [4, 4], key: "E", keyPc: 4,
      scale: "minor", scaleIntervals: [0, 2, 3, 5, 7, 8, 10],
    },
    structure: [
      { id: "chorus-1", name: "chorus", startBeat: 0, endBeat: 8 },
      { id: "chorus-2", name: "chorus", startBeat: 8, endBeat: 16 },
    ],
    harmony: [],
    tracks: [
      { id: "drums", channel: 9, program: 0,
        notes: [{ id: "kick", pitch: 36, start: 0, duration: 0.25, velocity: 92 }] },
      { id: "bass", channel: 1, program: 38,
        notes: [{ id: "bass", pitch: 40, start: 0, duration: 1, velocity: 84 }] },
      { id: "chords", channel: 2, program: 1,
        notes: [{ id: "chord", pitch: 64, start: 0, duration: 1, velocity: 75 }] },
      { id: "melody", channel: 3, program: 73,
        notes: [
          { id: "m0", pitch: 67, start: 8, duration: 0.25, velocity: 83 },
          { id: "m1", pitch: 69, start: 9, duration: 0.25, velocity: 85 },
        ] },
    ],
  };
}

test("pitch proposal changes one melodic note and exactly one verified MIDI event", () => {
  const source = makeSong();
  const before = structuredClone(source);
  const improved = structuredClone(source);
  improved.tracks[3].notes[1].pitch = 71;
  improved.tracks[3].notes[1].hookDevelopmentRole = "motif-contour-return";
  const change = inspectHookMutation(source, improved, "pitch");
  assert.equal(change.changedNotes, 1);
  const result = inspectHookExport(encodeMidiVerified(source), encodeMidiVerified(improved), "pitch");
  assert.equal(result.changedEvents, 1);
  assert.deepEqual(source, before);
});

test("rhythm proposal preserves pitch, note length, velocity, and unaffected tracks", () => {
  const source = makeSong();
  const proposed = structuredClone(source);
  proposed.tracks[3].notes[1].start += 0.125;
  proposed.tracks[3].notes[1].hookDevelopmentRole = "motif-rhythm-return";
  assert.equal(inspectHookMutation(source, proposed, "rhythm").changedNotes, 1);
  assert.equal(inspectHookExport(encodeMidiVerified(source), encodeMidiVerified(proposed), "rhythm").changedEvents, 1);
});

test("accidental bass changes, excessive shift and no-op proposal are rejected", () => {
  const source = makeSong();
  const bassChange = structuredClone(source);
  bassChange.tracks[1].notes[0].pitch += 2;
  assert.throws(() => inspectHookMutation(source, bassChange, "pitch"), /non-melody/);
  const farMove = structuredClone(source);
  farMove.tracks[3].notes[0].start += 1;
  assert.throws(() => inspectHookMutation(source, farMove, "rhythm"), /too large/);
  assert.throws(() => inspectHookMutation(source, structuredClone(source), "pitch"), /precisely one/);
});

test("blind labels repeat exactly for a fixed seed", () => {
  const left = blindVariant("rap-seed-A");
  assert.equal(left, blindVariant("rap-seed-A"));
  assert.ok(["A", "B"].includes(left));
});
