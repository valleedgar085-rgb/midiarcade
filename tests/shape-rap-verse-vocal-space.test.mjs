import assert from "node:assert/strict";
import test from "node:test";
import { createShapeCandidate, rejectShapeCandidate, acceptShapeCandidate } from "../src/core/shape-director-engine.js";
import { evaluateChorusHookRecurrence } from "../src/core/chorus-hook-recurrence.js";

const note = (id, start, pitch, velocity = 75) => ({ id, start, pitch, duration: 0.35, velocity });
const mainNotes = [
  note("m1", 1, 64), note("m2", 4, 67),
  note("m3", 8, 69), note("m4", 13, 67),
];
const answerNotes = [note("c1", 3, 72, 68), note("c2", 11, 74, 65)];
function fixture(genre = "rap") {
  return {
    id: "vocal-pocket-proof", genre, meta: { genre, beatsPerBar: 4 },
    structure: [
      { id: "verse-1", name: "Verse 1", startBeat: 0, endBeat: 16, bars: 4 },
      { id: "chorus-1", name: "Chorus", startBeat: 16, endBeat: 32, bars: 4 },
    ],
    tracks: [
      { id: "drums", notes: [note("kick", 0, 36, 102), note("snare", 2, 38, 94)] },
      { id: "bass", notes: [note("bass", 0, 40, 83), note("bass2", 8, 40, 83)] },
      { id: "melody", notes: [...mainNotes, note("hook1", 17, 72), note("hook2", 19, 76)] },
      { id: "counterpoint", notes: answerNotes },
    ],
  };
}
const track = (song, id) => song.tracks.find((entry) => entry.id === id);
const verseNotes = (song, id) => track(song, id).notes.filter((note) => note.start < 16);

test("Rap-family Catchier protects both lead and counterpoint rests in verse track scope", () => {
  for (const genre of ["rap", "hipHop", "trap", "drill", "hip-hop"]) {
    for (const trackId of ["melody", "counterpoint"]) {
      const song = fixture(genre);
      const before = structuredClone(song);
      const params = {
        selection: { target: "track", sectionId: "verse-1", trackId },
        size: "transform", direction: "catchier",
      };
      const candidate = createShapeCandidate(song, params, { seed: "pocket" });
      assert.equal(candidate.status, "candidate", genre + ":" + trackId);
      assert.equal(candidate.summary.insertedNoteCount, 0);
      assert.equal(candidate.summary.deletedNoteCount, 0);
      assert.deepEqual(verseNotes(candidate.after, trackId).map((note) =>
        [note.id, note.start, note.pitch, note.duration]),
        verseNotes(song, trackId).map((note) =>
          [note.id, note.start, note.pitch, note.duration]));
      assert.ok(verseNotes(candidate.after, trackId).some((note, i) =>
        note.velocity > verseNotes(song, trackId)[i].velocity),
        "Catchier may add restrained expression without any filler");
      assert.deepEqual(song, before);
      assert.deepEqual(rejectShapeCandidate(candidate), before);
      assert.deepEqual(acceptShapeCandidate(candidate), candidate.after);
      assert.deepEqual(createShapeCandidate(song, params, { seed: "pocket" }), candidate);
    }
  }
});

test("Whole-verse Catchier preserves lead-space diagnostics while keeping drums and bass eligible", () => {
  const song = fixture("hipHop");
  const before = evaluateChorusHookRecurrence(song).verses[0];
  const tx = createShapeCandidate(song, {
    selection: { target: "section", sectionId: "verse-1" },
    size: "transform", direction: "catchier",
  }, { seed: "whole-verse" });
  assert.equal(tx.status, "candidate");
  assert.deepEqual(verseNotes(tx.after, "melody").map((note) => [note.id, note.start, note.pitch, note.duration]),
    verseNotes(song, "melody").map((note) => [note.id, note.start, note.pitch, note.duration]));
  assert.deepEqual(verseNotes(tx.after, "counterpoint").map((note) => [note.id, note.start, note.pitch, note.duration]),
    verseNotes(song, "counterpoint").map((note) => [note.id, note.start, note.pitch, note.duration]));
  const after = evaluateChorusHookRecurrence(tx.after).verses[0];
  assert.equal(after.leadRestFraction, before.leadRestFraction);
  assert.equal(after.longestLeadRestBeats, before.longestLeadRestBeats);
  assert.equal(after.notesPerBar, before.notesPerBar);
  assert.deepEqual(tx.after.structure, song.structure);
  assert.deepEqual(track(tx.after, "melody").notes.filter((n) => n.start >= 16),
    track(song, "melody").notes.filter((n) => n.start >= 16));
  assert.ok(verseNotes(tx.after, "drums").length >= verseNotes(song, "drums").length);
  assert.ok(verseNotes(tx.after, "bass").length >= verseNotes(song, "bass").length);
});

test("Catchier in a Rap chorus and Busier in a Rap verse retain explicitly denser behavior", () => {
  const song = fixture("rap");
  const chorus = createShapeCandidate(song, {
    selection: { target: "track", sectionId: "chorus-1", trackId: "melody" },
    size: "transform", direction: "catchier",
  }, { seed: "chorus-note" });
  assert.equal(chorus.status, "candidate");
  assert.ok(chorus.summary.insertedNoteCount > 0, "lead chorus Catchier keeps its normal fallback");

  const busier = createShapeCandidate(song, {
    selection: { target: "track", sectionId: "verse-1", trackId: "melody" },
    size: "transform", direction: "busier",
  }, { seed: "verse-busier" });
  assert.equal(busier.status, "candidate");
  assert.ok(busier.summary.insertedNoteCount > 0, "explicitly choosing Busier should permit extra notes");
});

test("Pop, Jazz and missing genre do not inherit the Rap-specific vocal-space guard", () => {
  for (const genre of ["pop", "jazz", ""]) {
    const song = fixture(genre);
    const tx = createShapeCandidate(song, {
      selection: { target: "track", sectionId: "verse-1", trackId: "melody" },
      size: "transform", direction: "catchier",
    }, { seed: "original-catchier" });
    assert.equal(tx.status, "candidate");
    assert.ok(tx.summary.insertedNoteCount > 0, genre);
  }
});

test("Rap verse selected-note Catchier stays inside the one-note editing boundary", () => {
  const song = fixture("rap");
  const before = structuredClone(song);
  const result = createShapeCandidate(song, {
    selection: { target: "notes", sectionId: "verse-1", trackId: "melody", noteIds: ["m2"] },
    size: "transform", direction: "catchier",
  }, { seed: "one-note" });
  assert.equal(result.status, "candidate");
  assert.equal(result.summary.changedNoteCount, 1);
  assert.equal(result.summary.insertedNoteCount, 0);
  assert.deepEqual(verseNotes(result.after, "melody").map(n => [n.id, n.start, n.pitch, n.duration]),
    verseNotes(song, "melody").map(n => [n.id, n.start, n.pitch, n.duration]));
  assert.deepEqual(song, before);
});

test("Unknown or non-verse sections cannot trigger the vocal-space guard", () => {
  const song = fixture("rap");
  song.structure[0].name = "Bridge";
  song.structure[0].id = "bridge-1";
  const tx = createShapeCandidate(song, {
    selection: { target: "track", sectionId: "bridge-1", trackId: "melody" },
    size: "transform", direction: "catchier",
  });
  assert.equal(tx.status, "candidate");
  assert.ok(tx.summary.insertedNoteCount > 0);
});
