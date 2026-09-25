import assert from "node:assert/strict";
import test from "node:test";

import { auditStageMutationAuthority } from "../src/core/mutation-authority.js";

function song(notes) {
  return {
    tracks: [
      {
        id: "melody",
        notes: notes.map((note) => ({ duration: 0.5, velocity: 90, ...note })),
      },
    ],
  };
}

test("mutation authority accepts register-only octave edits in the register stage", () => {
  const before = song([{ start: 0, pitch: 60 }]);
  const after = song([{ start: 0, pitch: 72 }]);
  const audit = auditStageMutationAuthority(before, after, "registerHealthRefinement");
  assert.deepEqual(audit.changedMutations, ["register"]);
  assert.deepEqual(audit.violations, []);
  assert.equal(audit.passed, true);
});

test("mutation authority flags harmony edits attempted by the groove stage", () => {
  const before = song([{ start: 0, pitch: 60 }]);
  const after = song([{ start: 0, pitch: 61 }]);
  const audit = auditStageMutationAuthority(before, after, "groovePocket");
  assert.deepEqual(audit.changedMutations, ["harmony"]);
  assert.deepEqual(audit.violations, ["harmony"]);
  assert.equal(audit.passed, false);
});

test("automation-only transition FX is flagged if it rewrites notes", () => {
  const before = song([{ start: 0, pitch: 60 }]);
  const after = song([{ start: 0.25, pitch: 60 }]);
  const audit = auditStageMutationAuthority(before, after, "transitionFxRefinement");
  assert.deepEqual(audit.changedMutations, ["timing"]);
  assert.deepEqual(audit.violations, ["timing"]);
  assert.equal(audit.passed, false);
});
