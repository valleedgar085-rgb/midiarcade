import assert from "node:assert/strict";
import test from "node:test";

import { evaluateMelodySectionMemory } from "../src/core/melody-section-memory.js";

function note(start, pitch, duration = 0.5, extra = {}) {
  return { start, pitch, duration, velocity: 86, ...extra };
}

function songWith(targetNotes, {
  relationship = "recall",
  recallStrength = 0.78,
  sourceSectionId = "verse-1",
} = {}) {
  const sourceNotes = [
    note(0.5, 60),
    note(1.5, 64, 0.25),
    note(2.5, 67),
    note(3.5, 64, 0.75),
    note(4.5, 62),
    note(5.5, 65, 0.25),
    note(6.5, 69),
    note(7.5, 67, 0.75),
  ];
  return {
    meta: { beatsPerBar: 4 },
    structure: [
      { id: "verse-1", name: "verse", startBeat: 0, endBeat: 8, bars: 2 },
      { id: "chorus-1", name: "chorus", startBeat: 8, endBeat: 16, bars: 2 },
    ],
    phraseMemory: {
      version: 1,
      familyId: "memory-family-a",
      sections: [
        {
          sectionId: "verse-1",
          sourceSectionId: "verse-1",
          relationship: "statement",
          recallStrength: 1,
          transform: "statement",
        },
        {
          sectionId: "chorus-1",
          sourceSectionId,
          relationship,
          recallStrength,
          transform: relationship === "return" ? "motif-return" : "contour-echo",
        },
      ],
    },
    tracks: [{
      id: "melody",
      notes: [
        ...sourceNotes,
        ...targetNotes.map((entry) => ({
          ...entry,
          phraseMemorySourceSectionId: sourceSectionId,
        })),
      ],
    }],
  };
}

const TRANSFORMED_RECALL = [
  note(8.5, 62),
  note(9.5, 65, 0.25),
  note(10.5, 69),
  note(11.5, 65, 0.5),
  note(12.5, 64),
  note(13.5, 67, 0.25),
  note(14.5, 71),
  note(15.5, 69, 1),
];

test("section-memory evaluator is deterministic and read-only for a transformed recall", () => {
  const song = songWith(TRANSFORMED_RECALL);
  const before = structuredClone(song);
  const first = evaluateMelodySectionMemory(song);
  const second = evaluateMelodySectionMemory(song);

  assert.deepEqual(song, before);
  assert.deepEqual(first, second);
  assert.equal(first.mode, "read-only");
  assert.equal(first.status, "evaluated");
  assert.equal(first.passed, true, JSON.stringify(first));
  assert.ok(first.sections[0].metrics.familiarity >= 0.45, JSON.stringify(first));
  assert.ok(first.sections[0].metrics.cloneRisk < 0.92, JSON.stringify(first));
  assert.equal(first.sections[0].metrics.metadataAccuracy, 1);
});

test("exact copied return is rejected as clone risk rather than rewarded as perfect memory", () => {
  const copied = [
    note(8.5, 60),
    note(9.5, 64, 0.25),
    note(10.5, 67),
    note(11.5, 64, 0.75),
    note(12.5, 62),
    note(13.5, 65, 0.25),
    note(14.5, 69),
    note(15.5, 67, 0.75),
  ];
  const report = evaluateMelodySectionMemory(songWith(copied, {
    relationship: "return",
    recallStrength: 0.9,
  }));

  assert.equal(report.passed, false);
  assert.equal(report.reason, "memory-clone-risk");
  assert.equal(report.sections[0].metrics.cloneRisk, 1);
});

test("contrast can stay in the same melodic family without becoming a clone", () => {
  const contrast = [
    note(8.25, 67, 0.25),
    note(9.75, 65, 0.5),
    note(10.5, 62, 0.25),
    note(12, 64, 0.5),
    note(13.25, 69, 0.25),
    note(14.75, 67, 0.5),
    note(15.5, 64, 0.5),
  ];
  const report = evaluateMelodySectionMemory(songWith(contrast, {
    relationship: "contrast",
    recallStrength: 0.68,
  }));

  assert.equal(report.status, "evaluated");
  assert.ok(report.sections[0].metrics.cloneRisk < 0.82, JSON.stringify(report));
  assert.ok(report.sections[0].metrics.familiarity < 0.8, JSON.stringify(report));
});

test("missing source section fails closed when the phrase-memory contract cannot be compared", () => {
  const report = evaluateMelodySectionMemory(songWith(TRANSFORMED_RECALL, {
    sourceSectionId: "missing-verse",
  }));

  assert.equal(report.passed, false);
  assert.equal(report.reason, "incomplete-memory-comparison");
  assert.equal(report.sections[0].available, false);
});

test("songs with no recall/return/contrast contract are neutral and unavailable", () => {
  const song = songWith(TRANSFORMED_RECALL);
  song.phraseMemory.sections = song.phraseMemory.sections.map((memory) => ({
    ...memory,
    sourceSectionId: memory.sectionId,
    relationship: "statement",
  }));
  const report = evaluateMelodySectionMemory(song);

  assert.equal(report.status, "unavailable");
  assert.equal(report.passed, true);
  assert.equal(report.reason, "no-memory-comparisons");
  assert.equal(report.score, 100);
});
