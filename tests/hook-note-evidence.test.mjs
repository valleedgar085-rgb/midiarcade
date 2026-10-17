import assert from "node:assert/strict";
import test from "node:test";
import { evaluateChorusHookRecurrence } from "../src/core/chorus-hook-recurrence.js";
import { inspectHookNoteEvidence } from "../scripts/lib/hook-note-evidence.mjs";
import { inspectHookLineage } from "../scripts/lib/hook-lineage-audit.mjs";

const PITCHES = [60, 62, 65, 64, 67, 65, 69, 67];
function phrase(beat, pitches = PITCHES, { offsets = null, tag = undefined } = {}) {
  return pitches.map((pitch, i) => ({
    start: beat + (offsets?.[i] ?? i + 0.5),
    pitch, duration: 0.35, velocity: 84,
    ...(tag === undefined ? {} : { phraseMemorySourceSectionId: tag }),
  }));
}
function fixture({ returnNotes = phrase(16), sourceNotes = phrase(0), bars = 2 } = {}) {
  const length = bars * 4;
  return {
    genre: "pop", meta: { genre: "pop", beatsPerBar: 4 },
    structure: [
      { id: "chorus-a", name: "chorus", startBeat: 0, endBeat: length, bars },
      { id: "verse-a", name: "verse", startBeat: length, endBeat: 16, bars: 2 },
      { id: "chorus-b", name: "chorus", startBeat: 16, endBeat: 16 + length, bars },
    ],
    motifs: { sectionAssignments: [
      { sectionId: "chorus-a", motifId: "B" }, { sectionId: "chorus-b", motifId: "B" },
    ] },
    memoryMap: [{ sectionId: "chorus-b", originSectionId: "chorus-a" }],
    phraseMemory: { sections: [{ sectionId: "chorus-b", sourceSectionId: "chorus-a" }] },
    tracks: [
      { id: "drums", notes: [{ start: 0, pitch: 36, duration: 0.25, velocity: 95 }] },
      { id: "melody", notes: [...sourceNotes, ...returnNotes] },
    ],
  };
}
function evidence(song) {
  const comparison = evaluateChorusHookRecurrence(song).comparisons[0];
  return inspectHookNoteEvidence(song, "chorus-a", "chorus-b", comparison);
}

test("exact returned hook has equal normalized notes and reports absent tags without false failures", () => {
  const song = fixture();
  const before = structuredClone(song);
  const e = evidence(song);
  assert.equal(e.status, "evaluated");
  assert.equal(e.reason, "recognizable-rendered-hook");
  assert.equal(e.windowBars, 2);
  assert.equal(e.metrics.score, 1);
  assert.deepEqual(e.source.map(n => [n.onset, n.pitch, n.duration, n.velocity]),
    e.returning.map(n => [n.onset, n.pitch, n.duration, n.velocity]));
  assert.deepEqual(e.provenance, { matched: 0, mismatched: 0, absent: 8, mismatchedIndices: [] });
  assert.equal(e.primaryWeakness, null);
  assert.equal(e.stageAttribution, "unavailable-from-final-notes");
  assert.deepEqual(song, before);
  assert.deepEqual(e, evidence(song), "repeat audits must produce identical output");
});

test("matching and conflicting provenance are counted separately from missing tags", () => {
  const notes = phrase(16);
  notes[0].phraseMemorySourceSectionId = "chorus-a";
  notes[1].phraseMemorySourceSectionId = "verse-a";
  const e = evidence(fixture({ returnNotes: notes }));
  assert.deepEqual(e.provenance, { matched: 1, mismatched: 1, absent: 6, mismatchedIndices: [1] });
  assert.equal(e.metrics.score, 1, "metadata cannot replace musical evidence");
});

test("transposed hook retains contour and intervals with no false identity failure", () => {
  const e = evidence(fixture({ returnNotes: phrase(16, PITCHES.map(p => p + 2)) }));
  assert.equal(e.metrics.contour, 1);
  assert.equal(e.metrics.interval, 1);
  assert.equal(e.reason, "recognizable-rendered-hook");
  assert.equal(e.indexAlignedDifferences[0].semitoneDelta, 2);
});

test("rhythm-only drift remains visible independently of pitch contour", () => {
  const offsets = PITCHES.map((_, i) => i + 0.5);
  for (let i = 1; i < offsets.length; i++) offsets[i] += i * 0.18;
  const e = evidence(fixture({ returnNotes: phrase(16, PITCHES, { offsets }) }));
  assert.equal(e.status, "evaluated");
  assert.equal(e.metrics.contour, 1);
  assert.equal(e.metrics.interval, 1);
  assert.ok(e.metrics.rhythm < 1);
  assert.ok(e.indexAlignedDifferences.some(n => n.relativeOnsetDelta !== 0));
});

test("sparse four-bar hook uses critic's four-bar fallback, never invents notes", () => {
  const sparseOffsets = [0.5, 4.5, 8.5, 12.5];
  const song = fixture({
    bars: 4,
    sourceNotes: phrase(0, PITCHES.slice(0, 4), { offsets: sparseOffsets }),
    returnNotes: phrase(16, PITCHES.slice(0, 4), { offsets: sparseOffsets }),
  });
  const original = structuredClone(song);
  const e = evidence(song);
  assert.equal(e.status, "evaluated");
  assert.equal(e.windowBars, 4);
  assert.equal(e.source.length, 4);
  assert.deepEqual(song, original);
});

test("insufficient or missing chorus evidence is unavailable, not a failing hook", () => {
  const sparse = fixture({
    sourceNotes: phrase(0, PITCHES.slice(0, 3)),
    returnNotes: phrase(16, PITCHES.slice(0, 3)),
  });
  const missing = evidence(sparse);
  assert.equal(missing.status, "unavailable");
  assert.equal(missing.metrics, null);
  assert.equal(missing.primaryWeakness, null);
  assert.equal(missing.reason, "insufficient-opening-notes");
  assert.equal(inspectHookNoteEvidence(sparse, "chorus-a", "chorus-b", null).reason,
    "missing-recurrence-comparison");
  const noReturn = fixture();
  noReturn.structure.pop();
  assert.equal(inspectHookLineage(noReturn).returns.length, 0);
});

test("existing lineage report carries evidence without changing any musical event", () => {
  const song = fixture({ returnNotes: phrase(16, [72, 59, 73, 60, 75, 58, 70, 61]) });
  const untouched = JSON.stringify(song);
  const first = inspectHookLineage(song);
  const second = inspectHookLineage(song);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(JSON.stringify(song), untouched);
  assert.equal(first.returns[0].noteEvidence.status, "evaluated");
  assert.equal(first.returns[0].noteEvidence.source.length, 8);
  assert.equal(first.returns[0].noteEvidence.returning.length, 8);
});
