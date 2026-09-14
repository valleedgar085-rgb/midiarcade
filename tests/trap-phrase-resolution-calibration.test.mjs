import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateSongCandidate,
  generateNew,
} from "../src/music-engine.js";
import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import { applySongOutputQualityPipeline } from "../src/core/output-quality-pipeline-register.js";

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function average(values, fallback = 0) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
}

function harmonyAt(harmony, beat) {
  let result = harmony?.[0] ?? null;
  for (const event of harmony ?? []) {
    const start = finite(event?.start, 0);
    const duration = finite(event?.duration, 0);
    if (start <= beat + 1e-6) result = event;
    if (beat >= start - 1e-6 && beat < start + duration - 1e-6) return event;
  }
  return result;
}

function phraseResolutionBreakdown(song) {
  const melody = [...(song.tracks?.find((track) => track.id === "melody")?.notes ?? [])]
    .sort((left, right) => left.start - right.start || left.pitch - right.pitch);
  const sections = song.structure ?? song.sections ?? [];
  const beatsPerBar = finite(song.meta?.beatsPerBar, 4);
  const tonic = finite(song.meta?.keyPc, 0);
  const rows = sections.map((section) => {
    const end = finite(section.endBeat, 0);
    const phraseNotes = melody.filter((note) => note.start < end - 0.01 && note.start >= end - beatsPerBar * 1.25);
    const finalNote = phraseNotes.at(-1);
    if (!finalNote) {
      return {
        section: String(section.name ?? section.type ?? section.id ?? "section"),
        sectionId: String(section.id ?? ""),
        score: 55,
        missingEnding: true,
        chordTone: false,
        tonicLanding: false,
        held: false,
      };
    }
    const chord = harmonyAt(song.harmony ?? [], finalNote.start);
    const pitchClass = mod(finalNote.pitch, 12);
    const chordTone = Boolean(chord?.tones?.includes(pitchClass));
    const tonicLanding = pitchClass === tonic;
    const held = finalNote.duration >= beatsPerBar * 0.35;
    return {
      section: String(section.name ?? section.type ?? section.id ?? "section"),
      sectionId: String(section.id ?? ""),
      score: Math.round((0.38 + Number(chordTone) * 0.32 + Number(tonicLanding) * 0.18 + Number(held) * 0.12) * 100),
      missingEnding: false,
      chordTone,
      tonicLanding,
      held,
      pitch: finalNote.pitch,
      duration: Number(finalNote.duration.toFixed(4)),
      beatFromEnd: Number((end - finalNote.start).toFixed(4)),
    };
  });
  return {
    rows,
    score: Math.max(25, Math.min(100, Math.round(average(rows.map(({ score }) => score), 68)))),
    counts: {
      sections: rows.length,
      missingEnding: rows.filter(({ missingEnding }) => missingEnding).length,
      missingChordTone: rows.filter(({ missingEnding, chordTone }) => !missingEnding && !chordTone).length,
      missingTonic: rows.filter(({ missingEnding, tonicLanding }) => !missingEnding && !tonicLanding).length,
      shortEnding: rows.filter(({ missingEnding, held }) => !missingEnding && !held).length,
    },
  };
}

test("Trap fixed seeds expose the exact Quality Lab cadence-refinement bottleneck", () => {
  const results = [];
  for (const seed of ["quality-lab-01", "quality-lab-02", "quality-lab-03"]) {
    const generationConfig = {
      ...applyOutputQualityEvolution({
        genre: "trap",
        seed: `${seed}:trap`,
        bars: 16,
        candidateCount: 1,
      }, { kind: "new" }),
      phraseResolutionRefinement: true,
      registerHealthRefinement: true,
    };
    const generated = generateNew(generationConfig);
    const beforeProcessed = applySongOutputQualityPipeline(generated, {
      ...generationConfig,
      phraseResolutionRefinement: false,
      registerHealthRefinement: false,
    });
    const phraseProcessed = applySongOutputQualityPipeline(generated, {
      ...generationConfig,
      registerHealthRefinement: false,
    });
    const fullProcessed = applySongOutputQualityPipeline(generated, generationConfig);

    const beforeEvaluation = evaluateSongCandidate(beforeProcessed.song);
    const phraseEvaluation = evaluateSongCandidate(phraseProcessed.song);
    const fullEvaluation = evaluateSongCandidate(fullProcessed.song);
    const before = phraseResolutionBreakdown(beforeProcessed.song);
    const afterPhrase = phraseResolutionBreakdown(phraseProcessed.song);
    const afterFull = phraseResolutionBreakdown(fullProcessed.song);

    assert.equal(before.score, beforeEvaluation.subscores.phraseResolution, `${seed} before breakdown must match critic`);
    assert.equal(afterPhrase.score, phraseEvaluation.subscores.phraseResolution, `${seed} phrase breakdown must match critic`);
    assert.equal(afterFull.score, fullEvaluation.subscores.phraseResolution, `${seed} full breakdown must match critic`);
    assert.ok(afterPhrase.score >= before.score, `${seed} phrase refinement must not lower phrase resolution`);

    results.push({
      seed,
      beforePhraseResolution: before.score,
      afterPhraseResolution: afterPhrase.score,
      finalPhraseResolution: afterFull.score,
      beforeCounts: before.counts,
      afterCounts: afterPhrase.counts,
      beforeRows: before.rows,
      afterRows: afterPhrase.rows,
      phraseRefinement: phraseProcessed.phraseResolutionDiagnostics ?? null,
      registerRefinement: fullProcessed.registerHealthDiagnostics ?? null,
    });
  }

  console.log("TRAP_PHRASE_RESOLUTION_EXACT_CALIBRATION", JSON.stringify(results));
  assert.equal(results.length, 3);
});
