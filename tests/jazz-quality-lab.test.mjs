import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeJazzQuality,
  compareJazzQuality,
} from "../src/core/jazz-quality-lab.js";
import { judgeCompositionCandidate } from "../src/core/composition-candidate-judge.js";

function note(pitch, start, duration = 0.45, velocity = 82) {
  return { pitch, start, duration, velocity };
}

function fixture() {
  const harmony = [
    { start: 0, duration: 4, rootPc: 0, tones: [0, 4, 7, 11] },
    { start: 4, duration: 4, rootPc: 2, tones: [2, 5, 9, 0] },
    { start: 8, duration: 4, rootPc: 7, tones: [7, 11, 2, 5] },
    { start: 12, duration: 4, rootPc: 0, tones: [0, 4, 7, 11] },
  ];
  const chordShell = (pitches, start) => [
    note(pitches[0], start, 1.1, 72),
    note(pitches[1], start, 1.1, 70),
    note(pitches[0] + 12, start + 2.667, 0.5, 68),
  ];
  return {
    id: "jazz-lab-fixture",
    seed: "jazz-lab-fixture",
    genre: "jazz",
    meta: {
      genre: "jazz",
      keyPc: 0,
      scaleIntervals: [0, 2, 4, 5, 7, 9, 11],
      beatsPerBar: 4,
      bars: 4,
    },
    structure: [{ id: "head", name: "verse", startBeat: 0, endBeat: 16, bars: 4 }],
    harmony,
    tracks: [
      {
        id: "drums",
        notes: Array.from({ length: 16 }, (_, beat) => [
          note(51, beat, 0.08, 72),
          note(51, beat + 0.667, 0.08, 64),
        ]).flat(),
      },
      {
        id: "bass",
        notes: [
          note(36, 0), note(40, 1), note(43, 2), note(36, 3),
          note(38, 4), note(41, 5), note(45, 6), note(43, 7),
          note(43, 8), note(47, 9), note(50, 10), note(47, 11),
          note(48, 12), note(52, 13), note(55, 14), note(59, 15),
        ],
      },
      {
        id: "chords",
        notes: [
          ...chordShell([52, 59], 0),
          ...chordShell([53, 60], 4),
          ...chordShell([59, 65], 8),
          ...chordShell([52, 59], 12),
        ],
      },
      {
        id: "melody",
        notes: [
          note(64, 0.667), note(67, 1.667), note(71, 2.667), note(72, 3.667),
          note(65, 4.667), note(69, 5.667), note(72, 6.667), note(74, 7.667),
          note(71, 8.667), note(74, 9.667), note(77, 10.667), note(79, 11.667),
          note(76, 12.667), note(74, 13.667), note(71, 14.667), note(72, 15.4),
        ],
      },
      { id: "counterpoint", notes: [] },
      { id: "pad", notes: [] },
    ],
  };
}

test("Jazz Quality Lab reports inspectable deterministic musical scores", () => {
  const song = fixture();
  const first = analyzeJazzQuality(song);
  const second = analyzeJazzQuality(structuredClone(song));
  assert.deepEqual(first, second);
  assert.ok(first.guideTones.coverage >= 0.99);
  assert.ok(first.walkingBass.beatCoverage >= 0.99);
  assert.ok(first.swing.swingZoneRatio > 0);
  assert.ok(first.scores.overall >= 0 && first.scores.overall <= 100);
});

test("Jazz Quality Lab ignores non-Jazz songs", () => {
  const song = fixture();
  song.genre = "pop";
  song.meta.genre = "pop";
  assert.equal(analyzeJazzQuality(song), null);
});

test("guide-tone collapse is a hard Jazz regression even when roots and fifths remain legal chord tones", () => {
  const before = fixture();
  const after = structuredClone(before);
  after.tracks.find((track) => track.id === "chords").notes = [
    note(48, 0, 1.1), note(55, 0, 1.1),
    note(50, 4, 1.1), note(57, 4, 1.1),
    note(55, 8, 1.1), note(62, 8, 1.1),
    note(48, 12, 1.1), note(55, 12, 1.1),
  ];
  after.tracks.find((track) => track.id === "melody").notes = [
    note(60, 0.667), note(60, 2.667),
    note(62, 4.667), note(62, 6.667),
    note(67, 8.667), note(67, 10.667),
    note(60, 12.667), note(60, 15.4),
  ];

  const comparison = compareJazzQuality(before, after);
  assert.ok(comparison.hardIssues.includes("jazz:guide-tone-regression"));

  const judged = judgeCompositionCandidate(before, after, { target: "song" }, {});
  assert.equal(judged.passed, false);
  assert.ok(judged.hardIssues.includes("jazz:guide-tone-regression"));
  assert.ok(judged.jazz);
});

test("unresolved chromaticism is measured separately from legitimate Jazz vocabulary", () => {
  const before = fixture();
  const after = structuredClone(before);
  after.tracks.find((track) => track.id === "melody").notes.splice(
    2,
    0,
    note(66, 2.2, 0.2),
    note(66, 2.8, 0.2),
  );
  const report = analyzeJazzQuality(after);
  assert.equal(report.chromaticism.chromaticNotes, 2);
  assert.ok(report.chromaticism.resolutionRatio < 1);
});
