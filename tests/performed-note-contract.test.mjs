import assert from "node:assert/strict";
import test from "node:test";

import {
  performanceTransformForNote,
  resolvePerformedNote,
} from "../src/core/performed-note-contract.js";

test("performed note resolver preserves legacy note behavior", () => {
  const note = {
    start: 1.25,
    duration: 0.5,
    pitch: 72,
    velocity: 91,
    articulation: "accent",
    microtimingMs: -7,
  };
  assert.deepEqual(resolvePerformedNote(note), {
    start: 1.25,
    duration: 0.5,
    pitch: 72,
    velocity: 91,
    articulation: "accent",
    microtimingMs: -7,
    finalized: false,
    source: "legacy-note",
  });
  assert.deepEqual(
    performanceTransformForNote(note, { velocityDelta: 4, durationScale: 1.2 }),
    { velocityDelta: 4, durationScale: 1.2, source: "legacy-performance" },
  );
});

test("performed note resolver gives finalized performance precedence", () => {
  const note = {
    start: 0,
    duration: 2,
    pitch: 60,
    velocity: 40,
    performed: {
      startBeat: 1.25,
      durationBeats: 0.5,
      renderedMidiPitch: 72,
      velocity: 100,
      articulation: "connected",
      microtimingMs: -9,
    },
  };
  const resolved = resolvePerformedNote(note);
  assert.equal(resolved.start, 1.25);
  assert.equal(resolved.duration, 0.5);
  assert.equal(resolved.pitch, 72);
  assert.equal(resolved.velocity, 100);
  assert.equal(resolved.articulation, "connected");
  assert.equal(resolved.microtimingMs, -9);
  assert.equal(resolved.finalized, true);
  assert.deepEqual(
    performanceTransformForNote(note, { velocityDelta: 12, durationScale: 1.8 }),
    { velocityDelta: 0, durationScale: 1, source: "performed-final" },
    "finalized performed notes must never receive legacy performance twice",
  );
});
