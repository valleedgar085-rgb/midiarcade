import assert from "node:assert/strict";
import test from "node:test";

import { createGenerationExecutor } from "../src/core/generation-executor.js";
import { applySongOutputQualityPipeline } from "../src/core/output-quality-pipeline-register.js";
import {
  createPhraseResolutionCandidates,
  MAX_PHRASE_RESOLUTION_CANDIDATES,
  MAX_PHRASE_RESOLUTION_EDITS,
} from "../src/core/phrase-resolution-refinement.js";
import {
  phraseResolutionArticulationSatisfied,
  phraseResolutionDesiredDuration,
} from "../src/core/phrase-resolution-style.js";

function sourceSong() {
  return {
    id: "phrase-resolution-proof",
    genre: "trap",
    bars: 6,
    meta: {
      genre: "trap",
      keyPc: 0,
      bars: 6,
      beatsPerBar: 4,
      totalBeats: 24,
      scoreDetails: {},
    },
    structure: [
      { id: "a", name: "verse", startBeat: 0, endBeat: 8 },
      { id: "b", name: "chorus", startBeat: 8, endBeat: 16 },
      { id: "c", name: "outro", startBeat: 16, endBeat: 24 },
    ],
    harmony: [
      { start: 0, duration: 24, root: 0, tones: [0, 4, 7] },
    ],
    tracks: [
      {
        id: "drums",
        notes: [
          { id: "k0", start: 0, pitch: 36, duration: 0.1, velocity: 108 },
          { id: "s0", start: 2, pitch: 38, duration: 0.1, velocity: 96 },
        ],
      },
      {
        id: "bass",
        notes: [
          { id: "b0", start: 0, pitch: 36, duration: 1, velocity: 88 },
          { id: "b1", start: 8, pitch: 36, duration: 1, velocity: 90 },
        ],
      },
      {
        id: "chords",
        notes: [
          { id: "c0", start: 0, pitch: 60, duration: 8, velocity: 78 },
          { id: "c1", start: 8, pitch: 64, duration: 8, velocity: 80 },
          { id: "c2", start: 16, pitch: 67, duration: 8, velocity: 82 },
        ],
      },
      {
        id: "counterpoint",
        notes: [
          { id: "q0", start: 3, pitch: 76, duration: 0.5, velocity: 72 },
          { id: "q1", start: 11, pitch: 79, duration: 0.5, velocity: 74 },
        ],
      },
      {
        id: "pad",
        notes: [
          { id: "p0", start: 0, pitch: 55, duration: 24, velocity: 62 },
        ],
      },
      {
        id: "melody",
        notes: [
          { id: "m0", start: 1, pitch: 67, duration: 0.5, velocity: 92 },
          { id: "m1", start: 7, pitch: 62, duration: 0.25, velocity: 94 },
          { id: "m2", start: 9, pitch: 69, duration: 0.5, velocity: 92 },
          { id: "m3", start: 15, pitch: 62, duration: 0.25, velocity: 96 },
          { id: "m4", start: 17, pitch: 71, duration: 0.5, velocity: 92 },
          { id: "m5", start: 23, pitch: 62, duration: 0.25, velocity: 98 },
        ],
      },
    ],
  };
}

function track(song, id) {
  return song.tracks.find((entry) => entry.id === id);
}

function noteShape(song, id) {
  return (track(song, id)?.notes ?? []).map(({ id: noteId, start, pitch, duration, velocity }) => ({
    id: noteId,
    start,
    pitch,
    duration,
    velocity,
  }));
}

function phraseScore(song) {
  const melody = track(song, "melody")?.notes ?? [];
  const beatsPerBar = song.meta.beatsPerBar;
  const tonic = song.meta.keyPc;
  const endings = song.structure.map((section) => {
    const notes = melody.filter((note) => note.start < section.endBeat - 0.01 && note.start >= section.endBeat - beatsPerBar * 1.25);
    const finalNote = notes.at(-1);
    if (!finalNote) return 0.55;
    const pitchClass = ((finalNote.pitch % 12) + 12) % 12;
    const chordTone = [0, 4, 7].includes(pitchClass);
    const tonicLanding = pitchClass === tonic;
    const held = finalNote.duration >= beatsPerBar * 0.35 - 1e-6;
    return Math.min(1, 0.38 + Number(chordTone) * 0.32 + Number(tonicLanding) * 0.18 + Number(held) * 0.12);
  });
  return Math.round(endings.reduce((sum, value) => sum + value, 0) / endings.length * 100);
}

function evaluator(song, forcedPhrase = null) {
  const phraseResolution = forcedPhrase ?? phraseScore(song);
  return {
    score: 88 + phraseResolution * 0.03,
    diagnostics: { scaleFit: 1, densityTarget: 8 },
    subscores: {
      harmonic: 94,
      voiceLeading: 94,
      separation: 93,
      cadence: 92,
      harmonicJourney: 92,
      groove: 91,
      density: 90,
      performance: 91,
      drumVariety: 90,
      motif: 90,
      repetition: 90,
      memory: 90,
      phraseResolution,
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

function releaseGate() {
  return { passed: true, totalScore: 96, exportChecks: { durationSafe: true } };
}

test("phrase-resolution candidates are deterministic, immutable, melody-only, onset-stable, and bounded", () => {
  const source = sourceSong();
  const before = structuredClone(source);
  const candidates = createPhraseResolutionCandidates(source);
  const repeated = createPhraseResolutionCandidates(source);

  assert.deepEqual(source, before);
  assert.ok(candidates.length > 0);
  assert.ok(candidates.length <= MAX_PHRASE_RESOLUTION_CANDIDATES);
  assert.deepEqual(
    repeated.map(({ id, changedNotes, pitchEdits, durationEdits, localScoreDelta }) => [id, changedNotes, pitchEdits, durationEdits, localScoreDelta]),
    candidates.map(({ id, changedNotes, pitchEdits, durationEdits, localScoreDelta }) => [id, changedNotes, pitchEdits, durationEdits, localScoreDelta]),
  );

  for (const candidate of candidates) {
    assert.ok(candidate.changedNotes <= MAX_PHRASE_RESOLUTION_EDITS);
    assert.ok(candidate.localScoreDelta > 0);
    for (const trackId of ["drums", "bass", "chords", "counterpoint", "pad"]) {
      assert.deepEqual(track(candidate.song, trackId), track(source, trackId), `${trackId} must remain exact`);
    }

    const sourceMelody = track(source, "melody").notes;
    const candidateMelody = track(candidate.song, "melody").notes;
    assert.equal(candidateMelody.length, sourceMelody.length, "cadence refinement must not add or delete melody notes");
    assert.deepEqual(candidateMelody.map((note) => note.id), sourceMelody.map((note) => note.id));
    assert.deepEqual(candidateMelody.map((note) => note.start), sourceMelody.map((note) => note.start), "melody onsets must remain exact");

    for (const section of candidate.song.structure) {
      const landing = candidateMelody.filter((note) => note.start < section.endBeat - 0.01).at(-1);
      assert.ok(!landing || landing.start + landing.duration <= section.endBeat - 0.019, "held cadence must remain inside its section boundary");
    }
  }
});

test("phrase-resolution pipeline commits the strongest critic-verified cadence win", () => {
  const source = sourceSong();
  const before = structuredClone(source);
  const processed = applySongOutputQualityPipeline(source, {
    arrangementEvolution: false,
    returnDevelopment: false,
    densityRefinement: false,
    groovePocketRefinement: false,
    phraseResolutionRefinement: true,
  }, {
    evaluateCandidate: evaluator,
    evaluateReleaseGate: releaseGate,
  });

  assert.deepEqual(source, before);
  assert.notStrictEqual(processed.song, source);
  assert.equal(processed.phraseResolutionDiagnostics.accepted, true);
  assert.ok(processed.phraseResolutionDiagnostics.phraseResolutionDelta >= 0.75);
  assert.ok(processed.phraseResolutionDiagnostics.candidatesEvaluated <= MAX_PHRASE_RESOLUTION_CANDIDATES);
  assert.equal(processed.song.outputQualityEvolution.phraseResolutionRefinement.accepted, true);
  assert.deepEqual(noteShape(processed.song, "drums"), noteShape(source, "drums"));
  assert.deepEqual(noteShape(processed.song, "bass"), noteShape(source, "bass"));
  assert.deepEqual(track(processed.song, "melody").notes.map((note) => note.start), track(source, "melody").notes.map((note) => note.start));
});

test("phrase-resolution pipeline fails closed when cadence gain is not critic-verifiable", () => {
  const source = sourceSong();
  const processed = applySongOutputQualityPipeline(source, {
    arrangementEvolution: false,
    returnDevelopment: false,
    densityRefinement: false,
    groovePocketRefinement: false,
    phraseResolutionRefinement: true,
  }, {
    evaluateCandidate(song) {
      return evaluator(song, 72);
    },
    evaluateReleaseGate: releaseGate,
  });

  assert.strictEqual(processed.song, source);
  assert.equal(processed.phraseResolutionDiagnostics.accepted, false);
  assert.equal(processed.phraseResolutionDiagnostics.reason, "critic-regression");
});

test("fresh generation opts into cadence refinement while explicit opt-out remains authoritative", async () => {
  const captures = [];
  const createExecutor = () => createGenerationExecutor({
    fallback(kind, payload) {
      captures.push({ kind, config: structuredClone(payload.config) });
      return { status: "committed", song: { id: `phrase-${kind}` } };
    },
  });

  const fresh = createExecutor();
  await fresh.run("new", { config: { genre: "trap", seed: "phrase-fresh" } });
  fresh.dispose();
  assert.equal(captures.at(-1).config.phraseResolutionRefinement, true);

  const disabled = createExecutor();
  await disabled.run("new", {
    config: { genre: "trap", seed: "phrase-off", phraseResolutionRefinement: false },
  });
  disabled.dispose();
  assert.equal(captures.at(-1).config.phraseResolutionRefinement, false);
});



test("Funk and Afrobeats accept short boundary punctuation without changing standard held-cadence semantics", () => {
  const note = { start: 7.55, duration: 0.3, pitch: 60 };
  for (const genre of ["funk", "afrobeats"]) {
    assert.equal(phraseResolutionDesiredDuration(genre, 4), 0.48);
    assert.equal(phraseResolutionArticulationSatisfied({
      genre,
      note,
      sectionEnd: 8,
      beatsPerBar: 4,
    }), true);
  }

  assert.equal(phraseResolutionDesiredDuration("trap", 4), 1.4);
  assert.equal(phraseResolutionArticulationSatisfied({
    genre: "trap",
    note,
    sectionEnd: 8,
    beatsPerBar: 4,
  }), false);
});

test("phrase-resolution candidate budget remains capped at the original three candidates", () => {
  for (const genre of ["trap", "funk", "afrobeats"]) {
    const song = sourceSong();
    song.genre = genre;
    song.meta.genre = genre;
    const candidates = createPhraseResolutionCandidates(song, {
      maxCandidates: MAX_PHRASE_RESOLUTION_CANDIDATES,
    });
    assert.ok(candidates.length <= 3);
    assert.ok(candidates.every((candidate) => candidate.changedNotes <= MAX_PHRASE_RESOLUTION_EDITS));
  }
});


test("phrase-resolution reports no cadence opportunity as a true no-op", () => {
  const source = sourceSong();
  track(source, "melody").notes = [];
  const before = structuredClone(source);

  const processed = applySongOutputQualityPipeline(source, {
    arrangementEvolution: false,
    returnDevelopment: false,
    densityRefinement: false,
    groovePocketRefinement: false,
    phraseResolutionRefinement: true,
  }, {
    evaluateCandidate(song) {
      return evaluator(song, 78);
    },
    evaluateReleaseGate: releaseGate,
  });

  assert.deepEqual(source, before);
  assert.strictEqual(processed.song, source);
  assert.equal(processed.phraseResolutionDiagnostics.attempted, true);
  assert.equal(processed.phraseResolutionDiagnostics.accepted, false);
  assert.equal(processed.phraseResolutionDiagnostics.changed, false);
  assert.equal(processed.phraseResolutionDiagnostics.reason, "no-cadence-opportunity");
  assert.equal(processed.phraseResolutionDiagnostics.beforePhraseResolution, 78);
  assert.equal(processed.phraseResolutionDiagnostics.candidatesEvaluated, 0);
  assert.deepEqual(processed.phraseResolutionDiagnostics.candidateIds, []);
});
