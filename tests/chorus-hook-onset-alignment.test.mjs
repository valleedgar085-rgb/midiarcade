import assert from "node:assert/strict";
import test from "node:test";
import { evaluateChorusHookRecurrence } from "../src/core/chorus-hook-recurrence.js";
import { createChorusHookRhythmCandidates } from "../src/core/chorus-hook-development.js";

const note = (start, pitch, duration = 0.3) => ({ start, pitch, duration, velocity: 86 });
const phrase = (base, starts, pitches) =>
  starts.map((offset, index) => note(base + offset, pitches[index]));

function fixture(first, second) {
  return {
    genre: "rap",
    meta: { genre: "rap", keyPc: 4, scaleIntervals: [0, 2, 3, 5, 7, 8, 10], beatsPerBar: 4 },
    structure: [
      { id: "chorus-1", name: "chorus", startBeat: 32, endBeat: 40 },
      { id: "verse", name: "verse", startBeat: 40, endBeat: 96 },
      { id: "chorus-2", name: "chorus", startBeat: 96, endBeat: 104 },
    ],
    tracks: [{ id: "melody", notes: [...first, ...second] }],
  };
}

test("return of five perfectly aligned attacks is recognized as a shortened phrase, not bad timing", () => {
  const source = phrase(32, [0.8, 2.489, 5.299, 5.85, 7.55, 7.7, 7.999],
    [62, 66, 59, 55, 66, 60, 62]);
  const returning = phrase(96, [0.802, 2.491, 5.301, 5.852, 7.552],
    [74, 78, 83, 79, 78]);
  const song = fixture(source, returning);
  const before = structuredClone(song);
  const comparison = evaluateChorusHookRecurrence(song).comparisons[0];
  assert.equal(comparison.sharedAttacks, 5);
  assert.equal(comparison.returnOnsetCoverage, 1);
  assert.equal(comparison.sourceOnsetCoverage, 0.714);
  assert.equal(comparison.missingTail, true);
  assert.equal(comparison.extraPickup, false);
  assert.equal(comparison.reason, "shortened-return");
  assert.deepEqual(createChorusHookRhythmCandidates(song), []);
  assert.deepEqual(song, before);
});

test("a new pickup and missing last note are diagnosed together without rewriting notes", () => {
  const source = phrase(32, [0.926, 2.926, 4.001, 6.801], [59, 59, 64, 60]);
  const returning = phrase(96, [0.001, 0.925, 2.925, 4.0], [64, 59, 60, 55]);
  const song = fixture(source, returning);
  const comparison = evaluateChorusHookRecurrence(song).comparisons[0];
  assert.equal(comparison.sharedAttacks, 3);
  assert.equal(comparison.sourceOnsetCoverage, 0.75);
  assert.equal(comparison.returnOnsetCoverage, 0.75);
  assert.equal(comparison.extraPickup, true);
  assert.equal(comparison.missingTail, true);
  assert.equal(comparison.reason, "pickup-and-shortened-return");
});

test("a genuinely shifted rhythmic hook is marked as having changed onsets", () => {
  const a = phrase(32, [0.5, 1.5, 2.5, 3.5, 4.5], [64, 67, 69, 67, 64]);
  const b = phrase(96, [0.875, 1.875, 2.875, 3.875, 4.875], [64, 67, 69, 67, 64]);
  const comparison = evaluateChorusHookRecurrence(fixture(a, b)).comparisons[0];
  assert.equal(comparison.sharedAttacks, 0);
  assert.equal(comparison.reason, "phrase-onsets-changed");
  assert.equal(comparison.returnOnsetCoverage, 0);
});

test("ordinary aligned repeated hook remains fully covered", () => {
  const a = phrase(32, [0.5, 1.5, 2.5, 3.5], [64, 67, 69, 67]);
  const b = phrase(96, [0.502, 1.499, 2.503, 3.497], [66, 69, 71, 69]);
  const comparison = evaluateChorusHookRecurrence(fixture(a, b)).comparisons[0];
  assert.equal(comparison.sharedAttacks, 4);
  assert.equal(comparison.sourceOnsetCoverage, 1);
  assert.equal(comparison.returnOnsetCoverage, 1);
  assert.equal(comparison.reason, "onsets-preserved");
});
