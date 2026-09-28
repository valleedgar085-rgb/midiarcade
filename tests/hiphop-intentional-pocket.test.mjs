import assert from "node:assert/strict";
import test from "node:test";

import { applyPerformanceEngine } from "../src/core/performance-engine.js";

function event({
  id,
  roleId,
  startBeat,
  pitch,
  velocity = 80,
  phraseRole = "body",
  trackId = roleId,
}) {
  return Object.freeze({
    id,
    roleId,
    trackId,
    phraseRole,
    semanticPitch: Object.freeze({ midiNote: pitch }),
    renderedMidiPitch: pitch,
    velocity,
    canonical: Object.freeze({
      startBeat,
      durationBeats: 0.25,
      renderedMidiPitch: pitch,
      velocity,
    }),
    intent: Object.freeze({ locked: false }),
  });
}

function hipHopSong() {
  return Object.freeze({
    id: "intentional-pocket-fixture",
    sourceSeed: "intentional-pocket-seed",
    totalBeats: 8,
    beatsPerBar: 4,
    intent: Object.freeze({
      genre: "hipHop",
      bpm: 100,
      beatsPerBar: 4,
    }),
    musicalEvents: Object.freeze([
      event({ id: "kick-downbeat", roleId: "drums", startBeat: 0, pitch: 36 }),
      event({ id: "bass-lock", roleId: "bass", startBeat: 0, pitch: 36 }),
      event({ id: "hat-a", roleId: "drums", startBeat: 0.5, pitch: 42 }),
      event({ id: "snare-backbeat", roleId: "drums", startBeat: 1, pitch: 38 }),
      event({ id: "hat-b", roleId: "drums", startBeat: 1, pitch: 42 }),
      event({ id: "landing", roleId: "lead", startBeat: 2, pitch: 67, phraseRole: "landing" }),
    ]),
  });
}

function byId(result, id) {
  return result.events.find((entry) => entry.id === id);
}

test("Hip-Hop pocket anchors kick/bass and keeps structural landings tight", () => {
  const result = applyPerformanceEngine(hipHopSong(), {
    humanize: 1,
    seed: "pocket-a",
  });

  assert.equal(byId(result, "kick-downbeat").performed.microtimingMs, 0);
  assert.equal(byId(result, "bass-lock").performed.microtimingMs, 0);
  assert.equal(byId(result, "landing").performed.microtimingMs, 0);
  assert.ok(result.metrics.protectedTimingAnchors >= 3);
  assert.equal(result.metrics.intentionalPocket, true);
});

test("Hip-Hop drums stay on grid when the producer requests a tight pocket", () => {
  const result = applyPerformanceEngine(hipHopSong(), {
    humanize: 1,
    seed: "pocket-b",
  });

  const snare = byId(result, "snare-backbeat").performed;
  const hatA = byId(result, "hat-a").performed;
  const hatB = byId(result, "hat-b").performed;

  assert.equal(snare.microtimingMs, 0);
  assert.equal(hatA.microtimingMs, 0);
  assert.equal(hatB.microtimingMs, 0);
});

test("Hip-Hop velocity follows rhythmic intent instead of uniform random drift", () => {
  const result = applyPerformanceEngine(hipHopSong(), {
    humanize: 1,
    seed: "pocket-c",
  });

  const kick = byId(result, "kick-downbeat").performed;
  const snare = byId(result, "snare-backbeat").performed;
  const hatA = byId(result, "hat-a").performed;
  const hatB = byId(result, "hat-b").performed;

  assert.equal(kick.velocity, 84);
  assert.equal(snare.velocity, 86);
  assert.notEqual(hatA.velocity, hatB.velocity);
  assert.ok(hatA.velocity < snare.velocity);
  assert.ok(hatB.velocity < snare.velocity);
});

test("intentional pocket remains deterministic for the same song and seed", () => {
  const song = hipHopSong();
  const left = applyPerformanceEngine(song, { humanize: 0.65, seed: "fixed-pocket" });
  const right = applyPerformanceEngine(song, { humanize: 0.65, seed: "fixed-pocket" });

  assert.deepEqual(left, right);
  assert.ok(left.metrics.maxMicrotimingMs <= 12);
});
