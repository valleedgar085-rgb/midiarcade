import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateSongCandidate,
  generateNew,
} from "../src/music-engine.js";
import { adaptGenerationConfig } from "../src/core/adaptive-generation.js";
import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import { applySongOutputQualityPipeline } from "../src/core/output-quality-pipeline-register.js";
import {
  createRepetitionRefinementCandidates,
  MAX_REPETITION_REFINEMENT_CANDIDATES,
  MAX_REPETITION_REFINEMENT_EDITS,
  MAX_REPETITION_REFINEMENT_SHIFT,
  repetitionBalance,
  repetitionRefinementFamily,
} from "../src/core/repetition-refinement.js";

function configFor(primary, secondary, seed) {
  const adapted = adaptGenerationConfig({
    genre: primary,
    secondaryGenre: secondary,
    fusionBlend: 0.5,
    seed,
    bars: 12,
    candidateCount: 3,
    energy: 0.72,
    complexity: 0.58,
    variation: 0.52,
    evolution: 0.58,
    surprise: 0.28,
  }, { kind: "new" });
  return applyOutputQualityEvolution(adapted, { kind: "new" });
}

function noteIdentity(song) {
  return (song.tracks.find((track) => track.id === "melody")?.notes ?? [])
    .map((note) => ({ id: note.id, pitch: note.pitch, duration: note.duration, velocity: note.velocity }));
}

function sortNoteIdentity(notes) {
  return [...notes].sort((a, b) =>
    a.pitch - b.pitch
    || a.duration - b.duration
    || a.velocity - b.velocity
    || String(a.id).localeCompare(String(b.id))
  );
}

test("Hip-Hop Rap fusion uses the proven signed repetition surgery without broadening its budget", () => {
  const config = configFor("hipHop", "rap", "fusion-quality-01:hipHop+rap");
  const generated = generateNew(config);
  const before = evaluateSongCandidate(generated);
  const target = before.diagnostics?.repetitionTarget;
  const balanceBefore = repetitionBalance(generated, target);
  const sourceIdentity = noteIdentity(generated);
  const sourceCount = generated.tracks.find((track) => track.id === "melody")?.notes?.length ?? 0;

  assert.equal(generated.meta.isFusion, true);
  assert.equal(generated.meta.secondaryGenre, "rap");
  assert.equal(repetitionRefinementFamily(generated), "hiphop-rap-fusion");
  assert.equal(balanceBefore.direction, "evolve");

  const candidates = createRepetitionRefinementCandidates(generated, { target });
  assert.ok(candidates.length > 0 && candidates.length <= MAX_REPETITION_REFINEMENT_CANDIDATES);
  assert.ok(candidates.every((candidate) => candidate.changedNotes <= MAX_REPETITION_REFINEMENT_EDITS));
  assert.ok(candidates.every((candidate) => candidate.maxShift <= MAX_REPETITION_REFINEMENT_SHIFT));
  assert.ok(candidates.every((candidate) => candidate.errorDelta < 0));

  const processed = applySongOutputQualityPipeline(generated, config);
  const after = evaluateSongCandidate(processed.song);
  const balanceAfter = repetitionBalance(processed.song, target);

  assert.equal(processed.repetitionDiagnostics.accepted, true);
  assert.equal(processed.repetitionDiagnostics.direction, "evolve");
  assert.ok(after.subscores.repetition > before.subscores.repetition);
  assert.ok(balanceAfter.absoluteError < balanceBefore.absoluteError);
  assert.ok(Object.values(processed.repetitionDiagnostics.protectedDeltas).every((delta) => delta >= -1));
  assert.equal(processed.song.tracks.find((track) => track.id === "melody")?.notes?.length, sourceCount);
  assert.deepEqual(sortNoteIdentity(noteIdentity(processed.song)), sortNoteIdentity(sourceIdentity));

  console.log("HIPHOP_RAP_FUSION_REPETITION_REPAIR", JSON.stringify({
    beforeScore: before.score,
    afterScore: after.score,
    beforeRepetition: before.subscores.repetition,
    afterRepetition: after.subscores.repetition,
    beforeActual: balanceBefore.actual,
    afterActual: balanceAfter.actual,
    target: balanceBefore.target,
    changedNotes: processed.repetitionDiagnostics.changedNotes,
    maxShift: processed.repetitionDiagnostics.maxShift,
    protectedDeltas: processed.repetitionDiagnostics.protectedDeltas,
  }));
});

test("Pop Rap fusion uses the calibrated signed repetition repair while uncalibrated families stay isolated", () => {
  const config = configFor("pop", "rap", "fusion-quality-03:pop+rap");
  const generated = generateNew(config);
  const before = evaluateSongCandidate(generated);
  const target = before.diagnostics?.repetitionTarget;
  const balanceBefore = repetitionBalance(generated, target);
  const sourceIdentity = noteIdentity(generated);
  const sourceCount = generated.tracks.find((track) => track.id === "melody")?.notes?.length ?? 0;

  assert.equal(repetitionRefinementFamily(generated), "pop-rap-fusion");
  const candidates = createRepetitionRefinementCandidates(generated, { target });
  assert.ok(candidates.length > 0 && candidates.length <= MAX_REPETITION_REFINEMENT_CANDIDATES);
  assert.ok(candidates.every((candidate) => candidate.changedNotes <= MAX_REPETITION_REFINEMENT_EDITS));
  assert.ok(candidates.every((candidate) => candidate.maxShift <= MAX_REPETITION_REFINEMENT_SHIFT));
  assert.ok(candidates.every((candidate) => candidate.errorDelta < 0));

  const processed = applySongOutputQualityPipeline(generated, config);
  const after = evaluateSongCandidate(processed.song);
  const balanceAfter = repetitionBalance(processed.song, target);

  assert.equal(processed.repetitionDiagnostics.accepted, true);
  assert.equal(processed.repetitionDiagnostics.direction, balanceBefore.direction);
  assert.ok(after.subscores.repetition >= 78);
  assert.ok(after.subscores.motif >= 85);
  assert.ok(after.subscores.repetition > before.subscores.repetition);
  assert.ok(after.subscores.motif > before.subscores.motif);
  assert.ok(balanceAfter.absoluteError < balanceBefore.absoluteError);
  assert.ok(Object.values(processed.repetitionDiagnostics.protectedDeltas).every((delta) => delta >= -1));
  assert.ok(processed.repetitionDiagnostics.changedNotes <= MAX_REPETITION_REFINEMENT_EDITS);
  assert.ok(processed.repetitionDiagnostics.maxShift <= MAX_REPETITION_REFINEMENT_SHIFT);
  assert.equal(processed.song.tracks.find((track) => track.id === "melody")?.notes?.length, sourceCount);
  assert.deepEqual(sortNoteIdentity(noteIdentity(processed.song)), sortNoteIdentity(sourceIdentity));

  const popHipHop = generateNew(configFor("pop", "hipHop", "fusion-isolation:pop+hipHop"));
  const plainHipHop = generateNew(applyOutputQualityEvolution({
    genre: "hipHop",
    seed: "fusion-isolation:hipHop",
    bars: 12,
    candidateCount: 1,
  }, { kind: "new" }));

  assert.equal(repetitionRefinementFamily(popHipHop), null);
  assert.equal(repetitionRefinementFamily(plainHipHop), null);
  assert.deepEqual(createRepetitionRefinementCandidates(popHipHop, { target: 0.7 }), []);
  assert.deepEqual(createRepetitionRefinementCandidates(plainHipHop, { target: 0.7 }), []);
});