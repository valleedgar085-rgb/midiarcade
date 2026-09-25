import assert from "node:assert/strict";
import test from "node:test";

import { evaluateGrooveAuthorityLock } from "../src/core/groove-authority-lock.js";

const conductor = {
  bars: [
    {
      bar: 0,
      anchors: [0, 2],
      snarePulses: [1, 3],
      hatPulses: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5],
      percussionPulses: [1.75],
      bassPulses: [0, 2.5],
      chordPulses: [0, 2],
      leadPulses: [0.5, 2.5],
      counterPulses: [1.5, 3.5],
      protectedSpaces: [1.25],
    },
  ],
};

test("Groove DNA final lock is read-only and reports intact authored timing", () => {
  const tracks = [
    {
      id: "drums",
      notes: [
        { start: 0, pitch: 36, grooveSource: "hip-hop-pocket.kick" },
        { start: 1, pitch: 38, grooveSource: "hip-hop-pocket.snare" },
        { start: 1.5, pitch: 42, grooveSource: "hip-hop-pocket.hat" },
      ],
    },
    {
      id: "bass",
      notes: [
        { start: 0, pitch: 36, grooveLane: "bassPulses" },
        { start: 2.5, pitch: 38, grooveLane: "bassPulses" },
      ],
    },
  ];
  const before = structuredClone(tracks);
  const report = evaluateGrooveAuthorityLock(tracks, conductor, { beatsPerBar: 4 });

  assert.deepEqual(tracks, before);
  assert.equal(report.status, "complete");
  assert.equal(report.repairs, 0);
  assert.equal(report.timingViolations, 0);
  assert.equal(report.protectedSpaceViolations, 0);
  assert.equal(report.adherence, 1);
  assert.equal(report.version, 2);
  assert.equal(report.checks.kickAnchors, true);
  assert.equal(report.checks.snareAnchors, true);
  assert.equal(report.checks.bassPulses, true);
  assert.equal(report.checks.protectedNegativeSpace, true);
  assert.equal(report.checks.postCompositionTimingStable, true);
  assert.equal(report.postCompositionTimingMutations, 0);
});

test("Groove DNA final lock exposes late timing and negative-space violations without repairing them", () => {
  const tracks = [
    {
      id: "bass",
      notes: [
        { start: 0.4, pitch: 36, grooveLane: "bassPulses" },
        { start: 1.25, pitch: 38 },
      ],
    },
  ];
  const report = evaluateGrooveAuthorityLock(tracks, conductor, {
    beatsPerBar: 4,
    timingTolerance: 0.1,
  });

  assert.equal(report.status, "best-available");
  assert.equal(report.timingViolations, 1);
  assert.equal(report.protectedSpaceViolations, 1);
  assert.equal(report.postCompositionTimingMutations, 1);
  assert.equal(report.checks.bassPulses, false);
  assert.equal(report.checks.protectedNegativeSpace, false);
  assert.equal(report.checks.postCompositionTimingStable, false);
  assert.equal(report.repairs, 0);
});
