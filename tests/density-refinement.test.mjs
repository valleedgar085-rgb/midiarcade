import assert from "node:assert/strict";
import test from "node:test";

import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import { applySongOutputQualityPipeline } from "../src/core/output-quality-pipeline.js";
import { densityActivityForSong } from "../src/core/density-activity.js";
import {
  createDensityRefinementCandidates,
  MAX_DENSITY_REFINEMENT_CANDIDATES,
} from "../src/core/density-refinement.js";

function sourceSong() {
  return {
    id: "density-proof",
    genre: "jazz",
    bars: 4,
    meta: {
      genre: "jazz",
      bars: 4,
      beatsPerBar: 4,
      totalBeats: 16,
      scoreDetails: {},
    },
    structure: [{ id: "a", name: "verse", startBeat: 0, endBeat: 16 }],
    harmony: [],
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
          { id: "b1", start: 4, pitch: 38, duration: 1, velocity: 90 },
        ],
      },
      {
        id: "chords",
        notes: [
          { id: "c0", start: 0, pitch: 60, duration: 4, velocity: 78 },
          { id: "c1", start: 4, pitch: 64, duration: 4, velocity: 80 },
          { id: "c2", start: 8, pitch: 67, duration: 4, velocity: 82 },
          { id: "c3", start: 12, pitch: 71, duration: 4, velocity: 84 },
        ],
      },
      {
        id: "counterpoint",
        notes: [
          { id: "q0", start: 1, pitch: 74, duration: 2, velocity: 72 },
          { id: "q1", start: 9, pitch: 76, duration: 2, velocity: 74 },
        ],
      },
      {
        id: "pad",
        notes: [
          { id: "p0", start: 0, pitch: 55, duration: 8, velocity: 62 },
          { id: "p1", start: 8, pitch: 57, duration: 8, velocity: 64 },
        ],
      },
      {
        id: "melody",
        notes: [
          { id: "m0", start: 0.5, pitch: 79, duration: 0.5, velocity: 92 },
          { id: "m1", start: 4.5, pitch: 81, duration: 0.5, velocity: 94 },
        ],
      },
    ],
  };
}

function track(song, id) {
  return song.tracks.find((entry) => entry.id === id);
}

function pitches(song, id) {
  return (track(song, id)?.notes ?? []).map((note) => note.pitch).sort((a, b) => a - b);
}

function durationByPitch(song, trackId) {
  const totals = new Map();
  for (const note of track(song, trackId)?.notes ?? []) {
    totals.set(note.pitch, (totals.get(note.pitch) ?? 0) + note.duration);
  }
  return [...totals.entries()].sort((a, b) => a[0] - b[0]);
}

function pitchedNotesPerBar(song) {
  const count = song.tracks
    .filter((entry) => entry.id !== "drums")
    .reduce((sum, entry) => sum + entry.notes.length, 0);
  return count / song.meta.bars;
}

function evaluator(song, forcedDensity = null) {
  const target = 8;
  const npb = pitchedNotesPerBar(song);
  const density = forcedDensity ?? Math.round(100 - Math.abs(npb - target) / target * 42);
  return {
    score: 88 + density * 0.03,
    diagnostics: { scaleFit: 1, densityTarget: target },
    subscores: {
      harmonic: 94,
      voiceLeading: 94,
      separation: 93,
      cadence: 92,
      harmonicJourney: 92,
      groove: 91,
      density,
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

test("density candidates are deterministic, immutable, support-only, and move toward target", () => {
  const source = sourceSong();
  const before = structuredClone(source);
  const candidates = createDensityRefinementCandidates(source, { densityTarget: 8 });
  const repeated = createDensityRefinementCandidates(source, { densityTarget: 8 });

  assert.deepEqual(source, before);
  assert.equal(candidates.length, 3);
  assert.deepEqual(
    repeated.map(({ id, changedNotes, beforeNotesPerBar, afterNotesPerBar }) => [id, changedNotes, beforeNotesPerBar, afterNotesPerBar]),
    candidates.map(({ id, changedNotes, beforeNotesPerBar, afterNotesPerBar }) => [id, changedNotes, beforeNotesPerBar, afterNotesPerBar]),
  );

  for (const candidate of candidates) {
    assert.deepEqual(track(candidate.song, "drums"), track(source, "drums"));
    assert.deepEqual(track(candidate.song, "melody"), track(source, "melody"));
    assert.deepEqual(track(candidate.song, "bass"), track(source, "bass"));
    assert.ok(candidate.afterNotesPerBar > candidate.beforeNotesPerBar);
    assert.ok(candidate.densityErrorDelta < 0);
    assert.ok(candidate.changedNotes <= source.meta.bars, "widest candidate stays capped at one support articulation per bar");

    for (const trackId of ["chords", "counterpoint", "pad"]) {
      assert.deepEqual(
        [...new Set(pitches(candidate.song, trackId))],
        [...new Set(pitches(source, trackId))],
        `${trackId} must not invent pitch content`,
      );
      assert.deepEqual(
        durationByPitch(candidate.song, trackId),
        durationByPitch(source, trackId),
        `${trackId} aggregate sounding duration must stay unchanged`,
      );
    }
  }
});

test("density pipeline commits the strongest critic-verified support articulation win", () => {
  const source = sourceSong();
  const before = structuredClone(source);
  const processed = applySongOutputQualityPipeline(source, {
    arrangementEvolution: false,
    returnDevelopment: false,
    densityRefinement: true,
    groovePocketRefinement: false,
  }, {
    evaluateCandidate: evaluator,
    evaluateReleaseGate() {
      return { passed: true, totalScore: 96, exportChecks: { durationSafe: true } };
    },
  });

  assert.deepEqual(source, before);
  assert.notStrictEqual(processed.song, source);
  assert.equal(processed.densityDiagnostics.accepted, true);
  assert.equal(processed.densityDiagnostics.id, "full-support");
  assert.ok(processed.densityDiagnostics.densityDelta >= 0.75);
  assert.ok(processed.densityDiagnostics.densityErrorDelta < 0);
  assert.equal(processed.densityDiagnostics.candidatesEvaluated, 3);
  assert.equal(processed.song.outputQualityEvolution.densityRefinement.accepted, true);
});

test("density pipeline fails closed when the critic cannot verify a density gain", () => {
  const source = sourceSong();
  const processed = applySongOutputQualityPipeline(source, {
    arrangementEvolution: false,
    returnDevelopment: false,
    densityRefinement: true,
    groovePocketRefinement: false,
  }, {
    evaluateCandidate(song) {
      return evaluator(song, 72);
    },
    evaluateReleaseGate() {
      return { passed: true, totalScore: 96, exportChecks: { durationSafe: true } };
    },
  });

  assert.strictEqual(processed.song, source);
  assert.equal(processed.densityDiagnostics.accepted, false);
  assert.equal(processed.densityDiagnostics.reason, "critic-regression");
});

test("fresh generation opts into density refinement while Similar and explicit opt-out stay authoritative", () => {
  const fresh = applyOutputQualityEvolution({ genre: "jazz", seed: "density-fresh" }, { kind: "new" });
  const similar = applyOutputQualityEvolution({ genre: "jazz", seed: "density-similar" }, { kind: "similar" });
  const disabled = applyOutputQualityEvolution({ genre: "jazz", seed: "density-off", densityRefinement: false }, { kind: "new" });
  const enabledSimilar = applyOutputQualityEvolution({ genre: "jazz", seed: "density-similar-on", densityRefinement: true }, { kind: "similar" });

  assert.equal(fresh.densityRefinement, true);
  assert.equal(similar.densityRefinement, false);
  assert.equal(disabled.densityRefinement, false);
  assert.equal(enabledSimilar.densityRefinement, true);
});


test("rhythm-led genres count bounded drum-onset activity without inflating other genres", () => {
  const base = sourceSong();
  base.meta.bars = 4;
  base.bars = 4;
  base.tracks.find((track) => track.id === "drums").notes = Array.from({ length: 32 }, (_, index) => ({
    id: `d-${index}`,
    start: index * 0.5,
    pitch: index % 4 === 0 ? 36 : 42,
    duration: 0.08,
    velocity: 96,
  }));

  const pop = structuredClone(base);
  pop.genre = "pop";
  pop.meta.genre = "pop";
  const dnb = structuredClone(base);
  dnb.genre = "drumBass";
  dnb.meta.genre = "drumBass";
  const funk = structuredClone(base);
  funk.genre = "funk";
  funk.meta.genre = "funk";
  const afro = structuredClone(base);
  afro.genre = "afrobeats";
  afro.meta.genre = "afrobeats";

  const popDensity = densityActivityForSong(pop);
  const dnbDensity = densityActivityForSong(dnb);
  const funkDensity = densityActivityForSong(funk);
  const afroDensity = densityActivityForSong(afro);

  assert.equal(popDensity.metric, "pitched-notes");
  assert.equal(popDensity.observed, popDensity.pitchedNotesPerBar);
  for (const result of [dnbDensity, funkDensity, afroDensity]) {
    assert.equal(result.metric, "ensemble-events");
    assert.ok(result.observed > result.pitchedNotesPerBar);
    assert.ok(result.drumContribution > 0);
    assert.ok(result.drumContribution <= 16);
  }
});

test("rhythm-led density candidates improve ensemble density error rather than chasing pad-only note count", () => {
  const song = sourceSong();
  song.genre = "funk";
  song.meta.genre = "funk";
  song.meta.bars = 4;
  song.bars = 4;
  song.tracks.find((track) => track.id === "drums").notes = Array.from({ length: 40 }, (_, index) => ({
    id: `funk-d-${index}`,
    start: index * 0.4,
    pitch: index % 5 === 0 ? 36 : 42,
    duration: 0.08,
    velocity: 92,
  }));
  const beforeActivity = densityActivityForSong(song).observed;
  const candidates = createDensityRefinementCandidates(song, { densityTarget: beforeActivity + 2 });
  assert.ok(candidates.length <= MAX_DENSITY_REFINEMENT_CANDIDATES);
  assert.ok(candidates.every((candidate) => candidate.densityErrorDelta < 0));
  assert.ok(candidates.every((candidate) => candidate.beforeDensityActivity === beforeActivity));
  assert.ok(candidates.every((candidate) => candidate.afterDensityActivity >= candidate.beforeDensityActivity));
});
