import assert from "node:assert/strict";
import test from "node:test";

import {
  constrainMelodicDegree,
  hookSignatureAdjustment,
  melodyIntentRole,
  melodicMovementBudget,
  shouldAllowOrnamentalTurn,
} from "../src/core/melody-intent-authority.js";
import { generateNew } from "../src/music-engine.js";

test("Melody Intent Authority gives anchors no wandering budget", () => {
  const role = melodyIntentRole({
    sectionName: "verse",
    eventIndex: 0,
    eventCount: 7,
    progress: 0,
  });
  assert.equal(role, "anchor");
  assert.equal(melodicMovementBudget(role), 0);

  const result = constrainMelodicDegree({
    baseDegree: 2,
    proposedDegree: 6,
    role,
  });
  assert.equal(result.degree, 2);
  assert.equal(result.constrained, true);
});

test("continuations stay close while answers and climaxes retain expressive room", () => {
  const continuation = constrainMelodicDegree({
    baseDegree: 2,
    proposedDegree: 7,
    role: "continuation",
    previousDegree: 2,
  });
  assert.equal(continuation.degree, 3);

  const answer = constrainMelodicDegree({
    baseDegree: 2,
    proposedDegree: 6,
    role: "answer",
    previousDegree: 2,
  });
  assert.equal(answer.degree, 4);

  const climax = constrainMelodicDegree({
    baseDegree: 2,
    proposedDegree: 7,
    role: "climax",
    previousDegree: 2,
  });
  assert.equal(climax.degree, 5);
});

test("urban/pop ornamentation is suppressed unless Surprise is high and the slot is deliberate", () => {
  assert.equal(shouldAllowOrnamentalTurn({
    genre: "hipHop",
    surprise: 0.5,
    eventIndex: 4,
    eventCount: 7,
    role: "hook-signature",
  }), false);

  assert.equal(shouldAllowOrnamentalTurn({
    genre: "trap",
    surprise: 0.9,
    eventIndex: 1,
    eventCount: 8,
    role: "continuation",
  }), false);

  assert.equal(shouldAllowOrnamentalTurn({
    genre: "pop",
    surprise: 0.9,
    eventIndex: Math.floor(10 * 0.62),
    eventCount: 10,
    role: "hook-signature",
  }), true);
});

test("hook signature is repeatable and concentrated in one interior gesture", () => {
  const eventCount = 8;
  const signatureIndex = Math.floor(eventCount * 0.58);
  const signature = hookSignatureAdjustment({
    sectionName: "chorus",
    role: "hook-signature",
    eventIndex: signatureIndex,
    eventCount,
    repeat: 0,
  });
  assert.equal(signature.degreeShift, 1);
  assert.ok(signature.durationScale > 1);
  assert.ok(signature.velocityScale > 1);

  const nonSignature = hookSignatureAdjustment({
    sectionName: "chorus",
    role: "hook-signature",
    eventIndex: signatureIndex - 1,
    eventCount,
    repeat: 0,
  });
  assert.deepEqual(nonSignature, { degreeShift: 0, durationScale: 1, velocityScale: 1 });
});

test("full-song Hip-Hop melody exposes intentional note roles and bounded decisions", () => {
  const song = generateNew({
    seed: "melody-intent-authority-full-song",
    genre: "hipHop",
    bars: 32,
    professionalUpgrade: true,
    complexity: 0.82,
    variation: 0.78,
    evolution: 0.74,
    surprise: 0.58,
    candidateCount: 1,
  });
  const melody = song.tracks.find((track) => track.id === "melody")?.notes ?? [];
  assert.ok(melody.length > 0);

  const intentional = melody.filter((note) => note.melodyIntentRole);
  assert.ok(intentional.length >= Math.max(3, Math.floor(melody.length * 0.5)));
  assert.ok(intentional.some((note) => note.melodyIntentConstrained === true));
  assert.ok(intentional.every((note) => (
    Number.isFinite(Number(note.melodyIntentBudget))
    && Number.isFinite(Number(note.melodyIntentBaseDegree))
  )));
  assert.ok(intentional.some((note) => note.hookSignature === true));
});
