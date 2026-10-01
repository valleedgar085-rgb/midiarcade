import assert from "node:assert/strict";
import test from "node:test";

import {
  createGenerationExecutor,
  withCommittedMelodySectionMemoryDiagnostics,
} from "../src/core/generation-executor.js";

test("committed melody memory refresh replaces stale returned diagnostics without dropping other fields", () => {
  const stale = { status: "evaluated", passed: false, score: 44, reason: "stale" };
  const committed = { status: "evaluated", passed: true, score: 82, reason: "memory-development-coherent" };
  const result = {
    song: { id: "committed-song" },
    outputQualityDiagnostics: {
      melodySectionMemoryAudit: stale,
      melodyPhraseRefinement: { accepted: true },
    },
  };

  const refreshed = withCommittedMelodySectionMemoryDiagnostics(result, committed);

  assert.notEqual(refreshed, result);
  assert.equal(refreshed.song, result.song);
  assert.deepEqual(refreshed.outputQualityDiagnostics.melodySectionMemoryAudit, committed);
  assert.deepEqual(
    refreshed.outputQualityDiagnostics.melodyPhraseRefinement,
    result.outputQualityDiagnostics.melodyPhraseRefinement,
  );
  assert.deepEqual(result.outputQualityDiagnostics.melodySectionMemoryAudit, stale);
});

test("committed melody memory refresh is a no-op when no final report exists", () => {
  const result = { song: { id: "song" }, outputQualityDiagnostics: {} };
  assert.equal(withCommittedMelodySectionMemoryDiagnostics(result, null), result);
});

test("committed melody memory refresh preserves exact legacy result identity when diagnostics were never exposed", () => {
  const committed = { status: "evaluated", passed: true, score: 82, reason: "memory-development-coherent" };
  const legacy = { status: "committed", song: { id: "legacy-stable-result" } };

  const refreshed = withCommittedMelodySectionMemoryDiagnostics(legacy, committed);

  assert.equal(refreshed, legacy);
  assert.equal(refreshed.outputQualityDiagnostics, undefined);
});


function executorMemorySong() {
  const source = [
    { start: 0.5, pitch: 60, duration: 0.5, velocity: 86 },
    { start: 1.5, pitch: 64, duration: 0.25, velocity: 86 },
    { start: 2.5, pitch: 67, duration: 0.5, velocity: 86 },
    { start: 3.5, pitch: 64, duration: 0.75, velocity: 86 },
  ];
  return {
    meta: { beatsPerBar: 4 },
    structure: [
      { id: "verse-1", name: "verse", startBeat: 0, endBeat: 4, bars: 1 },
      { id: "verse-2", name: "verse", startBeat: 4, endBeat: 8, bars: 1 },
    ],
    phraseMemory: {
      version: 1,
      familyId: "executor-memory",
      sections: [
        { sectionId: "verse-1", sourceSectionId: "verse-1", relationship: "statement", recallStrength: 1 },
        { sectionId: "verse-2", sourceSectionId: "verse-1", relationship: "return", recallStrength: 0.8, transform: "motif-return" },
      ],
    },
    tracks: [{
      id: "melody",
      notes: [
        ...source,
        ...source.map((note) => ({
          ...note,
          start: note.start + 4,
          pitch: note.pitch + (note.pitch === 64 ? 2 : 0),
          phraseMemorySourceSectionId: "verse-1",
        })),
      ],
    }],
  };
}

test("generation executor replaces stale memory diagnostics when the result already exposes quality diagnostics", async () => {
  const stale = { status: "evaluated", passed: false, score: 1, reason: "stale" };
  const expected = {
    status: "committed",
    song: executorMemorySong(),
    outputQualityDiagnostics: { melodySectionMemoryAudit: stale },
  };
  const sourceBefore = structuredClone(expected.song);
  const executor = createGenerationExecutor({ fallback: () => expected });

  const result = await executor.run("new", { config: { seed: "memory-refresh-integration" } });

  assert.notEqual(result, expected);
  assert.deepEqual(expected.song, sourceBefore, "executor quality processing must not mutate the fallback source song");
  assert.notEqual(result.outputQualityDiagnostics.melodySectionMemoryAudit, stale);
  assert.equal(result.outputQualityDiagnostics.melodySectionMemoryAudit.status, "evaluated");
});
