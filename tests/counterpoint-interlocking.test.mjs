import test from "node:test";
import assert from "node:assert/strict";
import { generateInterlockedCounterpoint } from "../src/core/specialist-musicians.js";

test("generateInterlockedCounterpoint marks notes in open melody gaps as conversational response", () => {
  const melodyNotes = [
    { start: 0, duration: 1.0, pitch: 72 }, // Long hold from 0 to 1.0 -> gap from 0.36 to 1.0
    { start: 2.0, duration: 0.25, pitch: 74 }, // Rest gap between 1.0 and 2.0
  ];
  const counterNotes = [
    { start: 0.5, duration: 0.25, pitch: 60, velocity: 80 }, // During melody hold
    { start: 1.25, duration: 0.25, pitch: 62, velocity: 80 }, // In melody rest
    { start: 2.0, duration: 0.25, pitch: 64, velocity: 80 }, // Simultaneous with fast lead
  ];

  const result = generateInterlockedCounterpoint(melodyNotes, counterNotes);
  assert.equal(result.length, 3);
  assert.equal(result[0].interlockedRole, "conversational-response");
  assert.equal(result[1].interlockedRole, "conversational-response");
  assert.equal(result[2].interlockedRole, "harmonic-anchor");
});
