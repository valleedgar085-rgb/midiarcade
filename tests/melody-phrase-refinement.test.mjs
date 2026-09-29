import assert from "node:assert/strict";
import test from "node:test";

import { createMelodyPhraseCandidates } from "../src/core/melody-phrase-refinement.js";
import { evaluateMelodyPhraseIntelligence } from "../src/core/melody-phrase-intelligence.js";
import { applyMelodyPhraseRefinement } from "../src/core/output-quality-pipeline-register.js";
import { qualityStageAuthority } from "../src/core/generation-repair-router.js";

function sourceSong() {
  return {
    meta: {
      beatsPerBar: 4,
      keyPc: 0,
      scaleIntervals: [0, 2, 4, 5, 7, 9, 11],
    },
    structure: [{ id: "verse", startBeat: 0, endBeat: 8, bars: 2 }],
    harmony: [
      { start: 0, duration: 4, rootPc: 0, tones: [60, 64, 67] },
      { start: 4, duration: 4, rootPc: 5, tones: [65, 69, 72] },
    ],
    grooveConductor: {
      bars: [
        { bar: 0, sectionId: "verse", leadPulses: [0.5, 1.5, 2.5, 3.5] },
        { bar: 1, sectionId: "verse", leadPulses: [0.5, 1.5, 2.5, 3.5] },
      ],
    },
    tracks: [
      {
        id: "drums",
        notes: [
          { start: 0, pitch: 36, duration: 0.1, velocity: 100 },
          { start: 1, pitch: 38, duration: 0.1, velocity: 96 },
        ],
      },
      {
        id: "bass",
        notes: [
          { start: 0, pitch: 36, duration: 0.5, velocity: 92 },
          { start: 4, pitch: 41, duration: 0.5, velocity: 94 },
        ],
      },
      {
        id: "melody",
        notes: [
          { start: 0.5, pitch: 61, duration: 0.25, velocity: 84 },
          { start: 1.5, pitch: 61, duration: 0.25, velocity: 84 },
          { start: 2.5, pitch: 61, duration: 0.25, velocity: 84 },
          { start: 3.5, pitch: 61, duration: 0.8, velocity: 84 },
          { start: 4.5, pitch: 66, duration: 0.25, velocity: 84 },
          { start: 5.5, pitch: 66, duration: 0.25, velocity: 84 },
          { start: 6.5, pitch: 66, duration: 0.25, velocity: 84 },
          { start: 7.5, pitch: 66, duration: 0.9, velocity: 84 },
        ],
      },
    ],
  };
}

function evaluation() {
  return {
    score: 90,
    subscores: {
      phraseResolution: 90,
      repetition: 90,
      memory: 90,
      motif: 90,
      registerHealth: 90,
      groove: 90,
      performance: 90,
      separation: 90,
    },
    diagnostics: { scaleFit: 1 },
  };
}

test("melody phrase candidates are deterministic and improve phrase intent without touching rhythm section", () => {
  const song = sourceSong();
  const before = structuredClone(song);
  const first = createMelodyPhraseCandidates(song);
  const second = createMelodyPhraseCandidates(song);
  assert.deepEqual(song, before);
  assert.deepEqual(first, second);
  assert.ok(first.length >= 1);
  assert.ok(first.every((candidate) => candidate.phraseScoreDelta > 0));
  for (const candidate of first) {
    assert.deepEqual(candidate.song.tracks.find((track) => track.id === "drums"), before.tracks.find((track) => track.id === "drums"));
    assert.deepEqual(candidate.song.tracks.find((track) => track.id === "bass"), before.tracks.find((track) => track.id === "bass"));
  }
});

test("melody phrase refinement accepts only a release-safe phrase improvement", () => {
  const song = sourceSong();
  const beforePhrase = evaluateMelodyPhraseIntelligence(song);
  const result = applyMelodyPhraseRefinement(
    song,
    { melodyPhraseRefinement: true },
    () => evaluation(),
    () => ({ passed: true }),
  );
  assert.equal(result.diagnostics.attempted, true);
  assert.equal(result.diagnostics.accepted, true, JSON.stringify(result.diagnostics));
  assert.ok(result.diagnostics.phraseScoreDelta >= 3, JSON.stringify(result.diagnostics));
  assert.ok(evaluateMelodyPhraseIntelligence(result.song).score > beforePhrase.score);
  assert.deepEqual(result.song.tracks.find((track) => track.id === "drums"), song.tracks.find((track) => track.id === "drums"));
  assert.deepEqual(result.song.tracks.find((track) => track.id === "bass"), song.tracks.find((track) => track.id === "bass"));
});

test("melody phrase refinement fails closed when release safety rejects the candidate", () => {
  const song = sourceSong();
  const result = applyMelodyPhraseRefinement(
    song,
    { melodyPhraseRefinement: true },
    () => evaluation(),
    () => ({ passed: false }),
  );
  assert.equal(result.song, song);
  assert.equal(result.diagnostics.accepted, false);
  assert.equal(result.diagnostics.reason, "release-gate");
});

test("melody phrase stage is owned only by phrase, harmony, and ensemble authorities", () => {
  const authority = qualityStageAuthority("melodyPhraseRefinement");
  assert.deepEqual(authority.owners, ["phrase", "harmony", "ensemble"]);
  assert.ok(authority.mutations.includes("harmony"));
  assert.ok(authority.mutations.includes("duration"));
  assert.equal(authority.mutations.includes("register"), false);
});
