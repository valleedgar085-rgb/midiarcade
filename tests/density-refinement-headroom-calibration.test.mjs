import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateSongCandidate,
  generateNew,
} from "../src/music-engine.js";
import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import { applySongOutputQualityPipeline } from "../src/core/output-quality-pipeline-register.js";
import { densityActivityForSong } from "../src/core/density-activity.js";
import {
  createDensityRefinementCandidates,
  MAX_DENSITY_REFINEMENT_CANDIDATES,
} from "../src/core/density-refinement.js";

const TARGET_GENRES = ["drumBass", "jazz", "funk", "afrobeats"];
const SEEDS = ["quality-lab-01", "quality-lab-02", "quality-lab-03"];
const SUPPORT_TRACKS = new Set(["chords", "counterpoint", "pad"]);

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function barsFor(song) {
  return Math.max(1, Math.round(finite(song?.meta?.bars, song?.bars ?? 1)));
}

function pitchedNotes(song) {
  return (song?.tracks ?? [])
    .filter((track) => track?.id !== "drums")
    .reduce((sum, track) => sum + (track?.notes?.length ?? 0), 0);
}

function notesPerBar(song) {
  return pitchedNotes(song) / barsFor(song);
}

function protectedSupportNote(note) {
  return Boolean(
    note?.resolutionRole
    || note?.memoryRole
    || note?.transitionRole
    || note?.cadenceRole
    || note?.hookRole
    || note?.phraseRole === "landing"
  );
}

function eligibleSupport(song) {
  return (song?.tracks ?? [])
    .filter((track) => SUPPORT_TRACKS.has(track?.id))
    .flatMap((track) => (track.notes ?? []).map((note) => ({ trackId: track.id, note })))
    .filter(({ note }) => finite(note?.duration) >= 0.5 && !protectedSupportNote(note));
}

function densityScoreFor(notesPerBarValue, target) {
  return Math.max(35, Math.min(100, Math.round(
    100 - Math.abs(notesPerBarValue - target) / Math.max(10, target) * 42,
  )));
}

function candidateSummary(candidate) {
  const evaluation = evaluateSongCandidate(candidate.song);
  return {
    id: candidate.id,
    changedNotes: candidate.changedNotes,
    beforeNotesPerBar: candidate.beforeNotesPerBar,
    afterNotesPerBar: candidate.afterNotesPerBar,
    densityErrorDelta: candidate.densityErrorDelta,
    densityScore: evaluation.subscores.density,
  };
}

test("fixed sparse-genre seeds get deeper bounded density candidates without broadening search", () => {
  const rows = [];

  for (const genre of TARGET_GENRES) {
    for (const seed of SEEDS) {
      const generationConfig = {
        ...applyOutputQualityEvolution({
          genre,
          seed: `${seed}:${genre}`,
          bars: 16,
          candidateCount: 1,
        }, { kind: "new" }),
        phraseResolutionRefinement: true,
        registerHealthRefinement: true,
      };
      const generated = generateNew(generationConfig);
      const beforeProcessed = applySongOutputQualityPipeline(generated, {
        ...generationConfig,
        densityRefinement: false,
        phraseResolutionRefinement: false,
        registerHealthRefinement: false,
      });
      const beforeSong = beforeProcessed.song;
      const beforeEvaluation = evaluateSongCandidate(beforeSong);
      const target = finite(beforeEvaluation.diagnostics?.densityTarget);
      const beforeNpb = notesPerBar(beforeSong);
      const beforeActivity = densityActivityForSong(beforeSong);
      const eligible = eligibleSupport(beforeSong);
      const deficitNotes = Math.max(0, Math.ceil((target - beforeActivity.observed) * barsFor(beforeSong)));
      const candidates = createDensityRefinementCandidates(beforeSong, { densityTarget: target });
      const full = candidates.find(({ id }) => id === "full-support");
      const densityProcessed = applySongOutputQualityPipeline(generated, {
        ...generationConfig,
        phraseResolutionRefinement: false,
        registerHealthRefinement: false,
      });
      const afterEvaluation = evaluateSongCandidate(densityProcessed.song);
      const afterNpb = notesPerBar(densityProcessed.song);

      assert.equal(beforeEvaluation.subscores.density, densityScoreFor(beforeActivity.observed, target));
      assert.equal(beforeEvaluation.diagnostics.densityMetric, genre === "jazz" ? "pitched-notes" : "ensemble-events");
      assert.ok(candidates.length <= MAX_DENSITY_REFINEMENT_CANDIDATES);
      if (genre === "jazz") {
        assert.ok(full, `${genre}/${seed} must retain a full candidate`);
        assert.equal(Number((full.afterNotesPerBar - full.beforeNotesPerBar).toFixed(3)), 2);
        assert.ok(full.changedNotes <= barsFor(beforeSong));
      } else {
        assert.ok(candidates.every((candidate) => candidate.densityErrorDelta < 0));
        assert.ok(candidates.every((candidate) => (
          Math.abs(candidate.beforeDensityActivity - beforeActivity.observed) <= 0.001
        )));
      }
      assert.ok(afterEvaluation.subscores.density >= beforeEvaluation.subscores.density);

      rows.push({
        genre,
        seed,
        target,
        beforeNotesPerBar: Number(beforeNpb.toFixed(3)),
        beforeDensityActivity: beforeActivity.observed,
        densityMetric: beforeActivity.metric,
        beforeDensity: beforeEvaluation.subscores.density,
        deficitNotes,
        eligibleSupportNotes: eligible.length,
        eligibleByTrack: Object.fromEntries(["chords", "counterpoint", "pad"].map((trackId) => [
          trackId,
          eligible.filter((entry) => entry.trackId === trackId).length,
        ])),
        candidateCount: candidates.length,
        candidates: candidates.map(candidateSummary),
        accepted: Boolean(densityProcessed.densityDiagnostics?.accepted),
        selectedId: densityProcessed.densityDiagnostics?.id ?? null,
        reason: densityProcessed.densityDiagnostics?.reason ?? null,
        changedNotes: finite(densityProcessed.densityDiagnostics?.changedNotes),
        afterNotesPerBar: Number(afterNpb.toFixed(3)),
        afterDensity: afterEvaluation.subscores.density,
        remainingGap: Number((target - afterNpb).toFixed(3)),
      });
    }
  }

  console.log("DENSITY_HEADROOM_CALIBRATION", JSON.stringify(rows));
  assert.equal(rows.length, TARGET_GENRES.length * SEEDS.length);
  assert.ok(rows.every((row) => row.target > row.beforeDensityActivity));
});
