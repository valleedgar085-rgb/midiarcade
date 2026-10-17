import assert from "node:assert/strict";
import test from "node:test";
import { createMelodyQuestionAnswerCandidate } from "../src/core/melody-question-answer.js";
import {
  createShapeCandidate,
  acceptShapeCandidate,
  rejectShapeCandidate,
} from "../src/core/shape-director-engine.js";

const question = [60, 62, 64, 67];
const unanswered = [64, 67, 69, 71];
const note = (id, start, pitch) => ({ id, start, pitch, duration: 0.38, velocity: 86 });

function fixture() {
  return {
    id: "call-response-proof", genre: "pop",
    meta: { genre: "pop", beatsPerBar: 4, keyPc: 0, scaleIntervals: [0, 2, 4, 5, 7, 9, 11] },
    structure: [
      { id: "hook-a", name: "chorus", startBeat: 0, endBeat: 16, bars: 4 },
    ],
    harmony: [{ start: 0, duration: 16, tones: [0, 4, 7], rootPc: 0 }],
    tracks: [
      { id: "drums", notes: [note("kick", 1, 36)] },
      { id: "bass", notes: [note("root", 1, 36)] },
      { id: "melody", notes: [
        ...question.map((pitch, i) => note("ask" + i, [0.5, 2.5, 4.5, 7][i], pitch)),
        ...unanswered.map((pitch, i) => note("answer" + i, [8.5, 10.5, 12.5, 15][i], pitch)),
      ] },
    ],
  };
}

const melody = (song) => song.tracks.find((track) => track.id === "melody").notes;
const eventShape = (song) => melody(song).map(({ id, start, duration, velocity }) =>
  ({ id, start, duration, velocity }));

test("rising question receives a descending chord-tone answer with one existing pitch edit", () => {
  const source = fixture();
  const before = structuredClone(source);
  const proposal = createMelodyQuestionAnswerCandidate(source, { sectionId: "hook-a" });
  assert.ok(proposal, "unresolved rising answer should have a safe landing");
  assert.equal(proposal.changedNotes, 1);
  assert.equal(proposal.originalPitch, 71);
  assert.equal(proposal.changedPitch, 67);
  assert.equal(melody(proposal.song).at(-1).pitch, 67);
  assert.equal(melody(proposal.song).at(-1).questionAnswerRole, "answer-landing");
  assert.deepEqual(eventShape(proposal.song), eventShape(source));
  assert.deepEqual(proposal.song.tracks.slice(0, 2), source.tracks.slice(0, 2));
  assert.deepEqual(melody(proposal.song).slice(0, -1), melody(source).slice(0, -1));
  assert.deepEqual(source, before, "the source song must stay untouched");
  assert.deepEqual(
    createMelodyQuestionAnswerCandidate(source, { sectionId: "hook-a" }),
    proposal, "the proposal must be deterministic",
  );
  assert.ok(Object.isFrozen(proposal));
});

test("Shape Catchier auditions the answer through existing Before/After and only saves on Accept", () => {
  const source = fixture();
  const pristine = structuredClone(source);
  const args = {
    selection: { target: "track", sectionId: "hook-a", trackId: "melody" },
    size: "touchUp", direction: "catchier", preserve: ["rhythm"],
  };
  const tx = createShapeCandidate(source, args, { seed: "answer-one" });
  assert.equal(tx.status, "candidate");
  assert.equal(tx.summary.changedNoteCount, 1);
  assert.equal(tx.summary.insertedNoteCount, 0);
  assert.equal(tx.summary.deletedNoteCount, 0);
  assert.equal(melody(tx.after).at(-1).pitch, 67);
  assert.deepEqual(eventShape(tx.after), eventShape(source));
  assert.deepEqual(rejectShapeCandidate(tx), source);
  assert.deepEqual(acceptShapeCandidate(tx), tx.after);
  assert.deepEqual(source, pristine);
  assert.deepEqual(createShapeCandidate(source, args, { seed: "answer-one" }), tx);
});

test("whole-section Catchier can propose a melody-only answer without editing accompaniment", () => {
  const song = fixture();
  const result = createShapeCandidate(song, {
    selection: { target: "section", sectionId: "hook-a" },
    size: "reshape", direction: "catchier",
  });
  assert.equal(result.status, "candidate");
  assert.equal(result.summary.changedNoteCount, 1);
  assert.equal(result.summary.insertedNoteCount, 0);
  assert.deepEqual(result.after.tracks.slice(0, 2), song.tracks.slice(0, 2));
});

test("strong answers, protected landings, missing tonal authority and sparse phrases fail closed", () => {
  const alreadyResolved = fixture();
  melody(alreadyResolved).at(-1).pitch = 67;
  assert.equal(createMelodyQuestionAnswerCandidate(alreadyResolved, { sectionId: "hook-a" }), null);

  for (const protectedFlag of ["motifMemoryCore", "ensembleCadenceRole",
    "transitionHandoffRole", "motifHandoffRole", "finalAssemblyRole"]) {
    const song = fixture();
    melody(song).at(-1)[protectedFlag] = "locked";
    assert.equal(createMelodyQuestionAnswerCandidate(song, { sectionId: "hook-a" }), null);
  }

  const noScale = fixture();
  delete noScale.meta.scaleIntervals;
  assert.equal(createMelodyQuestionAnswerCandidate(noScale, { sectionId: "hook-a" }), null);

  const noHarmony = fixture();
  noHarmony.harmony = [];
  assert.equal(createMelodyQuestionAnswerCandidate(noHarmony, { sectionId: "hook-a" }), null);

  const discord = fixture();
  discord.harmony[0].tones = [1, 3, 6];
  assert.equal(createMelodyQuestionAnswerCandidate(discord, { sectionId: "hook-a" }), null);

  const sparse = fixture();
  melody(sparse).splice(1, 2);
  assert.equal(createMelodyQuestionAnswerCandidate(sparse, { sectionId: "hook-a" }), null);
});

test("verse, short section, unsupported genre and non-rising question never force a repair", () => {
  const verse = fixture();
  verse.structure[0].name = "verse";
  assert.equal(createMelodyQuestionAnswerCandidate(verse, { sectionId: "hook-a" }), null);
  const short = fixture();
  short.structure[0].endBeat = 8;
  assert.equal(createMelodyQuestionAnswerCandidate(short, { sectionId: "hook-a" }), null);
  const jazz = fixture();
  jazz.genre = "jazz"; jazz.meta.genre = "jazz";
  assert.equal(createMelodyQuestionAnswerCandidate(jazz, { sectionId: "hook-a" }), null);
  const flat = fixture();
  melody(flat)[3].pitch = 64;
  assert.equal(createMelodyQuestionAnswerCandidate(flat, { sectionId: "hook-a" }), null);
  assert.equal(createMelodyQuestionAnswerCandidate(fixture(), { sectionId: "wrong" }), null);
});

test("melody and harmony locks, bass scope and selected notes do not activate answer specialist", () => {
  const source = fixture();
  for (const preserve of [["melody"], ["harmony"]]) {
    const tx = createShapeCandidate(source, {
      selection: { target: "track", sectionId: "hook-a", trackId: "melody" },
      size: "reshape", direction: "catchier", preserve,
    }, { seed: "locked-answer" });
    assert.equal(tx.status, "candidate");
    assert.equal(
      melody(tx.after).find((entry) => entry.id === "answer3").pitch,
      71, "a protected melody must not be repitched",
    );
  }
  const bass = createShapeCandidate(source, {
    selection: { target: "track", sectionId: "hook-a", trackId: "bass" },
    size: "reshape", direction: "catchier",
  });
  assert.equal(bass.status, "candidate");
  assert.deepEqual(melody(bass.after), melody(source));
  const notes = createShapeCandidate(source, {
    selection: { target: "notes", sectionId: "hook-a", trackId: "melody", noteIds: ["answer3"] },
    size: "reshape", direction: "catchier",
  });
  assert.ok(["candidate", "rejected"].includes(notes.status));
  if (notes.status === "candidate") {
    assert.equal(melody(notes.after).find((entry) => entry.id === "answer3").pitch, 71);
  }
});
