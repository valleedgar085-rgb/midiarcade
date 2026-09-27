import assert from "node:assert/strict";
import test from "node:test";

import { createPerformanceShadowReport } from "../src/core/performance-shadow.js";

function fixtureSong() {
  return {
    id: "shadow-song",
    seed: "shadow-seed",
    genre: "neoSoul",
    bars: 2,
    meta: {
      genre: "neoSoul",
      tempo: 92,
      bars: 2,
      beatsPerBar: 4,
      totalBeats: 8,
      key: "A",
      keyPc: 9,
      scale: "minor",
      scaleIntervals: [0, 2, 3, 5, 7, 8, 10],
      timeSignature: [4, 4],
    },
    harmony: [
      { id: "h1", start: 0, duration: 4, chord: "Am9", root: "A" },
      { id: "h2", start: 4, duration: 4, chord: "Fmaj9", root: "F" },
    ],
    structure: [
      { id: "verse", name: "Verse", startBar: 0, bars: 1 },
      { id: "chorus", name: "Chorus", startBar: 1, bars: 1 },
    ],
    grooveConductor: {
      bars: [
        { bar: 0, sectionId: "verse" },
        { bar: 1, sectionId: "chorus" },
      ],
    },
    tracks: [
      {
        id: "drums",
        notes: [
          { start: 0, duration: 0.15, pitch: 36, velocity: 100 },
          { start: 1, duration: 0.15, pitch: 38, velocity: 94 },
          { start: 2, duration: 0.15, pitch: 36, velocity: 98 },
          { start: 3, duration: 0.15, pitch: 38, velocity: 96 },
        ],
      },
      {
        id: "bass",
        notes: [
          { start: 0, duration: 0.75, pitch: 33, velocity: 88 },
          { start: 1, duration: 0.5, pitch: 36, velocity: 86 },
          { start: 4, duration: 0.75, pitch: 33, velocity: 90, locked: true },
        ],
      },
      {
        id: "melody",
        notes: [
          { start: 4.5, duration: 0.5, pitch: 69, velocity: 84, motifId: "hook-A", phraseRole: "answer" },
          { start: 5.5, duration: 0.75, pitch: 72, velocity: 87, motifId: "hook-A", phraseRole: "resolution" },
        ],
      },
    ],
  };
}

test("performance shadow is deterministic, diagnostic-only, and non-mutating", () => {
  const song = fixtureSong();
  const before = structuredClone(song);
  const first = createPerformanceShadowReport(song, { humanize: 0.7 });
  const second = createPerformanceShadowReport(song, { humanize: 0.7 });

  assert.deepEqual(first, second);
  assert.deepEqual(song, before);
  assert.equal(first.mode, "diagnostic-only");
  assert.equal(first.outputMutation, false);
  assert.equal(first.deterministic, true);
  assert.equal(first.genre, "neoSoul");
  assert.equal(first.bpm, 92);
  assert.equal(first.technicalSafety.eventCountPreserved, true);
  assert.equal(first.technicalSafety.eventIdsPreserved, true);
  assert.equal(first.technicalSafety.pitchPreserved, true);
  assert.equal(first.technicalSafety.lockedEventsPreserved, true);
  assert.equal(first.technicalSafety.boundsPreserved, true);
  assert.equal(first.safeToAudition, true);
  assert.ok(first.metrics.changedEvents > 0);
  assert.ok(first.metrics.timing.maxAbsMs > 0);
  assert.ok(first.roles.some((role) => role.roleId === "bass"));
  assert.ok(first.roles.some((role) => role.roleId === "lead"));
});

test("performance shadow compares note-for-note without changing pitch identity", () => {
  const report = createPerformanceShadowReport(fixtureSong(), { humanize: 1 });
  assert.equal(report.metrics.totalEvents, 9);
  assert.equal(report.comparisons.length, 9);
  assert.ok(report.comparisons.every((entry) => typeof entry.id === "string" && entry.id.length > 0));
  assert.ok(report.metrics.velocity.maxAbsDelta <= 12);
  assert.ok(report.metrics.duration.maxAbsPercent <= 24.1);
  assert.equal(report.metrics.orderingInversions, 0);
  assert.equal(report.technicalSafety.pitchPreserved, true);
});

test("simultaneous chord stacks are not misclassified as ordering inversions", () => {
  const song = fixtureSong();
  song.tracks.push({
    id: "chords",
    notes: [
      { start: 2, duration: 1, pitch: 57, velocity: 76 },
      { start: 2, duration: 1, pitch: 60, velocity: 74 },
      { start: 2, duration: 1, pitch: 64, velocity: 78 },
      { start: 6, duration: 1, pitch: 60, velocity: 80 },
      { start: 6, duration: 1, pitch: 64, velocity: 79 },
      { start: 6, duration: 1, pitch: 69, velocity: 81 },
    ],
  });

  const report = createPerformanceShadowReport(song, { humanize: 1 });
  assert.equal(report.metrics.orderingInversions, 0);
  assert.equal(report.grooveSafety.orderingPreserved, true);
});

test("zero-humanize shadow reports no musical changes", () => {
  const report = createPerformanceShadowReport(fixtureSong(), { humanize: 0 });
  assert.equal(report.metrics.changedEvents, 0);
  assert.equal(report.metrics.timing.maxAbsMs, 0);
  assert.equal(report.metrics.velocity.maxAbsDelta, 0);
  assert.equal(report.metrics.duration.maxAbsPercent, 0);
  assert.equal(report.metrics.articulationChanges, 0);
  assert.equal(report.promotionCandidate, true);
});
