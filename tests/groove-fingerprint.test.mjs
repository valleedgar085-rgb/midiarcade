import assert from "node:assert/strict";
import test from "node:test";

import {
  aggregateGroovePerformances,
  extractGroovePerformance,
  grooveDrumRole,
} from "../src/core/groove-fingerprint.js";

test("Groove fingerprint maps GMD drum pitches into stable musical roles", () => {
  assert.equal(grooveDrumRole(36), "kick");
  assert.equal(grooveDrumRole(38), "snare");
  assert.equal(grooveDrumRole(22), "closedHat");
  assert.equal(grooveDrumRole(46), "openHat");
  assert.equal(grooveDrumRole(51), "ride");
  assert.equal(grooveDrumRole(99), "other");
});

test("Groove fingerprint extracts density, step shape, microtiming, and relationships", () => {
  const ppq = 480;
  const step = ppq / 4;
  const notes = [];
  for (let bar = 0; bar < 2; bar += 1) {
    const offset = bar * ppq * 4;
    for (const stepIndex of [0, 8]) notes.push({ midi: 36, ticks: offset + stepIndex * step, velocity: 0.9 });
    for (const stepIndex of [4, 12]) notes.push({ midi: 38, ticks: offset + stepIndex * step, velocity: 0.82 });
    for (let stepIndex = 0; stepIndex < 16; stepIndex += 2) {
      const micro = stepIndex % 4 === 2 ? step * 0.1 : 0;
      notes.push({ midi: 42, ticks: offset + stepIndex * step + micro, velocity: 0.62 });
    }
  }

  const fingerprint = extractGroovePerformance({
    notes,
    ppq,
    totalTicks: ppq * 8,
    style: "hiphop",
    beatType: "beat",
    bpm: 94,
    timeSignature: [4, 4],
  });

  assert.equal(fingerprint.stepsPerBar, 16);
  assert.equal(fingerprint.roles.kick.hitsPerBar, 2);
  assert.equal(fingerprint.roles.snare.hitsPerBar, 2);
  assert.equal(fingerprint.roles.closedHat.hitsPerBar, 8);
  assert.equal(fingerprint.roles.closedHat.stepPresencePerBar[0], 1);
  assert.equal(fingerprint.roles.closedHat.stepPresencePerBar[1], 0);
  assert.ok(fingerprint.relationships.hatSwingOffset16 > 0.09);
  assert.ok(fingerprint.relationships.hatSwingOffset16 < 0.11);
  assert.equal(fingerprint.relationships.kickSnareOverlapRate, 0);
});

test("Groove fingerprint aggregation preserves style and beat/fill separation", () => {
  const beat = extractGroovePerformance({
    notes: [{ midi: 36, ticks: 0, velocity: 1 }, { midi: 38, ticks: 480, velocity: 0.8 }],
    ppq: 480,
    totalTicks: 1920,
    style: "funk",
    beatType: "beat",
    bpm: 100,
  });
  const fill = extractGroovePerformance({
    notes: [{ midi: 43, ticks: 0, velocity: 0.9 }, { midi: 50, ticks: 120, velocity: 0.9 }],
    ppq: 480,
    totalTicks: 1920,
    style: "funk",
    beatType: "fill",
    bpm: 100,
  });

  const profiles = aggregateGroovePerformances([beat, fill]);
  assert.equal(profiles.funk.beat.performances, 1);
  assert.equal(profiles.funk.fill.performances, 1);
  assert.equal(profiles.funk.beat.roles.kick.hitsPerBar, 1);
  assert.equal(profiles.funk.fill.roles.tom.hitsPerBar, 2);
});
