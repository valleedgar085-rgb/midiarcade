import assert from "node:assert/strict";
import test from "node:test";

import { applyMusicalTimingRepair } from "../src/core/musical-timing-repair.js";

function baseSong() {
  return {
    schema: "midi-arcade/song@1",
    meta: { totalBeats: 8, beatsPerBar: 4, tempo: 120 },
    structure: [
      { id: "verse", startBeat: 0, endBeat: 4, bars: 1 },
      { id: "chorus", startBeat: 4, endBeat: 8, bars: 1 },
    ],
    grooveConductor: {
      bars: [
        { bar: 0, sectionId: "verse", anchors: [0, 2], bassPulses: [0, 1.5, 2.5], leadPulses: [0.5, 1.5, 2.5, 3.5] },
        { bar: 1, sectionId: "chorus", anchors: [0, 2], bassPulses: [0, 1.5, 2.5], leadPulses: [0.5, 1.5, 2.5, 3.5] },
      ],
    },
    tracks: [
      {
        id: "drums",
        notes: [
          { pitch: 36, start: 0, duration: 0.1, velocity: 100, grooveSource: "groove.anchors" },
          { pitch: 36, start: 4, duration: 0.1, velocity: 100, grooveSource: "groove.anchors" },
        ],
      },
      {
        id: "bass",
        notes: [
          {
            pitch: 45,
            start: 0.04,
            duration: 0.7,
            velocity: 90,
            grooveSource: "groove.bass",
            canonicalStartBeat: 0,
            canonicalDurationBeats: 0.7,
            performanceAuthority: "performance-engine-v1",
            performed: {
              startBeat: 0.04,
              durationBeats: 0.7,
              renderedMidiPitch: 45,
              velocity: 90,
              articulation: "normal",
              microtimingMs: 20,
              timingDeltaBeats: 0.04,
            },
          },
        ],
      },
      {
        id: "melody",
        notes: [
          {
            pitch: 69,
            start: 0.52,
            duration: 0.5,
            velocity: 88,
            grooveSource: "groove.lead",
            canonicalStartBeat: 0.5,
            performanceAuthority: "performance-engine-v1",
            performed: {
              startBeat: 0.52,
              durationBeats: 0.5,
              renderedMidiPitch: 69,
              velocity: 88,
              articulation: "normal",
              microtimingMs: 10,
              timingDeltaBeats: 0.02,
            },
          },
        ],
      },
    ],
  };
}

test("timing repair is deterministic and leaves already-safe performance untouched", () => {
  const song = baseSong();
  const before = structuredClone(song);
  const first = applyMusicalTimingRepair(song);
  const second = applyMusicalTimingRepair(song);

  assert.deepEqual(song, before);
  assert.strictEqual(first.song, song);
  assert.deepEqual(first, second);
  assert.equal(first.diagnostics.changed, false);
  assert.equal(first.diagnostics.reason, "timing-already-locked");
});

test("timing repair pulls a section-crossing performed note back to authored timing", () => {
  const song = baseSong();
  const bass = song.tracks.find((track) => track.id === "bass").notes[0];
  bass.canonicalStartBeat = 3.95;
  bass.start = 4.3;
  bass.performed.startBeat = 4.3;
  bass.performed.timingDeltaBeats = 0.35;
  bass.performed.microtimingMs = 175;

  const before = structuredClone(song);
  const result = applyMusicalTimingRepair(song);
  const repaired = result.song.tracks.find((track) => track.id === "bass").notes[0];

  assert.deepEqual(song, before, "repair must not mutate the source song");
  assert.equal(result.diagnostics.accepted, true, JSON.stringify(result.diagnostics));
  assert.equal(result.diagnostics.reasons["section-boundary"], 1);
  assert.equal(repaired.start, 3.95);
  assert.equal(repaired.performed.startBeat, 3.95);
  assert.equal(repaired.performed.timingDeltaBeats, 0);
  assert.equal(repaired.pitch, before.tracks[1].notes[0].pitch);
  assert.equal(repaired.velocity, before.tracks[1].notes[0].velocity);
  assert.equal(repaired.duration, before.tracks[1].notes[0].duration);
  assert.equal(repaired.performed.durationBeats, before.tracks[1].notes[0].performed.durationBeats);
});

test("timing repair reduces severe performance drift but preserves a small pocket offset", () => {
  const song = baseSong();
  const melody = song.tracks.find((track) => track.id === "melody").notes[0];
  melody.start = 0.9;
  melody.performed.startBeat = 0.9;
  melody.performed.timingDeltaBeats = 0.4;

  const result = applyMusicalTimingRepair(song, { maxPocketDriftBeats: 0.08 });
  const repaired = result.song.tracks.find((track) => track.id === "melody").notes[0];

  assert.equal(result.diagnostics.accepted, true, JSON.stringify(result.diagnostics));
  assert.ok(Math.abs(repaired.performed.startBeat - 0.58) < 1e-9);
  assert.ok(Math.abs(repaired.performed.timingDeltaBeats - 0.08) < 1e-9);
  assert.equal(repaired.performed.renderedMidiPitch, 69);
  assert.equal(repaired.performed.velocity, 88);
});

test("timing repair follows a later final-ensemble timing decision instead of stale canonical timing", () => {
  const song = baseSong();
  const melody = song.tracks.find((track) => track.id === "melody").notes[0];
  melody.finalEnsembleRepairRole = "lead-dialogue-answer";
  melody.canonicalStartBeat = 0.5;
  melody.start = 1;
  melody.performed.startBeat = 0.52;
  melody.performed.timingDeltaBeats = 0.02;

  const result = applyMusicalTimingRepair(song);
  const repaired = result.song.tracks.find((track) => track.id === "melody").notes[0];

  assert.equal(result.diagnostics.accepted, true, JSON.stringify(result.diagnostics));
  assert.ok(Math.abs(repaired.start - 0.92) < 1e-9);
  assert.ok(Math.abs(repaired.performed.startBeat - 0.92) < 1e-9);
  assert.ok(Math.abs(repaired.performed.timingDeltaBeats + 0.08) < 1e-9);
});

test("timing repair refuses to hide structural Groove DNA drift when there is no finalized performance", () => {
  const song = baseSong();
  const bass = song.tracks.find((track) => track.id === "bass").notes[0];
  delete bass.performed;
  delete bass.performanceAuthority;
  delete bass.canonicalStartBeat;
  bass.start = 0.4;

  const before = structuredClone(song);
  const result = applyMusicalTimingRepair(song);

  assert.deepEqual(song, before);
  assert.strictEqual(result.song, song);
  assert.equal(result.diagnostics.changed, false);
  assert.equal(result.diagnostics.reason, "no-authorized-performance-repair");
  assert.equal(result.diagnostics.before.checks.grooveAuthoredTimingStable, false);
});
