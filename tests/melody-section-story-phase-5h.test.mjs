import assert from "node:assert/strict";
import test from "node:test";

import { evaluateMelodySectionMemory } from "../src/core/melody-section-memory.js";
import { createMelodySectionDevelopmentCandidates } from "../src/core/melody-section-development-refinement.js";

function note(start, pitch, duration = 0.5, velocity = 86, extra = {}) {
  return { start, pitch, duration, velocity, ...extra };
}

function song() {
  return {
    meta: {
      beatsPerBar: 4,
      keyPc: 0,
      scaleIntervals: [0, 2, 4, 5, 7, 9, 11],
    },
    structure: [
      { id: "verse-1", name: "verse", startBeat: 0, endBeat: 8, bars: 2 },
      { id: "pre-1", name: "preChorus", startBeat: 8, endBeat: 16, bars: 2 },
      { id: "chorus-1", name: "chorus", startBeat: 16, endBeat: 24, bars: 2 },
    ],
    phraseMemory: {
      version: 1,
      familyId: "story-family",
      sections: [
        {
          sectionId: "verse-1",
          sourceSectionId: "verse-1",
          relationship: "statement",
          recallStrength: 1,
        },
        {
          sectionId: "pre-1",
          sourceSectionId: "pre-1",
          relationship: "statement",
          recallStrength: 1,
        },
        {
          sectionId: "chorus-1",
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
        notes: [note(0, 36, 0.1, 100), note(8, 36, 0.1, 100), note(16, 36, 0.1, 100)],
      },
      {
        id: "bass",
        notes: [note(0, 36, 0.5, 92), note(8, 41, 0.5, 92), note(16, 36, 0.5, 92)],
      },
      {
        id: "melody",
        notes: [
          // Verse authors the recognizable opening motif.
          note(0.5, 60),
          note(1.5, 64, 0.25),
          note(2.5, 67),
          note(3.5, 65, 0.5),
          note(4.5, 69, 0.5),
          note(6.5, 67, 0.75),

          // Pre-chorus raises expectation above the verse.
          note(8.5, 62),
          note(9.5, 65),
          note(10.5, 67),
          note(12.0, 69),
          note(13.0, 72, 0.5),
          note(14.5, 69, 0.75),

          // Chorus remembers the motif but initially fails to exceed the setup.
          note(16.5, 60, 0.5, 88, { phraseMemorySourceSectionId: "verse-1" }),
          note(17.5, 64, 0.25, 90, { phraseMemorySourceSectionId: "verse-1" }),
          note(18.5, 67, 0.5, 91, { phraseMemorySourceSectionId: "verse-1" }),
          note(19.5, 65, 0.5, 92, { phraseMemorySourceSectionId: "verse-1" }),
          note(20.5, 70, 0.5, 94, { phraseMemorySourceSectionId: "verse-1" }),
          note(21.5, 64, 0.5, 90, { phraseMemorySourceSectionId: "verse-1" }),
          note(22.5, 67, 0.75, 92, { phraseMemorySourceSectionId: "verse-1" }),
        ],
      },
    ],
  };
}

test("5H critic catches a chorus that recalls the hook but does not pay off the pre-chorus", () => {
  const input = song();
  const before = structuredClone(input);
  const report = evaluateMelodySectionMemory(input);

  assert.deepEqual(input, before, "5H story critic must remain read-only");
  assert.equal(report.passed, false, JSON.stringify(report));
  assert.equal(report.reason, "section-story-payoff-weak", JSON.stringify(report));
  assert.equal(report.weakestSection.sectionId, "chorus-1");
  assert.equal(report.weakestSection.metrics.sectionStoryEligible, true);
  assert.ok(report.weakestSection.metrics.motifCoreSimilarity >= 0.56, JSON.stringify(report));
  assert.ok(report.weakestSection.metrics.sectionStoryPayoff < 0.6, JSON.stringify(report));
  assert.ok(report.weakestSection.metrics.sectionStoryPeakLift < 0, JSON.stringify(report));
  assert.equal(report.weakestSection.metrics.sectionStoryPreviousSectionId, "pre-1");
});

test("5H raises one safe chorus payoff note without rewriting groove or motif identity", () => {
  const input = song();
  const before = structuredClone(input);
  const initial = evaluateMelodySectionMemory(input);
  const first = createMelodySectionDevelopmentCandidates(input);
  const second = createMelodySectionDevelopmentCandidates(input);

  assert.deepEqual(first, second, "5H candidate generation must be deterministic");
  assert.deepEqual(input, before, "5H candidate generation must not mutate its source");

  const candidate = first.find((entry) => entry.id === "lift-chorus-payoff");
  assert.ok(candidate, JSON.stringify(first.map((entry) => entry.id)));
  assert.equal(candidate.changedNotes, 1);
  assert.ok(
    candidate.afterSection.metrics.sectionStoryPayoff
      > initial.weakestSection.metrics.sectionStoryPayoff,
    JSON.stringify(candidate.afterSection),
  );
  assert.ok(candidate.afterSection.metrics.sectionStoryPeakLift >= 1, JSON.stringify(candidate.afterSection));

  const sourceMelody = before.tracks.find((track) => track.id === "melody");
  const repairedMelody = candidate.song.tracks.find((track) => track.id === "melody");
  assert.deepEqual(
    repairedMelody.notes.map((entry) => entry.start),
    sourceMelody.notes.map((entry) => entry.start),
    "5H must not move note starts",
  );
  assert.deepEqual(
    repairedMelody.notes.map((entry) => entry.duration),
    sourceMelody.notes.map((entry) => entry.duration),
    "5H must not rewrite durations",
  );
  assert.deepEqual(
    repairedMelody.notes.map((entry) => entry.velocity),
    sourceMelody.notes.map((entry) => entry.velocity),
    "5H must not rewrite velocities",
  );

  const chorusBefore = sourceMelody.notes.filter((entry) => entry.start >= 16 && entry.start < 24);
  const chorusAfter = repairedMelody.notes.filter((entry) => entry.start >= 16 && entry.start < 24);
  assert.deepEqual(
    chorusAfter.slice(0, 3).map((entry) => entry.pitch),
    chorusBefore.slice(0, 3).map((entry) => entry.pitch),
    "5H must leave the 5G motif-core cell untouched",
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
