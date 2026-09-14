import test from "node:test";
import * as engine from "../src/music-engine.js";
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

function row(genre, seed, secondaryGenre = null) {
  const request = {
    ...base,
    genre,
    seed,
    ...(secondaryGenre ? { secondaryGenre, fusionBlend: 0.5 } : {}),
  };
  const evolved = applyOutputQualityEvolution(request, { kind: "new" });
  const profile = createOutputQualityProfile(request, { kind: "new" });
  const song = engine.generateNew(request);
  const details = song.meta?.scoreDetails ?? {};
  return {
    genre,
    secondaryGenre,
    score: details.totalScore,
    repetition: details.subscores?.repetition,
    motifRepetition: details.diagnostics?.motifRepetition,
    repetitionTarget: details.diagnostics?.repetitionTarget,
    motif: details.subscores?.motif,
    phraseResolution: details.subscores?.phraseResolution,
    variation: evolved.variation,
    evolution: evolved.evolution,
    syncopation: evolved.syncopation,
    repetitionGuard: profile.repetitionGuard,
    phraseDevelopment: profile.phraseDevelopment,
    melodicContrast: profile.melodicContrast,
  };
}

test("diagnose Hip-Hop Rap fusion repetition direction", () => {
  const rows = [
    row("hipHop", "fusion-quality-01:hipHop"),
    row("rap", "fusion-quality-01:rap"),
    row("hipHop", "fusion-quality-01:hipHop+rap", "rap"),
  ];
  console.log("HIPHOP_RAP_REPETITION_DIAGNOSTIC", JSON.stringify(rows));
});
