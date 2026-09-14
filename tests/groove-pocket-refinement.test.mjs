import assert from "node:assert/strict";
import test from "node:test";

import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import { applySongOutputQualityPostprocess } from "../src/core/output-quality-postprocess.js";
import {
  createGroovePocketCandidates,
  MAX_GROOVE_POCKET_CANDIDATES,
} from "../src/core/groove-pocket-refinement.js";

function sourceSong() {
  return {
    id: "groove-pocket-proof",
    genre: "techno",
    bars: 4,
    meta: {
      genre: "techno",
      bars: 4,
      beatsPerBar: 4,
      totalBeats: 16,
      scoreDetails: {},
    },
    structure: [
      { id: "a", name: "idea", startBeat: 0, endBeat: 8 },
      { id: "b", name: "idea", startBeat: 8, endBeat: 16 },
    ],
    harmony: [],
    tracks: [
      {
        id: "drums",
        notes: [
          { id: "k0", start: 0, pitch: 36, duration: 0.1, velocity: 110 },
          { id: "k1", start: 4, pitch: 36, duration: 0.1, velocity: 110 },
          { id: "k2", start: 8, pitch: 36, duration: 0.1, velocity: 110 },
          { id: "k3", start: 12, pitch: 36, duration: 0.1, velocity: 110 },
          { id: "s0", start: 2, pitch: 38, duration: 0.1, velocity: 96 },
          { id: "s1", start: 6, pitch: 38, duration: 0.1, velocity: 96 },
          { id: "s2", start: 10, pitch: 38, duration: 0.1, velocity: 96 },
          { id: "s3", start: 14, pitch: 38, duration: 0.1, velocity: 96 },
        ],
      },
      {
        id: "bass",
        notes: [
          { id: "b0", start: 0.08, pitch: 36, duration: 0.5, velocity: 92 },
          { id: "b1", start: 4.13, pitch: 38, duration: 0.5, velocity: 94 },
          { id: "b2", start: 8.18, pitch: 41, duration: 0.5, velocity: 96 },
          { id: "b3", start: 12.19, pitch: 43, duration: 0.5, velocity: 98 },
        ],
      },
      { id: "melody", notes: [{ id: "m0", start: 1, pitch: 72, duration: 0.5, velocity: 90 }] },
    ],
  };
}

function noteStarts(song, trackId) {
  return song.tracks.find((track) => track.id === trackId).notes.map((note) => note.start);
}

function notePitches(song, trackId) {
  return song.tracks.find((track) => track.id === trackId).notes.map((note) => note.pitch);
}

function grooveEvaluation(song, forcedGroove = null) {
  const bass = song.tracks.find((track) => track.id === "bass")?.notes ?? [];
  const kicks = (song.tracks.find((track) => track.id === "drums")?.notes ?? []).filter((note) => [35, 36].includes(note.pitch));
  const matched = bass.filter((note) => kicks.some((kick) => [0, 0.5].some((offset) => Math.abs(note.start - kick.start - offset) <= 0.075))).length;
  const ratio = matched / Math.max(1, bass.length);
  const groove = forcedGroove ?? Math.round(64 + ratio * 24);
  return {
    score: 90 + ratio,
    diagnostics: { scaleFit: 1 },
    subscores: {
      harmonic: 94,
      voiceLeading: 94,
      separation: 93,
      cadence: 92,
      harmonicJourney: 92,
      groove,
      density: 88,
      performance: 91,
      drumVariety: 90,
      motif: 90,
      repetition: 90,
      memory: 90,
      phraseResolution: 90,
      registerHealth: 90,
      storyArc: 92,
      transitions: 92,
      orchestration: 92,
      tensionFollow: 92,
      stageInterlock: 92,
      production: 93,
      genreAuthenticity: 94,
    },
  };
}

test("groove pocket candidates are deterministic, bass-only, section-safe, and bounded", () => {
  const source = sourceSong();
  const before = structuredClone(source);
  const config = { groovePocketRefinement: true };
  const first = createGroovePocketCandidates(source, config);
  const repeated = createGroovePocketCandidates(source, config);

  assert.deepEqual(source, before, "candidate creation must not mutate the source song");
  assert.equal(first.length, MAX_GROOVE_POCKET_CANDIDATES);
  assert.deepEqual(
    repeated.map(({ id, changedNotes, maxShift, lockDelta }) => [id, changedNotes, maxShift, lockDelta]),
    first.map(({ id, changedNotes, maxShift, lockDelta }) => [id, changedNotes, maxShift, lockDelta]),
  );
  assert.deepEqual(first.map(({ id }) => id), ["tight-pocket", "balanced-pocket", "deep-pocket"]);

  for (const candidate of first) {
    assert.deepEqual(candidate.song.tracks.find((track) => track.id === "drums"), source.tracks.find((track) => track.id === "drums"));
    assert.deepEqual(notePitches(candidate.song, "bass"), notePitches(source, "bass"));
    assert.equal(noteStarts(candidate.song, "bass").length, noteStarts(source, "bass").length);
    assert.ok(candidate.changedNotes <= 5, "four-bar proof song should keep the timing budget small");
    assert.ok(candidate.afterLock > candidate.beforeLock);
    for (const note of candidate.song.tracks.find((track) => track.id === "bass").notes.filter((entry) => entry.groovePocketRole)) {
      const section = candidate.song.structure.find((entry) => note.start >= entry.startBeat - 1e-6 && note.start < entry.endBeat - 1e-6);
      assert.equal(String(section?.id ?? ""), note.groovePocketSectionId, "a pocket move must stay inside its original section");
    }
  }
});

test("groove postprocess selects the strongest real groove win and keeps release/scale gates intact", () => {
  const source = sourceSong();
  const before = structuredClone(source);
  const processed = applySongOutputQualityPostprocess(source, {
    arrangementEvolution: false,
    returnDevelopment: false,
    groovePocketRefinement: true,
  }, {
    evaluateCandidate: grooveEvaluation,
    evaluateReleaseGate() {
      return { passed: true, totalScore: 96, exportChecks: { durationSafe: true } };
    },
  });

  assert.deepEqual(source, before);
  assert.notStrictEqual(processed.song, source);
  assert.equal(processed.grooveDiagnostics.accepted, true);
  assert.equal(processed.grooveDiagnostics.id, "deep-pocket");
  assert.ok(processed.grooveDiagnostics.grooveDelta >= 1);
  assert.equal(processed.grooveDiagnostics.candidatesEvaluated, MAX_GROOVE_POCKET_CANDIDATES);
  assert.equal(processed.song.outputQualityEvolution.groovePocket.accepted, true);
  assert.ok(processed.song.meta.scoreDetails.outputQualityPostprocess.groovePocket.accepted);
});

test("groove postprocess preserves the exact source object when the critic cannot verify a groove gain", () => {
  const source = sourceSong();
  const processed = applySongOutputQualityPostprocess(source, {
    arrangementEvolution: false,
    returnDevelopment: false,
    groovePocketRefinement: true,
  }, {
    evaluateCandidate(song) {
      return grooveEvaluation(song, 82);
    },
    evaluateReleaseGate() {
      return { passed: true, totalScore: 96, exportChecks: { durationSafe: true } };
    },
  });

  assert.strictEqual(processed.song, source);
  assert.equal(processed.grooveDiagnostics.accepted, false);
  assert.equal(processed.grooveDiagnostics.reason, "critic-regression");
});

test("fresh generation opts into pocket refinement while Similar and explicit opt-outs remain authoritative", () => {
  const fresh = applyOutputQualityEvolution({ genre: "techno", seed: "groove-pocket-fresh" }, { kind: "new" });
  const similar = applyOutputQualityEvolution({ genre: "techno", seed: "groove-pocket-similar" }, { kind: "similar" });
  const disabled = applyOutputQualityEvolution({
    genre: "techno",
    seed: "groove-pocket-disabled",
    groovePocketRefinement: false,
  }, { kind: "new" });

  assert.equal(fresh.groovePocketRefinement, true);
  assert.equal(similar.groovePocketRefinement, false);
  assert.equal(disabled.groovePocketRefinement, false);
});
