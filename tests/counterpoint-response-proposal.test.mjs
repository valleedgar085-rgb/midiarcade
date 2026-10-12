import test from "node:test";
import assert from "node:assert/strict";
import { proposeCounterpointResponses } from "../src/core/counterpoint-response-proposal.js";

test("resolves dissonant counterpoint overlap without changing notes or seed determinism", () => {
  const lead = [{ start: 0, duration: 0.5, pitch: 72 }];
  const counter = [{ start: 0.25, duration: 0.25, pitch: 60, velocity: 80 }];
  const first = proposeCounterpointResponses(lead, counter);
  assert.deepEqual(first, proposeCounterpointResponses(lead, counter));
  assert.equal(first.notes[0].start, 0.5);
  assert.equal(first.notes[0].pitch, 60);
  assert.equal(first.notes[0].velocity, 80);
  assert.equal(first.notes[0].duration, 0.25);
  assert.equal(first.proposals[0].beforeViolations, 1);
  assert.equal(first.proposals[0].afterViolations, 0);
  assert.equal(counter[0].start, 0.25);
});
test("does not move consonant overlapping notes merely to empty the lead register", () => {
  const lead = [{ start: 0, duration: 0.5, pitch: 72 }];
  const counter = [{ start: 0.25, duration: 0.25, pitch: 64, velocity: 80 }];
  const result = proposeCounterpointResponses(lead, counter);
  assert.equal(result.changed, 0);
  assert.equal(result.notes[0].start, 0.25);
  assert.equal(result.proposals[0].beforeViolations, 0);
});
test("resolves attack collisions even without dissonant overlap", () => {
  const lead = [{ start: 0, duration: 0.2, pitch: 72 }];
  const counter = [{ start: 0, duration: 0.2, pitch: 64 }];
  const result = proposeCounterpointResponses(lead, counter, { maxShiftBeats: 0.5 });
  assert.equal(result.changed, 1);
  assert.ok(result.notes[0].start >= 0.125);
});
test("keeps unrepairable conflicts unchanged rather than inventing space", () => {
  const result = proposeCounterpointResponses(
    [{ start: 0, duration: 2, pitch: 72 }],
    [{ start: 0, duration: 0.25, pitch: 60 }],
    { sectionEndBeat: 0.5 },
  );
  assert.equal(result.changed, 0);
  assert.equal(result.unresolved, 1);
});
test("never moves proposals outside their section", () => {
  const result = proposeCounterpointResponses(
    [{ start: 1, duration: 0.5, pitch: 72 }],
    [{ start: 1.25, duration: 0.25, pitch: 60 }],
    { sectionStartBeat: 1.2, sectionEndBeat: 1.45 },
  );
  assert.equal(result.changed, 0);
  assert.equal(result.notes[0].start, 1.25);
});
