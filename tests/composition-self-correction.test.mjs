import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_COMPOSITION_CORRECTION_ATTEMPTS,
  createCompositionCorrectionInput,
  createSelfCorrectingCompositionCandidate,
  diagnoseCompositionCandidate,
} from "../src/core/composition-self-correction.js";

function sourceSong() {
  return {
    id: "self-correction-source",
    seed: "source-seed",
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
        { sectionId: "chorus-1", cadence: "open", density: 0.7, energy: 0.85 },
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
          { id: "b1", pitch: 36, start: 0.1, duration: 0.5, velocity: 94 },
          { id: "b2", pitch: 36, start: 2.1, duration: 0.5, velocity: 94 },
          { id: "b3", pitch: 36, start: 4.1, duration: 0.5, velocity: 94 },
          { id: "b4", pitch: 36, start: 6.1, duration: 0.5, velocity: 94 },
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
          { id: "m1", pitch: 64, start: 0, duration: 0.45, velocity: 96, connectionId: "interlock:chorus-1" },
          { id: "m2", pitch: 67, start: 2, duration: 0.45, velocity: 98, connectionId: "interlock:chorus-1" },
          { id: "m3", pitch: 64, start: 4, duration: 0.45, velocity: 98, connectionId: "interlock:chorus-1" },
          { id: "m4", pitch: 67, start: 6, duration: 0.45, velocity: 100, connectionId: "interlock:chorus-1" },
        ],
      },
      { id: "counterpoint", notes: [] },
      { id: "pad", notes: [] },
    ],
  };
}

const MELODY = Object.freeze({
  target: "section-track",
  sectionId: "chorus-1",
  trackId: "melody",
});

const BASS = Object.freeze({
  target: "section-track",
  sectionId: "chorus-1",
  trackId: "bass",
});

test("diagnosis maps validator failures to one repair focus and blocks safety-contract retries", () => {
  const harmony = diagnoseCompositionCandidate({
    validation: { valid: false, issues: ["out-of-scale:melody:61", "harmony:new-harsh-strong-note"] },
  });
  assert.equal(harmony.shouldRetry, true);
  assert.equal(harmony.focusGroup, "harmony");
  assert.equal(harmony.focusRoute, "harmony-first");

  const safety = diagnoseCompositionCandidate({
    validation: { valid: false, issues: ["scope-escape:bass", "groove:conductor-regression"] },
  });
  assert.equal(safety.shouldRetry, false);
  assert.equal(safety.reason, "safety-contract-failure");
  assert.equal(safety.focusGroup, "safety");
});

test("a valid first candidate stops immediately with no correction pass", () => {
  const calls = [];
  const composer = (source, input) => {
    calls.push(structuredClone(input));
    return structuredClone(source);
  };
  const transaction = createSelfCorrectingCompositionCandidate(
    sourceSong(),
    MELODY,
    { seed: "already-good" },
    { composer },
  );

  assert.equal(transaction.validation.valid, true);
  assert.equal(calls.length, 1);
  assert.equal(transaction.selfCorrection.attemptCount, 1);
  assert.equal(transaction.selfCorrection.selectedAttempt, 0);
  assert.equal(transaction.selfCorrection.passed, true);
  assert.equal(transaction.selfCorrection.stoppedReason, "candidate-valid");
});

test("harmony failure receives one deterministic harmony-first retry and then passes", () => {
  const source = sourceSong();
  const before = structuredClone(source);
  const calls = [];
  const composer = (canonical, input) => {
    calls.push({ source: structuredClone(canonical), input: structuredClone(input) });
    const candidate = structuredClone(canonical);
    const melody = candidate.tracks.find((track) => track.id === "melody");
    if (input.producerCorrection?.focusGroup !== "harmony") {
      melody.notes.forEach((note) => { note.pitch = 61; });
    }
    return candidate;
  };

  const transaction = createSelfCorrectingCompositionCandidate(
    source,
    MELODY,
    { seed: "harmony-repair" },
    { composer },
  );

  assert.equal(transaction.validation.valid, true);
  assert.equal(calls.length, 2);
  assert.deepEqual(source, before, "canonical source must never be mutated");
  assert.deepEqual(calls[0].source, before);
  assert.deepEqual(calls[1].source, before, "failed candidate must never become the next source");
  assert.equal(calls[1].input.producerCorrection.focusGroup, "harmony");
  assert.equal(calls[1].input.compositionRoute, "harmony-first");
  assert.equal(calls[1].input.candidateCount, 1);
  assert.equal(calls[1].input.adaptiveCandidates, false);
  assert.equal(calls[1].input.targetedRepair, false);
  assert.match(calls[1].input.seed, /repair:harmony:1$/);
  assert.equal(transaction.selfCorrection.selectedAttempt, 1);
});

test("explicit user composition route survives a focused retry", () => {
  const calls = [];
  const composer = (source, input) => {
    calls.push(structuredClone(input));
    const candidate = structuredClone(source);
    if (!input.producerCorrection) {
      candidate.tracks.find((track) => track.id === "melody").notes.forEach((note) => { note.pitch = 61; });
    }
    return candidate;
  };

  const transaction = createSelfCorrectingCompositionCandidate(
    sourceSong(),
    MELODY,
    {
      seed: "explicit-route",
      compositionRoute: "hook-first",
    },
    { composer },
  );

  assert.equal(transaction.validation.valid, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].input?.compositionRoute ?? calls[1].compositionRoute, "hook-first");
  assert.equal(calls[1].compositionRoute, "hook-first");
  assert.equal(calls[1].producerCorrection.focusGroup, "harmony");
  assert.equal(calls[1].producerCorrection.focusRoute, "harmony-first");
});

test("register failure retries with professional register protection without changing the selected scope", () => {
  const calls = [];
  const composer = (source, input) => {
    calls.push(structuredClone(input));
    const candidate = structuredClone(source);
    const melody = candidate.tracks.find((track) => track.id === "melody");
    if (input.producerCorrection?.focusGroup !== "register") {
      melody.notes[1].pitch = 88;
    }
    return candidate;
  };

  const transaction = createSelfCorrectingCompositionCandidate(
    sourceSong(),
    MELODY,
    { seed: "register-repair" },
    { composer },
  );

  assert.equal(transaction.validation.valid, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].producerCorrection.focusGroup, "register");
  assert.equal(calls[1].professionalUpgrade, true);
  assert.deepEqual(transaction.selection, MELODY);
});

test("groove failure receives groove-first retry instead of rewriting another instrument", () => {
  const calls = [];
  const composer = (source, input) => {
    calls.push(structuredClone(input));
    const candidate = structuredClone(source);
    const bass = candidate.tracks.find((track) => track.id === "bass");
    if (input.producerCorrection?.focusGroup !== "groove") {
      bass.notes.forEach((note, index) => { note.start = 1 + index * 2; });
    }
    return candidate;
  };

  const transaction = createSelfCorrectingCompositionCandidate(
    sourceSong(),
    BASS,
    { seed: "groove-repair" },
    { composer },
  );

  assert.equal(transaction.validation.valid, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].producerCorrection.focusGroup, "groove");
  assert.equal(calls[1].compositionRoute, "groove-first");
  assert.deepEqual(transaction.selection, BASS);
  assert.deepEqual(
    transaction.after.tracks.find((track) => track.id === "melody"),
    sourceSong().tracks.find((track) => track.id === "melody"),
  );
});

test("self-correction never exceeds the hard three-attempt ceiling", () => {
  let calls = 0;
  const composer = (source) => {
    calls += 1;
    const candidate = structuredClone(source);
    candidate.tracks.find((track) => track.id === "melody").notes.forEach((note) => { note.pitch = 61; });
    return candidate;
  };

  const transaction = createSelfCorrectingCompositionCandidate(
    sourceSong(),
    MELODY,
    { seed: "never-valid" },
    { composer, maxAttempts: 99 },
  );

  assert.equal(MAX_COMPOSITION_CORRECTION_ATTEMPTS, 3);
  assert.equal(calls, 3);
  assert.equal(transaction.selfCorrection.maxAttempts, 3);
  assert.equal(transaction.selfCorrection.attemptCount, 3);
  assert.equal(transaction.selfCorrection.passed, false);
  assert.equal(transaction.selfCorrection.exhausted, true);
  assert.equal(transaction.validation.valid, false);
});

test("correction input is deterministic and disables nested engine search", () => {
  const source = sourceSong();
  const diagnosis = {
    focusGroup: "groove",
    focusRoute: "groove-first",
    issues: ["groove:kick-bass-lock-regression"],
  };
  const first = createCompositionCorrectionInput(source, BASS, { seed: "stable" }, diagnosis, 2);
  const second = createCompositionCorrectionInput(source, BASS, { seed: "stable" }, diagnosis, 2);

  assert.deepEqual(first, second);
  assert.equal(first.candidateCount, 1);
  assert.equal(first.adaptiveCandidates, false);
  assert.equal(first.weaknessAwareSearch, false);
  assert.equal(first.targetedRepair, false);
  assert.equal(first.selfCorrection, false);
  assert.equal(first.producerCorrection.pass, 2);
  assert.match(first.seed, /repair:groove:2$/);
});
