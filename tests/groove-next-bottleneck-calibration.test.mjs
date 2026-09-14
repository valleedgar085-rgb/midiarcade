import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateSongCandidate,
  evaluateSongReleaseGate,
  generateNew,
} from "../src/music-engine.js";
import { createDensityRefinementCandidates } from "../src/core/density-refinement.js";
import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import { applySongOutputQualityPipeline } from "../src/core/output-quality-pipeline-register.js";

const SEEDS = ["quality-lab-01", "quality-lab-02", "quality-lab-03"];

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function round(value, digits = 3) {
  return Number(finite(value).toFixed(digits));
}

function creativeFloor(evaluation) {
  return Math.min(...Object.values(evaluation?.subscores ?? {}).map((value) => finite(value)));
}

function generationConfig(genre, seed) {
  return {
    ...applyOutputQualityEvolution({
      genre,
      seed: `${seed}:${genre}`,
      bars: 16,
      candidateCount: 1,
    }, { kind: "new" }),
    phraseResolutionRefinement: true,
    registerHealthRefinement: true,
  };
}

function baseBeforeDensity(genre, seed) {
  const config = generationConfig(genre, seed);
  const generated = generateNew(config);
  const processed = applySongOutputQualityPipeline(generated, {
    ...config,
    densityRefinement: false,
    phraseResolutionRefinement: false,
    registerHealthRefinement: false,
  });
  return { config, generated, song: processed.song };
}

function drumBarMetrics(song) {
  const drums = song.tracks.find((track) => track.id === "drums")?.notes ?? [];
  const barBeats = finite(song.meta?.beatsPerBar, 4);
  const bars = Math.max(1, Math.round(finite(song.meta?.bars, song.bars ?? 1)));
  const signatures = Array.from({ length: bars }, (_, bar) => drums
    .filter((note) => Math.floor(finite(note.start) / barBeats) === bar)
    .map((note) => `${note.pitch}:${round(((finite(note.start) % barBeats) + barBeats) % barBeats, 4)}`)
    .join("|"));
  const populated = signatures.filter(Boolean);
  const uniqueRatio = new Set(populated).size / Math.max(1, populated.length);
  const adjacentCopies = populated.slice(1)
    .filter((signature, index) => signature === populated[index]).length / Math.max(1, populated.length - 1);
  const counts = Array.from({ length: bars }, (_, bar) => drums.filter((note) => Math.floor(finite(note.start) / barBeats) === bar).length);
  const duplicateGroups = Object.entries(signatures.reduce((groups, signature, bar) => {
    if (!signature) return groups;
    (groups[signature] ??= []).push(bar);
    return groups;
  }, {}))
    .filter(([, barIndexes]) => barIndexes.length > 1)
    .map(([, barIndexes]) => barIndexes);
  return {
    uniqueRatio: round(uniqueRatio),
    adjacentCopies: round(adjacentCopies),
    uniqueBars: new Set(populated).size,
    populatedBars: populated.length,
    avgHitsPerBar: round(counts.reduce((sum, count) => sum + count, 0) / bars),
    minHits: Math.min(...counts),
    maxHits: Math.max(...counts),
    duplicateGroups,
  };
}

function evaluationSummary(song) {
  const evaluation = evaluateSongCandidate(song);
  const release = evaluateSongReleaseGate(song, evaluation);
  return {
    score: evaluation.score,
    floor: creativeFloor(evaluation),
    density: evaluation.subscores.density,
    groove: evaluation.subscores.groove,
    drumVariety: evaluation.subscores.drumVariety,
    performance: evaluation.subscores.performance,
    repetition: evaluation.subscores.repetition,
    motif: evaluation.subscores.motif,
    memory: evaluation.subscores.memory,
    separation: evaluation.subscores.separation,
    production: evaluation.subscores.production,
    genreAuthenticity: evaluation.subscores.genreAuthenticity,
    scaleFit: round(evaluation.diagnostics?.scaleFit),
    releasePassed: Boolean(release.passed),
  };
}

test("Jazz fixed seeds reveal whether drum-variety weakness is cloning or over-randomization", () => {
  const rows = [];
  for (const seed of SEEDS) {
    const config = generationConfig("jazz", seed);
    const generated = generateNew(config);
    const processed = applySongOutputQualityPipeline(generated, config);
    const song = processed.song;
    rows.push({
      seed,
      evaluation: evaluationSummary(song),
      drums: drumBarMetrics(song),
    });
  }
  console.log("JAZZ_DRUM_VARIETY_CALIBRATION", JSON.stringify(rows));
  assert.equal(rows.length, 3);
  assert.ok(rows.every((row) => row.evaluation.releasePassed && row.evaluation.scaleFit === 1));
});

test("Funk fixed seeds expose the protected dimension behind rejected deep density candidates", () => {
  const rows = [];
  for (const seed of SEEDS) {
    const { config, generated, song: before } = baseBeforeDensity("funk", seed);
    const beforeEval = evaluateSongCandidate(before);
    const candidates = createDensityRefinementCandidates(before, {
      densityTarget: beforeEval.diagnostics?.densityTarget,
    });
    const pipeline = applySongOutputQualityPipeline(generated, {
      ...config,
      phraseResolutionRefinement: false,
      registerHealthRefinement: false,
    });
    const beforeSummary = evaluationSummary(before);
    rows.push({
      seed,
      pipeline: {
        accepted: Boolean(pipeline.densityDiagnostics?.accepted),
        id: pipeline.densityDiagnostics?.id ?? null,
        reason: pipeline.densityDiagnostics?.reason ?? null,
      },
      before: beforeSummary,
      candidates: candidates.map((candidate) => {
        const after = evaluationSummary(candidate.song);
        return {
          id: candidate.id,
          changedNotes: candidate.changedNotes,
          beforeNotesPerBar: candidate.beforeNotesPerBar,
          afterNotesPerBar: candidate.afterNotesPerBar,
          densityErrorDelta: candidate.densityErrorDelta,
          ...after,
          scoreDelta: round(after.score - beforeSummary.score, 2),
          floorDelta: round(after.floor - beforeSummary.floor, 2),
          densityDelta: round(after.density - beforeSummary.density, 2),
          grooveDelta: round(after.groove - beforeSummary.groove, 2),
          drumVarietyDelta: round(after.drumVariety - beforeSummary.drumVariety, 2),
          performanceDelta: round(after.performance - beforeSummary.performance, 2),
          repetitionDelta: round(after.repetition - beforeSummary.repetition, 2),
          motifDelta: round(after.motif - beforeSummary.motif, 2),
          memoryDelta: round(after.memory - beforeSummary.memory, 2),
          separationDelta: round(after.separation - beforeSummary.separation, 2),
          productionDelta: round(after.production - beforeSummary.production, 2),
          authenticityDelta: round(after.genreAuthenticity - beforeSummary.genreAuthenticity, 2),
        };
      }),
    });
  }
  console.log("FUNK_DENSITY_REJECTION_CALIBRATION", JSON.stringify(rows));
  assert.equal(rows.length, 3);
  assert.ok(rows.every((row) => row.before.releasePassed && row.before.scaleFit === 1));
  assert.ok(rows.every((row) => row.candidates.every((candidate) => candidate.releasePassed && candidate.scaleFit === 1)));
});
