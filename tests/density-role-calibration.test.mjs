import assert from "node:assert/strict";
import test from "node:test";

import { evaluateSongCandidate, generateNew } from "../src/music-engine.js";
import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import { applySongOutputQualityPipeline } from "../src/core/output-quality-pipeline-register.js";

const TARGET_GENRES = ["drumBass", "funk", "jazz", "afrobeats"];
const SEEDS = ["quality-lab-01", "quality-lab-02", "quality-lab-03"];
const TRACKS = ["bass", "chords", "melody", "counterpoint", "pad"];

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function round(value, digits = 3) {
  return Number(finite(value).toFixed(digits));
}

function barsFor(song) {
  return Math.max(1, Math.round(finite(song?.meta?.bars, song?.bars ?? 1)));
}

function beatsPerBar(song) {
  return Math.max(1, finite(song?.meta?.beatsPerBar, 4));
}

function pitchedCount(song) {
  return (song?.tracks ?? [])
    .filter((track) => track?.id !== "drums")
    .reduce((sum, track) => sum + (track?.notes?.length ?? 0), 0);
}

function trackStats(song, trackId) {
  const notes = song.tracks.find((track) => track.id === trackId)?.notes ?? [];
  const bars = barsFor(song);
  const barBeats = beatsPerBar(song);
  const onsets = new Set(notes.map((note) => round(note.start, 4)));
  const activeBars = new Set(notes.map((note) => Math.max(0, Math.floor(finite(note.start) / barBeats))));
  const totalDuration = notes.reduce((sum, note) => sum + Math.max(0, finite(note.duration)), 0);
  const totalPitched = pitchedCount(song);
  return {
    count: notes.length,
    notesPerBar: round(notes.length / bars),
    onsetsPerBar: round(onsets.size / bars),
    avgDuration: round(totalDuration / Math.max(1, notes.length)),
    activeBarRatio: round(activeBars.size / bars),
    pitchedShare: round(notes.length / Math.max(1, totalPitched)),
  };
}

function roleStats(song) {
  return Object.fromEntries(TRACKS.map((trackId) => [trackId, trackStats(song, trackId)]));
}

function generatedFor(genre, seed) {
  const config = {
    ...applyOutputQualityEvolution({
      genre,
      seed: `${seed}:${genre}`,
      bars: 16,
      candidateCount: 1,
    }, { kind: "new" }),
    phraseResolutionRefinement: true,
    registerHealthRefinement: true,
  };
  return { config, song: generateNew(config) };
}

test("fixed sparse-genre seeds expose pitched density by musical role before and after refinement", () => {
  const rows = [];

  for (const genre of TARGET_GENRES) {
    for (const seed of SEEDS) {
      const { config, song: generated } = generatedFor(genre, seed);
      const beforeProcessed = applySongOutputQualityPipeline(generated, {
        ...config,
        densityRefinement: false,
        phraseResolutionRefinement: false,
        registerHealthRefinement: false,
      });
      const afterProcessed = applySongOutputQualityPipeline(generated, {
        ...config,
        phraseResolutionRefinement: false,
        registerHealthRefinement: false,
      });
      const before = beforeProcessed.song;
      const after = afterProcessed.song;
      const beforeEval = evaluateSongCandidate(before);
      const afterEval = evaluateSongCandidate(after);
      const bars = barsFor(before);

      assert.equal(bars, 16);
      assert.ok(afterEval.subscores.density >= beforeEval.subscores.density);
      assert.equal(after.tracks.find((track) => track.id === "bass")?.notes.length, before.tracks.find((track) => track.id === "bass")?.notes.length);
      assert.equal(after.tracks.find((track) => track.id === "melody")?.notes.length, before.tracks.find((track) => track.id === "melody")?.notes.length);

      rows.push({
        genre,
        seed,
        target: beforeEval.diagnostics.densityTarget,
        beforeDensity: beforeEval.subscores.density,
        afterDensity: afterEval.subscores.density,
        beforeTotalPerBar: round(pitchedCount(before) / bars),
        afterTotalPerBar: round(pitchedCount(after) / bars),
        densityAccepted: Boolean(afterProcessed.densityDiagnostics?.accepted),
        densityCandidate: afterProcessed.densityDiagnostics?.id ?? null,
        before: roleStats(before),
        after: roleStats(after),
      });
    }
  }

  console.log("DENSITY_ROLE_CALIBRATION", JSON.stringify(rows));
  assert.equal(rows.length, TARGET_GENRES.length * SEEDS.length);
});
