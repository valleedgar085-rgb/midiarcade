import test from "node:test";
import * as engine from "../src/music-engine.js";
import { adaptGenerationConfig } from "../src/core/adaptive-generation.js";
import { applyOutputQualityEvolution, createOutputQualityProfile } from "../src/core/output-quality-evolution.js";

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

function summarize(song) {
  const details = song.meta?.scoreDetails ?? {};
  return {
    score: details.totalScore,
    repetition: details.subscores?.repetition,
    motifRepetition: details.diagnostics?.motifRepetition,
    repetitionTarget: details.diagnostics?.repetitionTarget,
    motif: details.subscores?.motif,
    phraseResolution: details.subscores?.phraseResolution,
    performance: details.subscores?.performance,
    groove: details.subscores?.groove,
  };
}

function row(genre, seed, secondaryGenre = null) {
  const request = requestFor(genre, seed, secondaryGenre);
  const rawProfile = createOutputQualityProfile(request, { kind: "new" });
  const adapted = adaptGenerationConfig(request, { kind: "new" });
  const evolved = applyOutputQualityEvolution(adapted, { kind: "new" });
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
    row("hipHop", "fusion-quality-01:hipHop"),
    row("rap", "fusion-quality-01:rap"),
    row("hipHop", "fusion-quality-01:hipHop+rap", "rap"),
  ];
  console.log("HIPHOP_RAP_REPETITION_DIAGNOSTIC", JSON.stringify(rows));
});
