import assert from "node:assert/strict";
import test from "node:test";
import { evaluateChorusHookRecurrence } from "../src/core/chorus-hook-recurrence.js";

const PITCHES = [60, 62, 65, 64, 67, 65, 69, 67];
const STARTS = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5];

function phrase(beat, pitches = PITCHES, offsets = STARTS) {
  return pitches.map((pitch, index) => ({
    start: beat + offsets[index],
    pitch,
    duration: index === pitches.length - 1 ? 0.75 : 0.35,
    velocity: 84 + index,
  }));
}

function fixture(returnNotes = phrase(16, PITCHES.map((pitch) => pitch + 2)), {
  sourceNotes = phrase(0),
  verseNotes = [],
  thirdChorusNotes = null,
} = {}) {
  return {
    genre: "pop",
    meta: { beatsPerBar: 4, tempo: 110 },
    structure: [
      { id: "chorus-1", name: "chorus", startBeat: 0, endBeat: 8, bars: 2 },
      { id: "verse-1", name: "verse", startBeat: 8, endBeat: 16, bars: 2 },
      { id: "chorus-2", name: "chorus", startBeat: 16, endBeat: 24, bars: 2 },
      ...(thirdChorusNotes ? [{ id: "chorus-3", name: "chorus", startBeat: 24, endBeat: 32, bars: 2 }] : []),
    ],
    tracks: [
      { id: "melody", notes: [...sourceNotes, ...verseNotes, ...returnNotes, ...(thirdChorusNotes ?? [])] },
    ],
  };
}

test("a returned chorus hook remains recognizable after transposition and a little pitch variation", () => {
  const pitches = PITCHES.map((pitch) => pitch + 2);
  pitches[5] += 1;
  const song = fixture(phrase(16, pitches));
  const before = structuredClone(song);
  const result = evaluateChorusHookRecurrence(song);

  assert.deepEqual(song, before);
  assert.deepEqual(result, evaluateChorusHookRecurrence(song));
  assert.equal(result.mode, "read-only");
  assert.equal(result.status, "evaluated");
  assert.equal(result.passed, true, JSON.stringify(result));
  assert.ok(result.score >= 66, JSON.stringify(result));
  assert.equal(result.comparisons[0].literalRepeat, false);
  assert.equal(result.comparisons[0].sourceSectionId, "chorus-1");
});

test("transposed same-shape hook counts as familiar but not literally copied pitch", () => {
  const result = evaluateChorusHookRecurrence(fixture());
  assert.equal(result.score, 100);
  assert.equal(result.passed, true);
  assert.equal(result.comparisons[0].literalRepeat, false);
});

test("literal chorus repeat is identified separately from recognizability", () => {
  const result = evaluateChorusHookRecurrence(fixture(phrase(16)));
  assert.equal(result.score, 100);
  assert.equal(result.comparisons[0].literalRepeat, true);
});

test("unrelated pitches and dislocated note timing do not pass as a hook return", () => {
  const weird = phrase(16, [72, 59, 73, 60, 75, 58, 70, 61],
    [0.25, 0.75, 2.25, 2.5, 3.75, 5.25, 6.25, 7.25]);
  const report = evaluateChorusHookRecurrence(fixture(weird));
  assert.equal(report.status, "evaluated");
  assert.equal(report.passed, false, JSON.stringify(report));
  assert.equal(report.reason, "weak-hook-recurrence");
  assert.ok(report.score < 66);
});

test("multiple choruses are scored individually; missing opening notes yield incomplete evidence", () => {
  const report = evaluateChorusHookRecurrence(fixture(phrase(16), {
    thirdChorusNotes: phrase(24, [60, 64]),
  }));
  assert.equal(report.status, "incomplete");
  assert.equal(report.passed, false);
  assert.equal(report.comparisons.length, 2);
  assert.equal(report.comparisons[1].available, false);
  assert.equal(report.reason, "incomplete-hook-evidence");
});

test("rap verse negative space is measured without demanding filler notes", () => {
  const song = fixture(phrase(16), {
    verseNotes: [
      { start: 8.5, pitch: 60, duration: 0.5, velocity: 80 },
      { start: 12.5, pitch: 62, duration: 0.25, velocity: 80 },
    ],
  });
  const before = JSON.stringify(song);
  const report = evaluateChorusHookRecurrence(song);
  assert.equal(report.verses.length, 1);
  assert.ok(report.verses[0].leadRestFraction >= 0.9, JSON.stringify(report.verses));
  assert.ok(report.verses[0].longestLeadRestBeats >= 3);
  assert.equal(report.verses[0].notesPerBar, 1);
  assert.equal(JSON.stringify(song), before);
});

test("single-chorus and melody-free songs are unavailable rather than false failures", () => {
  const single = fixture();
  single.structure = single.structure.filter((section) => section.id !== "chorus-2");
  const result = evaluateChorusHookRecurrence(single);
  assert.equal(result.status, "unavailable");
  assert.equal(result.passed, null);
  assert.equal(result.reason, "single-or-no-chorus");

  const noMelody = fixture();
  noMelody.tracks = [];
  const missing = evaluateChorusHookRecurrence(noMelody);
  assert.equal(missing.status, "unavailable");
  assert.equal(missing.passed, null);
  assert.equal(missing.reason, "missing-melody");
});

test("repeated 3-note fragments do not masquerade as full hook identity", () => {
  const report = evaluateChorusHookRecurrence(fixture(phrase(16, [60, 62, 65])));
  assert.equal(report.status, "incomplete");
  assert.equal(report.passed, null);
  assert.equal(report.reason, "missing-comparable-hooks");
});

test("comparing chorus hooks never changes MIDI event count or identity", () => {
  const song = fixture(phrase(16));
  const before = song.tracks[0].notes.map((note) =>
    [note.pitch, note.start, note.duration, note.velocity]);
  evaluateChorusHookRecurrence(song);
  assert.deepEqual(song.tracks[0].notes.map((note) =>
    [note.pitch, note.start, note.duration, note.velocity]), before);
});
