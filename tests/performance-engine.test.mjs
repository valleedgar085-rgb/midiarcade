import assert from "node:assert/strict";
import test from "node:test";

import { createCanonicalMusicalEvent } from "../src/core/canonical-musical-event.js";
import { applyPerformanceEngine } from "../src/core/performance-engine.js";

function event({
  id,
  roleId,
  time,
  duration = 0.5,
  pitch = 60,
  velocity = 90,
  midiNote = null,
  motifId = "A",
  phraseRole = "statement",
  locked = false,
}) {
  return createCanonicalMusicalEvent({
    id,
    trackId: roleId === "lead" ? "melody" : roleId,
    roleId,
    sectionId: "verse",
    time,
    duration,
    semanticPitch: roleId === "drums"
      ? { type: "percussion", midiNote: midiNote ?? pitch }
      : { type: "pitched", pitchClass: pitch % 12, scaleDegree: 1, inScale: true },
    renderedMidiPitch: midiNote ?? pitch,
    velocity,
    chordContext: roleId === "drums" ? null : { id: "harmony-1", chord: "Am9" },
    motifId,
    motifSource: "native",
    phraseRole,
    phraseRoleSource: "native",
    articulation: "normal",
    note: {
      source: "specialist-musician",
      sectionPatternId: "verse-pocket",
      locked,
    },
  });
}

function song(genre = "neoSoul") {
  return Object.freeze({
    id: "performance-fixture",
    sourceSeed: "performance-seed",
    totalBeats: 16,
    intent: Object.freeze({ genre, bpm: 96 }),
    musicalEvents: Object.freeze([
      event({ id: "kick", roleId: "drums", time: 0, pitch: 36, midiNote: 36, velocity: 100 }),
      event({ id: "snare", roleId: "drums", time: 1, pitch: 38, midiNote: 38, velocity: 96 }),
      event({ id: "bass", roleId: "bass", time: 1, pitch: 36, velocity: 88 }),
      event({ id: "lead-a", roleId: "lead", time: 2.5, pitch: 69, velocity: 86, motifId: "hook-A", phraseRole: "answer" }),
      event({ id: "lead-b", roleId: "lead", time: 3.5, pitch: 72, velocity: 84, motifId: "hook-A", phraseRole: "resolution" }),
      event({ id: "locked", roleId: "lead", time: 15.75, duration: 0.2, pitch: 69, velocity: 80, locked: true }),
    ]),
  });
}

test("performance engine is deterministic and zero-humanize is identity", () => {
  const source = song();
  const zero = applyPerformanceEngine(source, { humanize: 0 });
  assert.deepEqual(zero.events, source.musicalEvents);

  const first = applyPerformanceEngine(source, { humanize: 0.8 });
  const second = applyPerformanceEngine(source, { humanize: 0.8 });
  assert.deepEqual(first, second);
  assert.equal(first.deterministic, true);
  assert.ok(first.metrics.changedEvents > 0);
});

test("laid-back snare and bass receive deliberate lag while grid genres stay tight", () => {
  const laidback = applyPerformanceEngine(song("neoSoul"), { humanize: 1 });
  const grid = applyPerformanceEngine(song("house"), { humanize: 1 });

  for (const id of ["snare", "bass"]) {
    const laidbackEvent = laidback.events.find((entry) => entry.id === id);
    const gridEvent = grid.events.find((entry) => entry.id === id);
    assert.ok(
      laidbackEvent.performed.timingDeltaBeats > 0.01
        && laidbackEvent.performed.timingDeltaBeats < 0.022,
      `${id} should preserve the deliberate laid-back pocket`,
    );
    assert.ok(
      Math.abs(gridEvent.performed.timingDeltaBeats) <= 0.004,
      `${id} should stay tightly attenuated in a four-on-the-floor grid genre`,
    );
  }
});

test("performance engine preserves pitch, locked events, and song bounds", () => {
  const source = song();
  const result = applyPerformanceEngine(source, { humanize: 1 });
  const lockedBefore = source.musicalEvents.find((entry) => entry.id === "locked");
  const lockedAfter = result.events.find((entry) => entry.id === "locked");
  assert.equal(lockedAfter, lockedBefore, "locked musical intent must be returned untouched");

  for (const [index, performed] of result.events.entries()) {
    const original = source.musicalEvents[index];
    assert.equal(performed.renderedMidiPitch, original.renderedMidiPitch);
    assert.ok(performed.time >= 0);
    assert.ok(performed.duration > 0);
    assert.ok(performed.time + performed.duration <= source.totalBeats + 1e-6);
    assert.ok(performed.velocity >= 1 && performed.velocity <= 127);
  }
});

test("performance microtiming cannot reorder distinct notes inside a track", () => {
  const source = Object.freeze({
    id: "close-note-order",
    sourceSeed: "close-note-order",
    totalBeats: 4,
    intent: Object.freeze({ genre: "loFiHipHop", bpm: 82 }),
    musicalEvents: Object.freeze([
      event({ id: "bass-close-a", roleId: "bass", time: 1, duration: 0.25, pitch: 36, velocity: 88, motifId: "bass-run" }),
      event({ id: "bass-close-b", roleId: "bass", time: 1.0025, duration: 0.25, pitch: 38, velocity: 86, motifId: "bass-run" }),
      event({ id: "bass-close-c", roleId: "bass", time: 1.006, duration: 0.25, pitch: 40, velocity: 87, motifId: "bass-run" }),
    ]),
  });

  for (let index = 0; index < 100; index += 1) {
    const result = applyPerformanceEngine(source, {
      humanize: 1,
      seed: `order-seed-${index}`,
    });
    const times = result.events.map((entry) => entry.performed.startBeat);
    assert.ok(times[0] <= times[1], `seed ${index} reordered first/second bass note`);
    assert.ok(times[1] <= times[2], `seed ${index} reordered second/third bass note`);
  }
});

test("phrase-related notes share structured motion without collapsing to identical values", () => {
  const result = applyPerformanceEngine(song(), { humanize: 1 });
  const leadA = result.events.find((entry) => entry.id === "lead-a");
  const leadB = result.events.find((entry) => entry.id === "lead-b");

  assert.equal(leadA.motifId, leadB.motifId);
  assert.notEqual(leadA.performed.timingDeltaBeats, leadB.performed.timingDeltaBeats);
  assert.ok(Math.abs(
    leadA.performed.timingDeltaBeats - leadB.performed.timingDeltaBeats,
  ) < 0.012, "same-phrase notes should move as a related pocket, not independent wide jitter");
  assert.ok(leadB.performed.velocity >= leadA.performed.velocity - 8);
});
