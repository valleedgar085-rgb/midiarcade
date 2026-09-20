import assert from "node:assert/strict";
import test from "node:test";

import { generateNew } from "../src/music-engine.js";
import {
  analyzeBassContinuity,
  createBassContinuityCandidates,
} from "../src/core/bass-continuity-refinement.js";
import { applyBassContinuityRefinement } from "../src/core/output-quality-pipeline-register.js";

function bassDropoutSong() {
  return {
    id: "bass-continuity-proof",
    genre: "hipHop",
    meta: { genre: "hipHop", bars: 12, beatsPerBar: 4, totalBeats: 48 },
    structure: [
      { id: "intro-1", name: "intro", startBeat: 0, endBeat: 8, bars: 2 },
      { id: "verse-1", name: "verse", startBeat: 8, endBeat: 24, bars: 4 },
      { id: "chorus-1", name: "chorus", startBeat: 24, endBeat: 40, bars: 4 },
      { id: "outro-1", name: "outro", startBeat: 40, endBeat: 48, bars: 2 },
    ],
    harmony: Array.from({ length: 12 }, (_, bar) => ({
      bar,
      start: bar * 4,
      duration: 4,
      rootPc: [0, 5, 9, 7][bar % 4],
      degree: [0, 3, 5, 4][bar % 4],
    })),
    producerIntent: {
      scenes: [
        { sectionId: "verse-1", roles: { bass: "foundation" } },
        { sectionId: "chorus-1", roles: { bass: "foundation" } },
      ],
    },
    orchestrationMatrix: [
      { sectionId: "verse-1", lanes: { bass: { presence: 0.82 } } },
      { sectionId: "chorus-1", lanes: { bass: { presence: 0.96 } } },
    ],
    tracks: [
      {
        id: "drums",
        notes: Array.from({ length: 12 }, (_, bar) => ({
          id: `kick-${bar}`,
          pitch: 36,
          start: bar * 4,
          duration: 0.08,
          velocity: 96,
        })),
      },
      {
        id: "bass",
        notes: [
          { id: "v1", pitch: 36, start: 8, duration: 0.9, velocity: 88 },
          { id: "v2", pitch: 41, start: 12, duration: 0.9, velocity: 86 },
          { id: "v3", pitch: 45, start: 16, duration: 0.9, velocity: 90 },
          { id: "v4", pitch: 43, start: 20, duration: 0.9, velocity: 87 },
          { id: "c1", pitch: 36, start: 24, duration: 0.9, velocity: 92 },
          { id: "c2", pitch: 43, start: 36, duration: 0.9, velocity: 90 },
        ],
      },
      { id: "chords", notes: [] },
      { id: "melody", notes: [] },
      { id: "counterpoint", notes: [] },
      { id: "pad", notes: [] },
    ],
  };
}

function evaluationFor(candidateSong, { regress = false } = {}) {
  const links = candidateSong.tracks
    .find((track) => track.id === "bass").notes
    .filter((note) => note.continuityRole === "bass-foundation-link").length;
  return {
    score: 85 + links,
    subscores: {
      density: 74 + links,
      groove: 84 + links,
      performance: regress && links ? 83 : 84,
      motif: 84,
      repetition: 82,
      memory: 86,
      registerHealth: 88,
      separation: 89,
      phraseResolution: 84,
      genreAuthenticity: 86,
    },
    diagnostics: { scaleFit: 1 },
  };
}

test("bass continuity detects a body-section dropout without filling intro/outro", () => {
  const result = analyzeBassContinuity(bassDropoutSong());
  assert.ok(result.deficit > 0);
  assert.equal(result.sections.some((section) => section.id === "intro-1"), false);
  assert.equal(result.sections.some((section) => section.id === "outro-1"), false);
  assert.equal(result.weakestSectionId, "chorus-1");
});

test("bass continuity candidates are deterministic, bounded, kick-aware, and chord-root safe", () => {
  const source = bassDropoutSong();
  const original = structuredClone(source);
  const first = createBassContinuityCandidates(source);
  const repeated = createBassContinuityCandidates(source);

  assert.deepEqual(source, original);
  assert.deepEqual(first, repeated);
  assert.ok(first.length >= 1 && first.length <= 2);
  for (const candidate of first) {
    assert.ok(candidate.changedNotes >= 1 && candidate.changedNotes <= 3);
    assert.ok(candidate.continuityErrorDelta < 0);
    const additions = candidate.song.tracks
      .find((track) => track.id === "bass").notes
      .filter((note) => note.continuityRole === "bass-foundation-link");
    assert.equal(additions.length, candidate.changedNotes);
    for (const note of additions) {
      assert.ok(note.start >= 24 && note.start < 40);
      assert.ok(candidate.song.tracks.find((track) => track.id === "drums").notes.some(
        (kick) => kick.pitch === 36 && Math.abs(kick.start - note.start) < 1e-6,
      ));
      const chord = candidate.song.harmony.find(
        (entry) => note.start >= entry.start && note.start < entry.start + entry.duration,
      );
      assert.equal(((note.pitch % 12) + 12) % 12, ((chord.rootPc % 12) + 12) % 12);
      assert.ok(note.pitch >= 24 && note.pitch <= 60);
    }
  }
});

test("final bass continuity stage accepts only a release-safe no-regression repair", () => {
  const source = bassDropoutSong();
  const result = applyBassContinuityRefinement(
    source,
    { bassContinuityRefinement: true },
    (candidateSong) => evaluationFor(candidateSong),
    () => ({ passed: true, totalScore: 91 }),
  );

  assert.equal(result.diagnostics.attempted, true);
  assert.equal(result.diagnostics.accepted, true);
  assert.ok(result.diagnostics.changedNotes >= 1);
  assert.ok(result.diagnostics.continuityErrorDelta < 0);
  assert.ok(result.song !== source);
});

test("bass continuity fails closed if another critic regresses", () => {
  const source = bassDropoutSong();
  const result = applyBassContinuityRefinement(
    source,
    { bassContinuityRefinement: true },
    (candidateSong) => evaluationFor(candidateSong, { regress: true }),
    () => ({ passed: true, totalScore: 91 }),
  );

  assert.equal(result.diagnostics.accepted, false);
  assert.equal(result.diagnostics.reason, "protected-dimension-regression");
  assert.equal(result.song, source);
});

test("bass continuity fails closed if the release gate rejects the repair", () => {
  const source = bassDropoutSong();
  const result = applyBassContinuityRefinement(
    source,
    { bassContinuityRefinement: true },
    (candidateSong) => evaluationFor(candidateSong),
    () => ({ passed: false, totalScore: 70 }),
  );

  assert.equal(result.diagnostics.accepted, false);
  assert.equal(result.diagnostics.reason, "release-gate");
  assert.equal(result.song, source);
});

test("every selectable song length produces a contiguous full arrangement with valid bass timing", () => {
  for (const bars of [16, 24, 32, 48, 64]) {
    const song = generateNew({
      seed: `length-bass-${bars}`,
      genre: "hipHop",
      bars,
      professionalUpgrade: true,
      candidateCount: 1,
      adaptiveCandidates: false,
      targetedRepair: false,
    });

    assert.equal(song.bars, bars);
    assert.equal(song.meta.bars, bars);
    assert.equal(song.structure.reduce((sum, section) => sum + section.bars, 0), bars);
    assert.equal(song.structure[0].startBeat, 0);
    assert.equal(song.structure.at(-1).endBeat, bars * song.meta.beatsPerBar);

    let expectedStart = 0;
    for (const section of song.structure) {
      assert.equal(section.startBeat, expectedStart);
      assert.ok(section.endBeat > section.startBeat);
      expectedStart = section.endBeat;
    }

    const bass = song.tracks.find((track) => track.id === "bass");
    assert.ok(bass?.notes?.length > 0, `${bars}-bar generation must retain a bass foundation`);
    assert.ok(bass.notes.every((note) => (
      Number.isFinite(note.start)
      && Number.isFinite(note.duration)
      && note.start >= 0
      && note.start < song.meta.totalBeats
      && note.duration > 0
    )));
  }
});
