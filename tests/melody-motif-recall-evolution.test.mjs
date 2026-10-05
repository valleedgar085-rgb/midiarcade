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

const WEAK_RETURN = [
  note(8.5, 60),
  note(9.5, 62, 0.25),
  note(10.5, 60),
  note(11.5, 65, 0.5),
  note(12.5, 64),
  note(13.5, 67, 0.25),
  note(14.5, 71),
  note(15.5, 69, 1, { phraseRole: "turnaround" }),
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
      familyId: "motif-family",
      sections: [
        { sectionId: "verse-1", sourceSectionId: "verse-1", relationship: "statement", recallStrength: 1 },
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
      {
        id: "drums",
        notes: [note(0, 36, 0.1, 100), note(8, 36, 0.1, 100)],
      },
      {
        id: "bass",
        notes: [note(0, 36, 0.5, 92), note(8, 36, 0.5, 92)],
      },
      {
        id: "melody",
        notes: [
          ...SOURCE,
          ...WEAK_RETURN.map((entry) => ({
            ...entry,
            phraseMemorySourceSectionId: "verse-1",
          })),
        ],
      },
    ],
  };
}

test("5G motif critic rejects a return whose opening hook identity drifted", () => {
  const input = song();
  const before = structuredClone(input);
  const report = evaluateMelodySectionMemory(input);

  assert.deepEqual(input, before, "5G memory critic must remain read-only");
  assert.equal(report.passed, false, JSON.stringify(report));
  assert.equal(report.reason, "motif-core-weak", JSON.stringify(report));
  assert.equal(report.weakestSection.sectionId, "verse-2");
  assert.ok(report.weakestSection.metrics.motifCoreSimilarity < 0.56, JSON.stringify(report));
  assert.ok(report.weakestSection.metrics.cloneRisk < 0.92, JSON.stringify(report));
});

test("5G restores a recognizable motif core with at most two pitch edits", () => {
  const input = song();
  const before = structuredClone(input);
  const initial = evaluateMelodySectionMemory(input);
  const first = createMelodySectionDevelopmentCandidates(input);
  const second = createMelodySectionDevelopmentCandidates(input);

  assert.deepEqual(first, second, "5G candidate generation must be deterministic");
  assert.deepEqual(input, before, "5G candidate generation must not mutate its source");

  const candidate = first.find((entry) => entry.id === "restore-motif-core");
  assert.ok(candidate, JSON.stringify(first.map((entry) => entry.id)));
  assert.ok(candidate.changedNotes > 0 && candidate.changedNotes <= 2);
  assert.ok(
    candidate.afterSection.metrics.motifCoreSimilarity
      > initial.weakestSection.metrics.motifCoreSimilarity,
    JSON.stringify(candidate.afterSection),
  );

  const sourceMelody = before.tracks.find((track) => track.id === "melody");
  const repairedMelody = candidate.song.tracks.find((track) => track.id === "melody");
  assert.deepEqual(
    repairedMelody.notes.map((entry) => entry.start),
    sourceMelody.notes.map((entry) => entry.start),
    "5G must not rewrite note timing",
  );
  assert.deepEqual(
    repairedMelody.notes.map((entry) => entry.duration),
    sourceMelody.notes.map((entry) => entry.duration),
    "5G must not rewrite durations",
  );
  assert.deepEqual(
    repairedMelody.notes.map((entry) => entry.velocity),
    sourceMelody.notes.map((entry) => entry.velocity),
    "5G must not rewrite velocities",
  );
  assert.equal(
    repairedMelody.notes.at(-1).pitch,
    sourceMelody.notes.at(-1).pitch,
    "protected turnaround landing must remain exact",
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
