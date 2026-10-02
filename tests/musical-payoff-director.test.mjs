import assert from "node:assert/strict";
import test from "node:test";

import {
  createMusicalPayoffPlan,
  createSectionPayoffIntent,
  evaluateMusicalPayoffArc,
} from "../src/core/musical-payoff-director.js";

function fixture() {
  return {
    meta: { beatsPerBar: 4 },
    songBlueprint: {
      intent: {
        energyArc: { opening: 0.42, body: 0.62, peak: 0.88, release: 0.34 },
        spaceReserve: 0.54,
      },
    },
    structure: [
      { id: "intro-1", name: "Intro", startBeat: 0, endBeat: 4, bars: 1 },
      { id: "verse-1", name: "Verse", startBeat: 4, endBeat: 8, bars: 1 },
      { id: "pre-1", name: "Pre-Chorus", startBeat: 8, endBeat: 12, bars: 1 },
      { id: "chorus-1", name: "Chorus", startBeat: 12, endBeat: 16, bars: 1 },
      { id: "break-1", name: "Breakdown", startBeat: 16, endBeat: 20, bars: 1 },
      { id: "outro-1", name: "Outro", startBeat: 20, endBeat: 24, bars: 1 },
    ],
    tracks: [
      {
        id: "drums",
        notes: [
          { start: 0, duration: 0.1, pitch: 36, velocity: 84 },
          { start: 4, duration: 0.1, pitch: 36, velocity: 90 },
          { start: 8, duration: 0.1, pitch: 36, velocity: 96 },
          { start: 12, duration: 0.1, pitch: 36, velocity: 108 },
          { start: 14, duration: 0.1, pitch: 38, velocity: 104 },
          { start: 16, duration: 0.1, pitch: 36, velocity: 78 },
          { start: 20, duration: 0.1, pitch: 36, velocity: 72 },
        ],
      },
      {
        id: "bass",
        notes: [
          { start: 4, duration: 0.7, pitch: 45, velocity: 86 },
          { start: 8, duration: 0.7, pitch: 45, velocity: 92 },
          { start: 12, duration: 0.7, pitch: 45, velocity: 100 },
          { start: 14, duration: 0.7, pitch: 48, velocity: 102 },
          { start: 16, duration: 0.7, pitch: 45, velocity: 76 },
        ],
      },
      {
        id: "chords",
        notes: [
          { start: 0, duration: 2, pitch: 57, velocity: 68 },
          { start: 4, duration: 2, pitch: 57, velocity: 74 },
          { start: 8, duration: 2, pitch: 57, velocity: 82 },
          { start: 12, duration: 2, pitch: 57, velocity: 94 },
          { start: 16, duration: 2, pitch: 57, velocity: 68 },
          { start: 20, duration: 2, pitch: 57, velocity: 62 },
        ],
      },
      {
        id: "melody",
        notes: [
          { start: 5, duration: 0.5, pitch: 69, velocity: 86 },
          { start: 9, duration: 0.5, pitch: 71, velocity: 92 },
          { start: 13, duration: 0.5, pitch: 72, velocity: 104 },
          { start: 15, duration: 0.5, pitch: 74, velocity: 106 },
          { start: 21, duration: 0.5, pitch: 69, velocity: 70 },
        ],
      },
      {
        id: "counterpoint",
        notes: [
          { start: 13.75, duration: 0.3, pitch: 76, velocity: 92 },
        ],
      },
    ],
  };
}

test("payoff plan classifies song sections into a musical arc", () => {
  const plan = createMusicalPayoffPlan(fixture());
  assert.equal(plan.version, 1);
  assert.equal(plan.authority, "musical-payoff-director-v1");
  assert.deepEqual(
    plan.sections.map((section) => section.phase),
    ["opening", "body", "build", "payoff", "recovery", "release"],
  );
  assert.equal(plan.sections[0].mustBreathe, true);
  assert.equal(plan.sections[2].mustLiftFromPrevious, true);
  assert.equal(plan.sections[3].mustLiftFromPrevious, true);
  assert.equal(plan.sections[4].mustBreathe, true);
  assert.ok(plan.sections[3].targetEnergy > plan.sections[1].targetEnergy);
  assert.ok(plan.sections[4].targetSpace > plan.sections[3].targetSpace);
});

test("section payoff intent exposes exact target role and pressure goals", () => {
  const intent = createSectionPayoffIntent(fixture(), "chorus-1");
  assert.equal(intent.phase, "payoff");
  assert.equal(intent.role, "deliver");
  assert.equal(intent.payoff, true);
  assert.equal(intent.targetEnergy, 0.88);
  assert.ok(intent.targetSpace < createSectionPayoffIntent(fixture(), "intro-1").targetSpace);
});

test("payoff evaluator recognizes lift into chorus and breathing after it", () => {
  const report = evaluateMusicalPayoffArc(fixture());
  assert.equal(report.available, true);
  const intoChorus = report.transitions.find((entry) => entry.toSectionId === "chorus-1");
  const intoBreak = report.transitions.find((entry) => entry.toSectionId === "break-1");
  assert.equal(intoChorus.expectedLift, true);
  assert.equal(intoChorus.liftHealthy, true, JSON.stringify(intoChorus));
  assert.equal(intoBreak.expectedBreath, true);
  assert.equal(intoBreak.breathHealthy, true, JSON.stringify(intoBreak));
  assert.ok(!report.issues.includes("opening-too-hot"), JSON.stringify(report));
});

test("payoff evaluator flags a chorus that fails to lift", () => {
  const source = fixture();
  for (const track of source.tracks) {
    track.notes = track.notes.filter((note) => note.start < 12 || note.start >= 16);
  }
  source.tracks.find((track) => track.id === "drums").notes.push(
    { start: 12, duration: 0.1, pitch: 36, velocity: 72 },
  );
  source.tracks.find((track) => track.id === "chords").notes.push(
    { start: 12, duration: 2, pitch: 57, velocity: 66 },
  );

  const report = evaluateMusicalPayoffArc(source);
  assert.ok(report.issues.includes("weak-lift:chorus-1"), JSON.stringify(report));
});
