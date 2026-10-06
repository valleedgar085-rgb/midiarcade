import test from "node:test";
import assert from "node:assert/strict";

import {
  generateNew,
  normalizeConfig,
  refineAutoScaleFromHarmony,
} from "../src/music-engine.js";

function pitchClass(value) {
  return ((Math.round(Number(value)) % 12) + 12) % 12;
}

test("Auto Scale refinement runs in the real generateNew composition path", () => {
  const input = {
    genre: "jazz",
    key: "C",
    mode: "auto",
    scaleSelection: "auto",
    chordPath: "jazz",
    seed: "auto-scale-production-path",
    bars: 4,
    candidateCount: 1,
  };

  const first = generateNew(input);
  const second = generateNew(input);

  assert.ok(first.meta.autoScaleRefinement);
  assert.equal(first.meta.autoScaleRefinement.authority, "auto-scale-harmony-refinement-v1");
  assert.equal(first.meta.autoScaleRefinement.selectedScale, first.meta.scale);
  assert.ok(first.meta.autoScaleRefinement.context.length >= 1);
  assert.deepEqual(first.meta.autoScaleRefinement, second.meta.autoScaleRefinement);
  assert.equal(first.meta.scale, second.meta.scale);
});

test("final harmony is regenerated inside the selected Auto scale", () => {
  const song = generateNew({
    genre: "pop",
    key: "C",
    mode: "auto",
    scaleSelection: "auto",
    chordPath: "pop",
    seed: "auto-scale-final-harmony",
    bars: 4,
    candidateCount: 1,
  });

  const allowed = new Set(song.meta.scaleIntervals.map((interval) => pitchClass(song.meta.keyPc + interval)));
  for (const event of song.harmony) {
    for (const tone of event.tones ?? []) {
      assert.ok(
        allowed.has(pitchClass(tone)),
        `harmony tone ${tone} must belong to final selected scale ${song.meta.scale}`,
      );
    }
  }
});

test("explicit scale bypasses harmony refinement", () => {
  const song = generateNew({
    genre: "jazz",
    key: "C",
    mode: "dorian",
    scaleSelection: "explicit",
    chordPath: "jazz",
    seed: "explicit-scale-no-refinement",
    bars: 4,
    candidateCount: 1,
  });

  assert.equal(song.meta.scale, "dorian");
  assert.equal(song.meta.autoScaleRefinement, null);
});

test("refinement helper can change an Auto config from real chord context", () => {
  const config = normalizeConfig({
    genre: "jazz",
    key: "C",
    mode: "auto",
    scaleSelection: "auto",
    chordPath: "jazz",
    seed: "auto-scale-helper-context",
  });

  const result = refineAutoScaleFromHarmony(config, [
    { symbol: "Dm7", rootPc: 2, tones: [2, 5, 9, 0] },
    { symbol: "Cmaj7", rootPc: 0, tones: [0, 4, 7, 11] },
    { symbol: "G7", rootPc: 7, tones: [7, 11, 2, 5] },
  ]);

  assert.ok(result.report);
  assert.equal(result.report.selectedScale, result.config.scale);
  assert.deepEqual(result.report.context, ["Dm7", "Cmaj7", "G7"]);
  assert.ok(Array.isArray(result.config.scaleIntervals));
  assert.ok(result.config.scaleIntervals.length > 0);
});
