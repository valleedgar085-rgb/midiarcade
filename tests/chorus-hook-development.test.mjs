import assert from "node:assert/strict";
import test from "node:test";
import { evaluateChorusHookRecurrence } from "../src/core/chorus-hook-recurrence.js";
import { createChorusHookDevelopmentCandidates } from "../src/core/chorus-hook-development.js";

const sourcePitches = [64, 67, 69, 71, 72, 74, 76, 74];
const weakReturn = [76, 74, 72, 71, 69, 67, 64, 67];
const note = (start, pitch, extra = {}) => ({
  start, pitch, duration: 0.35, velocity: 85, ...extra,
});
const phrase = (start, pitches, extra = {}) => pitches.map((pitch, i) =>
  note(start + i + 0.5, pitch, typeof extra === "function" ? extra(i) : extra));

function fixture({
  genre = "rap",
  returning = phrase(16, weakReturn),
  source = phrase(0, sourcePitches),
  verse = [note(9, 64), note(13, 67)],
  meta = { beatsPerBar: 4, keyPc: 4, scaleIntervals: [0, 2, 3, 5, 7, 8, 10] },
} = {}) {
  return {
    genre, meta: { genre, ...meta },
    structure: [
      { id: "chorus-1", name: "chorus", startBeat: 0, endBeat: 8 },
      { id: "verse-1", name: "verse", startBeat: 8, endBeat: 16 },
      { id: "chorus-2", name: "chorus", startBeat: 16, endBeat: 24 },
    ],
    tracks: [
      { id: "drums", notes: [note(0, 36)] },
      { id: "bass", notes: [note(0, 40)] },
      { id: "melody", notes: [...source, ...verse, ...returning] },
    ],
  };
}

test("weak rap hook gets a bounded scale-safe contour candidate without filler", () => {
  const song = fixture();
  const original = structuredClone(song);
  const before = evaluateChorusHookRecurrence(song);
  assert.equal(before.status, "evaluated");
  assert.ok(before.score < 66, JSON.stringify(before));
  const proposals = createChorusHookDevelopmentCandidates(song);
  assert.ok(proposals.length >= 1, JSON.stringify({ before, proposals }));
  assert.ok(proposals.length <= 3);
  const result = proposals[0];
  assert.equal(result.targetSectionId, "chorus-2");
  assert.equal(result.sourceSectionId, "chorus-1");
  assert.equal(result.changedNotes, 1);
  assert.ok(result.localScoreDelta >= 0.035);
  assert.ok(result.afterScore > before.score);
  assert.deepEqual(song, original);
  assert.deepEqual(result.song.tracks[0], original.tracks[0]);
  assert.deepEqual(result.song.tracks[1], original.tracks[1]);
  assert.deepEqual(result.song.tracks[2].notes.slice(0, 10), original.tracks[2].notes.slice(0, 10));
  const changed = result.song.tracks[2].notes.filter((entry, index) =>
    entry.pitch !== original.tracks[2].notes[index].pitch);
  assert.equal(changed.length, 1);
  assert.ok([0, 2, 3, 5, 7, 8, 10].includes(((changed[0].pitch - 4) % 12 + 12) % 12));
  assert.ok(changed[0].pitch >= 57 && changed[0].pitch <= 79);
  assert.deepEqual(
    result.song.tracks[2].notes.map((entry) => [entry.start, entry.duration, entry.velocity]),
    original.tracks[2].notes.map((entry) => [entry.start, entry.duration, entry.velocity]),
  );
  assert.deepEqual(
    proposals.map((c) => [c.id, c.changedPitch, c.afterScore]),
    createChorusHookDevelopmentCandidates(song).map((c) => [c.id, c.changedPitch, c.afterScore]),
  );
});

test("strong, sparse and unsupported-genre songs receive no proposal", () => {
  assert.deepEqual(createChorusHookDevelopmentCandidates(fixture({ returning: phrase(16, sourcePitches) })), []);
  assert.deepEqual(createChorusHookDevelopmentCandidates(fixture({ returning: phrase(16, [64, 67]) })), []);
  assert.deepEqual(createChorusHookDevelopmentCandidates(fixture({ genre: "jazz" })), []);
});

test("protected melody memory anchors are never moved", () => {
  const returning = phrase(16, weakReturn, (i) => ({
    motifMemoryCore: true, ensembleCadenceRole: i === 7 ? "release" : undefined,
  }));
  assert.deepEqual(createChorusHookDevelopmentCandidates(fixture({ returning })), []);
});

test("no scale authority means no safe rewrite", () => {
  assert.deepEqual(createChorusHookDevelopmentCandidates(fixture({ meta: { beatsPerBar: 4 } })), []);
});

test("no proposal when maxCandidates is zero", () => {
  assert.deepEqual(createChorusHookDevelopmentCandidates(fixture(), { maxCandidates: 0 }), []);
});

test("sparse hip-hop pickup uses an equal four-bar comparison window", () => {
  const song = {
    genre: "hipHop", meta: { beatsPerBar: 4 },
    structure: [
      { id: "chorus-1", name: "chorus", startBeat: 0, endBeat: 16 },
      { id: "chorus-2", name: "chorus", startBeat: 16, endBeat: 32 },
    ],
    tracks: [{ id: "melody", notes: [
      ...phrase(0, [64, 67, 69]), ...phrase(8, [71, 72, 74, 76]),
      ...phrase(16, [66, 69, 71]), ...phrase(24, [73, 74, 76, 78]),
    ] }],
  };
  const before = JSON.stringify(song);
  const audit = evaluateChorusHookRecurrence(song);
  assert.equal(audit.status, "evaluated", JSON.stringify(audit));
  assert.equal(audit.comparisons[0].windowBars, 4);
  assert.ok(audit.score >= 66);
  assert.equal(JSON.stringify(song), before);
});
