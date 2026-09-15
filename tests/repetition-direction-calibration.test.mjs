import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateSongCandidate,
  generateNew,
  GENRE_CRITIC_PROFILES,
} from "../src/music-engine.js";
import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import { applySongOutputQualityPipeline } from "../src/core/output-quality-pipeline-register.js";

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function average(values, fallback = 0) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function phraseRepetitionRatio(song) {
  const melodyNotes = [...(song.tracks?.find((track) => track.id === "melody")?.notes ?? [])]
    .sort((left, right) => left.start - right.start || left.pitch - right.pitch);
  const length = finite(song.motifs?.melody?.lengthBeats, 0);
  if (length <= 0 || melodyNotes.length < 4) return 0.55;
  const signatures = [];
  for (const section of song.structure ?? []) {
    const repeats = Math.min(4, Math.floor((section.endBeat - section.startBeat) / length));
    for (let repeat = 0; repeat < repeats; repeat += 1) {
      const start = section.startBeat + repeat * length;
      const notes = melodyNotes.filter((note) => note.start >= start - 1e-6 && note.start < start + length - 1e-6);
      if (notes.length < 2) continue;
      signatures.push(new Set(notes.map((note) => `${Math.round((note.start - start) * 4) / 4}`)));
    }
  }
  if (signatures.length < 2) return 0.55;
  const reference = signatures[0];
  return average(signatures.slice(1).map((signature) => {
    const shared = [...reference].filter((item) => signature.has(item)).length;
    return shared / Math.max(1, Math.min(reference.size, signature.size));
  }), 0.55);
}

function repetitionTarget(song) {
  const profile = GENRE_CRITIC_PROFILES[song.genre] ?? GENRE_CRITIC_PROFILES.pop;
  return average([
    finite(song.songBlueprint?.qualityTargets?.repetition, profile.repetition),
    profile.repetition,
  ], profile.repetition);
}

function repetitionScore(actual, target) {
  return Math.max(30, Math.min(100, Math.round(100 - Math.abs(actual - target) * 125)));
}

test("RnB Soul fixed seeds expose signed repetition error using the production critic contract", () => {
  const rows = [];
  for (const seed of ["quality-lab-01", "quality-lab-02", "quality-lab-03"]) {
    const config = {
      ...applyOutputQualityEvolution({
        genre: "rnbSoul",
        seed: `${seed}:rnbSoul`,
        bars: 16,
        candidateCount: 1,
      }, { kind: "new" }),
      phraseResolutionRefinement: true,
      registerHealthRefinement: true,
      repetitionRefinement: false,
    };
    const generated = generateNew(config);
    const song = applySongOutputQualityPipeline(generated, config).song;
    const evaluation = evaluateSongCandidate(song);
    const actual = phraseRepetitionRatio(song);
    const target = repetitionTarget(song);
    const signedDelta = actual - target;
    const expectedScore = repetitionScore(actual, target);

    assert.equal(expectedScore, evaluation.subscores.repetition, `${seed} diagnostic must match production critic`);
    rows.push({
      seed,
      actual: Number(actual.toFixed(4)),
      target: Number(target.toFixed(4)),
      signedDelta: Number(signedDelta.toFixed(4)),
      score: expectedScore,
      direction: signedDelta < 0 ? "under-recall" : signedDelta > 0 ? "over-repeat" : "on-target",
    });
  }

  console.log("RNB_REPETITION_CALIBRATION", JSON.stringify(rows));
  assert.equal(rows.length, 3);
});
