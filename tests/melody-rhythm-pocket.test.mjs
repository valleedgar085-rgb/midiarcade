import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateMelodyRhythmPocket,
  refineMelodyRhythmPocket,
} from "../src/core/melody-rhythm-pocket.js";

function fixture(genre = "hipHop") {
  return {
    genre,
    meta: { genre, beatsPerBar: 4, totalBeats: 8 },
    structure: [
      { id: "verse", name: "verse", startBeat: 0, endBeat: 4, bars: 1 },
      { id: "chorus", name: "chorus", startBeat: 4, endBeat: 8, bars: 1 },
    ],
    grooveConductor: {
      bars: [
        { bar: 0, spaces: [0.75] },
        { bar: 1, spaces: [0.75] },
      ],
    },
    tracks: [
      {
        id: "drums",
        notes: [
          { pitch: 36, start: 0, duration: 0.1 },
          { pitch: 38, start: 1, duration: 0.1 },
          { pitch: 36, start: 2, duration: 0.1 },
          { pitch: 38, start: 3, duration: 0.1 },
          { pitch: 36, start: 4, duration: 0.1 },
          { pitch: 38, start: 5, duration: 0.1 },
        ],
      },
      {
        id: "bass",
        notes: [
          { pitch: 40, start: 0, duration: 0.5 },
          { pitch: 43, start: 1, duration: 0.5 },
          { pitch: 40, start: 4, duration: 0.5 },
          { pitch: 43, start: 5, duration: 0.5 },
        ],
      },
      {
        id: "melody",
        notes: [
          { pitch: 67, start: 1, duration: 0.5, velocity: 90 },
          { pitch: 69, start: 2.5, duration: 0.5, velocity: 88 },
          { pitch: 71, start: 5, duration: 0.5, velocity: 92 },
          { pitch: 72, start: 7, duration: 0.5, velocity: 95, resolutionRole: "cadence" },
        ],
      },
    ],
  };
}

test("melody pocket critic is deterministic and read-only", () => {
  const source = fixture();
  const before = structuredClone(source);
  const first = evaluateMelodyRhythmPocket(source);
  const second = evaluateMelodyRhythmPocket(source);

  assert.deepEqual(source, before);
  assert.deepEqual(first, second);
  assert.equal(first.mode, "read-only");
  assert.equal(first.repairs, 0);
  assert.ok(first.diagnostics.snareCollisions >= 2);
});

test("hip-hop melody pocket repair moves only unprotected melody timing", () => {
  const source = fixture("hipHop");
  const protectedStart = source.tracks.find((track) => track.id === "melody").notes[3].start;
  const result = refineMelodyRhythmPocket(source);

  assert.equal(result.accepted, true);
  assert.ok(result.changedNotes >= 1);
  assert.ok(result.after.diagnostics.collisionRatio < result.before.diagnostics.collisionRatio);

  const melody = result.song.tracks.find((track) => track.id === "melody").notes;
  const cadence = melody.find((note) => note.resolutionRole === "cadence");
  assert.equal(cadence.start, protectedStart);
  assert.ok(melody.filter((note) => note.melodyPocketRole === "rhythm-space-repair")
    .every((note) => Math.abs(note.melodyPocketShiftBeats) <= 0.25));
});

test("melody pocket repair never changes pitch duration or velocity", () => {
  const source = fixture("neoSoul");
  const before = source.tracks.find((track) => track.id === "melody").notes
    .map(({ pitch, duration, velocity }) => ({ pitch, duration, velocity }));
  const result = refineMelodyRhythmPocket(source);
  const after = result.song.tracks.find((track) => track.id === "melody").notes
    .map(({ pitch, duration, velocity }) => ({ pitch, duration, velocity }));

  assert.deepEqual(after, before);
});

test("house pocket repair stays micro-bounded", () => {
  const result = refineMelodyRhythmPocket(fixture("house"));
  for (const note of result.song.tracks.find((track) => track.id === "melody").notes) {
    if (note.melodyPocketShiftBeats == null) continue;
    assert.ok(Math.abs(note.melodyPocketShiftBeats) <= 0.0625 + 1e-9);
  }
});
