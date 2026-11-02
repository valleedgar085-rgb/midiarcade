import test from "node:test";
import assert from "node:assert/strict";
import { proposeMelodyCommitment } from "../src/core/melody-commitment.js";

test("does not modify input or invent notes for an unavailable hook", () => {
  const song = { meta: { genre: "hipHop" }, tracks: [{ id: "melody", notes: [
    { start: 0, pitch: 60, duration: 0.5, velocity: 80 },
  ] }], structure: [{ id: "verse1", name: "Verse", startBeat: 0, bars: 4 }] };
  const before = structuredClone(song);
  assert.deepEqual(proposeMelodyCommitment(song), []);
  assert.deepEqual(song, before);
});

test("unsupported genres do not receive hook repair candidates", () => {
  const song = { meta: { genre: "jazz" }, tracks: [{ id: "melody", notes: [] }],
    structure: [{ id: "chorus1", name: "Chorus", startBeat: 0, bars: 4 },
      { id: "chorus2", name: "Chorus", startBeat: 16, bars: 4 }] };
  assert.deepEqual(proposeMelodyCommitment(song), []);
});

test("candidate limit zero disables optional proposals", () => {
  assert.deepEqual(proposeMelodyCommitment({ tracks: [] }, { maxCandidates: 0 }), []);
});

const FIRST_HOOK = [64, 67, 69, 71, 72, 74, 76, 74];
const WEAK_RETURN = [76, 74, 72, 71, 69, 67, 64, 67];
const hookNotes = (startBeat, pitches, extra = {}) => pitches.map((pitch, index) => ({
  start: startBeat + index + 0.5,
  pitch,
  duration: 0.35,
  velocity: 85,
  ...extra,
}));

function weakHookFixture({ returning = hookNotes(16, WEAK_RETURN) } = {}) {
  const genre = "rap";
  return {
    genre,
    meta: { genre, beatsPerBar: 4, keyPc: 4, scaleIntervals: [0, 2, 3, 5, 7, 8, 10] },
    structure: [
      { id: "chorus-1", name: "chorus", startBeat: 0, endBeat: 8 },
      { id: "verse-1", name: "verse", startBeat: 8, endBeat: 16 },
      { id: "chorus-2", name: "chorus", startBeat: 16, endBeat: 24 },
    ],
    tracks: [
      { id: "drums", notes: [{ start: 0, pitch: 36, duration: 0.35, velocity: 85 }] },
      { id: "bass", notes: [{ start: 0, pitch: 40, duration: 0.35, velocity: 85 }] },
      { id: "melody", notes: [
        ...hookNotes(0, FIRST_HOOK),
        { start: 9, pitch: 64, duration: 0.35, velocity: 85 },
        { start: 13, pitch: 67, duration: 0.35, velocity: 85 },
        ...returning,
      ] },
    ],
  };
}

test("weak recurring hook produces a reproducible, measurable pitch-only improvement", async () => {
  const { evaluateChorusHookRecurrence } = await import("../src/core/chorus-hook-recurrence.js");
  const song = weakHookFixture();
  const original = structuredClone(song);
  const before = evaluateChorusHookRecurrence(song);
  assert.equal(before.status, "evaluated");
  assert.ok(before.score < 66, JSON.stringify(before));

  const proposals = proposeMelodyCommitment(song);
  assert.ok(proposals.length > 0 && proposals.length <= 3, JSON.stringify(proposals.map((p) => p.id)));
  assert.deepEqual(song, original, "candidate selection must not modify the accepted song");
  assert.deepEqual(
    proposals.map(({ id, changedPitch, afterScore }) => ({ id, changedPitch, afterScore })),
    proposeMelodyCommitment(song).map(({ id, changedPitch, afterScore }) => ({ id, changedPitch, afterScore })),
    "identical input must yield an identical candidate ranking",
  );

  const improved = proposals[0].song;
  const after = evaluateChorusHookRecurrence(improved);
  assert.ok(after.score > before.score, JSON.stringify({ before: before.score, after: after.score }));
  assert.deepEqual(after.verses, before.verses, "rap-verse vocal space must be preserved");
  assert.deepEqual(improved.structure, song.structure);
  assert.deepEqual(improved.harmony, song.harmony);
  assert.deepEqual(improved.tracks[0], song.tracks[0], "drums must not change");
  assert.deepEqual(improved.tracks[1], song.tracks[1], "bass must not change");

  const initialNotes = song.tracks[2].notes;
  const finalNotes = improved.tracks[2].notes;
  assert.equal(finalNotes.length, initialNotes.length);
  let changed = 0;
  for (let i = 0; i < initialNotes.length; i += 1) {
    const start = initialNotes[i];
    const end = finalNotes[i];
    assert.deepEqual(
      [end.start, end.duration, end.velocity],
      [start.start, start.duration, start.velocity],
      "timing, duration and dynamics must remain unchanged",
    );
    if (end.pitch !== start.pitch) {
      changed += 1;
      assert.ok(end.start >= 16 && end.start < 24, "only returning-chorus notes may be re-pitched");
      assert.ok(end.pitch >= 57 && end.pitch <= 79, "melody register must remain safe");
      const pitchClass = ((end.pitch - song.meta.keyPc) % 12 + 12) % 12;
      assert.ok(song.meta.scaleIntervals.includes(pitchClass), "changed pitch must remain in scale");
    }
  }
  assert.equal(changed, 1, "a proposal must alter exactly one pitch");
});

test("already recognizable and protected chorus hooks are left alone", () => {
  const recognizable = weakHookFixture({ returning: hookNotes(16, FIRST_HOOK) });
  assert.deepEqual(proposeMelodyCommitment(recognizable), []);
  const protectedReturn = weakHookFixture({
    returning: hookNotes(16, WEAK_RETURN, { motifMemoryCore: true }),
  });
  const before = structuredClone(protectedReturn);
  assert.deepEqual(proposeMelodyCommitment(protectedReturn), []);
  assert.deepEqual(protectedReturn, before);
});
