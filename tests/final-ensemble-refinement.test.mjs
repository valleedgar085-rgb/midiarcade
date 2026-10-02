import assert from "node:assert/strict";
import test from "node:test";

import {
  createFinalEnsembleRepairCandidates,
} from "../src/core/final-ensemble-refinement.js";
import { auditStageMutationAuthority } from "../src/core/mutation-authority.js";

function song() {
  return {
    meta: { beatsPerBar: 4, bars: 2 },
    structure: [
      { id: "verse-1", name: "Verse", startBeat: 0, endBeat: 4, bars: 1 },
      { id: "chorus-1", name: "Chorus", startBeat: 4, endBeat: 8, bars: 1 },
    ],
    grooveConductor: {
      bars: [
        { bar: 0, sectionId: "verse-1", bassPulses: [0, 2], chordPulses: [0, 2], leadPulses: [1, 3], counterPulses: [1.5, 3.5], anchors: [0, 2] },
        { bar: 1, sectionId: "chorus-1", bassPulses: [0, 2], chordPulses: [0, 2], leadPulses: [1, 3], counterPulses: [1.5, 3.5], anchors: [0, 2] },
      ],
    },
    tracks: [
      {
        id: "drums",
        notes: [
          { id: "kick-a", pitch: 36, start: 0, duration: 0.08, velocity: 100 },
          { id: "kick-b", pitch: 36, start: 4, duration: 0.08, velocity: 102 },
        ],
      },
      {
        id: "bass",
        notes: [
          { id: "bass-regular", pitch: 45, start: 0.1, duration: 0.6, velocity: 92 },
          { id: "bass-answer-turnaround", phraseRole: "bass-answer", pitch: 45, start: 2.1, duration: 0.5, velocity: 94 },
          { id: "bass-chorus", pitch: 45, start: 4, duration: 0.6, velocity: 94 },
        ],
      },
      {
        id: "chords",
        notes: [
          { id: "chord-a", pitch: 57, start: 0, duration: 2, velocity: 78 },
          { id: "chord-b", pitch: 60, start: 0, duration: 2, velocity: 76 },
          { id: "chord-c", pitch: 57, start: 4, duration: 2, velocity: 82 },
        ],
      },
      {
        id: "melody",
        notes: [
          { id: "lead-a", pitch: 69, start: 1, duration: 0.75, velocity: 94 },
          { id: "lead-b", pitch: 72, start: 5, duration: 0.5, velocity: 100 },
        ],
      },
      {
        id: "counterpoint",
        notes: [
          { id: "counter-collision", pitch: 76, start: 1.1, duration: 0.5, velocity: 82 },
          { id: "counter-chorus", pitch: 77, start: 5.5, duration: 0.4, velocity: 84 },
        ],
      },
      {
        id: "pad",
        notes: [
          { id: "pad-verse-a", pitch: 52, start: 0.5, duration: 0.5, velocity: 70 },
          { id: "pad-verse-b", pitch: 55, start: 1.15, duration: 0.5, velocity: 72 },
          { id: "pad-chorus", pitch: 52, start: 4.5, duration: 0.5, velocity: 74 },
        ],
      },
    ],
  };
}

function plan(directive) {
  return {
    available: true,
    directives: [directive],
  };
}

test("density-balance repair subtracts one support note without touching foundation or lead", () => {
  const source = song();
  const beforeFoundation = structuredClone(
    source.tracks.filter((track) => ["drums", "bass", "melody"].includes(track.id)),
  );
  const candidates = createFinalEnsembleRepairCandidates(source, {
    report: {},
    plan: plan({ sectionId: "verse-1", relationship: "density-balance" }),
    maxCandidates: 1,
  });

  assert.equal(candidates.length, 1);
  const candidate = candidates[0];
  assert.equal(candidate.operation, "subtract-support-note");
  assert.equal(candidate.changedNotes, 1);
  assert.deepEqual(
    candidate.song.tracks.filter((track) => ["drums", "bass", "melody"].includes(track.id)),
    beforeFoundation,
  );
  const audit = auditStageMutationAuthority(source, candidate.song, "finalEnsembleRefinement");
  assert.equal(audit.passed, true, JSON.stringify(audit));
  assert.ok(audit.changedMutations.includes("topology"));
  assert.equal(audit.changedMutations.includes("velocity"), false);
  assert.deepEqual(audit.violations, []);
});

test("melody-counterline repair restores turn-taking without changing pitches", () => {
  const source = song();
  const beforeCounter = source.tracks.find((track) => track.id === "counterpoint").notes[0];
  const candidates = createFinalEnsembleRepairCandidates(source, {
    report: {},
    plan: plan({ sectionId: "verse-1", relationship: "melody-counterline" }),
    maxCandidates: 1,
  });

  assert.equal(candidates.length, 1);
  const repaired = candidates[0].song.tracks.find((track) => track.id === "counterpoint")
    .notes.find((note) => note.id === "counter-collision");
  assert.equal(repaired.pitch, beforeCounter.pitch);
  assert.ok(repaired.start > beforeCounter.start);
  assert.ok(repaired.start >= 1.75, JSON.stringify(repaired));
  const audit = auditStageMutationAuthority(source, candidates[0].song, "finalEnsembleRefinement");
  assert.equal(audit.passed, true, JSON.stringify(audit));
  assert.ok(audit.changedMutations.includes("timing"));
});

test("payoff-lift repair creates contrast in the setup section instead of stuffing the chorus", () => {
  const source = song();
  const chorusBefore = structuredClone(source.tracks.map((track) => ({
    id: track.id,
    notes: track.notes.filter((note) => note.start >= 4),
  })));
  const candidates = createFinalEnsembleRepairCandidates(source, {
    report: {},
    plan: plan({
      fromSectionId: "verse-1",
      sectionId: "chorus-1",
      relationship: "payoff-lift",
    }),
    maxCandidates: 1,
  });

  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].operation, "subtract-support-note");
  const chorusAfter = candidates[0].song.tracks.map((track) => ({
    id: track.id,
    notes: track.notes.filter((note) => note.start >= 4),
  }));
  assert.deepEqual(chorusAfter, chorusBefore);
});

test("kick-bass relock never moves authored bass-answer events", () => {
  const source = song();
  const protectedBefore = source.tracks.find((track) => track.id === "bass")
    .notes.find((note) => note.id === "bass-answer-turnaround");
  const candidates = createFinalEnsembleRepairCandidates(source, {
    report: {},
    plan: plan({ sectionId: "verse-1", relationship: "kick-bass" }),
    maxCandidates: 1,
  });

  assert.equal(candidates.length, 1);
  const protectedAfter = candidates[0].song.tracks.find((track) => track.id === "bass")
    .notes.find((note) => note.id === "bass-answer-turnaround");
  const regularAfter = candidates[0].song.tracks.find((track) => track.id === "bass")
    .notes.find((note) => note.id === "bass-regular");
  assert.equal(protectedAfter.start, protectedBefore.start);
  assert.equal(regularAfter.start, 0);
});
