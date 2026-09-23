import fs from "node:fs/promises";
import path from "node:path";

import { evaluateSongCandidate, generateNew } from "../src/music-engine.js";
import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import { applySongOutputQualityPipeline } from "../src/core/output-quality-pipeline-register.js";

const GENRES = ["drumBass", "funk", "afrobeats"];
const SEEDS = ["density-a", "density-b", "density-c", "density-d"];
const TRACKS = ["drums", "bass", "chords", "melody", "counterpoint", "pad"];

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value, places = 3) => Number(finite(value).toFixed(places));

function trackStats(song, trackId) {
  const track = (song.tracks ?? []).find((entry) => entry.id === trackId);
  const notes = track?.notes ?? [];
  const bars = Math.max(1, finite(song.meta?.bars, song.bars ?? 16));
  const beatsPerBar = Math.max(1, finite(song.meta?.beatsPerBar, 4));
  const activeBars = new Set(notes.map((note) => Math.floor(finite(note.start) / beatsPerBar)));
  const onsets = new Set(notes.map((note) => round(finite(note.start), 4)));
  const durations = notes.map((note) => finite(note.duration)).filter((value) => value > 0);
  return {
    count: notes.length,
    notesPerBar: round(notes.length / bars),
    onsetsPerBar: round(onsets.size / bars),
    activeBarRatio: round(activeBars.size / bars),
    averageDuration: round(durations.reduce((sum, value) => sum + value, 0) / Math.max(1, durations.length)),
  };
}

function pitchedNotesPerBar(song) {
  const bars = Math.max(1, finite(song.meta?.bars, song.bars ?? 16));
  const count = (song.tracks ?? [])
    .filter((track) => track.id !== "drums")
    .reduce((sum, track) => sum + (track.notes ?? []).length, 0);
  return round(count / bars);
}

const rows = [];
for (const genre of GENRES) {
  for (const seed of SEEDS) {
    const config = {
      ...applyOutputQualityEvolution({
        genre,
        seed: `phase5-density:${genre}:${seed}`,
        bars: 16,
        candidateCount: 1,
      }, { kind: "new" }),
      phraseResolutionRefinement: true,
      registerHealthRefinement: true,
    };
    const generated = generateNew(config);
    const beforeProcessed = applySongOutputQualityPipeline(generated, {
      ...config,
      densityRefinement: false,
      phraseResolutionRefinement: false,
      repetitionRefinement: false,
      registerHealthRefinement: false,
    });
    const afterProcessed = applySongOutputQualityPipeline(generated, {
      ...config,
      phraseResolutionRefinement: false,
      repetitionRefinement: false,
      registerHealthRefinement: false,
    });
    const before = beforeProcessed.song;
    const after = afterProcessed.song;
    const beforeEval = evaluateSongCandidate(before);
    const afterEval = evaluateSongCandidate(after);
    rows.push({
      genre,
      seed,
      densityTarget: round(beforeEval.diagnostics?.densityTarget),
      beforeDensity: beforeEval.subscores.density,
      afterDensity: afterEval.subscores.density,
      densityMetric: beforeEval.diagnostics?.densityMetric ?? "pitched-notes",
      beforeObservedDensity: round(beforeEval.diagnostics?.densityObserved, pitchedNotesPerBar(before)),
      afterObservedDensity: round(afterEval.diagnostics?.densityObserved, pitchedNotesPerBar(after)),
      beforeNotesPerBar: pitchedNotesPerBar(before),
      afterNotesPerBar: pitchedNotesPerBar(after),
      densityGapBefore: round(finite(beforeEval.diagnostics?.densityTarget) - finite(beforeEval.diagnostics?.densityObserved, pitchedNotesPerBar(before))),
      densityGapAfter: round(finite(afterEval.diagnostics?.densityTarget) - finite(afterEval.diagnostics?.densityObserved, pitchedNotesPerBar(after))),
      accepted: Boolean(afterProcessed.densityDiagnostics?.accepted),
      candidate: afterProcessed.densityDiagnostics?.id ?? null,
      changedNotes: finite(afterProcessed.densityDiagnostics?.changedNotes),
      reason: afterProcessed.densityDiagnostics?.reason ?? null,
      before: Object.fromEntries(TRACKS.map((trackId) => [trackId, trackStats(before, trackId)])),
      after: Object.fromEntries(TRACKS.map((trackId) => [trackId, trackStats(after, trackId)])),
    });
  }
}

const report = {
  version: 1,
  genres: GENRES,
  seeds: SEEDS,
  rows,
  summary: Object.fromEntries(GENRES.map((genre) => {
    const sample = rows.filter((row) => row.genre === genre);
    const avg = (selector) => round(sample.reduce((sum, row) => sum + selector(row), 0) / sample.length);
    return [genre, {
      averageBeforeDensity: avg((row) => row.beforeDensity),
      averageAfterDensity: avg((row) => row.afterDensity),
      averageObservedDensityBefore: avg((row) => row.beforeObservedDensity),
      averageObservedDensityAfter: avg((row) => row.afterObservedDensity),
      averageGapBefore: avg((row) => row.densityGapBefore),
      averageGapAfter: avg((row) => row.densityGapAfter),
      acceptanceRate: round(sample.filter((row) => row.accepted).length / sample.length),
      averageBeforeBassNotesPerBar: avg((row) => row.before.bass.notesPerBar),
      averageBeforeDrumOnsetsPerBar: avg((row) => row.before.drums.onsetsPerBar),
      averageBeforeSupportNotesPerBar: avg((row) => (
        row.before.chords.notesPerBar + row.before.counterpoint.notesPerBar + row.before.pad.notesPerBar
      )),
      averageAfterSupportNotesPerBar: avg((row) => (
        row.after.chords.notesPerBar + row.after.counterpoint.notesPerBar + row.after.pad.notesPerBar
      )),
    }];
  })),
};

const target = path.resolve(process.argv[2] ?? "/tmp/phase5-rhythm-density.json");
await fs.mkdir(path.dirname(target), { recursive: true });
await fs.writeFile(target, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log("PHASE5_RHYTHM_DENSITY", JSON.stringify(report.summary));
