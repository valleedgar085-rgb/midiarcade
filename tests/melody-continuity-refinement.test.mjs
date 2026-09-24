import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeMelodyContinuity,
  createMelodyContinuityCandidates,
} from "../src/core/melody-continuity-refinement.js";
import { applyMelodyContinuityRefinement } from "../src/core/output-quality-pipeline-register.js";
import { evaluateSongCandidate } from "../src/music-engine.js";

function song() {
  return {
    id: "continuity-proof",
    meta: { bars: 8, beatsPerBar: 4, totalBeats: 32 },
    structure: [
      { id: "intro-1", name: "intro", startBeat: 0, endBeat: 8, bars: 2 },
      { id: "verse-1", name: "verse", startBeat: 8, endBeat: 16, bars: 2 },
      { id: "chorus-1", name: "chorus", startBeat: 16, endBeat: 24, bars: 2 },
      { id: "outro-1", name: "outro", startBeat: 24, endBeat: 32, bars: 2 },
    ],
    tracks: [
      { id: "drums", notes: [] },
      { id: "bass", notes: [] },
      { id: "chords", notes: [] },
      { id: "counterpoint", notes: [] },
      { id: "pad", notes: [] },
      {
        id: "melody",
        notes: [
          { id: "i1", start: 1, pitch: 72, duration: 0.5, velocity: 80 },
          { id: "i2", start: 6, pitch: 74, duration: 0.5, velocity: 82 },
          { id: "v1", start: 8.5, pitch: 72, duration: 0.5, velocity: 88 },
          { id: "v2", start: 14.75, pitch: 76, duration: 0.5, velocity: 90 },
          { id: "c1", start: 16.5, pitch: 79, duration: 0.5, velocity: 96 },
          { id: "c2", start: 22.75, pitch: 81, duration: 0.5, velocity: 98 },
          { id: "o1", start: 25, pitch: 72, duration: 0.5, velocity: 76 },
          { id: "o2", start: 30, pitch: 72, duration: 0.5, velocity: 74 },
        ],
      },
    ],
  };
}

test("continuity analysis targets sparse body sections but preserves intro/outro breathing room", () => {
  const result = analyzeMelodyContinuity(song());
  assert.ok(result.deficit > 0);
  assert.equal(result.sections.some((section) => section.id === "intro-1"), false);
  assert.equal(result.sections.some((section) => section.id === "outro-1"), false);
  assert.ok(["verse-1", "chorus-1"].includes(result.weakestSectionId));
});

test("continuity candidates add only bounded deterministic melody connectors", () => {
  const source = song();
  const before = structuredClone(source);
  const first = createMelodyContinuityCandidates(source);
  const repeated = createMelodyContinuityCandidates(source);

  assert.deepEqual(source, before);
  assert.deepEqual(first, repeated);
  assert.ok(first.length >= 2 && first.length <= 3);
  for (const candidate of first) {
    assert.ok(candidate.changedNotes >= 1 && candidate.changedNotes <= 24);
    assert.ok(candidate.continuityErrorDelta < 0);
    const originalCount = source.tracks.find((track) => track.id === "melody").notes.length;
    const candidateCount = candidate.song.tracks.find((track) => track.id === "melody").notes.length;
    assert.equal(candidateCount, originalCount + candidate.changedNotes);
    assert.ok(candidate.song.tracks.find((track) => track.id === "melody").notes.some((note) => note.continuityRole === "phrase-link"));
  }
});

test("phrase-link helpers do not rewrite motif or repetition identity in Critic 6.0", () => {
  const source = song();
  const balanced = createMelodyContinuityCandidates(source)
    .find((candidate) => candidate.id === "balanced-links");
  assert.ok(balanced);

  const before = evaluateSongCandidate(source);
  const after = evaluateSongCandidate(balanced.song);

  assert.equal(after.subscores.repetition, before.subscores.repetition);
  assert.equal(after.subscores.motif, before.subscores.motif);
  assert.ok(after.subscores.density >= before.subscores.density);
});

test("continuity does not invent melody activity for intentionally silent sections", () => {
  const source = song();
  source.tracks.find((track) => track.id === "melody").notes = source.tracks
    .find((track) => track.id === "melody").notes
    .filter((note) => note.start < 8 || note.start >= 16);
  const candidates = createMelodyContinuityCandidates(source);
  assert.ok(candidates.every((candidate) => (
    candidate.song.tracks.find((track) => track.id === "melody").notes
      .filter((note) => note.start >= 8 && note.start < 16).length === 0
  )));
});


function evaluationFor(candidateSong, { regress = false, source = null } = {}) {
  const connectorCount = candidateSong.tracks
    .find((track) => track.id === "melody").notes
    .filter((note) => note.continuityRole === "phrase-link").length;
  return {
    score: 84 + connectorCount,
    subscores: {
      density: 72 + connectorCount * 2,
      motif: regress && source && candidateSong !== source ? 83 : 84,
      repetition: 82,
      memory: 86,
      registerHealth: 88,
      groove: 87,
      performance: 85,
      separation: 89,
      phraseResolution: 84,
      genreAuthenticity: 86,
    },
    diagnostics: { scaleFit: 1 },
  };
}

test("final continuity stage accepts only a release-safe no-regression connector", () => {
  const source = song();
  const result = applyMelodyContinuityRefinement(
    source,
    { melodyContinuityRefinement: true },
    (candidateSong) => evaluationFor(candidateSong),
    () => ({ passed: true, totalScore: 90 }),
  );

  assert.equal(result.diagnostics.attempted, true);
  assert.equal(result.diagnostics.accepted, true);
  assert.ok(result.diagnostics.changedNotes >= 1);
  assert.ok(result.diagnostics.continuityErrorDelta < 0);
  assert.ok(result.song !== source);
});

test("final continuity stage fails closed when any existing critic regresses", () => {
  const source = song();
  const result = applyMelodyContinuityRefinement(
    source,
    { melodyContinuityRefinement: true },
    (candidateSong) => evaluationFor(candidateSong, { regress: true, source }),
    () => ({ passed: true, totalScore: 90 }),
  );

  assert.equal(result.diagnostics.attempted, true);
  assert.equal(result.diagnostics.accepted, false);
  assert.equal(result.diagnostics.reason, "protected-dimension-regression");
  assert.equal(result.song, source);
});

test("balanced continuity can spend at most two truthful score points to remove real gaps", () => {
  const source = song();
  const result = applyMelodyContinuityRefinement(
    source,
    { melodyContinuityRefinement: true },
    (candidateSong) => {
      const links = candidateSong.tracks
        .find((track) => track.id === "melody").notes
        .filter((note) => note.continuityRole === "phrase-link").length;
      return {
        score: links ? 82 : 84,
        subscores: {
          density: 72,
          motif: 84,
          repetition: 82,
          memory: 86,
          registerHealth: 88,
          groove: 87,
          performance: 85,
          separation: 89,
          phraseResolution: 84,
          genreAuthenticity: 86,
        },
        diagnostics: { scaleFit: 1 },
      };
    },
    () => ({ passed: true, totalScore: 90 }),
  );

  assert.equal(result.diagnostics.accepted, true);
  assert.equal(result.diagnostics.id, "balanced-links");
  assert.equal(result.diagnostics.afterScore, 82);
  assert.equal(result.diagnostics.criticViewScore, 84);
  assert.equal(result.diagnostics.maxScoreCost, 2);
  assert.ok(result.diagnostics.continuityErrorDelta < 0);
});

test("continuity-aware floor ignores helper-note motif penalties while preserving actual score", () => {
  const source = song();
  const result = applyMelodyContinuityRefinement(
    source,
    { melodyContinuityRefinement: true },
    (candidateSong) => {
      const links = candidateSong.tracks
        .find((track) => track.id === "melody").notes
        .filter((note) => note.continuityRole === "phrase-link").length;
      return {
        score: links ? 82 : 84,
        subscores: {
          density: 72,
          motif: 84,
          repetition: links ? 60 : 82,
          memory: 86,
          registerHealth: 88,
          groove: 87,
          performance: 85,
          separation: 89,
          phraseResolution: 84,
          genreAuthenticity: 86,
        },
        diagnostics: { scaleFit: 1 },
      };
    },
    () => ({ passed: true, totalScore: 90 }),
  );

  assert.equal(result.diagnostics.accepted, true);
  assert.equal(result.diagnostics.id, "balanced-links");
  assert.equal(result.diagnostics.afterScore, 82);
  assert.equal(result.diagnostics.criticViewScore, 84);
  assert.equal(result.diagnostics.floorDelta, 0);
  assert.equal(result.diagnostics.criticFloorDelta, 0);
  assert.ok(result.diagnostics.actualFloorDelta < -10);
});

test("final continuity stage rejects a connector that only looks safe in the filtered critic view", () => {
  const source = song();
  const result = applyMelodyContinuityRefinement(
    source,
    { melodyContinuityRefinement: true },
    (candidateSong) => {
      const links = candidateSong.tracks
        .find((track) => track.id === "melody").notes
        .filter((note) => note.continuityRole === "phrase-link").length;
      return {
        score: links ? 80 : 84,
        subscores: {
          density: 72,
          motif: 84,
          repetition: 82,
          memory: 86,
          registerHealth: 88,
          groove: 87,
          performance: 85,
          separation: 89,
          phraseResolution: 84,
          genreAuthenticity: 86,
        },
        diagnostics: { scaleFit: 1 },
      };
    },
    () => ({ passed: true, totalScore: 90 }),
  );

  assert.equal(result.diagnostics.accepted, false);
  assert.equal(result.diagnostics.reason, "full-song-regression");
  assert.equal(result.song, source);
});

test("final continuity stage fails closed when the release gate rejects the connector", () => {
  const source = song();
  const result = applyMelodyContinuityRefinement(
    source,
    { melodyContinuityRefinement: true },
    (candidateSong) => evaluationFor(candidateSong),
    () => ({ passed: false, totalScore: 70 }),
  );

  assert.equal(result.diagnostics.accepted, false);
  assert.equal(result.diagnostics.reason, "release-gate");
  assert.equal(result.song, source);
});

test("melody continuity prefers authored leadPulses over midpoint quantization", () => {
  const source = song();
  source.grooveConductor = {
    bars: Array.from({ length: 8 }, (_, bar) => ({
      bar,
      sectionId: bar < 2 ? "intro-1" : bar < 4 ? "verse-1" : bar < 6 ? "chorus-1" : "outro-1",
      leadPulses: [0.75],
    })),
  };
  const candidates = createMelodyContinuityCandidates(source);
  assert.ok(candidates.length > 0);
  const additions = candidates[0].song.tracks
    .find((track) => track.id === "melody").notes
    .filter((note) => note.continuityRole === "phrase-link");
  assert.ok(additions.length > 0);
  for (const note of additions) {
    const offset = ((note.start % 4) + 4) % 4;
    assert.ok(Math.abs(offset - 0.75) < 1e-6, `expected lead Groove DNA pulse, got ${note.start}`);
  }
});


test("larger melody continuity repairs keep truthful score accounting inside the bounded cost budget", () => {
  const source = song();
  source.meta.bars = 32;
  source.meta.totalBeats = 128;
  source.structure = [
    { id: "intro-1", name: "intro", startBeat: 0, endBeat: 8, bars: 2 },
    { id: "verse-1", name: "verse", startBeat: 8, endBeat: 56, bars: 12 },
    { id: "chorus-1", name: "chorus", startBeat: 56, endBeat: 104, bars: 12 },
    { id: "outro-1", name: "outro", startBeat: 104, endBeat: 128, bars: 6 },
  ];
  source.tracks.find((track) => track.id === "melody").notes = [
    { id: "i1", start: 1, pitch: 72, duration: 0.5, velocity: 80 },
    { id: "i2", start: 6, pitch: 74, duration: 0.5, velocity: 82 },
    { id: "v1", start: 8.5, pitch: 72, duration: 0.5, velocity: 88 },
    { id: "v2", start: 54.5, pitch: 76, duration: 0.5, velocity: 90 },
    { id: "c1", start: 56.5, pitch: 79, duration: 0.5, velocity: 96 },
    { id: "c2", start: 102.5, pitch: 81, duration: 0.5, velocity: 98 },
    { id: "o1", start: 105, pitch: 72, duration: 0.5, velocity: 76 },
    { id: "o2", start: 126, pitch: 72, duration: 0.5, velocity: 74 },
  ];

  const candidates = createMelodyContinuityCandidates(source);
  const balanced = candidates.find((candidate) => candidate.id === "balanced-links");
  assert.ok(balanced);
  assert.ok(balanced.changedNotes >= 9, `expected a substantial repair, got ${balanced.changedNotes}`);

  const result = applyMelodyContinuityRefinement(
    source,
    { melodyContinuityRefinement: true },
    (candidateSong) => {
      const links = candidateSong.tracks
        .find((track) => track.id === "melody").notes
        .filter((note) => note.continuityRole === "phrase-link").length;
      return {
        score: links >= 9 ? 93 : 94,
        subscores: {
          density: 80,
          motif: 90,
          repetition: 90,
          memory: 90,
          registerHealth: 90,
          groove: 90,
          performance: 90,
          separation: 90,
          phraseResolution: 84,
          genreAuthenticity: 90,
        },
        diagnostics: { scaleFit: 1 },
      };
    },
    () => ({ passed: true, totalScore: 94 }),
  );

  assert.equal(result.diagnostics.accepted, true);
  assert.equal(result.diagnostics.id, "balanced-links");
  assert.ok(result.diagnostics.changedNotes >= 9);
  assert.equal(result.diagnostics.afterScore, 93);
  assert.equal(result.diagnostics.criticViewScore, 94);
  assert.equal(result.diagnostics.scoreDelta, -1);
  assert.ok(result.diagnostics.maxScoreCost >= 3);
  assert.ok(result.diagnostics.scoreDelta >= -result.diagnostics.maxScoreCost);
});
