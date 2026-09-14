import assert from "node:assert/strict";
import test from "node:test";

import { createShapeIntent } from "../src/core/shape-director-policy.js";
import {
  acceptShapeCandidate,
  auditionShapeCandidate,
  createShapeCandidate,
  rejectShapeCandidate,
} from "../src/core/shape-director-engine.js";

function note(id, start, pitch, velocity = 88, duration = 0.5) {
  return { id, start, pitch, velocity, duration };
}

function fixtureSong() {
  return {
    id: "shape-song",
    meta: { key: "A", mode: "minor", beatsPerBar: 4, totalBeats: 16 },
    structure: [
      { id: "verse", name: "Verse", startBeat: 0, endBeat: 8, bars: 2 },
      { id: "chorus", name: "Chorus", startBeat: 8, endBeat: 16, bars: 2 },
    ],
    tracks: [
      {
        id: "drums",
        program: 16,
        settings: { program: 16 },
        notes: [
          note("d1", 0, 36, 105, 0.25), note("d2", 1, 38, 100, 0.25),
          note("d3", 2, 36, 105, 0.25), note("d4", 3, 38, 100, 0.25),
          note("d5", 8, 36, 110, 0.25), note("d6", 9, 38, 104, 0.25),
        ],
      },
      {
        id: "bass",
        program: 38,
        settings: { program: 38 },
        notes: [
          note("b1", 0, 45), note("b2", 1, 48), note("b3", 2, 52), note("b4", 3, 48),
          note("b5", 8, 45), note("b6", 9, 48),
        ],
      },
      {
        id: "melody",
        program: 81,
        settings: { program: 81 },
        notes: [
          note("m1", 0, 69, 86), note("m2", 1, 72, 88), note("m3", 2, 76, 90), note("m4", 3, 72, 91),
          note("m5", 4, 69, 87), note("m6", 5, 72, 89), note("m7", 6, 76, 92), note("m8", 7, 72, 90),
          note("m9", 8, 76, 98), note("m10", 9, 79, 101),
        ],
      },
    ],
  };
}

function byId(song, trackId, noteId) {
  return song.tracks.find((track) => track.id === trackId).notes.find((entry) => entry.id === noteId);
}

test("Shape candidate is non-destructive until accepted", () => {
  const source = fixtureSong();
  const pristine = JSON.stringify(source);
  const transaction = createShapeCandidate(source, {
    selection: { target: "track", sectionId: "verse", trackId: "melody" },
    size: "reshape",
    direction: "harder",
  }, { seed: "harder-verse" });

  assert.equal(transaction.status, "candidate");
  assert.equal(JSON.stringify(source), pristine, "creating a candidate must never mutate the active song");
  assert.notDeepEqual(transaction.after, transaction.before);
  assert.deepEqual(rejectShapeCandidate(transaction), source);
  assert.notDeepEqual(acceptShapeCandidate(transaction), source);
});

test("track scope changes only that instrument inside the selected section", () => {
  const source = fixtureSong();
  const transaction = createShapeCandidate(source, {
    selection: { target: "track", sectionId: "verse", trackId: "melody" },
    size: "transform",
    direction: "brighter",
  }, { seed: "scope-check" });

  assert.equal(transaction.status, "candidate");
  const after = transaction.after;
  assert.deepEqual(after.tracks.find((track) => track.id === "bass"), source.tracks.find((track) => track.id === "bass"));
  assert.deepEqual(after.tracks.find((track) => track.id === "drums"), source.tracks.find((track) => track.id === "drums"));
  assert.deepEqual(byId(after, "melody", "m9"), byId(source, "melody", "m9"), "chorus melody must remain untouched");
  const changedVerse = source.tracks.find((track) => track.id === "melody").notes.slice(0, 8)
    .filter((entry) => JSON.stringify(byId(after, "melody", entry.id)) !== JSON.stringify(entry));
  assert.ok(changedVerse.length > 0);
});

test("selected-note scope never silently expands to neighboring notes", () => {
  const source = fixtureSong();
  const transaction = createShapeCandidate(source, {
    selection: { target: "notes", sectionId: "verse", trackId: "melody", noteIds: ["m2", "m4"] },
    size: "transform",
    direction: "darker",
  }, { seed: "two-notes" });

  assert.equal(transaction.status, "candidate");
  assert.deepEqual(byId(transaction.after, "melody", "m1"), byId(source, "melody", "m1"));
  assert.deepEqual(byId(transaction.after, "melody", "m3"), byId(source, "melody", "m3"));
  assert.ok(
    byId(transaction.after, "melody", "m2").pitch !== byId(source, "melody", "m2").pitch
      || byId(transaction.after, "melody", "m4").pitch !== byId(source, "melody", "m4").pitch,
  );
});

test("missing selected notes fail closed rather than widening scope", () => {
  const result = createShapeCandidate(fixtureSong(), {
    selection: { target: "notes", sectionId: "verse", trackId: "melody", noteIds: ["does-not-exist"] },
    size: "reshape",
    direction: "harder",
  });
  assert.equal(result.status, "rejected");
  assert.equal(result.error, "selected-notes-not-found");
});

test("preserve rhythm blocks deletion and timing edits while allowing expressive change", () => {
  const source = fixtureSong();
  const intent = createShapeIntent({
    selection: { target: "track", sectionId: "verse", trackId: "melody" },
    size: "transform",
    direction: "moreSpace",
    preserve: ["rhythm"],
  });
  const transaction = createShapeCandidate(source, intent, { seed: "preserve-rhythm" });
  assert.equal(transaction.status, "candidate");

  const before = source.tracks.find((track) => track.id === "melody").notes.slice(0, 8);
  const after = transaction.after.tracks.find((track) => track.id === "melody").notes.slice(0, 8);
  assert.equal(after.length, before.length);
  for (const original of before) {
    const shaped = byId(transaction.after, "melody", original.id);
    assert.equal(shaped.start, original.start);
    assert.equal(shaped.duration, original.duration);
  }
});

test("preserve melody and harmony prevent register rewrite", () => {
  const source = fixtureSong();
  const transaction = createShapeCandidate(source, {
    selection: { target: "track", sectionId: "verse", trackId: "melody" },
    size: "transform",
    direction: "brighter",
    preserve: ["melody", "harmony"],
  }, { seed: "pitch-lock" });
  assert.equal(transaction.status, "candidate");
  for (const original of source.tracks.find((track) => track.id === "melody").notes.slice(0, 8)) {
    assert.equal(byId(transaction.after, "melody", original.id).pitch, original.pitch);
  }
});

test("instrument programs remain intact across Shape transactions", () => {
  const source = fixtureSong();
  const transaction = createShapeCandidate(source, {
    selection: { target: "section", sectionId: "verse" },
    size: "reshape",
    direction: "moreBounce",
    preserve: ["instrument"],
  }, { seed: "instrument-lock" });
  assert.equal(transaction.status, "candidate");
  assert.deepEqual(
    transaction.after.tracks.map((track) => track.program),
    source.tracks.map((track) => track.program),
  );
});

test("rewrite size expands the maximum local change budget", () => {
  const source = fixtureSong();
  const make = (size) => createShapeCandidate(source, {
    selection: { target: "track", sectionId: "verse", trackId: "melody" },
    size,
    direction: "harder",
  }, { seed: "same-budget-seed" });

  const touch = make("touchUp");
  const reshape = make("reshape");
  const transform = make("transform");
  assert.equal(touch.status, "candidate");
  assert.equal(reshape.status, "candidate");
  assert.equal(transform.status, "candidate");
  assert.ok(touch.summary.changedNoteCount <= reshape.summary.changedNoteCount);
  assert.ok(reshape.summary.changedNoteCount <= transform.summary.changedNoteCount);
});

test("same song, intent and seed produce the same candidate", () => {
  const input = {
    selection: { target: "track", sectionId: "verse", trackId: "melody" },
    size: "reshape",
    direction: "moreEmotional",
  };
  const first = createShapeCandidate(fixtureSong(), input, { seed: "repeatable" });
  const second = createShapeCandidate(fixtureSong(), input, { seed: "repeatable" });
  assert.equal(first.status, "candidate");
  assert.equal(second.status, "candidate");
  assert.deepEqual(first.after, second.after);
  assert.equal(first.id, second.id);
});

test("Before and After audition return isolated snapshots", () => {
  const transaction = createShapeCandidate(fixtureSong(), {
    selection: { target: "track", sectionId: "verse", trackId: "melody" },
    size: "reshape",
    direction: "buildUp",
  });
  assert.equal(transaction.status, "candidate");
  const before = auditionShapeCandidate(transaction, "before");
  const after = auditionShapeCandidate(transaction, "after");
  before.title = "mutated audition";
  after.title = "other mutation";
  assert.notEqual(transaction.before.title, "mutated audition");
  assert.notEqual(transaction.after.title, "other mutation");
});
