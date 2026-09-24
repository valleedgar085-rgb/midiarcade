import assert from "node:assert/strict";
import test from "node:test";

import {
  SPECIALIST_MUSICIAN_ORDER,
  createSpecialistDirectorPlan,
  runSpecialistMusicianGeneration,
} from "../src/core/specialist-musicians.js";
import { checkSpecialistEnsemble } from "../src/core/specialist-ensemble-checker.js";

function sourceSong() {
  return {
    id: "specialist-source",
    seed: "specialist-seed",
    meta: {
      genre: "pop",
      bpm: 100,
      bars: 4,
      beatsPerBar: 4,
      key: "A",
      keyPc: 9,
      scale: "minor",
      scaleIntervals: [0, 2, 3, 5, 7, 8, 10],
    },
    structure: [
      { id: "verse-1", name: "Verse 1", startBeat: 0, endBeat: 8, bars: 2, intent: { role: "development" } },
      { id: "chorus-1", name: "Chorus 1", startBeat: 8, endBeat: 16, bars: 2, intent: { role: "payoff" } },
    ],
    harmony: [
      { id: "a-minor", start: 0, duration: 8, rootPc: 9, tones: [9, 0, 4], symbol: "Am" },
      { id: "f-major", start: 8, duration: 8, rootPc: 5, tones: [5, 9, 0], symbol: "F" },
    ],
    grooveConductor: {
      id: "test-pocket",
      bars: [
        { bar: 0, sectionId: "verse-1", anchors: [0, 2], answers: [1.5, 3.5], chordPulses: [0, 2], counterPulses: [1, 3] },
        { bar: 1, sectionId: "verse-1", anchors: [0, 2], answers: [1.5, 3.5], chordPulses: [0, 2], counterPulses: [1, 3] },
        { bar: 2, sectionId: "chorus-1", anchors: [0, 2], answers: [1.5, 3.5], chordPulses: [0, 2], counterPulses: [1, 3] },
        { bar: 3, sectionId: "chorus-1", anchors: [0, 2], answers: [1.5, 3.5], chordPulses: [0, 2], counterPulses: [1, 3] },
      ],
    },
    songBlueprint: {
      intent: { groovePressure: 0.7, hookPressure: 0.72 },
      sections: [
        { sectionId: "verse-1", density: 0.5, cadence: "open" },
        { sectionId: "chorus-1", density: 0.72, cadence: "resolve" },
      ],
      orchestrationMatrix: [],
    },
    tracks: [
      { id: "drums", notes: [
        { pitch: 36, start: 0, duration: 0.1, velocity: 100 },
        { pitch: 38, start: 2, duration: 0.1, velocity: 96 },
        { pitch: 36, start: 8, duration: 0.1, velocity: 104 },
        { pitch: 38, start: 10, duration: 0.1, velocity: 98 },
      ] },
      { id: "bass", notes: [
        { pitch: 45, start: 0, duration: 1, velocity: 90 },
        { pitch: 45, start: 4, duration: 1, velocity: 90 },
        { pitch: 41, start: 8, duration: 1, velocity: 94 },
        { pitch: 41, start: 12, duration: 1, velocity: 94 },
      ] },
      { id: "chords", notes: [
        { pitch: 57, start: 0, duration: 2, velocity: 78 },
        { pitch: 60, start: 0, duration: 2, velocity: 75 },
        { pitch: 53, start: 8, duration: 2, velocity: 82 },
        { pitch: 57, start: 8, duration: 2, velocity: 79 },
      ] },
      { id: "melody", notes: [
        { pitch: 69, start: 1, duration: 0.5, velocity: 92 },
        { pitch: 72, start: 5, duration: 0.5, velocity: 94 },
        { pitch: 69, start: 9, duration: 0.5, velocity: 100 },
        { pitch: 72, start: 13, duration: 0.5, velocity: 102 },
      ] },
      { id: "counterpoint", notes: [
        { pitch: 64, start: 3, duration: 0.5, velocity: 74 },
        { pitch: 65, start: 7, duration: 0.5, velocity: 74 },
        { pitch: 64, start: 11, duration: 0.5, velocity: 78 },
        { pitch: 65, start: 15, duration: 0.5, velocity: 78 },
      ] },
      { id: "pad", notes: [
        { pitch: 57, start: 0, duration: 4, velocity: 66 },
        { pitch: 53, start: 8, duration: 4, velocity: 70 },
      ] },
    ],
  };
}

function safeComposer(source, input) {
  const song = structuredClone(source);
  const target = song.tracks.find((track) => track.id === input.targetTrack);
  if (target) {
    target.notes = target.notes.map((note, index) => ({
      ...note,
      velocity: Math.min(127, note.velocity + (index % 2)),
      specialistOwner: input.specialistMusician?.specialistId ?? null,
    }));
  }
  return song;
}

test("Director publishes the complete specialist musician chain in dependency order", () => {
  const plan = createSpecialistDirectorPlan(sourceSong());
  assert.deepEqual(plan.order, SPECIALIST_MUSICIAN_ORDER);
  assert.equal(plan.specialists.length, 9);
  assert.equal(plan.specialists.find((entry) => entry.id === "drums").trackId, "drums");
  assert.equal(plan.specialists.find((entry) => entry.id === "lead").trackId, "melody");
  assert.equal(plan.specialists.find((entry) => entry.id === "counterline").trackId, "counterpoint");
  assert.equal(plan.specialists.find((entry) => entry.id === "arp").trackId, "pad");
  assert.equal(plan.specialists.find((entry) => entry.id === "fx").kind, "authority");
  assert.deepEqual(
    plan.specialists.find((entry) => entry.id === "bass").dependsOn,
    ["harmony", "groove", "drums"],
  );
});

test("specialist generation commits one physical track at a time and finishes with ensemble check", () => {
  const result = runSpecialistMusicianGeneration(
    sourceSong(),
    { seed: "specialist-pass" },
    { composer: safeComposer },
  );

  assert.equal(result.stages.length, 9);
  assert.deepEqual(
    result.stages.map((stage) => stage.specialistId),
    SPECIALIST_MUSICIAN_ORDER,
  );
  assert.equal(result.stages.find((stage) => stage.specialistId === "harmony").status, "published");
  assert.equal(result.stages.find((stage) => stage.specialistId === "groove").status, "published");
  assert.equal(result.stages.find((stage) => stage.specialistId === "fx").status, "published");

  for (const id of ["drums", "bass", "chords", "lead", "counterline", "arp"]) {
    assert.equal(
      result.stages.find((stage) => stage.specialistId === id).status,
      "accepted",
      `${id} should own and commit its scoped candidate`,
    );
  }

  assert.equal(result.ensemble.checks.specialistPlanComplete, true);
  assert.equal(result.ensemble.checks.physicalTrackContract, true);
  assert.equal(result.ensemble.checks.scaleSafety, true);
});

test("a specialist cannot commit an unsafe out-of-scale part", () => {
  const unsafeComposer = (source, input) => {
    const song = safeComposer(source, input);
    if (input.targetTrack === "bass") {
      song.tracks.find((track) => track.id === "bass").notes[0].pitch = 46;
    }
    return song;
  };

  const result = runSpecialistMusicianGeneration(
    sourceSong(),
    { seed: "specialist-reject" },
    { composer: unsafeComposer },
  );
  const bassStage = result.stages.find((stage) => stage.specialistId === "bass");
  assert.equal(bassStage.status, "rejected");
  assert.ok(bassStage.issues.some((issue) => issue.startsWith("out-of-scale:bass:")));
  assert.equal(result.song.tracks.find((track) => track.id === "bass").notes[0].pitch, 45);
});

test("Ensemble Checker rejects global lead/counterline collision regressions", () => {
  const source = sourceSong();
  const candidate = structuredClone(source);
  candidate.tracks.find((track) => track.id === "counterpoint").notes.push({
    pitch: 69,
    start: 1,
    duration: 0.5,
    velocity: 80,
  });

  const result = checkSpecialistEnsemble(source, candidate, {
    plan: createSpecialistDirectorPlan(source),
    stages: [],
  });

  assert.equal(result.passed, false);
  assert.ok(result.hardIssues.includes("collision:new-lead-counterpoint-unison"));
});
