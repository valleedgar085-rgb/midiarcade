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


test("already-strong melody skips candidate audition", () => {
  const song = sourceSong();
  song.tracks.find((track) => track.id === "melody").notes = [
    { start: 0.5, pitch: 64, duration: 0.5, velocity: 82 },
    { start: 1.5, pitch: 67, duration: 0.25, velocity: 91 },
    { start: 2.5, pitch: 69, duration: 0.5, velocity: 86 },
    { start: 3.5, pitch: 67, duration: 0.75, velocity: 96 },
    { start: 4.5, pitch: 69, duration: 0.5, velocity: 84 },
    { start: 5.5, pitch: 72, duration: 0.25, velocity: 93 },
    { start: 6.5, pitch: 74, duration: 0.5, velocity: 88 },
    { start: 7.5, pitch: 72, duration: 0.75, velocity: 99 },
  ];
  const report = evaluateMelodyPhraseIntelligence(song);
  assert.ok(report.score >= 78, JSON.stringify(report));
  const result = applyMelodyPhraseRefinement(
    song,
    { melodyPhraseRefinement: true },
    () => { throw new Error("strong melody should not invoke full candidate critic"); },
    () => { throw new Error("strong melody should not invoke release gate"); },
  );
  assert.equal(result.song, song);
  assert.equal(result.diagnostics.reason, "already-strong");
  assert.equal(result.diagnostics.beforePhraseScore, report.score);
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


test("melody phrase candidates repair an isolated contour spike without changing rhythm-section timing", () => {
  const song = sourceSong();
  const melody = song.tracks.find((track) => track.id === "melody");
  melody.notes = [
    { start: 0.5, pitch: 60, duration: 0.5, velocity: 82 },
    { start: 1.5, pitch: 64, duration: 0.25, velocity: 88 },
    { start: 2.5, pitch: 79, duration: 0.25, velocity: 90 },
    { start: 3.5, pitch: 65, duration: 0.75, velocity: 94 },
    { start: 4.5, pitch: 67, duration: 0.5, velocity: 84 },
    { start: 5.5, pitch: 69, duration: 0.25, velocity: 91 },
    { start: 6.5, pitch: 72, duration: 0.5, velocity: 88 },
    { start: 7.5, pitch: 69, duration: 0.75, velocity: 96 },
  ];

  const before = structuredClone(song);
  const candidates = createMelodyPhraseCandidates(song);
  const repair = candidates.find((candidate) => candidate.id === "contour-outlier-repair");

  assert.ok(repair, JSON.stringify(candidates.map((candidate) => ({
    id: candidate.id,
    delta: candidate.phraseScoreDelta,
  }))));
  const repairedMelody = repair.song.tracks.find((track) => track.id === "melody");
  const repairedNote = repairedMelody.notes.find((note) => note.start === 2.5);

  assert.notEqual(repairedNote.pitch, 79);
  assert.ok(Math.abs(repairedNote.pitch - 64) < 15);
  assert.ok(Math.abs(65 - repairedNote.pitch) < 14);
  assert.equal(repairedNote.start, before.tracks.find((track) => track.id === "melody").notes[2].start);
  assert.equal(repairedNote.duration, before.tracks.find((track) => track.id === "melody").notes[2].duration);
  assert.equal(repairedNote.phraseIntentRole, "contour-outlier-repair");
  assert.deepEqual(
    repair.song.tracks.find((track) => track.id === "drums"),
    before.tracks.find((track) => track.id === "drums"),
  );
  assert.deepEqual(
    repair.song.tracks.find((track) => track.id === "bass"),
    before.tracks.find((track) => track.id === "bass"),
  );
});
