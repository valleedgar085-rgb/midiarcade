import assert from "node:assert/strict";
import test from "node:test";
import { createShapeCandidate, acceptShapeCandidate, rejectShapeCandidate } from "../src/core/shape-director-engine.js";
import { evaluateChorusHookRecurrence } from "../src/core/chorus-hook-recurrence.js";
import { encodeMidiVerified } from "../src/music-engine.js";
import { resolvePerformedNote } from "../src/core/performed-note-contract.js";

const track = (song, id) => song.tracks.find((entry) => entry.id === id);
const note = (id, start, pitch, velocity = 85) => ({ id, start, pitch, velocity, duration: 0.12 });
const pitches = (id, start, values) => values.map((pitch, i) => note(`${id}-${i}`, start + i + 0.5, pitch));

function fixture() {
  return {
    id: "precision-proof", seed: "precision-fixed", genre: "hipHop",
    meta: { genre: "hipHop", tempo: 90, ppq: 480, keyPc: 4, scaleIntervals: [0, 2, 3, 5, 7, 8, 10], beatsPerBar: 4, totalBeats: 24 },
    structure: [
      { id: "chorus-1", name: "chorus", startBeat: 0, endBeat: 8, bars: 2 },
      { id: "verse", name: "verse", startBeat: 8, endBeat: 16, bars: 2 },
      { id: "chorus-2", name: "chorus", startBeat: 16, endBeat: 24, bars: 2 },
    ],
    harmony: [{ start: 0, duration: 24, root: 4, tones: [4, 7, 11] }],
    tracks: [
      { id: "drums", channel: 9, program: 0, settings: {}, notes: [
        note("kick", 8, 36, 110), note("hat-a", 8.016, 42), note("snare", 9.016, 38, 100),
        note("hat-b", 9.516, 46), note("hat-c", 11.766, 42), note("next-hat", 16.016, 42),
      ] },
      { id: "bass", channel: 1, program: 38, settings: {}, notes: [note("bass", 8.016, 40)] },
      { id: "chords", channel: 2, program: 0, settings: {}, notes: [note("chord", 8, 64)] },
      { id: "melody", channel: 3, program: 80, settings: {}, notes: [
        ...pitches("a", 0, [64, 67, 69, 71, 72, 74, 76, 74]),
        note("verse-rest", 10, 64),
        ...pitches("b", 16, [76, 74, 72, 71, 69, 67, 64, 67]),
      ] },
    ],
  };
}

function intent(direction, extra = {}) {
  return { selection: { target: "section", sectionId: "verse" }, direction, size: "touchUp", ...extra };
}

test("Shift hats rotates only existing hats within each bar, retaining swing, notes and the band", () => {
  const source = fixture();
  const frozen = structuredClone(source);
  const result = createShapeCandidate(source, intent("shiftHats"), { seed: "hats" });
  assert.equal(result.status, "candidate", JSON.stringify(result));
  assert.deepEqual(source, frozen);
  assert.equal(result.summary.insertedNoteCount, 0);
  assert.equal(result.summary.deletedNoteCount, 0);
  assert.equal(result.summary.changedNoteCount, 3);
  for (const original of track(source, "drums").notes) {
    const actual = track(result.after, "drums").notes.find((entry) => entry.id === original.id);
    if (original.id.startsWith("hat-")) {
      const bar = Math.floor(original.start / 4) * 4;
      assert.ok(Math.abs(actual.start - (bar + (original.start - bar + 0.25) % 4)) < 1e-6);
      assert.deepEqual({ ...actual, start: original.start }, original);
    } else assert.deepEqual(actual, original);
  }
  assert.deepEqual(result.after.tracks.slice(1), source.tracks.slice(1));
  assert.deepEqual(result.after.harmony, source.harmony);
  assert.deepEqual(result.after.structure, source.structure);
  assert.deepEqual(rejectShapeCandidate(result), source);
  assert.deepEqual(acceptShapeCandidate(result), result.after);
  assert.equal(encodeMidiVerified(result.after).audit.passed, true);
});

test("Hat accents changes only existing hat velocities, never timing or hit count", () => {
  const source = fixture();
  const result = createShapeCandidate(source, intent("hatAccents"), { seed: "accents" });
  assert.equal(result.status, "candidate", JSON.stringify(result));
  assert.equal(result.summary.changedNoteCount, 3);
  for (const original of track(source, "drums").notes) {
    const actual = track(result.after, "drums").notes.find((entry) => entry.id === original.id);
    if (original.id.startsWith("hat-")) {
      assert.notEqual(actual.velocity, original.velocity);
      assert.ok(Math.abs(actual.velocity - original.velocity) <= 16);
      assert.deepEqual({ ...actual, velocity: original.velocity }, original);
    } else assert.deepEqual(actual, original);
  }
  assert.deepEqual(result.after.tracks.slice(1), source.tracks.slice(1));
});

test("Precision hat edits honor note selection and rhythm locks, and refuse the wrong instrument", () => {
  const source = fixture();
  const selected = intent("hatAccents", { selection: { target: "notes", sectionId: "verse", trackId: "drums", noteIds: ["hat-b"] }, preserve: ["rhythm"] });
  const result = createShapeCandidate(source, selected);
  assert.equal(result.status, "candidate", JSON.stringify(result));
  assert.equal(result.summary.changedNoteCount, 1);
  assert.deepEqual(track(result.after, "drums").notes.filter((n) => n.id !== "hat-b"), track(source, "drums").notes.filter((n) => n.id !== "hat-b"));
  for (const input of [
    intent("shiftHats", { preserve: ["rhythm"] }),
    intent("shiftHats", { selection: { target: "track", sectionId: "verse", trackId: "bass" } }),
    intent("hatAccents", { selection: { target: "notes", sectionId: "verse", trackId: "drums", noteIds: ["snare"] } }),
  ]) assert.equal(createShapeCandidate(source, input).status, "rejected");
});

test("Recall hook uses the existing one-pitch return proposal without density or timing edits", () => {
  const source = fixture();
  const result = createShapeCandidate(source, intent("recallHook", { selection: { target: "track", sectionId: "chorus-2", trackId: "melody" }, preserve: ["rhythm"] }));
  assert.equal(result.status, "candidate", JSON.stringify(result));
  assert.equal(result.summary.changedNoteCount, 1);
  assert.equal(result.summary.insertedNoteCount, 0);
  assert.ok(evaluateChorusHookRecurrence(result.after).score > evaluateChorusHookRecurrence(source).score);
  track(source, "melody").notes.forEach((original, i) => {
    const actual = track(result.after, "melody").notes[i];
    assert.equal(actual.start, original.start);
    assert.equal(actual.duration, original.duration);
    assert.equal(actual.velocity, original.velocity);
    if (original.start < 16) assert.deepEqual(actual, original);
  });
  assert.deepEqual(result.after.tracks.slice(0, 3), source.tracks.slice(0, 3));
});

function cadenceFixture() {
  const song = fixture();
  song.meta.keyPc = 0;
  song.meta.scaleIntervals = [0, 2, 4, 5, 7, 9, 11];
  song.harmony = [{ start: 0, duration: 24, tones: [0, 4, 7] }];
  track(song, "melody").notes = [
    ...pitches("end", 8, [60, 64, 67, 65, 62, 64, 67, 62]), note("outside", 16.5, 67),
  ];
  return song;
}

test("Resolve ending changes one final melody pitch using the existing cadence owner", () => {
  const source = cadenceFixture();
  const result = createShapeCandidate(source, intent("resolveEnding", { preserve: ["rhythm"] }));
  assert.equal(result.status, "candidate", JSON.stringify(result));
  assert.equal(result.summary.changedNoteCount, 1);
  assert.equal(result.summary.insertedNoteCount, 0);
  const before = track(source, "melody").notes;
  const after = track(result.after, "melody").notes;
  assert.deepEqual(after.slice(0, 7), before.slice(0, 7));
  assert.deepEqual(after[8], before[8]);
  assert.notEqual(after[7].pitch, before[7].pitch);
  assert.ok([0, 4, 7].includes(after[7].pitch % 12));
  assert.ok(Math.abs(after[7].pitch - before[7].pitch) <= 5);
  assert.ok(after[7].pitch >= 57 && after[7].pitch <= 79);
  assert.equal(after[7].duration, before[7].duration);
  assert.equal(after[7].start, before[7].start);
  assert.equal(after[7].velocity, before[7].velocity);
  assert.deepEqual(result.after.tracks.slice(0, 3), source.tracks.slice(0, 3));
});

test("Melodic precision edits fail closed for locks, missing authority, protected notes and already-resolved endings", () => {
  for (const preserve of [["melody"], ["harmony"]]) {
    assert.equal(createShapeCandidate(cadenceFixture(), intent("resolveEnding", { preserve })).status, "rejected");
    assert.equal(createShapeCandidate(fixture(), intent("recallHook", { selection: { target: "section", sectionId: "chorus-2" }, preserve })).status, "rejected");
  }
  for (const mutate of [
    (song) => { delete song.meta.scaleIntervals; },
    (song) => { delete song.meta.keyPc; },
    (song) => { song.harmony = []; },
    (song) => { track(song, "melody").notes[7].motifMemoryCore = true; },
    (song) => { track(song, "melody").notes[7].pitch = 64; },
  ]) {
    const song = cadenceFixture(); mutate(song);
    const before = structuredClone(song);
    assert.equal(createShapeCandidate(song, intent("resolveEnding")).status, "rejected");
    assert.deepEqual(song, before);
  }
});

test("Shape replay records source, exact selection, seed and engine version; different selections cannot share an ID", () => {
  const source = fixture();
  const input = intent("hatAccents");
  const first = createShapeCandidate(source, input, { seed: "replay" });
  assert.equal(first.status, "candidate");
  assert.deepEqual(createShapeCandidate(structuredClone(source), structuredClone(input), { seed: "replay" }), first);
  const revision = first.after.shapeRevision;
  assert.equal(revision.seed, "replay");
  assert.equal(revision.version, 2);
  assert.ok(revision.sourceSignature);
  const selected = createShapeCandidate(source, intent("hatAccents", { selection: { target: "notes", sectionId: "verse", trackId: "drums", noteIds: ["hat-b"] } }), { seed: "replay" });
  assert.equal(selected.status, "candidate");
  assert.notEqual(selected.id, first.id);
  assert.deepEqual(selected.after.shapeRevision.noteIds, ["hat-b"]);
});

test("precision changes update finalized performed events used by preview and MIDI, not just display fields", () => {
  for (const direction of ["shiftHats", "hatAccents", "resolveEnding", "recallHook"]) {
    const source = direction === "resolveEnding" ? cadenceFixture() : fixture();
    for (const part of source.tracks) for (const note of part.notes) {
      note.performed = { startBeat: note.start, durationBeats: note.duration, renderedMidiPitch: note.pitch, velocity: note.velocity };
    }
    const input = intent(direction, direction === "recallHook" ? { selection: { target: "section", sectionId: "chorus-2" } } : {});
    const result = createShapeCandidate(source, input);
    assert.equal(result.status, "candidate", direction);
    for (const part of result.after.tracks) for (const note of part.notes) {
      const actual = resolvePerformedNote(note);
      assert.equal(actual.start, note.start);
      assert.equal(actual.duration, note.duration);
      assert.equal(actual.pitch, note.pitch);
      assert.equal(actual.velocity, note.velocity);
    }
    assert.equal(encodeMidiVerified(result.after).audit.passed, true);
  }
});

test("MIDI velocity 1 remains a soft MIDI attack rather than being mistaken for normalized velocity", () => {
  const source = fixture();
  track(source, "drums").notes[1].velocity = 1;
  const result = createShapeCandidate(source, intent("hatAccents"));
  assert.equal(result.status, "candidate", JSON.stringify(result));
  assert.equal(track(result.after, "drums").notes[1].velocity, 1);
});

test("Resolve ending rejects a harmony gap instead of borrowing a chord from outside the note", () => {
  const source = cadenceFixture();
  source.harmony = [{ start: 0, duration: 8, tones: [0, 4, 7] }];
  assert.equal(createShapeCandidate(source, intent("resolveEnding")).status, "rejected");
});
