import assert from "node:assert/strict";
import test from "node:test";
import {
  analyzeSectionRelationship,
  nearestScalePitch,
  transposeScaleStep,
} from "../src/ui/shape-logic.js";

test("scale-safe drawing snaps chromatic pitches deterministically without leaving MIDI bounds", () => {
  const major = { scalePitchClasses: [0, 2, 4, 5, 7, 9, 11] };
  assert.equal(nearestScalePitch(61, major), 60, "equidistant pitches should resolve downward");
  assert.equal(nearestScalePitch(66, major), 65);
  assert.equal(nearestScalePitch(-999, major), 0);
  assert.equal(nearestScalePitch(999, major), 127);
  assert.equal(nearestScalePitch(61, null), 61, "missing guide data should preserve the bounded pitch");
});

test("piano-roll arrows travel by scale degree and remain safe at register boundaries", () => {
  const dorian = { scalePitchClasses: [0, 2, 3, 5, 7, 9, 10] };
  assert.equal(transposeScaleStep(60, 1, dorian), 62);
  assert.equal(transposeScaleStep(60, -1, dorian), 58);
  assert.equal(transposeScaleStep(127, 1, dorian), 127);
  assert.equal(transposeScaleStep(0, -1, dorian), 0);
  assert.equal(transposeScaleStep(61, 0, dorian), 60);
});

test("relationship analysis distinguishes locked attacks from breathing space and rejects malformed input", () => {
  const primary = [{ start: 0 }, { start: 1 }, { start: 2 }, { start: 3 }];
  const partner = [{ start: 0.04 }, { start: 2.06 }, { start: 7 }];
  assert.deepEqual(analyzeSectionRelationship(primary, partner), {
    primaryNotes: 4,
    partnerNotes: 3,
    sharedAttacks: 2,
    breathingNotes: 2,
    interlockRatio: 0.5,
  });
  assert.deepEqual(analyzeSectionRelationship(null, "bad"), {
    primaryNotes: 0,
    partnerNotes: 0,
    sharedAttacks: 0,
    breathingNotes: 0,
    interlockRatio: 0,
  });
});
