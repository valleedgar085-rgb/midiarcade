import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateCompositionPocketLock,
  refineCompositionPocketLock,
} from "../src/core/composition-pocket-lock.js";

function fixture() {
  return {
    genre: "hipHop",
    meta: { genre: "hipHop", beatsPerBar: 4, totalBeats: 8 },
    structure: [
      { id: "verse", startBeat: 0, endBeat: 4, bars: 1 },
      { id: "chorus", startBeat: 4, endBeat: 8, bars: 1 },
    ],
    grooveConductor: {
      bars: [
        {
          bar: 0,
          sectionId: "verse",
          anchors: [0, 2],
          snarePulses: [1, 3],
          bassPulses: [0, 1.5, 2.5],
          leadPulses: [0.5, 1.5, 2.5, 3.5],
          spaces: [3.75],
        },
        {
          bar: 1,
          sectionId: "chorus",
          anchors: [0, 2],
          snarePulses: [1, 3],
          bassPulses: [0, 1.5, 2.5],
          leadPulses: [0.5, 1.5, 2.5, 3.5],
          spaces: [3.75],
        },
      ],
    },
    tracks: [
      {
        id: "drums",
        notes: [
          { pitch: 36, start: 0, duration: 0.1, velocity: 105 },
          { pitch: 38, start: 1, duration: 0.1, velocity: 100 },
          { pitch: 36, start: 2, duration: 0.1, velocity: 105 },
          { pitch: 38, start: 3, duration: 0.1, velocity: 100 },
          { pitch: 36, start: 4, duration: 0.1, velocity: 105 },
          { pitch: 38, start: 5, duration: 0.1, velocity: 100 },
        ],
      },
      {
        id: "bass",
        notes: [
          { id: "b1", pitch: 36, start: 0.11, duration: 0.6, velocity: 92 },
          { id: "b2", pitch: 38, start: 1.5, duration: 0.5, velocity: 88 },
          { id: "b3", pitch: 41, start: 4.12, duration: 0.6, velocity: 90 },
        ],
      },
      {
        id: "melody",
        notes: [
          { id: "m1", pitch: 64, start: 1, duration: 0.35, velocity: 88 },
          { id: "m2", pitch: 67, start: 2.5, duration: 0.35, velocity: 92 },
          { id: "m3", pitch: 69, start: 4.5, duration: 0.4, velocity: 94, phraseAnchor: true },
        ],
      },
    ],
  };
}

test("composition pocket evaluator is deterministic and read-only", () => {
  const song = fixture();
  const before = structuredClone(song);
  const first = evaluateCompositionPocketLock(song);
  const second = evaluateCompositionPocketLock(song);

  assert.deepEqual(song, before);
  assert.deepEqual(first, second);
  assert.equal(first.mode, "read-only");
  assert.ok(Number.isFinite(first.score));
  assert.ok(first.metrics.bassCompared > 0);
  assert.ok(first.metrics.melodyCompared > 0);
});

test("composition pocket relocks nearby bass notes to Groove DNA without changing musical content", () => {
  const song = fixture();
  const before = structuredClone(song);
  const result = refineCompositionPocketLock(song);

  assert.deepEqual(song, before, "source song must remain untouched");
  assert.equal(result.accepted, true, JSON.stringify(result));
  const bass = result.song.tracks.find((track) => track.id === "bass").notes;
  assert.equal(bass[0].start, 0);
  assert.equal(bass[2].start, 4);
  for (const [index, note] of bass.entries()) {
    const source = before.tracks.find((track) => track.id === "bass").notes[index];
    assert.equal(note.pitch, source.pitch);
    assert.equal(note.duration, source.duration);
    assert.equal(note.velocity, source.velocity);
  }
  assert.ok(result.after.metrics.bassGrooveAlignment > result.before.metrics.bassGrooveAlignment);
});

test("composition pocket prefers a legal Groove DNA lead pulse for melody spacing repair", () => {
  const song = fixture();
  const result = refineCompositionPocketLock(song);
  const melody = result.song.tracks.find((track) => track.id === "melody").notes;
  const repaired = melody.find((note) => note.id === "m1");

  assert.equal(result.accepted, true, JSON.stringify(result));
  assert.equal(repaired.start, 1.5);
  assert.equal(repaired.melodyPocketRole, "rhythm-space-groove-repair");
  assert.equal(repaired.pitch, 64);
  assert.equal(repaired.duration, 0.35);
  assert.equal(repaired.velocity, 88);
});

test("composition pocket never moves protected phrase anchors", () => {
  const song = fixture();
  const anchorBefore = structuredClone(song.tracks.find((track) => track.id === "melody").notes[2]);
  const result = refineCompositionPocketLock(song);
  const anchorAfter = result.song.tracks.find((track) => track.id === "melody").notes
    .find((note) => note.id === "m3");

  assert.equal(anchorAfter.start, anchorBefore.start);
  assert.equal(anchorAfter.pitch, anchorBefore.pitch);
  assert.equal(anchorAfter.duration, anchorBefore.duration);
  assert.equal(anchorAfter.velocity, anchorBefore.velocity);
});

test("composition pocket refuses broad bass rewrites when a note is far from an authored pulse", () => {
  const song = fixture();
  song.tracks.find((track) => track.id === "bass").notes[0].start = 0.4;
  const result = refineCompositionPocketLock(song);
  const bass = result.song.tracks.find((track) => track.id === "bass").notes
    .find((note) => note.id === "b1");

  assert.equal(bass.start, 0.4, "far bass notes require composition authority, not a cleanup snap");
});
