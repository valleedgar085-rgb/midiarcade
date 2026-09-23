import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateSongCandidate,
  generateNew,
  GENRE_CRITIC_PROFILES,
} from "../src/music-engine.js";
import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import { applySongOutputQualityPipeline } from "../src/core/output-quality-pipeline-register.js";
import {
  createRepetitionRefinementCandidates,
  MAX_REPETITION_REFINEMENT_CANDIDATES,
  MAX_REPETITION_REFINEMENT_EDITS,
  MAX_REPETITION_REFINEMENT_SHIFT,
  repetitionBalance,
  repetitionRefinementFamily,
} from "../src/core/repetition-refinement.js";

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function average(values, fallback = 0) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function sourceSong({ mode = "over" } = {}) {
  const motifStarts = mode === "under" ? [0.5, 1.5, 2.5] : [0, 1, 2];
  const notes = [];
  for (let window = 0; window < 4; window += 1) {
    const offsets = window === 0 ? [0, 1, 2] : motifStarts;
    for (let index = 0; index < offsets.length; index += 1) {
      notes.push({
        id: `m-${window}-${index}`,
        start: window * 4 + offsets[index],
        pitch: 60 + index * 2,
        duration: 0.42,
        velocity: 88 + index,
      });
    }
  }
  return {
    id: `rnb-${mode}`,
    genre: "rnbSoul",
    bars: 4,
    meta: {
      genre: "rnbSoul",
      keyPc: 0,
      bars: 4,
      beatsPerBar: 4,
      totalBeats: 16,
      scoreDetails: {},
    },
    motifs: { melody: { lengthBeats: 4 } },
    songBlueprint: { qualityTargets: { repetition: 0.62 } },
    structure: [{ id: "verse-a", name: "verse", startBeat: 0, endBeat: 16 }],
    harmony: [{ start: 0, duration: 16, root: 0, tones: [0, 4, 7] }],
    tracks: [
      { id: "drums", notes: [{ id: "k", start: 0, pitch: 36, duration: 0.1, velocity: 108 }] },
      { id: "bass", notes: [{ id: "b", start: 0, pitch: 36, duration: 1, velocity: 88 }] },
      { id: "chords", notes: [{ id: "c", start: 0, pitch: 60, duration: 4, velocity: 78 }] },
      { id: "counterpoint", notes: [{ id: "q", start: 2.5, pitch: 72, duration: 0.4, velocity: 72 }] },
      { id: "pad", notes: [{ id: "p", start: 0, pitch: 55, duration: 16, velocity: 62 }] },
      { id: "melody", notes },
    ],
  };
}

function track(song, id) {
  return song.tracks.find((entry) => entry.id === id);
}

function targetForSong(song) {
  const profile = GENRE_CRITIC_PROFILES[song.genre] ?? GENRE_CRITIC_PROFILES.pop;
  return average([
    finite(song.songBlueprint?.qualityTargets?.repetition, profile.repetition),
    profile.repetition,
  ], profile.repetition);
}

function repetitionScore(song, target = targetForSong(song)) {
  const balance = repetitionBalance(song, target);
  return Math.max(30, Math.min(100, Math.round(100 - balance.absoluteError * 125)));
}

function evaluator(song) {
  const repetition = repetitionScore(song);
  return {
    score: 88 + repetition * 0.04,
    diagnostics: { scaleFit: 1, densityTarget: 8 },
    subscores: {
      harmonic: 94,
      voiceLeading: 94,
      separation: 92,
      cadence: 92,
      harmonicJourney: 92,
      groove: 91,
      density: 90,
      performance: 91,
      drumVariety: 90,
      motif: 90,
      repetition,
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

function releaseGate() {
  return { passed: true, totalScore: 96, exportChecks: { durationSafe: true } };
}

function assertCandidatePreservesMusicalIdentity(source, candidate) {
  for (const trackId of ["drums", "bass", "chords", "counterpoint", "pad"]) {
    assert.deepEqual(track(candidate.song, trackId), track(source, trackId), `${trackId} must remain exact`);
  }
  const originalById = new Map(track(source, "melody").notes.map((note) => [note.id, note]));
  const changed = [];
  for (const note of track(candidate.song, "melody").notes) {
    const original = originalById.get(note.id);
    assert.ok(original);
    assert.equal(note.pitch, original.pitch);
    assert.equal(note.duration, original.duration);
    assert.equal(note.velocity, original.velocity);
    if (Math.abs(note.start - original.start) > 1e-6) {
      changed.push(note);
      assert.ok(Math.abs(note.start - original.start) <= MAX_REPETITION_REFINEMENT_SHIFT + 1e-6);
      assert.ok(original.start >= 4, "reference motif window must remain untouched");
    }
  }
  assert.equal(changed.length, candidate.changedNotes);
  assert.ok(changed.length > 0 && changed.length <= MAX_REPETITION_REFINEMENT_EDITS);
}

test("signed repetition candidates deterministically move both under-recall and over-repeat toward target", () => {
  for (const mode of ["under", "over"]) {
    const source = sourceSong({ mode });
    const before = structuredClone(source);
    const target = 0.62;
    const candidates = createRepetitionRefinementCandidates(source, { target });
    const repeated = createRepetitionRefinementCandidates(source, { target });

    assert.deepEqual(source, before);
    assert.ok(candidates.length > 0 && candidates.length <= MAX_REPETITION_REFINEMENT_CANDIDATES);
    assert.deepEqual(
      repeated.map(({ id, direction, changedNotes, beforeActual, afterActual, errorDelta }) => (
        [id, direction, changedNotes, beforeActual, afterActual, errorDelta]
      )),
      candidates.map(({ id, direction, changedNotes, beforeActual, afterActual, errorDelta }) => (
        [id, direction, changedNotes, beforeActual, afterActual, errorDelta]
      )),
    );

    const expectedDirection = mode === "under" ? "reinforce" : "evolve";
    for (const candidate of candidates) {
      assert.equal(candidate.direction, expectedDirection);
      assert.ok(candidate.errorDelta < 0);
      assert.ok(candidate.afterError < candidate.beforeError);
      assertCandidatePreservesMusicalIdentity(source, candidate);
    }
  }
});

test("repetition pipeline commits only a full-critic-verified signed win", () => {
  const source = sourceSong({ mode: "over" });
  const before = structuredClone(source);
  const processed = applySongOutputQualityPipeline(source, {
    arrangementEvolution: false,
    returnDevelopment: false,
    densityRefinement: false,
    phraseResolutionRefinement: false,
    groovePocketRefinement: false,
    repetitionRefinement: true,
    registerHealthRefinement: false,
  }, {
    evaluateCandidate: evaluator,
    evaluateReleaseGate: releaseGate,
  });

  assert.deepEqual(source, before);
  assert.notStrictEqual(processed.song, source);
  assert.equal(processed.repetitionDiagnostics.accepted, true);
  assert.equal(processed.repetitionDiagnostics.direction, "evolve");
  assert.ok(processed.repetitionDiagnostics.repetitionDelta >= 0.75);
  assert.ok(processed.repetitionDiagnostics.errorDelta < 0);
  assert.ok(processed.repetitionDiagnostics.candidatesEvaluated <= MAX_REPETITION_REFINEMENT_CANDIDATES);
  assert.ok(Object.values(processed.repetitionDiagnostics.protectedDeltas).every((delta) => delta >= -1));
  assert.equal(processed.song.outputQualityEvolution.repetitionRefinement.accepted, true);
});

test("repetition pipeline fails closed on critic disagreement and never touches uncalibrated genres", () => {
  const source = sourceSong({ mode: "under" });
  const blocked = applySongOutputQualityPipeline(source, {
    arrangementEvolution: false,
    returnDevelopment: false,
    densityRefinement: false,
    phraseResolutionRefinement: false,
    groovePocketRefinement: false,
    repetitionRefinement: true,
    registerHealthRefinement: false,
  }, {
    evaluateCandidate(song) {
      const result = evaluator(song);
      return { ...result, subscores: { ...result.subscores, repetition: 60 } };
    },
    evaluateReleaseGate: releaseGate,
  });
  assert.strictEqual(blocked.song, source);
  assert.equal(blocked.repetitionDiagnostics.accepted, false);
  assert.equal(blocked.repetitionDiagnostics.reason, "critic-regression");

  const techno = { ...sourceSong({ mode: "over" }), genre: "techno", meta: { ...source.meta, genre: "techno" } };
  const isolated = applySongOutputQualityPipeline(techno, {
    arrangementEvolution: false,
    returnDevelopment: false,
    densityRefinement: false,
    phraseResolutionRefinement: false,
    groovePocketRefinement: false,
    repetitionRefinement: true,
    registerHealthRefinement: false,
  }, {
    evaluateCandidate: evaluator,
    evaluateReleaseGate: releaseGate,
  });
  assert.strictEqual(isolated.song, techno);
  assert.equal(isolated.repetitionDiagnostics.reason, "calibrated-genre-only");
});

test("fresh output-quality evolution opts into repetition balance while explicit controls remain authoritative", () => {
  const fresh = applyOutputQualityEvolution({ genre: "rnbSoul", seed: "repeat-fresh" }, { kind: "new" });
  const related = applyOutputQualityEvolution({ genre: "rnbSoul", seed: "repeat-related" }, { kind: "similar" });
  const disabled = applyOutputQualityEvolution({
    genre: "rnbSoul",
    seed: "repeat-off",
    repetitionRefinement: false,
  }, { kind: "new" });

  assert.equal(fresh.repetitionRefinement, true);
  assert.equal(related.repetitionRefinement, false);
  assert.equal(disabled.repetitionRefinement, false);
});

test("fixed RnB Quality Lab seeds improve or retain repetition while preserving release-safe full-song quality", () => {
  const rows = [];
  for (const seed of ["quality-lab-01", "quality-lab-02", "quality-lab-03"]) {
    const evolved = applyOutputQualityEvolution({
      genre: "rnbSoul",
      seed: `${seed}:rnbSoul`,
      bars: 16,
      candidateCount: 1,
    }, { kind: "new" });
    const baselineConfig = { ...evolved, repetitionRefinement: false };
    const enabledConfig = { ...evolved, repetitionRefinement: true };
    const baselineGenerated = generateNew(baselineConfig);
    const enabledGenerated = generateNew(enabledConfig);
    const baseline = applySongOutputQualityPipeline(baselineGenerated, baselineConfig).song;
    const processed = applySongOutputQualityPipeline(enabledGenerated, enabledConfig);
    const after = processed.song;
    const beforeEvaluation = evaluateSongCandidate(baseline);
    const afterEvaluation = evaluateSongCandidate(after);

    assert.ok(afterEvaluation.subscores.repetition >= beforeEvaluation.subscores.repetition);
    assert.ok(afterEvaluation.score >= beforeEvaluation.score - 0.25);
    rows.push({
      seed,
      before: beforeEvaluation.subscores.repetition,
      after: afterEvaluation.subscores.repetition,
      accepted: Boolean(processed.repetitionDiagnostics?.accepted),
      direction: processed.repetitionDiagnostics?.direction ?? null,
    });
  }

  const beforeAverage = average(rows.map(({ before }) => before));
  const afterAverage = average(rows.map(({ after }) => after));
  console.log("RNB_REPETITION_REFINEMENT", JSON.stringify(rows));
  assert.ok(afterAverage > beforeAverage, `expected RnB repetition average to improve beyond ${beforeAverage}`);
});


test("Phase 5 core genres opt into the bounded signed repetition repair", () => {
  const families = {
    hipHop: "hiphop",
    trap: "trap",
    pop: "pop",
    neoSoul: "neo-soul",
  };

  for (const [genre, family] of Object.entries(families)) {
    const source = sourceSong({ mode: "over" });
    source.genre = genre;
    source.meta.genre = genre;
    source.songBlueprint.qualityTargets.repetition = GENRE_CRITIC_PROFILES[genre].repetition;

    assert.equal(repetitionRefinementFamily(source), family);
    const candidates = createRepetitionRefinementCandidates(source, {
      target: GENRE_CRITIC_PROFILES[genre].repetition,
    });
    assert.ok(candidates.length > 0, `${genre} should expose at least one safe repetition candidate`);
    assert.ok(candidates.every((candidate) => candidate.errorDelta < 0));
    assert.ok(candidates.every((candidate) => candidate.changedNotes <= MAX_REPETITION_REFINEMENT_EDITS));
    assert.ok(candidates.every((candidate) => candidate.maxShift <= MAX_REPETITION_REFINEMENT_SHIFT));
  }
});
