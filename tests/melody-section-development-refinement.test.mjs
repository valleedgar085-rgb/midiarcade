import assert from "node:assert/strict";
import test from "node:test";

import { createMelodySectionDevelopmentCandidates } from "../src/core/melody-section-development-refinement.js";
import { evaluateMelodySectionMemory } from "../src/core/melody-section-memory.js";
import {
  applyMelodySectionDevelopmentRefinement,
  applyMelodySectionMemoryAudit,
} from "../src/core/output-quality-pipeline-register.js";
import { authorizeQualityStage, qualityStageAuthority } from "../src/core/generation-repair-router.js";
import { runQualityStageSequence } from "../src/core/output-quality-stage-runner.js";

function note(start, pitch, duration = 0.5, velocity = 86) {
  return { start, pitch, duration, velocity };
}

const SOURCE = [
  note(0.5, 60),
  note(1.5, 64, 0.25),
  note(2.5, 67),
  note(3.5, 64, 0.75),
  note(4.5, 62),
  note(5.5, 65, 0.25),
  note(6.5, 69),
  note(7.5, 67, 0.75),
];

function songWithReturn(targetNotes) {
  return {
    meta: {
      beatsPerBar: 4,
      keyPc: 0,
      scaleIntervals: [0, 2, 4, 5, 7, 9, 11],
    },
    structure: [
      { id: "verse-1", name: "verse", startBeat: 0, endBeat: 8, bars: 2 },
      { id: "verse-2", name: "verse", startBeat: 8, endBeat: 16, bars: 2 },
    ],
    phraseMemory: {
      version: 1,
      familyId: "return-family",
      sections: [
        { sectionId: "verse-1", sourceSectionId: "verse-1", relationship: "statement", recallStrength: 1 },
        { sectionId: "verse-2", sourceSectionId: "verse-1", relationship: "return", recallStrength: 0.9, transform: "motif-return" },
      ],
    },
    tracks: [
      {
        id: "drums",
        notes: [note(0, 36, 0.1, 100), note(1, 38, 0.1, 96), note(8, 36, 0.1, 100), note(9, 38, 0.1, 96)],
      },
      {
        id: "bass",
        notes: [note(0, 36, 0.5, 92), note(4, 41, 0.5, 94), note(8, 36, 0.5, 92), note(12, 41, 0.5, 94)],
      },
      {
        id: "melody",
        notes: [
          ...SOURCE,
          ...targetNotes.map((entry) => ({ ...entry, phraseMemorySourceSectionId: "verse-1" })),
        ],
      },
    ],
  };
}

const EXACT_RETURN = SOURCE.map((entry) => ({ ...entry, start: entry.start + 8 }));
const DEVELOPED_RETURN = [
  note(8.5, 62),
  note(9.5, 65, 0.25),
  note(10.5, 69),
  note(11.5, 65, 0.5),
  note(12.5, 64),
  note(13.5, 67, 0.25),
  note(14.5, 71),
  note(15.5, 69, 1),
];

function evaluation() {
  return {
    score: 91,
    subscores: {
      phraseResolution: 90,
      repetition: 90,
      memory: 90,
      motif: 90,
      registerHealth: 90,
      groove: 90,
      performance: 90,
      separation: 90,
    },
    diagnostics: { scaleFit: 1 },
  };
}

test("section-development candidates are deterministic and never touch drums or bass", () => {
  const song = songWithReturn(EXACT_RETURN);
  const before = structuredClone(song);
  const first = createMelodySectionDevelopmentCandidates(song);
  const second = createMelodySectionDevelopmentCandidates(song);
  assert.deepEqual(song, before);
  assert.deepEqual(first, second);
  assert.ok(first.length >= 1, "exact clone should create at least one bounded development candidate");
  assert.ok(first.every((candidate) => candidate.memoryScoreDelta > 0 && candidate.sectionScoreDelta > 0));
  for (const candidate of first) {
    assert.deepEqual(candidate.song.tracks.find((track) => track.id === "drums"), before.tracks.find((track) => track.id === "drums"));
    assert.deepEqual(candidate.song.tracks.find((track) => track.id === "bass"), before.tracks.find((track) => track.id === "bass"));
    assert.deepEqual(
      candidate.song.tracks.find((track) => track.id === "melody").notes.map((entry) => entry.start),
      before.tracks.find((track) => track.id === "melody").notes.map((entry) => entry.start),
      "section development must preserve canonical note starts",
    );
  }
});

test("release-safe clone development is accepted and lowers clone risk", () => {
  const song = songWithReturn(EXACT_RETURN);
  const before = evaluateMelodySectionMemory(song);
  assert.equal(before.passed, false);
  assert.equal(before.reason, "memory-clone-risk");
  const result = applyMelodySectionDevelopmentRefinement(
    song,
    { melodySectionDevelopmentRefinement: true },
    () => evaluation(),
    () => ({ passed: true }),
  );
  assert.equal(result.diagnostics.attempted, true);
  assert.equal(result.diagnostics.accepted, true, JSON.stringify(result.diagnostics));
  const after = evaluateMelodySectionMemory(result.song);
  assert.ok(after.sections[0].metrics.cloneRisk < before.sections[0].metrics.cloneRisk, JSON.stringify(after));
  assert.ok(after.score > before.score, JSON.stringify(after));
  assert.deepEqual(result.song.tracks.find((track) => track.id === "drums"), song.tracks.find((track) => track.id === "drums"));
  assert.deepEqual(result.song.tracks.find((track) => track.id === "bass"), song.tracks.find((track) => track.id === "bass"));
});

test("already-developed memory returns the exact source song without mutation", () => {
  const song = songWithReturn(DEVELOPED_RETURN);
  const before = structuredClone(song);
  const audit = evaluateMelodySectionMemory(song);
  assert.equal(audit.passed, true, JSON.stringify(audit));
  const result = applyMelodySectionDevelopmentRefinement(
    song,
    { melodySectionDevelopmentRefinement: true },
    () => { throw new Error("strong memory should not invoke full candidate critic"); },
    () => { throw new Error("strong memory should not invoke release gate"); },
  );
  assert.equal(result.song, song);
  assert.deepEqual(song, before);
  assert.equal(result.diagnostics.reason, "already-strong");
});

test("section-development repair fails closed when release safety rejects it", () => {
  const song = songWithReturn(EXACT_RETURN);
  const result = applyMelodySectionDevelopmentRefinement(
    song,
    { melodySectionDevelopmentRefinement: true },
    () => evaluation(),
    () => ({ passed: false }),
  );
  assert.equal(result.song, song);
  assert.equal(result.diagnostics.accepted, false);
  assert.equal(result.diagnostics.reason, "release-gate");
});

test("final memory audit is read-only and cannot be skipped by another specialist focus", () => {
  const song = songWithReturn(DEVELOPED_RETURN);
  const before = structuredClone(song);
  const auditResult = applyMelodySectionMemoryAudit(song);
  assert.equal(auditResult.song, song);
  assert.deepEqual(song, before);
  assert.equal(auditResult.diagnostics.finalAudit, true);

  const authority = qualityStageAuthority("melodySectionMemoryAudit");
  assert.equal(authority.readOnly, true);
  assert.deepEqual(authority.mutations, []);
  const admission = authorizeQualityStage("melodySectionMemoryAudit", {
    allowsSurgicalPostprocess: true,
    mutationOwner: "groove",
  });
  assert.equal(admission.allowed, true);
  assert.equal(admission.reason, "read-only-audit");
});


test("melody section development authority forbids topology and timing mutation", () => {
  const authority = qualityStageAuthority("melodySectionDevelopmentRefinement");
  assert.equal(authority.strictMutations, true);
  assert.deepEqual(authority.mutations, ["duration", "harmony"]);
  assert.equal(authority.mutations.includes("topology"), false);
  assert.equal(authority.mutations.includes("timing"), false);
});

test("strict melody section authority rejects a future stage that shifts note starts", () => {
  const song = songWithReturn(DEVELOPED_RETURN);
  const shifted = structuredClone(song);
  shifted.tracks.find((track) => track.id === "melody").notes[0].start += 0.25;

  const result = runQualityStageSequence(song, [{
    id: "melodySectionDevelopmentRefinement",
    run: () => ({
      song: shifted,
      diagnostics: { attempted: true, accepted: true, changed: true, reason: "test-shift" },
    }),
  }]);

  assert.equal(result.song, song, "unauthorized timing change must never become current song authority");
  assert.equal(result.diagnostics.melodySectionDevelopmentRefinement.accepted, false);
  assert.equal(result.diagnostics.melodySectionDevelopmentRefinement.reason, "mutation-authority-violation");
  assert.deepEqual(
    result.diagnostics.melodySectionDevelopmentRefinement.mutationAuthority.violations,
    ["timing"],
  );
});
