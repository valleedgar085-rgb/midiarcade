import assert from "node:assert/strict";
import test from "node:test";

import {
  CANONICAL_MUSICAL_EVENT_SCHEMA,
  createCanonicalMusicalEvent,
  validateCanonicalMusicalEvent,
} from "../src/core/canonical-musical-event.js";

function baseEvent(overrides = {}) {
  return createCanonicalMusicalEvent({
    id: "melody:0:4.125",
    trackId: "melody",
    roleId: "lead",
    sectionId: "chorus",
    time: 4.125,
    duration: 0.5,
    semanticPitch: {
      type: "pitched",
      pitchClass: 9,
      scaleDegree: 1,
      inScale: true,
    },
    renderedMidiPitch: 69,
    velocity: 88,
    chordContext: { id: "harmony-2", chord: "Am9" },
    motifId: "hook-A",
    motifSource: "native",
    phraseRole: "answer",
    phraseRoleSource: "native",
    articulation: "connected",
    note: {
      source: "lead-brain",
      sectionPatternId: "chorus-lead-pocket",
      compositionReason: "answer previous hook phrase",
      probability: 0.92,
    },
    ...overrides,
  });
}

test("canonical musical event preserves the rendered note as the performed authority", () => {
  const event = baseEvent();
  const validation = validateCanonicalMusicalEvent(event);

  assert.equal(event.schema, CANONICAL_MUSICAL_EVENT_SCHEMA);
  assert.equal(event.version, 1);
  assert.equal(event.time, event.performed.startBeat);
  assert.equal(event.duration, event.performed.durationBeats);
  assert.equal(event.renderedMidiPitch, event.performed.renderedMidiPitch);
  assert.equal(event.velocity, event.performed.velocity);
  assert.equal(event.articulation, event.performed.articulation);
  assert.equal(event.intent.source, "lead-brain");
  assert.equal(event.intent.reason, "answer previous hook phrase");
  assert.equal(event.intent.rhythmSource, "chorus-lead-pocket");
  assert.equal(validation.passed, true, validation.issues?.join(", "));
});

test("canonical musical event marks performed timing as fallback when no pre-performance timing exists", () => {
  const event = baseEvent();

  assert.equal(event.canonical.startBeat, 4.125);
  assert.equal(event.canonical.durationBeats, 0.5);
  assert.equal(event.canonical.timingSource, "performed-fallback");
  assert.equal(event.canonical.durationSource, "performed-fallback");
  assert.equal(event.performed.timingDeltaBeats, 0);
  assert.equal(event.performed.durationDeltaBeats, 0);
});

test("canonical musical event keeps intended timing separate from performed timing", () => {
  const event = baseEvent({
    time: 4.11,
    duration: 0.44,
    velocity: 91,
    note: {
      canonicalStartBeat: 4,
      canonicalDurationBeats: 0.5,
      canonicalVelocity: 88,
      microtimingMs: -8.5,
      source: "performance-engine",
      musicalReason: "laid-back hook answer",
      rhythmSource: "chorus-pocket",
      locked: true,
    },
  });

  assert.equal(event.canonical.startBeat, 4);
  assert.equal(event.canonical.durationBeats, 0.5);
  assert.equal(event.canonical.velocity, 88);
  assert.equal(event.canonical.timingSource, "canonicalStartBeat");
  assert.equal(event.performed.startBeat, 4.11);
  assert.equal(event.performed.durationBeats, 0.44);
  assert.equal(event.performed.velocity, 91);
  assert.equal(event.performed.microtimingMs, -8.5);
  assert.equal(event.performed.timingDeltaBeats, 0.11);
  assert.equal(event.performed.durationDeltaBeats, -0.06);
  assert.equal(event.performed.velocityDelta, 3);
  assert.equal(event.intent.locked, true);
  assert.equal(validateCanonicalMusicalEvent(event).passed, true);
});
