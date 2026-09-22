import assert from "node:assert/strict";
import test from "node:test";

import {
  applyTransitionFxRefinement,
  createTransitionFxCandidate,
  MAX_TRANSITION_FX_BOUNDARIES,
} from "../src/core/transition-fx-refinement.js";

function fixture(genre = "techno") {
  const structure = [
    { id: "intro-1", name: "intro", startBeat: 0, endBeat: 8, bars: 2 },
    { id: "build-1", name: "build", startBeat: 8, endBeat: 16, bars: 2 },
    { id: "drop-1", name: "drop", startBeat: 16, endBeat: 32, bars: 4 },
    { id: "breakdown-1", name: "breakdown", startBeat: 32, endBeat: 40, bars: 2 },
    { id: "build-2", name: "build", startBeat: 40, endBeat: 48, bars: 2 },
    { id: "drop-2", name: "drop", startBeat: 48, endBeat: 64, bars: 4 },
  ];
  const notes = [{ pitch: 60, start: 0, duration: 64, velocity: 80 }];
  return {
    genre,
    meta: { genre, totalBeats: 64, beatsPerBar: 4 },
    structure,
    tracks: [
      { id: "drums", settings: { reverb: 0.12 }, automation: [], notes: [{ pitch: 36, start: 0, duration: 0.25, velocity: 100 }] },
      { id: "bass", settings: { reverb: 0.08 }, automation: [], notes: [{ pitch: 43, start: 0, duration: 1, velocity: 92 }] },
      { id: "chords", settings: { reverb: 0.3 }, automation: [{ type: "cc", controller: 11, beat: 0, value: 112 }], notes: structuredClone(notes) },
      { id: "counterpoint", settings: { reverb: 0.36 }, automation: [], notes: structuredClone(notes) },
      { id: "pad", settings: { reverb: 0.58 }, automation: [], notes: structuredClone(notes) },
    ],
    arrangementTransitions: [
      { fromSectionId: "intro-1", toSectionId: "build-1", type: "build", pickupBeats: 1 },
      { fromSectionId: "build-1", toSectionId: "drop-1", type: "launch", pickupBeats: 1 },
      { fromSectionId: "drop-1", toSectionId: "breakdown-1", type: "drop-out", pickupBeats: 0.5 },
      { fromSectionId: "breakdown-1", toSectionId: "build-2", type: "build", pickupBeats: 1 },
      { fromSectionId: "build-2", toSectionId: "drop-2", type: "launch", pickupBeats: 1 },
    ],
  };
}

test("transition FX adds bounded CC74/CC91 automation without changing notes", () => {
  const source = fixture("techno");
  const beforeNotes = structuredClone(source.tracks.map(({ id, notes }) => ({ id, notes })));
  const result = createTransitionFxCandidate(source, { genre: "techno" });

  assert.equal(result.changed, true);
  assert.deepEqual(source.tracks.map(({ id, notes }) => ({ id, notes })), beforeNotes, "source song must remain immutable");
  assert.deepEqual(result.song.tracks.map(({ id, notes }) => ({ id, notes })), beforeNotes, "transition FX must never rewrite notes");
  assert.ok(result.diagnostics.transitionsShaped <= MAX_TRANSITION_FX_BOUNDARIES);
  assert.deepEqual(result.diagnostics.controllers, [74, 91]);

  const automation = result.song.tracks.flatMap((track) => track.automation ?? []);
  const fx = automation.filter((event) => event.transitionFxVersion === 1);
  assert.ok(fx.length > 0);
  assert.ok(fx.every((event) => [74, 91].includes(event.controller)));
  assert.ok(fx.every((event) => event.beat >= 0 && event.beat <= 64));
  assert.ok(fx.every((event) => event.value >= 0 && event.value <= 127));
});

test("transition FX is deterministic, idempotent, and preserves manual controller points", () => {
  const source = fixture("pop");
  source.tracks.find((track) => track.id === "chords").automation.push(
    { type: "cc", controller: 74, beat: 15.9375, value: 77 },
  );
  const first = createTransitionFxCandidate(source, { genre: "pop" });
  const second = createTransitionFxCandidate(source, { genre: "pop" });
  const repeated = createTransitionFxCandidate(first.song, { genre: "pop" });

  assert.deepEqual(first, second);
  const manual = repeated.song.tracks.find((track) => track.id === "chords").automation
    .filter((event) => event.controller === 74 && Math.abs(event.beat - 15.9375) < 1e-7);
  assert.equal(manual.length, 1);
  assert.equal(manual[0].value, 77);
  const firstFx = first.song.tracks.flatMap((track) => track.automation ?? []).filter((event) => event.transitionFxVersion === 1);
  const repeatedFx = repeated.song.tracks.flatMap((track) => track.automation ?? []).filter((event) => event.transitionFxVersion === 1);
  assert.equal(repeatedFx.length, firstFx.length, "rerunning the pass must replace its own points, not multiply them");
});

test("Jazz and Rock transition FX stay intentionally subtler than Techno", () => {
  const peakLift = (genre) => {
    const result = createTransitionFxCandidate(fixture(genre), { genre });
    const chords = result.song.tracks.find((track) => track.id === "chords");
    return Math.max(...chords.automation.filter((event) => event.controller === 74).map((event) => event.value));
  };
  assert.ok(peakLift("techno") > peakLift("rock"));
  assert.ok(peakLift("rock") > peakLift("jazz"));
});

test("transition FX still passes through the release-gate boundary before acceptance", () => {
  const source = fixture("techno");
  const accepted = applyTransitionFxRefinement(
    source,
    { genre: "techno", transitionFxRefinement: true },
    () => ({ score: 90, diagnostics: { scaleFit: 1 }, subscores: {} }),
    () => ({ passed: true }),
  );
  assert.equal(accepted.diagnostics.accepted, true);
  assert.notStrictEqual(accepted.song, source);

  const rejected = applyTransitionFxRefinement(
    source,
    { genre: "techno", transitionFxRefinement: true },
    () => ({ score: 90, diagnostics: { scaleFit: 1 }, subscores: {} }),
    () => ({ passed: false }),
  );
  assert.equal(rejected.diagnostics.accepted, false);
  assert.strictEqual(rejected.song, source);
});
