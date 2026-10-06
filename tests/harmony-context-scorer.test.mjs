import test from "node:test";
import assert from "node:assert/strict";

import {
  HARMONY_CONTEXT_WEIGHTS,
  rankHarmonyScaleCandidates,
  scoreHarmonyScaleCandidate,
} from "../src/core/harmony-context-scorer.js";

const C_MAJOR = [0, 2, 4, 5, 7, 9, 11];
const C_DORIAN = [0, 2, 3, 5, 7, 9, 10];
const C_BLUES = [0, 3, 5, 6, 7, 10];

test("harmony context weights form a complete base score", () => {
  const total = Object.values(HARMONY_CONTEXT_WEIGHTS).reduce((sum, value) => sum + value, 0);
  assert.equal(Number(total.toFixed(10)), 1);
});

test("chord and guide-tone fit outrank a modest genre preference", () => {
  const ranked = rankHarmonyScaleCandidates({
    genre: "jazz",
    chord: { rootPc: 0, tones: [0, 4, 7, 11] },
    candidates: [
      { scale: "dorian", pitchClasses: C_DORIAN },
      { scale: "major", pitchClasses: C_MAJOR },
    ],
  });

  assert.equal(ranked[0].scale, "major");
  assert.ok(ranked[0].metrics.chordFit > ranked[1].metrics.chordFit);
  assert.ok(ranked[0].metrics.guideToneFit > ranked[1].metrics.guideToneFit);
});

test("common tones and semitone resolution are visible in the score breakdown", () => {
  const result = scoreHarmonyScaleCandidate({
    genre: "jazz",
    candidate: { scale: "major", pitchClasses: C_MAJOR },
    previousChord: { rootPc: 5, tones: [5, 9, 0, 4] },
    chord: { rootPc: 2, tones: [2, 5, 9, 0] },
    nextChord: { rootPc: 7, tones: [7, 11, 2, 5] },
  });

  assert.equal(result.metrics.commonToneFit, 1);
  assert.ok(result.metrics.semitoneResolution > 0);
});

test("melody fit can break an otherwise close harmonic choice", () => {
  const ranked = rankHarmonyScaleCandidates({
    genre: "",
    chord: { rootPc: 0, tones: [0, 3, 7] },
    melodyPitchClasses: [3, 6, 10],
    candidates: [
      { scale: "dorian", pitchClasses: C_DORIAN },
      { scale: "blues", pitchClasses: C_BLUES },
    ],
  });

  assert.equal(ranked[0].scale, "blues");
  assert.equal(ranked[0].metrics.melodyFit, 1);
  assert.ok(ranked[0].score > ranked[1].score);
});

test("genre prior remains a small additive tiebreaker", () => {
  const jazz = scoreHarmonyScaleCandidate({
    genre: "jazz",
    candidate: { scale: "dorian", pitchClasses: C_DORIAN },
  });
  const unsupported = scoreHarmonyScaleCandidate({
    genre: "hipHop",
    candidate: { scale: "dorian", pitchClasses: C_DORIAN },
  });

  assert.equal(jazz.baseScore, unsupported.baseScore);
  assert.equal(jazz.genreBonus, 0.08);
  assert.equal(unsupported.genreBonus, 0);
  assert.ok(jazz.score > unsupported.score);
});

test("ranking is deterministic and does not mutate candidate input", () => {
  const candidates = [
    { scale: "major", pitchClasses: [...C_MAJOR] },
    { scale: "dorian", pitchClasses: [...C_DORIAN] },
  ];
  const before = structuredClone(candidates);
  const input = {
    genre: "pop",
    chord: { rootPc: 0, tones: [0, 4, 7] },
    nextChord: { rootPc: 7, tones: [7, 11, 2, 5] },
    melodyPitchClasses: [0, 4, 7, 9],
    candidates,
  };

  const first = rankHarmonyScaleCandidates(input);
  const second = rankHarmonyScaleCandidates(input);
  assert.deepEqual(first, second);
  assert.deepEqual(candidates, before);
});
