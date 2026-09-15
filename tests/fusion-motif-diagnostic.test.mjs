import test from "node:test";
import * as engine from "../src/music-engine.js";
import { adaptGenerationConfig } from "../src/core/adaptive-generation.js";
import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import { applySongOutputQualityPipeline as applyBaseQualityPipeline } from "../src/core/output-quality-pipeline.js";
import { applySongOutputQualityPipeline as applyFullQualityPipeline } from "../src/core/output-quality-pipeline-register.js";

const BASE = Object.freeze({
  bars: 12,
  candidateCount: 3,
  energy: 0.72,
  complexity: 0.58,
  variation: 0.52,
  evolution: 0.58,
  surprise: 0.28,
});

function configFor(genre, seed, secondaryGenre = null) {
  const adapted = adaptGenerationConfig({
    ...BASE,
    genre,
    seed,
    ...(secondaryGenre ? { secondaryGenre, fusionBlend: 0.5 } : {}),
  }, { kind: "new" });
  return applyOutputQualityEvolution(adapted, { kind: "new" });
}

function summarize(song) {
  const evaluation = engine.evaluateSongCandidate(song);
  const melody = song.tracks?.find((track) => track.id === "melody")?.notes ?? [];
  const intervals = melody.slice(1).map((note, index) => ({
    index: index + 1,
    from: melody[index].pitch,
    to: note.pitch,
    interval: Math.abs(note.pitch - melody[index].pitch),
    start: note.start,
  }));
  const controlled = intervals.filter(({ interval }) => interval <= 12).length;
  return {
    score: evaluation.score,
    motif: evaluation.subscores?.motif,
    repetition: evaluation.subscores?.repetition,
    phraseResolution: evaluation.subscores?.phraseResolution,
    registerHealth: evaluation.subscores?.registerHealth,
    voiceLeading: evaluation.subscores?.voiceLeading,
    performance: evaluation.subscores?.performance,
    melodyNotes: melody.length,
    controlledMotion: intervals.length ? Number((controlled / intervals.length).toFixed(4)) : 0.65,
    largeLeaps: intervals.filter(({ interval }) => interval > 12),
    stored: song.meta?.scoreDetails?.subscores ?? {},
  };
}

function trace(genre, seed, secondaryGenre = null) {
  const config = configFor(genre, seed, secondaryGenre);
  const generated = engine.generateNew(config);
  const base = applyBaseQualityPipeline(generated, config);
  const full = applyFullQualityPipeline(generated, config);
  return {
    config: { genre, seed, secondaryGenre, repetitionRefinement: config.repetitionRefinement },
    generated: summarize(generated),
    base: summarize(base.song),
    full: summarize(full.song),
    diagnostics: {
      density: base.densityDiagnostics,
      phrase: base.phraseResolutionDiagnostics,
      repetition: full.repetitionDiagnostics,
      register: full.registerHealthDiagnostics,
      performance: full.fusionPerformanceDiagnostics,
    },
  };
}

test("trace Pop Rap fusion motif deficit and parent baselines", () => {
  const seed = "fusion-quality-03";
  console.log("POP_RAP_MOTIF_TRACE", JSON.stringify({
    pop: trace("pop", `${seed}:pop`),
    rap: trace("rap", `${seed}:rap`),
    fusion: trace("pop", `${seed}:pop+rap`, "rap"),
  }));
});
