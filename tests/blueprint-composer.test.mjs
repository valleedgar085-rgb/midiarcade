import assert from "node:assert/strict";
import test from "node:test";

import {
  acceptCompositionCandidate,
  createCompositionCandidate,
  createDirectorDirective,
  normalizeCompositionSelection,
  rejectCompositionCandidate,
  validateCompositionCandidate,
} from "../src/core/blueprint-composer.js";

function sourceSong() {
  return {
    id: "source-song",
    seed: "source-seed",
    meta: {
      beatsPerBar: 4,
      keyPc: 9,
      scaleIntervals: [0, 2, 3, 5, 7, 8, 10],
    },
    structure: [
      { id: "verse-1", name: "Verse 1", startBeat: 0, endBeat: 8, bars: 2 },
      { id: "chorus-1", name: "Chorus 1", startBeat: 8, endBeat: 16, bars: 2 },
    ],
    harmony: [
      { start: 0, duration: 8, rootPc: 9 },
      { start: 8, duration: 8, rootPc: 5 },
    ],
    songBlueprint: {
      version: 6,
      sectionPlans: [
        { sectionId: "verse-1", energy: 0.45, cadence: "open" },
        { sectionId: "chorus-1", energy: 0.9, cadence: "resolve" },
      ],
      orchestrationMatrix: [
        { sectionId: "verse-1", featuredTrack: "melody" },
        { sectionId: "chorus-1", featuredTrack: "bass" },
      ],
    },
    generationInterlock: {
      sectionContracts: [
        { sectionId: "verse-1", role: "development" },
        { sectionId: "chorus-1", role: "payoff" },
      ],
    },
    tracks: [
      {
        id: "drums",
        program: 0,
        notes: [
          { pitch: 36, start: 0, duration: 0.25, velocity: 100 },
          { pitch: 36, start: 8, duration: 0.25, velocity: 100 },
        ],
      },
      {
        id: "bass",
        program: 33,
        notes: [
          { id: "bass-verse", pitch: 45, start: 1, duration: 1, velocity: 90 },
          { id: "bass-boundary", pitch: 48, start: 7.5, duration: 1, velocity: 90 },
          { id: "bass-chorus", pitch: 41, start: 9, duration: 1, velocity: 94 },
        ],
      },
      {
        id: "melody",
        program: 80,
        notes: [
          { id: "melody-verse", pitch: 69, start: 2, duration: 0.5, velocity: 92 },
          { id: "melody-chorus", pitch: 72, start: 10, duration: 0.5, velocity: 98 },
        ],
      },
    ],
  };
}

function composerStub(source, input) {
  const candidate = structuredClone(source);
  candidate.id = `generated-${input.seed ?? "seed"}`;
  const targetIds = input.targetTrack ? [input.targetTrack] : candidate.tracks.map((track) => track.id);
  for (const track of candidate.tracks) {
    if (!targetIds.includes(track.id)) continue;
    track.notes = track.notes.map((note) => {
      const copy = { ...note };
      if (copy.start >= 8 && copy.start < 16 && track.id !== "drums") {
        copy.pitch += track.id === "bass" ? 12 : -12;
      }
      if (copy.start < 8 && input.targetTrack === track.id) copy.velocity -= 5;
      return copy;
    });
  }
  return candidate;
}

test("selection normalization supports whole song, instrument, section, and section instrument", () => {
  const song = sourceSong();
  assert.deepEqual(normalizeCompositionSelection({}, song), { target: "song" });
  assert.deepEqual(normalizeCompositionSelection({ target: "instrument", instrument: "bass" }, song), {
    target: "track",
    trackId: "bass",
  });
  assert.deepEqual(normalizeCompositionSelection({ target: "section", sectionId: "chorus-1" }, song), {
    target: "section",
    sectionId: "chorus-1",
  });
  assert.deepEqual(normalizeCompositionSelection({ target: "track", trackId: "bass", sectionId: "chorus-1" }, song), {
    target: "section-track",
    trackId: "bass",
    sectionId: "chorus-1",
  });
});

test("Director directive publishes the exact section blueprint, orchestration, and interlock", () => {
  const directive = createDirectorDirective(sourceSong(), {
    target: "track",
    sectionId: "chorus-1",
    trackId: "bass",
  });
  assert.equal(directive.selection.target, "section-track");
  assert.equal(directive.sectionPlan.sectionId, "chorus-1");
  assert.equal(directive.sectionPlan.cadence, "resolve");
  assert.equal(directive.orchestration.featuredTrack, "bass");
  assert.equal(directive.interlock.role, "payoff");
  assert.equal(directive.ensembleContext.sectionId, "chorus-1");
  assert.equal(directive.ensembleContext.intent.cadence, "resolve");
  assert.equal(directive.ensembleContext.intent.featuredTrack, "bass");
  assert.deepEqual(directive.ensembleContext.coordination.rhythmSection, ["drums", "bass"]);
  assert.deepEqual(directive.ensembleContext.coordination.leadConversation, ["melody", "counterpoint"]);
});

test("Director ensemble intent steers the Composer before scoped notes are accepted", () => {
  let observedInput = null;
  const observingComposer = (source, input) => {
    observedInput = structuredClone(input);
    return composerStub(source, input);
  };
  createCompositionCandidate(
    sourceSong(),
    { target: "track", sectionId: "chorus-1", trackId: "bass" },
    { seed: "director-route" },
    { composer: observingComposer },
  );

  assert.equal(observedInput.compositionRoute, "groove-first");
  assert.equal(observedInput.ensembleContext.intent.featuredTrack, "bass");
  assert.equal(observedInput.ensembleContext.intent.role, "payoff");
});


test("Chorus 1 → Bass changes only contained chorus bass notes and preserves boundary-crossing notes", () => {
  const source = sourceSong();
  const transaction = createCompositionCandidate(
    source,
    { target: "track", sectionId: "chorus-1", trackId: "bass" },
    { seed: "chorus-bass" },
    { composer: composerStub },
  );

  assert.equal(transaction.status, "candidate");
  assert.equal(transaction.validation.valid, true);
  assert.deepEqual(transaction.before, source);
  assert.deepEqual(source, sourceSong(), "source must remain immutable");

  const beforeBass = source.tracks.find((track) => track.id === "bass");
  const afterBass = transaction.after.tracks.find((track) => track.id === "bass");
  assert.equal(afterBass.notes.find((note) => note.id === "bass-chorus").pitch, 53);
  assert.deepEqual(
    afterBass.notes.find((note) => note.id === "bass-boundary"),
    beforeBass.notes.find((note) => note.id === "bass-boundary"),
    "boundary-crossing source notes must survive unchanged",
  );
  assert.deepEqual(
    transaction.after.tracks.find((track) => track.id === "melody"),
    source.tracks.find((track) => track.id === "melody"),
  );
});

test("whole-section candidate changes only that section while preserving blueprint and track metadata", () => {
  const source = sourceSong();
  const transaction = createCompositionCandidate(
    source,
    { target: "section", sectionId: "chorus-1" },
    { seed: "chorus-all" },
    { composer: composerStub },
  );

  assert.equal(transaction.validation.valid, true);
  assert.deepEqual(transaction.after.songBlueprint, source.songBlueprint);
  for (const id of ["bass", "melody"]) {
    const before = source.tracks.find((track) => track.id === id);
    const after = transaction.after.tracks.find((track) => track.id === id);
    assert.deepEqual(
      after.notes.filter((note) => note.start < 8),
      before.notes.filter((note) => note.start < 8),
      `${id} outside the selected section must stay unchanged`,
    );
    assert.equal(after.program, before.program);
  }
});

test("whole-instrument candidate leaves every other track byte-equivalent", () => {
  const source = sourceSong();
  const transaction = createCompositionCandidate(
    source,
    { target: "instrument", trackId: "melody" },
    { seed: "whole-melody" },
    { composer: composerStub },
  );

  assert.equal(transaction.validation.valid, true);
  assert.notDeepEqual(
    transaction.after.tracks.find((track) => track.id === "melody").notes,
    source.tracks.find((track) => track.id === "melody").notes,
  );
  assert.deepEqual(
    transaction.after.tracks.find((track) => track.id === "bass"),
    source.tracks.find((track) => track.id === "bass"),
  );
  assert.deepEqual(
    transaction.after.tracks.find((track) => track.id === "drums"),
    source.tracks.find((track) => track.id === "drums"),
  );
});

test("candidate creation is deterministic for the same source, selection, and seed", () => {
  const source = sourceSong();
  const args = [
    source,
    { target: "track", sectionId: "chorus-1", trackId: "bass" },
    { seed: "fixed-seed" },
    { composer: composerStub },
  ];
  assert.deepEqual(createCompositionCandidate(...args), createCompositionCandidate(...args));
});

test("validation catches out-of-scope mutation before acceptance", () => {
  const transaction = createCompositionCandidate(
    sourceSong(),
    { target: "track", sectionId: "chorus-1", trackId: "bass" },
    { seed: "tamper" },
    { composer: composerStub },
  );
  transaction.after.tracks.find((track) => track.id === "melody").notes[0].velocity = 1;

  const validation = validateCompositionCandidate(transaction);
  assert.equal(validation.valid, false);
  assert.ok(validation.issues.includes("scope-escape:melody"));
  assert.throws(() => acceptCompositionCandidate(transaction), /Cannot accept invalid composition candidate/);
});

test("validation catches an out-of-scale generated note in the selected scope", () => {
  const badComposer = (source) => {
    const candidate = structuredClone(source);
    candidate.tracks.find((track) => track.id === "bass").notes
      .find((note) => note.id === "bass-chorus").pitch = 42;
    return candidate;
  };
  const transaction = createCompositionCandidate(
    sourceSong(),
    { target: "track", sectionId: "chorus-1", trackId: "bass" },
    { seed: "bad-scale" },
    { composer: badComposer },
  );
  assert.equal(transaction.validation.valid, false);
  assert.ok(transaction.validation.issues.some((issue) => issue.startsWith("out-of-scale:bass:")));
});

test("accept commits only a valid candidate; reject restores the source snapshot", () => {
  const source = sourceSong();
  const transaction = createCompositionCandidate(
    source,
    { target: "track", sectionId: "chorus-1", trackId: "bass" },
    { seed: "accept-reject" },
    { composer: composerStub },
  );
  assert.deepEqual(acceptCompositionCandidate(transaction), transaction.after);
  assert.deepEqual(rejectCompositionCandidate(transaction), source);
});
