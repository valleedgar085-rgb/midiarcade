import assert from "node:assert/strict";
import test from "node:test";
import { evaluateChorusHookRecurrence } from "../src/core/chorus-hook-recurrence.js";
import { createChorusHookRhythmCandidates } from "../src/core/chorus-hook-development.js";

const sourcePitches = [64, 67, 69, 71, 72, 74, 76, 74];
const targetPitches = [76, 74, 72, 71, 69, 67, 64, 67];
const returnStarts = [16.5, 17.75, 18.5, 19.75, 20.5, 21.75, 22.5, 23.5];

function note(start, pitch, extra = {}) {
  return { start, pitch, duration: 0.25, velocity: 88, ...extra };
}
function sequence(start, pitches, offsets = pitches.map((_, i) => i + 0.5)) {
  return pitches.map((pitch, i) => note(start + offsets[i], pitch));
}
function fixture({
  genre = "rap",
  starts = returnStarts,
  source = sequence(0, sourcePitches),
  protect = false,
  groove = true,
} = {}) {
  const target = targetPitches.map((pitch, i) =>
    note(starts[i], pitch, protect ? { motifMemoryCore: true } : {}));
  const grooveConductor = groove ? {
    bars: Array.from({ length: 6 }, (_, bar) => ({
      bar, leadPulses: [0.5, 1.5, 2.5, 3.5],
    })),
  } : null;
  return {
    genre,
    meta: { genre, beatsPerBar: 4, keyPc: 4, scaleIntervals: [0, 2, 3, 5, 7, 8, 10] },
    structure: [
      { id: "chorus-1", name: "chorus", startBeat: 0, endBeat: 8 },
      { id: "verse-1", name: "verse", startBeat: 8, endBeat: 16 },
      { id: "chorus-2", name: "chorus", startBeat: 16, endBeat: 24 },
    ],
    grooveConductor,
    tracks: [
      { id: "drums", notes: [note(0, 36)] },
      { id: "bass", notes: [note(0, 40)] },
      { id: "chords", notes: [note(0, 60)] },
      { id: "melody", notes: [
        ...source, note(9, 64), note(13, 67), ...target,
      ] },
    ],
  };
}

test("rhythmic recall offers short, aligned shifts without modifying source or vocal verse", () => {
  const song = fixture();
  const original = structuredClone(song);
  const before = evaluateChorusHookRecurrence(song);
  assert.equal(before.status, "evaluated");
  assert.ok(before.score < 66, JSON.stringify(before));
  const candidates = createChorusHookRhythmCandidates(song);
  assert.ok(candidates.length > 0, "expected a feasible rhythmic candidate; report=" + JSON.stringify(before));
  assert.ok(candidates.length <= 3);
  const best = candidates[0];
  assert.ok(best.rhythmGain >= 0.045, JSON.stringify(best));
  assert.ok(best.localScoreDelta >= 0.018);
  assert.ok(best.afterScore > before.score);
  assert.equal(best.targetSectionId, "chorus-2");
  assert.ok(Math.abs(best.shiftBeats) <= 0.375);
  assert.equal(best.changedNotes, 1);
  assert.deepEqual(song, original);
  for (const index of [0, 1, 2]) assert.deepEqual(best.song.tracks[index], song.tracks[index]);
  assert.deepEqual(best.song.tracks[3].notes.slice(0, 10), song.tracks[3].notes.slice(0, 10));

  const beforeNotes = original.tracks[3].notes;
  const afterNotes = best.song.tracks[3].notes;
  assert.equal(afterNotes.length, beforeNotes.length);
  const changes = afterNotes
    .map((n, i) => ({ before: beforeNotes[i], after: n }))
    .filter(({ before, after }) => before.start !== after.start);
  assert.equal(changes.length, 1);
  const changed = changes[0];
  assert.ok(changed.after.start >= 16 && changed.after.start < 24);
  assert.equal(changed.before.pitch, changed.after.pitch);
  assert.equal(changed.before.duration, changed.after.duration);
  assert.equal(changed.before.velocity, changed.after.velocity);
  assert.equal(changed.after.hookDevelopmentRole, "motif-rhythm-return");
  assert.deepEqual(
    afterNotes.map(({ pitch, duration, velocity }) => [pitch, duration, velocity]),
    beforeNotes.map(({ pitch, duration, velocity }) => [pitch, duration, velocity]),
  );
  assert.deepEqual(
    candidates.map(({ id, changedStart, afterScore }) => [id, changedStart, afterScore]),
    createChorusHookRhythmCandidates(song).map(({ id, changedStart, afterScore }) => [id, changedStart, afterScore]),
  );
});

test("protected motifs and disabled candidate limit remain untouched", () => {
  assert.deepEqual(createChorusHookRhythmCandidates(fixture({ protect: true })), []);
  assert.deepEqual(createChorusHookRhythmCandidates(fixture(), { maxCandidates: 0 }), []);
});

test("strong chorus returns, sparse hooks, and unsupported genres are ignored", () => {
  const strong = fixture({ starts: sourcePitches.map((_, i) => 16.5 + i) });
  strong.tracks[3].notes.splice(10, 8, ...sequence(16, sourcePitches));
  assert.deepEqual(createChorusHookRhythmCandidates(strong), []);
  const sparse = fixture();
  sparse.tracks[3].notes = sparse.tracks[3].notes.slice(0, 13);
  assert.deepEqual(createChorusHookRhythmCandidates(sparse), []);
  assert.deepEqual(createChorusHookRhythmCandidates(fixture({ genre: "jazz" })), []);
});

test("no candidate introduces a collision with another note or changes a cadence", () => {
  const song = fixture();
  // Even if the original note is late, the source note may be tied across
  // the proposed earlier slot. Check resulting overlaps rather than a
  // brittle assumption about which candidate the optimizer picks.
  const target = song.tracks[3].notes;
  target[10].duration = 1.2;
  target[target.length - 1].ensembleCadenceRole = "ending";
  for (const candidate of createChorusHookRhythmCandidates(song)) {
    const notes = candidate.song.tracks[3].notes.slice(10);
    for (let i = 1; i < notes.length; i += 1) {
      assert.ok(notes[i].start >= notes[i - 1].start + notes[i - 1].duration + 0.014,
        JSON.stringify(notes));
    }
    assert.equal(candidate.song.tracks[3].notes.at(-1).start, song.tracks[3].notes.at(-1).start);
  }
});

test("a shift that worsens groove alignment is rejected", () => {
  const song = fixture({ groove: true });
  for (let bar = 4; bar <= 5; bar += 1) {
    song.grooveConductor.bars[bar].leadPulses = [0.75, 1.75, 2.75, 3.75];
  }
  for (const candidate of createChorusHookRhythmCandidates(song)) {
    const change = candidate.song.tracks[3].notes.find((n, i) =>
      n.start !== song.tracks[3].notes[i].start);
    const start = change.start;
    const bar = Math.floor(start / 4);
    const offsets = song.grooveConductor.bars[bar].leadPulses;
    const distance = Math.min(...offsets.map((offset) => Math.abs(start - (bar * 4 + offset))));
    assert.ok(distance <= 0.135);
  }
});

test("no proposed changes leak into preview synthesis or exports", () => {
  const song = fixture();
  const before = JSON.stringify(song);
  const candidates = createChorusHookRhythmCandidates(song);
  assert.equal(JSON.stringify(song), before);
  assert.ok(candidates.every(({ song: candidate }) =>
    candidate.tracks[0].notes.length === song.tracks[0].notes.length
    && candidate.tracks[1].notes.length === song.tracks[1].notes.length));
});
