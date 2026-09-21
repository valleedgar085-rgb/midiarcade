import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeCompositionCandidate,
  judgeCompositionCandidate,
} from "../src/core/composition-candidate-judge.js";
import {
  acceptCompositionCandidate,
  createCompositionCandidate,
} from "../src/core/blueprint-composer.js";

function fixture() {
  return {
    id: "judge-source",
    seed: "judge-seed",
    meta: {
      beatsPerBar: 4,
      bars: 2,
      totalBeats: 8,
      keyPc: 0,
      scaleIntervals: [0, 2, 4, 5, 7, 9, 11],
    },
    structure: [
      { id: "chorus-1", name: "Chorus 1", startBeat: 0, endBeat: 8, bars: 2 },
    ],
    harmony: [
      { start: 0, duration: 4, rootPc: 0, tones: [0, 4, 7] },
      { start: 4, duration: 4, rootPc: 0, tones: [0, 4, 7] },
    ],
    songBlueprint: {
      sectionPlans: [
        { sectionId: "chorus-1", cadence: "open", density: 0.7, energy: 0.8 },
      ],
      orchestrationMatrix: [
        {
          sectionId: "chorus-1",
          featuredTrack: "melody",
          lanes: {
            melody: { presence: 1 },
            bass: { presence: 0.9 },
            drums: { presence: 1 },
          },
        },
      ],
    },
    generationInterlock: {
      sectionContracts: [
        {
          id: "interlock:chorus-1",
          sectionId: "chorus-1",
          role: "payoff",
          featuredTrack: "melody",
        },
      ],
    },
    grooveConductor: {
      bars: [
        { anchors: [0, 2], answers: [], chordPulses: [0, 2], counterPulses: [1, 3] },
        { anchors: [0, 2], answers: [], chordPulses: [0, 2], counterPulses: [1, 3] },
      ],
    },
    tracks: [
      {
        id: "drums",
        notes: [
          { pitch: 36, start: 0, duration: 0.2, velocity: 108 },
          { pitch: 38, start: 1, duration: 0.2, velocity: 102 },
          { pitch: 36, start: 2, duration: 0.2, velocity: 108 },
          { pitch: 38, start: 3, duration: 0.2, velocity: 102 },
          { pitch: 36, start: 4, duration: 0.2, velocity: 108 },
          { pitch: 38, start: 5, duration: 0.2, velocity: 102 },
          { pitch: 36, start: 6, duration: 0.2, velocity: 108 },
          { pitch: 38, start: 7, duration: 0.2, velocity: 102 },
        ],
      },
      {
        id: "bass",
        notes: [
          { id: "b1", pitch: 36, start: 0.1, duration: 0.6, velocity: 94 },
          { id: "b2", pitch: 36, start: 2.1, duration: 0.6, velocity: 94 },
          { id: "b3", pitch: 36, start: 4.1, duration: 0.6, velocity: 94 },
          { id: "b4", pitch: 36, start: 6.1, duration: 0.6, velocity: 94 },
        ],
      },
      {
        id: "chords",
        notes: [
          { pitch: 48, start: 0, duration: 1.5, velocity: 78 },
          { pitch: 52, start: 0, duration: 1.5, velocity: 76 },
          { pitch: 55, start: 0, duration: 1.5, velocity: 74 },
          { pitch: 48, start: 4, duration: 1.5, velocity: 78 },
          { pitch: 52, start: 4, duration: 1.5, velocity: 76 },
          { pitch: 55, start: 4, duration: 1.5, velocity: 74 },
        ],
      },
      {
        id: "melody",
        notes: [
          { id: "m1", pitch: 64, start: 0, duration: 0.5, velocity: 96, connectionId: "interlock:chorus-1" },
          { id: "m2", pitch: 67, start: 2, duration: 0.5, velocity: 98, connectionId: "interlock:chorus-1" },
          { id: "m3", pitch: 64, start: 4, duration: 0.5, velocity: 98, connectionId: "interlock:chorus-1" },
          { id: "m4", pitch: 67, start: 6, duration: 0.5, velocity: 100, connectionId: "interlock:chorus-1" },
        ],
      },
      {
        id: "counterpoint",
        notes: [
          { pitch: 72, start: 1, duration: 0.35, velocity: 78 },
          { pitch: 71, start: 3, duration: 0.35, velocity: 76 },
          { pitch: 72, start: 5, duration: 0.35, velocity: 78 },
          { pitch: 71, start: 7, duration: 0.35, velocity: 76 },
        ],
      },
      {
        id: "pad",
        notes: [
          { pitch: 48, start: 0, duration: 3.5, velocity: 62 },
          { pitch: 48, start: 4, duration: 3.5, velocity: 62 },
        ],
      },
    ],
  };
}

const MELODY_SELECTION = Object.freeze({
  target: "section-track",
  sectionId: "chorus-1",
  trackId: "melody",
});

function directive(overrides = {}) {
  return {
    sectionPlan: { sectionId: "chorus-1", cadence: "open", density: 0.7, ...overrides.sectionPlan },
    orchestration: {
      sectionId: "chorus-1",
      featuredTrack: "melody",
      lanes: { melody: { presence: 1 }, ...overrides.lanes },
    },
    interlock: {
      id: "interlock:chorus-1",
      sectionId: "chorus-1",
      featuredTrack: "melody",
      ...overrides.interlock,
    },
  };
}

test("candidate judge exposes inspectable harmony, groove, register, phrase and blueprint scores", () => {
  const song = fixture();
  const report = analyzeCompositionCandidate(song, MELODY_SELECTION, directive());
  assert.equal(report.harmony.harshStrongNotes, 0);
  assert.equal(report.register.violations, 0);
  assert.equal(report.collisions.sameTrack, 0);
  assert.equal(report.blueprint.missingTracks.length, 0);
  assert.ok(report.scores.overall >= 0 && report.scores.overall <= 100);
  assert.equal(judgeCompositionCandidate(song, structuredClone(song), MELODY_SELECTION, directive()).passed, true);
});

test("new harsh strong-beat color tone is rejected even when it remains in the selected scale", () => {
  const before = fixture();
  const after = structuredClone(before);
  for (const note of after.tracks.find((track) => track.id === "melody").notes) note.pitch = 65;
  const result = judgeCompositionCandidate(before, after, MELODY_SELECTION, directive());
  assert.equal(result.passed, false);
  assert.ok(result.hardIssues.includes("harmony:new-harsh-strong-note"));
});

test("new role-register violation is rejected", () => {
  const before = fixture();
  const after = structuredClone(before);
  after.tracks.find((track) => track.id === "melody").notes[1].pitch = 91;
  const result = judgeCompositionCandidate(before, after, MELODY_SELECTION, directive());
  assert.equal(result.passed, false);
  assert.ok(result.hardIssues.includes("register:new-role-window-violation"));
});

test("new overlapping unison inside a selected track is rejected", () => {
  const before = fixture();
  const after = structuredClone(before);
  after.tracks.find((track) => track.id === "melody").notes.push({
    id: "collision",
    pitch: 64,
    start: 0.2,
    duration: 0.4,
    velocity: 80,
  });
  const result = judgeCompositionCandidate(before, after, MELODY_SELECTION, directive());
  assert.equal(result.passed, false);
  assert.ok(result.hardIssues.includes("collision:new-same-track-overlap"));
});

test("bass candidate that abandons a previously strong kick relationship is rejected", () => {
  const before = fixture();
  const after = structuredClone(before);
  const bass = after.tracks.find((track) => track.id === "bass");
  bass.notes.forEach((note, index) => { note.start = 1 + index * 2; });
  const selection = { target: "section-track", sectionId: "chorus-1", trackId: "bass" };
  const result = judgeCompositionCandidate(before, after, selection, {
    ...directive(),
    orchestration: { sectionId: "chorus-1", featuredTrack: "bass", lanes: { bass: { presence: 1 } } },
    interlock: { id: "interlock:chorus-1", sectionId: "chorus-1", featuredTrack: "bass" },
  });
  assert.equal(result.passed, false);
  assert.ok(result.hardIssues.includes("groove:kick-bass-lock-regression"));
});

test("candidate that abandons explicit groove-conductor anchors is rejected", () => {
  const before = fixture();
  const after = structuredClone(before);
  after.tracks.find((track) => track.id === "melody").notes
    .forEach((note, index) => { note.start = 1 + index * 2; });
  const result = judgeCompositionCandidate(before, after, MELODY_SELECTION, directive());
  assert.equal(result.passed, false);
  assert.ok(result.hardIssues.includes("groove:conductor-regression"));
});

test("resolve-cadence selection cannot discard an already-correct chord-tone landing", () => {
  const before = fixture();
  before.songBlueprint.sectionPlans[0].cadence = "resolve";
  before.tracks.find((track) => track.id === "melody").notes.at(-1).start = 7.4;
  before.tracks.find((track) => track.id === "melody").notes.at(-1).pitch = 64;
  const after = structuredClone(before);
  after.tracks.find((track) => track.id === "melody").notes.at(-1).pitch = 62;
  const result = judgeCompositionCandidate(before, after, MELODY_SELECTION, directive({
    sectionPlan: { cadence: "resolve" },
  }));
  assert.equal(result.passed, false);
  assert.ok(result.hardIssues.includes("phrase:cadence-resolution-lost"));
});

test("featured blueprint lane cannot disappear during local regeneration", () => {
  const before = fixture();
  const after = structuredClone(before);
  after.tracks.find((track) => track.id === "melody").notes = [];
  const result = judgeCompositionCandidate(before, after, MELODY_SELECTION, directive());
  assert.equal(result.passed, false);
  assert.ok(result.hardIssues.includes("blueprint:required-track-missing"));
});

test("blueprint composer acceptance is actually blocked by Judge failures", () => {
  const source = fixture();
  const badComposer = (song) => {
    const candidate = structuredClone(song);
    for (const note of candidate.tracks.find((track) => track.id === "melody").notes) note.pitch = 65;
    return candidate;
  };
  const transaction = createCompositionCandidate(
    source,
    MELODY_SELECTION,
    { seed: "judge-integration" },
    { composer: badComposer },
  );
  assert.equal(transaction.validation.valid, false);
  assert.equal(transaction.validation.judge.passed, false);
  assert.ok(transaction.validation.issues.includes("harmony:new-harsh-strong-note"));
  assert.throws(() => acceptCompositionCandidate(transaction), /Cannot accept invalid composition candidate/);
});
