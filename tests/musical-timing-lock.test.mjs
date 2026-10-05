import assert from "node:assert/strict";
import test from "node:test";

import { evaluateMusicalTimingLock } from "../src/core/musical-timing-lock.js";

function song() {
  return {
    meta: { totalBeats: 8, beatsPerBar: 4 },
    structure: [
      { id: "verse", startBeat: 0, endBeat: 4, bars: 1 },
      { id: "chorus", startBeat: 4, endBeat: 8, bars: 1 },
    ],
    grooveConductor: {
      bars: [
        { bar: 0, sectionId: "verse", anchors: [0, 2], bassPulses: [0, 1.5, 2.5], chordPulses: [0, 2], leadPulses: [0.5, 1.5, 2.5, 3.5] },
        { bar: 1, sectionId: "chorus", anchors: [0, 2], bassPulses: [0, 1.5, 2.5], chordPulses: [0, 2], leadPulses: [0.5, 1.5, 2.5, 3.5] },
      ],
    },
    tracks: [
      {
        id: "drums",
        notes: [
          { pitch: 36, start: 0, duration: 0.1, grooveSource: "groove.anchors" },
          { pitch: 36, start: 4, duration: 0.1, grooveSource: "groove.anchors" },
        ],
      },
      {
        id: "bass",
        notes: [
          { pitch: 45, start: 0, duration: 0.7, grooveSource: "groove.bass", performed: { startBeat: 0, durationBeats: 0.7, renderedMidiPitch: 45, velocity: 90 } },
          { pitch: 43, start: 4, duration: 0.7, grooveSource: "groove.bass", performed: { startBeat: 4, durationBeats: 0.7, renderedMidiPitch: 43, velocity: 92 } },
        ],
      },
      {
        id: "chords",
        notes: [
          { pitch: 57, start: 0, duration: 1.5, grooveSource: "groove.chords" },
          { pitch: 60, start: 4, duration: 1.5, grooveSource: "groove.chords" },
        ],
      },
      {
        id: "melody",
        notes: [
          { pitch: 69, start: 0.5, duration: 0.5, grooveSource: "groove.lead" },
          { pitch: 72, start: 4.5, duration: 0.5, grooveSource: "groove.lead" },
        ],
      },
    ],
  };
}

test("musical timing lock is deterministic, read-only, and accepts a coherent final song", () => {
  const source = song();
  const before = structuredClone(source);
  const first = evaluateMusicalTimingLock(source);
  const second = evaluateMusicalTimingLock(source);

  assert.deepEqual(source, before);
  assert.deepEqual(first, second);
  assert.equal(first.mode, "read-only");
  assert.equal(first.repairs, 0);
  assert.equal(first.passed, true, JSON.stringify(first));
  assert.equal(first.status, "complete");
  assert.equal(first.metrics.outOfBounds, 0);
  assert.equal(first.metrics.grooveTimingViolations, 0);
  assert.equal(first.metrics.performedSectionCrossings, 0);
  assert.equal(first.metrics.severePerformanceDrift, 0);
});

test("musical timing lock catches performed timing that crosses a section boundary", () => {
  const source = song();
  const bass = source.tracks.find((track) => track.id === "bass");
  bass.notes[0].start = 3.95;
  bass.notes[0].performed.startBeat = 4.3;

  const report = evaluateMusicalTimingLock(source);

  assert.equal(report.passed, false);
  assert.equal(report.checks.performedSectionStable, false);
  assert.equal(report.checks.noSeverePerformanceDrift, false);
  assert.equal(report.metrics.performedSectionCrossings, 1);
  assert.equal(report.metrics.severePerformanceDrift, 1);
});

test("musical timing lock catches final performed Groove DNA drift", () => {
  const source = song();
  const bass = source.tracks.find((track) => track.id === "bass");
  bass.notes[0].performed.startBeat = 0.4;

  const report = evaluateMusicalTimingLock(source);

  assert.equal(report.passed, false);
  assert.equal(report.checks.grooveAuthoredTimingStable, false);
  assert.ok(report.metrics.grooveTimingViolations >= 1);
  assert.ok(report.byTrack.bass.grooveTimingViolations >= 1);
});

test("musical timing lock reports kick-bass connection without forcing cloning", () => {
  const source = song();
  const bass = source.tracks.find((track) => track.id === "bass");
  bass.notes.push({
    pitch: 47,
    start: 1.5,
    duration: 0.5,
    grooveSource: "groove.bass",
    performed: { startBeat: 1.5, durationBeats: 0.5, renderedMidiPitch: 47, velocity: 88 },
  });

  const report = evaluateMusicalTimingLock(source);

  assert.ok(report.metrics.kickBassConnection < 1);
  assert.ok(report.metrics.directKickBassLock < report.metrics.kickBassConnection);
  assert.equal(report.passed, true, "independent bass replies are diagnostic, not a forced kick clone");
});
