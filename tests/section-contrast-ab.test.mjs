import test from "node:test";
import assert from "node:assert/strict";
import { blindSideFor, inspectArrangementPair, inspectExportProjectionPair } from
  "../scripts/lib/section-contrast-ab.mjs";

function song() {
  return {
    id: "fixed-ab-test",
    genre: "hipHop",
    meta: {
      tempo: 100, ppq: 480, beatsPerBar: 4, totalBeats: 8,
      timeSignature: [4, 4], key: "E", keyPc: 4,
      scale: "minor", scaleIntervals: [0, 2, 3, 5, 7, 8, 10],
    },
    structure: [{ id: "verse-1", startBeat: 0, endBeat: 4 },
      { id: "chorus-1", startBeat: 4, endBeat: 8 }],
    harmony: [],
    tracks: [
      { id: "drums", channel: 9, program: 0,
        notes: [{ start: 0, pitch: 36, duration: 0.25, velocity: 92 }] },
      { id: "bass", channel: 1, program: 38,
        notes: [{ start: 0, pitch: 40, duration: 1, velocity: 83 }] },
      { id: "chords", channel: 2, program: 1,
        notes: [{ start: 0, pitch: 64, duration: 1.5, velocity: 78 }] },
      { id: "melody", channel: 3, program: 73,
        notes: [{ start: 4, pitch: 69, duration: 0.5, velocity: 78 }] },
    ],
  };
}

test("source and staged candidate preserve note topology; exported MIDI changes only support velocity", () => {
  const before = song();
  const original = structuredClone(before);
  const after = structuredClone(before);
  after.tracks[2].notes[0].velocity -= 7;
  after.tracks[2].notes[0].arrangementPerformanceRole = "verse-support-restraint";

  const review = inspectArrangementPair(before, after);
  assert.equal(review.noteCount, 4);
  assert.equal(review.changedNotes, 1);
  assert.equal(review.modified[0].trackId, "chords");
  assert.equal(review.modified[0].delta, -7);

  const midi = inspectExportProjectionPair(before, after);
  assert.equal(midi.exportAudiblyDistinctByVelocity, true);
  assert.equal(midi.changedVelocities, 1);
  assert.deepEqual(before, original, "read-only inspection must not mutate source");
});

test("protected lane and off-grid edits are rejected", () => {
  const before = song();
  const badVelocity = structuredClone(before);
  badVelocity.tracks[1].notes[0].velocity += 2;
  badVelocity.tracks[1].notes[0].arrangementPerformanceRole = "payoff-support-open";
  assert.throws(() => inspectArrangementPair(before, badVelocity), /protected lane/);

  const badOnset = structuredClone(before);
  badOnset.tracks[2].notes[0].start = 0.125;
  assert.throws(() => inspectArrangementPair(before, badOnset), /timing drift/);

  const badAmount = structuredClone(before);
  badAmount.tracks[2].notes[0].velocity = 99;
  badAmount.tracks[2].notes[0].arrangementPerformanceRole = "payoff-support-open";
  assert.throws(() => inspectArrangementPair(before, badAmount), /approved bound/);
});

test("identical A/B projects report zero differences without fabricating audible improvement", () => {
  const baseline = song();
  assert.equal(inspectArrangementPair(baseline, structuredClone(baseline)).changedNotes, 0);
  assert.equal(inspectExportProjectionPair(baseline, structuredClone(baseline)).changedVelocities, 0);
  assert.equal(blindSideFor("consistent-seed"), blindSideFor("consistent-seed"));
  assert.ok(["A", "B"].includes(blindSideFor("consistent-seed")));
});
