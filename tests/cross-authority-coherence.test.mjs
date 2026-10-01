import assert from "node:assert/strict";
import test from "node:test";

import { evaluateCrossAuthorityCoherence } from "../src/core/cross-authority-coherence.js";
import { createSpecialistDirectorPlan } from "../src/core/specialist-musicians.js";
import { withCommittedCrossAuthorityCoherenceDiagnostics } from "../src/core/generation-executor.js";

function song() {
  return {
    id: "coherence-fixture",
    seed: "coherence-seed",
    meta: {
      genre: "pop", tempo: 100, bars: 2, beatsPerBar: 4,
      key: "A", keyPc: 9, scale: "minor", scaleIntervals: [0, 2, 3, 5, 7, 8, 10],
    },
    structure: [
      { id: "verse", name: "Verse", startBeat: 0, endBeat: 4, bars: 1 },
      { id: "chorus", name: "Chorus", startBeat: 4, endBeat: 8, bars: 1 },
    ],
    harmony: [
      { id: "am", start: 0, duration: 4, rootPc: 9, symbol: "Am" },
      { id: "f", start: 4, duration: 4, rootPc: 5, symbol: "F" },
    ],
    grooveConductor: {
      id: "fixture-pocket",
      grooveDNA: {
        id: "groove-dna-v1", grammarId: "pop-pulse-lift",
        pipeline: ["probability", "density", "variation", "humanization"],
        relationships: {
          bass: { source: "kick", mode: "pulse-reinforcement", lock: 0.78 },
          chords: { source: "snare", mode: "stable-comping" },
          lead: { source: "kick", mode: "hook-pickup" },
        },
        humanization: { timing: 0.02, velocity: 0.1, swing: 0.08 },
      },
      bars: [
        { bar: 0, sectionId: "verse", anchors: [0, 2], bassPulses: [0, 2], chordPulses: [0, 2], leadPulses: [1, 3], counterPulses: [1.5, 3.5], protectedSpaces: [] },
        { bar: 1, sectionId: "chorus", anchors: [0, 2], bassPulses: [0, 2], chordPulses: [0, 2], leadPulses: [1, 3], counterPulses: [1.5, 3.5], protectedSpaces: [] },
      ],
    },
    tracks: [
      { id: "drums", notes: [{ pitch: 36, start: 0, duration: 0.1, velocity: 100 }, { pitch: 36, start: 4, duration: 0.1, velocity: 104 }] },
      { id: "bass", notes: [{ pitch: 45, start: 0, duration: 1, velocity: 90 }, { pitch: 41, start: 4, duration: 1, velocity: 94 }] },
      { id: "chords", notes: [{ pitch: 57, start: 0, duration: 2, velocity: 78 }, { pitch: 53, start: 4, duration: 2, velocity: 82 }] },
      { id: "melody", notes: [{ pitch: 69, start: 1, duration: 0.5, velocity: 92 }, { pitch: 69, start: 5, duration: 0.5, velocity: 98 }] },
    ],
  };
}

test("cross-authority gate is deterministic, read-only, and accepts a coherent song", () => {
  const source = song();
  const before = structuredClone(source);
  const plan = createSpecialistDirectorPlan(source);
  const first = evaluateCrossAuthorityCoherence(source, { specialistPlan: plan });
  const second = evaluateCrossAuthorityCoherence(source, { specialistPlan: plan });

  assert.deepEqual(source, before);
  assert.deepEqual(first, second);
  assert.equal(first.mode, "read-only");
  assert.equal(first.repairs, 0);
  assert.equal(first.passed, true, JSON.stringify(first.issues));
  assert.equal(first.score, 100);
  assert.equal(typeof first.observations.sourceMatchesDirectorGrooveDNA, "boolean");
});

test("cross-authority gate rejects a specialist using different Groove DNA", () => {
  const source = song();
  const plan = structuredClone(createSpecialistDirectorPlan(source));
  const bass = plan.specialists.find((entry) => entry.id === "bass");
  bass.context.grooveDNA.relationships.bass.lock = 0.11;

  const report = evaluateCrossAuthorityCoherence(source, { specialistPlan: plan });
  assert.equal(report.passed, false);
  assert.ok(report.issues.includes("specialist-groove-dna-drift"));
});

test("cross-authority gate rejects harmony context drift", () => {
  const source = song();
  const plan = structuredClone(createSpecialistDirectorPlan(source));
  const lead = plan.specialists.find((entry) => entry.id === "lead");
  lead.context.harmonyTimeline[0].chord = "C";

  const report = evaluateCrossAuthorityCoherence(source, { specialistPlan: plan });
  assert.equal(report.passed, false);
  assert.ok(report.issues.includes("specialist-harmony-drift"));
});

test("cross-authority gate rejects Groove DNA bars pointing at unknown sections", () => {
  const source = song();
  source.grooveConductor.bars[1].sectionId = "ghost-section";

  const report = evaluateCrossAuthorityCoherence(source);
  assert.equal(report.passed, false);
  assert.ok(report.issues.includes("groove-section-drift"));
});


test("relationship diagnostics remain read-only when ensemble contracts are unavailable", () => {
  const source = song();
  const before = structuredClone(source);
  const report = evaluateCrossAuthorityCoherence(source);

  assert.deepEqual(source, before);
  assert.equal(report.ensemble.reason, "missing-ensemble-contracts");
  assert.equal(report.checks.rhythmFoundationCoherent, true);
  assert.equal(report.checks.harmonicSupportCoherent, true);
  assert.equal(report.checks.leadDialogueCoherent, true);
  assert.equal(report.checks.cadenceTeamCoherent, true);
  assert.equal(report.checks.sectionEvolutionCoherent, true);
});


test("committed coherence diagnostics attach read-only audit without replacing the accepted song", () => {
  const source = song();
  const before = structuredClone(source);
  const report = evaluateCrossAuthorityCoherence(source);
  const result = {
    status: "committed",
    song: source,
    outputQualityDiagnostics: { existing: true },
  };

  const attached = withCommittedCrossAuthorityCoherenceDiagnostics(result, report);

  assert.equal(attached.song, source);
  assert.deepEqual(source, before);
  assert.equal(attached.outputQualityDiagnostics.existing, true);
  assert.deepEqual(attached.outputQualityDiagnostics.crossAuthorityCoherenceAudit, report);
  assert.equal(report.mode, "read-only");
  assert.equal(report.repairs, 0);
});

test("committed coherence diagnostics preserve legacy results without quality diagnostics", () => {
  const source = song();
  const result = { status: "committed", song: source };
  const report = evaluateCrossAuthorityCoherence(source);

  assert.equal(withCommittedCrossAuthorityCoherenceDiagnostics(result, report), result);
});
