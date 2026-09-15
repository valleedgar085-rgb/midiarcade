import test from "node:test";
import * as engine from "../src/music-engine.js";
import { adaptGenerationConfig } from "../src/core/adaptive-generation.js";
import { applyOutputQualityEvolution, createOutputQualityProfile } from "../src/core/output-quality-evolution.js";
import { applySongOutputQualityPostprocess } from "../src/core/output-quality-postprocess.js";
import { applySongOutputQualityPipeline as applyBaseQualityPipeline } from "../src/core/output-quality-pipeline.js";
import { applySongOutputQualityPipeline as applyFullQualityPipeline } from "../src/core/output-quality-pipeline-register.js";

const base = {
  bars: 12,
  candidateCount: 3,
  energy: 0.72,
  complexity: 0.58,
  variation: 0.52,
  evolution: 0.58,
  surprise: 0.28,
};

function requestFor(genre, seed, secondaryGenre = null) {
  return {
    ...base,
    genre,
    seed,
    ...(secondaryGenre ? { secondaryGenre, fusionBlend: 0.5 } : {}),
  };
}

function runtimeConfig(genre, seed, secondaryGenre = null) {
  const adapted = adaptGenerationConfig(requestFor(genre, seed, secondaryGenre), { kind: "new" });
  return applyOutputQualityEvolution(adapted, { kind: "new" });
}

function summarize(song) {
  const evaluation = engine.evaluateSongCandidate(song);
  const details = song.meta?.scoreDetails ?? {};
  const pitched = (song.tracks ?? []).filter((track) => track.id !== "drums").flatMap((track) => track.notes ?? []);
  const velocities = pitched.map((note) => Number.isFinite(Number(note.velocity)) ? Number(note.velocity) : 80);
  const mean = velocities.length ? velocities.reduce((sum, value) => sum + value, 0) / velocities.length : 80;
  const variance = velocities.length ? velocities.reduce((sum, value) => sum + (value - mean) ** 2, 0) / velocities.length : 0;
  const spread = Math.sqrt(variance);
  const profile = song.performanceProfile ?? {};
  const targetSpread = 10 + (Number.isFinite(Number(profile.velocityVariance)) ? Number(profile.velocityVariance) : 5) * 1.2;
  const safeTiming = Number(profile.timingJitter ?? 0) <= 0.04
    && Object.values(profile.trackOffsets ?? {}).every((offset) => Math.abs(Number(offset ?? 0)) <= 0.05);
  return {
    score: evaluation.score,
    floor: Math.min(...Object.values(evaluation.subscores ?? {}).map(Number).filter(Number.isFinite)),
    performance: evaluation.subscores?.performance,
    density: evaluation.subscores?.density,
    phraseResolution: evaluation.subscores?.phraseResolution,
    repetition: evaluation.subscores?.repetition,
    motif: evaluation.subscores?.motif,
    groove: evaluation.subscores?.groove,
    velocityMean: Number(mean.toFixed(3)),
    velocitySpread: Number(spread.toFixed(3)),
    targetSpread: Number(targetSpread.toFixed(3)),
    spreadError: Number(Math.abs(spread - targetSpread).toFixed(3)),
    velocityVariance: profile.velocityVariance,
    timingJitter: profile.timingJitter,
    safeTiming,
    noteCount: pitched.length,
    storedPerformance: details.subscores?.performance,
  };
}

function repetitionRow(genre, seed, secondaryGenre = null) {
  const request = requestFor(genre, seed, secondaryGenre);
  const rawProfile = createOutputQualityProfile(request, { kind: "new" });
  const evolved = runtimeConfig(genre, seed, secondaryGenre);
  return {
    genre,
    secondaryGenre,
    raw: summarize(engine.generateNew(request)),
    runtimeSteered: summarize(engine.generateNew(evolved)),
    controls: {
      variation: evolved.variation,
      evolution: evolved.evolution,
      syncopation: evolved.syncopation,
      drumFills: evolved.drumFills,
      repetitionGuard: rawProfile.repetitionGuard,
      phraseDevelopment: rawProfile.phraseDevelopment,
      melodicContrast: rawProfile.melodicContrast,
    },
  };
}

test("diagnose Hip-Hop Rap fusion repetition on raw and runtime-steered paths", () => {
  const rows = [
    repetitionRow("hipHop", "fusion-quality-01:hipHop"),
    repetitionRow("rap", "fusion-quality-01:rap"),
    repetitionRow("hipHop", "fusion-quality-01:hipHop+rap", "rap"),
  ];
  console.log("HIPHOP_RAP_REPETITION_DIAGNOSTIC", JSON.stringify(rows));
});

test("trace Pop Hip-Hop performance through each production quality stage", () => {
  const config = runtimeConfig("pop", "fusion-quality-01:pop+hipHop", "hipHop");
  const generated = engine.generateNew(config);
  const structural = applySongOutputQualityPostprocess(generated, config);
  const densityOnly = applyBaseQualityPipeline(generated, { ...config, phraseResolutionRefinement: false });
  const phraseOnly = applyBaseQualityPipeline(generated, { ...config, densityRefinement: false });
  const basePipeline = applyBaseQualityPipeline(generated, config);
  const fullPipeline = applyFullQualityPipeline(generated, config);
  const densityOffFull = applyFullQualityPipeline(generated, { ...config, densityRefinement: false });

  console.log("POP_HIPHOP_PERFORMANCE_TRACE", JSON.stringify({
    config: {
      densityRefinement: config.densityRefinement,
      phraseResolutionRefinement: config.phraseResolutionRefinement,
      repetitionRefinement: config.repetitionRefinement,
      registerHealthRefinement: config.registerHealthRefinement,
      variation: config.variation,
      evolution: config.evolution,
      syncopation: config.syncopation,
    },
    stages: {
      generated: summarize(generated),
      structural: summarize(structural.song),
      densityOnly: summarize(densityOnly.song),
      phraseOnly: summarize(phraseOnly.song),
      basePipeline: summarize(basePipeline.song),
      fullPipeline: summarize(fullPipeline.song),
      densityOffFull: summarize(densityOffFull.song),
    },
    diagnostics: {
      structural: structural.diagnostics,
      density: basePipeline.densityDiagnostics,
      phrase: basePipeline.phraseResolutionDiagnostics,
      repetition: fullPipeline.repetitionDiagnostics,
      register: fullPipeline.registerHealthDiagnostics,
    },
  }));
});
