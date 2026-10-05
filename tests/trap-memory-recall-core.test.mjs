import assert from "node:assert/strict";
import test from "node:test";

import * as engine from "../src/music-engine.js";
import { applySongOutputQualityPipeline } from "../src/core/output-quality-pipeline-register.js";

const QUALITY_CONFIG = Object.freeze({
  arrangementEvolution: false,
  returnDevelopment: false,
  groovePocketRefinement: false,
  densityRefinement: false,
  phraseResolutionRefinement: false,
  repetitionRefinement: false,
  registerHealthRefinement: false,
  fusionPerformanceRefinement: false,
  melodyContinuityRefinement: false,
  melodyPhraseRefinement: false,
  melodySectionDevelopmentRefinement: true,
  bassContinuityRefinement: false,
  ensembleContinuityRefinement: false,
  genreIdentityRefinement: false,
  transitionFxRefinement: false,
});

test("Trap 32-bar recall keeps a recognizable authored memory core", { timeout: 120_000 }, () => {
  const options = {
    seed: "melody-memory-gauntlet-trap-32",
    genre: "trap",
    key: "A",
    scale: "minor",
    bars: 32,
    energy: 0.72,
    complexity: 0.74,
    variation: 0.76,
    evolution: 0.72,
    swing: 0.16,
    humanize: 0.12,
    candidateCount: 1,
  };

  const firstComposed = engine.generateNew(options);
  const secondComposed = engine.generateNew(options);
  assert.deepEqual(firstComposed, secondComposed);

  const first = applySongOutputQualityPipeline(firstComposed, QUALITY_CONFIG);
  const second = applySongOutputQualityPipeline(secondComposed, QUALITY_CONFIG);
  assert.deepEqual(first.song, second.song);

  const release = engine.evaluateSongReleaseGate(first.song);
  assert.equal(release.passed, true, (release.failures ?? []).join(", "));

  const memory = first.melodySectionMemoryDiagnostics;
  assert.equal(memory?.status, "evaluated");
  assert.equal(memory?.passed, true, JSON.stringify(memory));
  assert.ok(memory?.score >= 62, `memory score should stay above gate, got ${memory?.score}`);

  const verse2 = (memory?.sections ?? []).find((entry) => entry.sectionId === "verse-2");
  assert.ok(verse2?.available, "Verse 2 recall must be evaluable");
  assert.equal(verse2.relationship, "recall");
  assert.ok(verse2.metrics.relationshipFit >= 0.48, JSON.stringify(verse2));
  assert.ok(verse2.metrics.rhythmSimilarity > 0, "recall rhythm must retain source evidence");
  assert.ok(verse2.metrics.endingSimilarity > 0, "recall ending must retain source evidence");

  const melody = first.song.tracks.find((track) => track.id === "melody");
  const verse2Section = first.song.structure.find((section) => section.id === "verse-2");
  const verse2Notes = (melody?.notes ?? []).filter((note) => (
    note.start >= verse2Section.startBeat - 1e-6
    && note.start < verse2Section.endBeat - 1e-6
  ));
  assert.ok(verse2Notes.some((note) => note.motifMemoryCore === true), "Verse 2 should retain memory-core evidence");

  const beforeCount = firstComposed.tracks.find((track) => track.id === "melody")?.notes?.length ?? 0;
  const afterCount = first.song.tracks.find((track) => track.id === "melody")?.notes?.length ?? 0;
  assert.equal(afterCount, beforeCount, "memory refinement must not change melody topology");
});
