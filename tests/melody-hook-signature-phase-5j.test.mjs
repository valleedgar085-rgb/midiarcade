import assert from "node:assert/strict";
import test from "node:test";

import { evaluateMelodySectionMemory } from "../src/core/melody-section-memory.js";
import { createMelodySectionDevelopmentCandidates } from "../src/core/melody-section-development-refinement.js";

function note(start, pitch, duration = 0.5, velocity = 86, extra = {}) {
  return { start, pitch, duration, velocity, ...extra };
}

const SOURCE = [
  note(0.5, 60),
  note(1.5, 64, 0.25),
  note(2.5, 67),
  note(3.5, 64, 0.75),
  note(4.5, 62),
  note(5.5, 65, 0.25),
  note(6.5, 69),
  note(7.5, 67, 0.75),
];

const DRIFTED_RETURN = [
  note(8.5, 72),
  note(9.5, 76, 0.25),
  note(10.5, 79),
  // First three notes still identify the old 5G motif, but this fourth note
  // destroys the listener-facing four-note hook shape.
  note(11.5, 84, 0.75),
  note(12.5, 76),
  note(13.5, 79, 0.25),
  note(14.5, 83),
  note(15.5, 81, 0.75, { phraseRole: "turnaround" }),
];

function song() {
  return {
    meta: {
      beatsPerBar: 4,
      keyPc: 0,
      scaleIntervals: [0, 2, 4, 5, 7, 9, 11],
    },
    structure: [
      { id: "verse-1", name: "verse", startBeat: 0, endBeat: 8, bars: 2 },
      { id: "verse-2", name: "verse", startBeat: 8, endBeat: 16, bars: 2 },
    ],
    phraseMemory: {
      version: 1,
      familyId: "hook-signature-family",
      sections: [
        {
          sectionId: "verse-1",
          sourceSectionId: "verse-1",
          relationship: "statement",
          recallStrength: 1,
          transform: "statement",
        },
        {
          sectionId: "verse-2",
          sourceSectionId: "verse-1",
          relationship: "return",
          recallStrength: 0.9,
          transform: "motif-return",
        },
      ],
    },
    tracks: [
      { id: "drums", notes: [note(0, 36, 0.1, 100), note(8, 36, 0.1, 100)] },
      { id: "bass", notes: [note(0, 36, 0.5, 92), note(8, 36, 0.5, 92)] },
      {
        id: "melody",
        notes: [
          ...SOURCE,
          ...DRIFTED_RETURN.map((entry) => ({
            ...entry,
            phraseMemorySourceSectionId: "verse-1",
          })),
        ],
      },
    ],
  };
}

test("5J rejects a return that passes the three-note motif but loses the four-note hook", () => {
  const input = song();
  const before = structuredClone(input);
  const report = evaluateMelodySectionMemory(input);

  assert.deepEqual(input, before, "5J recognizability critic must remain read-only");
  assert.equal(report.passed, false, JSON.stringify(report));
  assert.equal(report.reason, "hook-signature-weak", JSON.stringify(report));
  assert.ok(report.weakestSection.metrics.motifCoreSimilarity >= 0.56, JSON.stringify(report));
  assert.ok(report.weakestSection.metrics.hookSignatureSimilarity < 0.78, JSON.stringify(report));
});

test("5J restores the four-note hook with bounded pitch-only edits", () => {
  const input = song();
  const before = structuredClone(input);
  const initial = evaluateMelodySectionMemory(input);
  const first = createMelodySectionDevelopmentCandidates(input);
  const second = createMelodySectionDevelopmentCandidates(input);

  assert.deepEqual(first, second, "5J candidate generation must be deterministic");
  assert.deepEqual(input, before, "5J must not mutate the source song");

  const candidate = first.find((entry) => entry.id === "restore-hook-signature");
  assert.ok(candidate, JSON.stringify(first.map((entry) => entry.id)));
  assert.equal(candidate.authorityPhase, "5J");
  assert.ok(candidate.changedNotes >= 1 && candidate.changedNotes <= 3);
  assert.ok(
    candidate.afterSection.metrics.hookSignatureSimilarity
      > initial.weakestSection.metrics.hookSignatureSimilarity,
    JSON.stringify(candidate.afterSection),
  );
  assert.ok(candidate.afterSection.metrics.hookSignatureSimilarity >= 0.78);

  const sourceMelody = before.tracks.find((track) => track.id === "melody");
  const repairedMelody = candidate.song.tracks.find((track) => track.id === "melody");

  assert.deepEqual(
    repairedMelody.notes.map((entry) => entry.start),
    sourceMelody.notes.map((entry) => entry.start),
    "5J must not rewrite canonical timing",
  );
  assert.deepEqual(
    repairedMelody.notes.map((entry) => entry.duration),
    sourceMelody.notes.map((entry) => entry.duration),
    "5J must preserve articulation timing",
  );
  assert.deepEqual(
    repairedMelody.notes.map((entry) => entry.velocity),
    sourceMelody.notes.map((entry) => entry.velocity),
    "5J must preserve velocity",
  );
  assert.equal(repairedMelody.notes[8].pitch, 72, "return register anchor must stay intact");
  assert.equal(repairedMelody.notes[11].pitch, 76, "fourth hook note should restore the source shape");
  assert.equal(
    repairedMelody.notes.at(-1).pitch,
    sourceMelody.notes.at(-1).pitch,
    "protected turnaround must remain untouched",
  );
  assert.deepEqual(
    candidate.song.tracks.find((track) => track.id === "drums"),
    before.tracks.find((track) => track.id === "drums"),
  );
  assert.deepEqual(
    candidate.song.tracks.find((track) => track.id === "bass"),
    before.tracks.find((track) => track.id === "bass"),
  );
});
