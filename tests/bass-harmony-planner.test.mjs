import assert from "node:assert/strict";
import test from "node:test";

import { planBassHarmonyTarget } from "../src/core/bass-harmony-planner.js";

const C = Object.freeze({ rootPc: 0, tones: [0, 4, 7] });
const F = Object.freeze({ rootPc: 5, tones: [5, 9, 0] });

function target(overrides = {}) {
  return planBassHarmonyTarget({
    genre: "hipHop",
    chord: C,
    nextChord: F,
    bassGrooveRole: "response",
    currentPitch: 40,
    index: 1,
    eventCount: 4,
    seed: "bass-harmony-planner-test",
    variation: 0.66,
    complexity: 0.62,
    ...overrides,
  });
}

test("Bass Harmony Planner is deterministic for a fixed musical context", () => {
  assert.deepEqual(target(), target());
});

test("anchor events resolve to the active chord root in the bass register", () => {
  const result = target({
    bassGrooveRole: "anchor",
    currentPitch: 43,
    index: 0,
  });
  assert.equal(result.role, "ANCHOR");
  assert.equal(result.targetPitchClass, 0);
  assert.equal(result.pitch % 12, 0);
  assert.ok(result.pitch >= 28 && result.pitch <= 55);
});


test("configured sub register keeps the nearest octave-1 target eligible before preferred-range bias", () => {
  const result = target({
    bassGrooveRole: "anchor",
    currentPitch: 27,
    index: 0,
    register: {
      minimum: 24,
      maximum: 55,
      preferredMin: 35,
      preferredMax: 52,
    },
  });
  assert.equal(result.targetPitchClass, 0);
  assert.equal(result.pitch, 24);
});

test("Hip-Hop replies choose from approved chord-support tones rather than arbitrary scale motion", () => {
  const result = target();
  assert.equal(result.role, "REPLY");
  assert.ok([0, 4, 7].includes(result.targetPitchClass));
  assert.ok(["fifth", "root", "chord"].includes(result.strategy));
});

test("Neo-Soul replies can use chord color while remaining inside the current harmony", () => {
  const result = target({
    genre: "neoSoul",
    seed: "neo-soul-color-test",
    variation: 1,
    complexity: 1,
  });
  assert.equal(result.role, "REPLY");
  assert.ok([0, 4, 7].includes(result.targetPitchClass));
  assert.ok(["third", "fifth", "chord", "root"].includes(result.strategy));
});

test("last-event anticipation aims at the next chord root", () => {
  const result = target({
    bassGrooveRole: "pickup",
    index: 3,
    eventCount: 4,
    currentPitch: 43,
  });
  assert.equal(result.role, "ANTICIPATION");
  assert.equal(result.strategy, "nextRoot");
  assert.equal(result.targetPitchClass, 5);
  assert.equal(result.pitch % 12, 5);
});

test("genre recipes keep House support conservative and Trap anchors root-safe", () => {
  const house = target({
    genre: "house",
    bassGrooveRole: "movement",
    seed: "house-harmony-target",
  });
  const trap = target({
    genre: "trap",
    bassGrooveRole: "anchor",
    seed: "trap-harmony-target",
  });
  assert.ok(["root", "fifth"].includes(house.strategy));
  assert.equal(trap.strategy, "root");
  assert.equal(trap.targetPitchClass, 0);
});
