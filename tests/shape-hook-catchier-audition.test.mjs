import assert from "node:assert/strict";
import test from "node:test";
import { createShapeCandidate, acceptShapeCandidate, rejectShapeCandidate } from "../src/core/shape-director-engine.js";
import { evaluateChorusHookRecurrence } from "../src/core/chorus-hook-recurrence.js";

const opening = [64, 67, 69, 71, 72, 74, 76, 74];
const weakReturn = [76, 74, 72, 71, 69, 67, 64, 67];
const notes = (prefix, beat, pitches) => pitches.map((pitch, index) => ({
  id: `${prefix}-${index}`,
  start: beat + index + 0.5,
  pitch,
  duration: 0.35,
  velocity: 85,
}));

function songFixture() {
  return {
    id: "shape-hook-proof", genre: "rap",
    meta: { genre: "rap", beatsPerBar: 4, keyPc: 4, scaleIntervals: [0, 2, 3, 5, 7, 8, 10] },
    structure: [
      { id: "chorus-1", name: "chorus", startBeat: 0, endBeat: 8 },
      { id: "verse-1", name: "verse", startBeat: 8, endBeat: 16 },
      { id: "chorus-2", name: "chorus", startBeat: 16, endBeat: 24 },
    ],
    tracks: [
      { id: "drums", notes: [{ id: "kick", start: 16, pitch: 36, duration: 0.1, velocity: 100 }] },
      { id: "bass", notes: [{ id: "root", start: 16, pitch: 40, duration: 1, velocity: 85 }] },
      { id: "melody", notes: [
        ...notes("a", 0, opening),
        { id: "verse-space", start: 10, pitch: 64, duration: 0.25, velocity: 76 },
        ...notes("b", 16, weakReturn),
      ] },
    ],
  };
}

const melody = (song) => song.tracks.find((track) => track.id === "melody").notes;
const basicNotes = (song) => melody(song).map(({ id, start, duration, velocity }) =>
  ({ id, start, duration, velocity }));

test("Catchier on weak returning melody creates one safer hook pitch, not extra notes", () => {
  const source = songFixture();
  const before = structuredClone(source);
  const beforeScore = evaluateChorusHookRecurrence(source).score;
  assert.ok(beforeScore < 66);
  const input = {
    selection: { target: "track", sectionId: "chorus-2", trackId: "melody" },
    direction: "catchier", size: "touchUp", preserve: ["rhythm"],
  };
  const candidate = createShapeCandidate(source, input, { seed: "hook-restore" });
  assert.equal(candidate.status, "candidate", JSON.stringify(candidate));
  assert.equal(candidate.summary.changedNoteCount, 1);
  assert.equal(candidate.summary.insertedNoteCount, 0);
  assert.equal(candidate.summary.deletedNoteCount, 0);
  assert.deepEqual(source, before);
  assert.deepEqual(basicNotes(candidate.after), basicNotes(source), "all onsets, durations, velocities and IDs remain");
  assert.deepEqual(candidate.after.tracks[0], source.tracks[0]);
  assert.deepEqual(candidate.after.tracks[1], source.tracks[1]);
  const changed = melody(candidate.after).filter((entry, i) => entry.pitch !== melody(source)[i].pitch);
  assert.equal(changed.length, 1);
  assert.ok(changed[0].start >= 16 && changed[0].start < 24);
  assert.ok(evaluateChorusHookRecurrence(candidate.after).score > beforeScore);
  assert.deepEqual(rejectShapeCandidate(candidate), source);
  assert.deepEqual(acceptShapeCandidate(candidate), candidate.after);
  assert.deepEqual(
    createShapeCandidate(source, input, { seed: "hook-restore" }),
    candidate,
    "candidate must be seeded and repeatable",
  );
});

test("Catchier can audition a melody-only hook repair from section scope", () => {
  const song = songFixture();
  const result = createShapeCandidate(song, {
    selection: { target: "section", sectionId: "chorus-2" },
    size: "reshape", direction: "catchier",
  }, { seed: "section-hook" });
  assert.equal(result.status, "candidate");
  assert.equal(result.summary.changedNoteCount, 1);
  assert.equal(result.summary.insertedNoteCount, 0);
  assert.deepEqual(result.after.tracks[0], song.tracks[0]);
  assert.deepEqual(result.after.tracks[1], song.tracks[1]);
  assert.deepEqual(basicNotes(result.after), basicNotes(song));
});

test("Pitch locks keep the original Catchier behavior without repitching melody", () => {
  for (const preserve of [["melody"], ["harmony"], ["melody", "rhythm"]]) {
    const song = songFixture();
    const output = createShapeCandidate(song, {
      selection: { target: "track", sectionId: "chorus-2", trackId: "melody" },
      size: "reshape", direction: "catchier", preserve,
    }, { seed: "locked" });
    assert.equal(output.status, "candidate");
    assert.ok(output.summary.insertedNoteCount > 0, "keeps the legacy expressive Catchier path");
    for (const note of melody(song)) {
      assert.equal(
        melody(output.after).find((entry) => entry.id === note.id)?.pitch,
        note.pitch,
        "protected melodic pitch must not be altered",
      );
    }
  }
});

test("Selected notes, original chorus and uncalibrated genres do not trigger hook-repair substitution", () => {
  const song = songFixture();
  for (const selection of [
    { target: "track", sectionId: "chorus-1", trackId: "melody" },
    { target: "notes", sectionId: "chorus-2", trackId: "melody", noteIds: ["b-1", "b-2"] },
  ]) {
    const output = createShapeCandidate(song, {
      selection, size: "reshape", direction: "catchier",
    }, { seed: "legacy" });
    if (output.status === "candidate") {
      assert.equal(
        melody(output.after).filter((entry, i) => entry.pitch !== melody(song)[i]?.pitch).length,
        0, "not an authorized return-hook repitch",
      );
    } else {
      assert.equal(output.error, "scope-escape", "existing narrow note-scope validator stays authoritative");
    }
  }
  song.genre = "jazz";
  song.meta.genre = "jazz";
  const jazz = createShapeCandidate(song, {
    selection: { target: "track", sectionId: "chorus-2", trackId: "melody" },
    size: "touchUp", direction: "catchier",
  });
  assert.equal(jazz.status, "candidate");
  assert.ok(jazz.summary.insertedNoteCount > 0);
});
