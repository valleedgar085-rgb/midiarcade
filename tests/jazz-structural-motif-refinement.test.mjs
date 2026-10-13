import assert from "node:assert/strict";
import test from "node:test";
import { generateNew, evaluateSongCandidate, evaluateSongReleaseGate } from "../src/music-engine.js";
import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import { applySongOutputQualityPipeline } from "../src/core/output-quality-pipeline-register.js";
import { auditStageMutationAuthority } from "../src/core/mutation-authority.js";
import { qualityStageAuthority, authorizeQualityStage } from "../src/core/generation-repair-router.js";
import { analyzeJazzDrumExpression } from "../src/core/jazz-drum-expression.js";
import {
  JAZZ_STRUCTURAL_MOTIF_LIMITS,
  createJazzStructuralMotifCandidates,
  applyJazzStructuralMotifRefinement,
} from "../src/core/jazz-structural-motif-refinement.js";

function fixture() {
  const notes = [];
  for (let bar = 0; bar < 8; bar += 1) {
    for (let beat = 0; beat < 4; beat += 1) {
      notes.push({
        start: bar * 4 + beat + 0.012,
        duration: 0.12, pitch: 51, velocity: 76,
        grooveSource: "jazz-ride",
      });
    }
    notes.push({ start: bar * 4 + 0.5, duration: 0.10, pitch: 42, velocity: 62 });
    notes.push({ start: bar * 4 + (bar >= 4 ? 1.75 : 1.5),
      duration: 0.10, pitch: 42, velocity: 59 });
    notes.push({ start: bar * 4, duration: 0.16, pitch: 36, velocity: 82 });
    notes.push({ start: bar * 4 + 1, duration: 0.15, pitch: 38, velocity: 72 });
    // The returned bar remains an authentic *development* of its origin.
    if (bar >= 4) notes.push({ start: bar * 4 + 2.5,
      duration: 0.1, pitch: 45, velocity: 58 });
  }
  return {
    genre: "jazz",
    meta: { genre: "jazz", bars: 8, beatsPerBar: 4, keyPc: 0 },
    structure: [
      { id: "verse-1", name: "Verse", startBeat: 0, endBeat: 16, bars: 4 },
      { id: "verse-2", name: "Verse", startBeat: 16, endBeat: 32, bars: 4 },
    ],
    memoryMap: [{ relationship: "return", originSectionId: "verse-1", sectionId: "verse-2" }],
    tracks: [
      { id: "drums", notes },
      { id: "bass", notes: [
        { start: 4.012, duration: 0.50, pitch: 43, velocity: 78 },
        { start: 20.012, duration: 0.50, pitch: 43, velocity: 78 },
      ] },
      { id: "melody", notes: [
        { start: 4.3, duration: 0.3, pitch: 67, velocity: 76 },
      ] },
    ],
  };
}
const noteTopology = (song) => song.tracks.map((track) => [track.id,
  track.notes.map((note) => [note.pitch, note.duration, note.velocity])]);
const skeleton = (song) => song.tracks.find((track) => track.id === "drums").notes
  .filter((note) => [35, 36, 37, 38, 39, 40].includes(Number(note.pitch)))
  .map((note) => [note.start, note.pitch, note.velocity]);

test("one existing Jazz offbeat ornament can echo an earlier phrase without copying a bar", () => {
  const source = fixture(), original = structuredClone(source);
  const before = analyzeJazzDrumExpression(source);
  const a = createJazzStructuralMotifCandidates(source);
  const b = createJazzStructuralMotifCandidates(source);
  assert.deepEqual(a, b, "proposal search must be deterministic");
  assert.deepEqual(source, original, "must never mutate the source song");
  assert.ok(a.length > 0 && a.length <= JAZZ_STRUCTURAL_MOTIF_LIMITS.candidateLimit);
  const chosen = a[0];
  assert.ok([5, 6].includes(chosen.targetBar));
  assert.ok(chosen.sourceBar < chosen.targetBar - 1);
  assert.equal(chosen.changedNotes, 1);
  assert.ok(Math.abs(chosen.shiftBeats) <= 0.28);
  assert.ok(chosen.afterMatches > chosen.beforeMatches);
  assert.ok(chosen.afterMatches >= 2);
  assert.deepEqual(noteTopology(chosen.song), noteTopology(source),
    "pitch, duration, velocity, all track roles and note counts are preserved");
  assert.deepEqual(skeleton(chosen.song), skeleton(source));
  assert.deepEqual(chosen.song.tracks.filter((track) => track.id !== "drums"),
    source.tracks.filter((track) => track.id !== "drums"));
  const originalNotes = source.tracks[0].notes, newNotes = chosen.song.tracks[0].notes;
  const changes = originalNotes.map((note, index) => ({note, changed: newNotes[index]}))
    .filter(({note, changed}) => note.start !== changed.start);
  assert.equal(changes.length, 1);
  assert.equal(changes[0].note.pitch, 42, "only the original hat ghost can move");
  assert.equal(Math.floor(changes[0].note.start / 4), chosen.targetBar);
  const after = analyzeJazzDrumExpression(chosen.song);
  assert.equal(after.bassCymbalCoincidence, before.bassCymbalCoincidence);
  const audit = auditStageMutationAuthority(source, chosen.song, "jazzStructuralMotifRefinement");
  assert.equal(audit.passed, true, JSON.stringify(audit));
  assert.deepEqual(audit.changedMutations, ["timing"]);
});

test("reject full-bar copying, protected fills, unrelated genres and missing section memory", () => {
  const source = fixture();
  const noDevelopment = structuredClone(source);
  noDevelopment.tracks[0].notes = noDevelopment.tracks[0].notes.filter(
    (note) => !(note.pitch === 45 && note.start >= 16));
  assert.deepEqual(createJazzStructuralMotifCandidates(noDevelopment), [],
    "source bar must never be replicated as an identical full drum bar");
  const protectedSong = structuredClone(source);
  for (const note of protectedSong.tracks[0].notes) {
    if ([5, 6].includes(Math.floor(note.start / 4))) {
      note.transitionFeature = "pre-fill";
    }
  }
  assert.deepEqual(createJazzStructuralMotifCandidates(protectedSong), []);
  const genre = structuredClone(source);
  genre.genre = "house";
  assert.deepEqual(createJazzStructuralMotifCandidates(genre), []);
  const noMemory = structuredClone(source);
  noMemory.memoryMap = [];
  noMemory.structure[1].name = "Outro";
  assert.deepEqual(createJazzStructuralMotifCandidates(noMemory), []);
});

test("the structural motif stage is strictly groove-owned timing only and default-off", () => {
  const song = fixture();
  const defaultResult = applyJazzStructuralMotifRefinement(song, {});
  assert.equal(defaultResult.song, song);
  assert.equal(defaultResult.diagnostics.reason, "disabled");
  const authority = qualityStageAuthority("jazzStructuralMotifRefinement");
  assert.equal(authority.strictMutations, true);
  assert.deepEqual(authority.mutations, ["timing"]);
  assert.deepEqual(authority.owners, ["groove"]);
  assert.equal(authorizeQualityStage("jazzStructuralMotifRefinement", {
    allowsSurgicalPostprocess: true, mutationOwner: "groove",
  }).allowed, true);
  for (const owner of ["ensemble", "harmony", "phrase", "register"]) {
    assert.equal(authorizeQualityStage("jazzStructuralMotifRefinement", {
      allowsSurgicalPostprocess: true, mutationOwner: owner,
    }).allowed, false);
  }
  const production = applyOutputQualityEvolution({
    genre: "jazz", seed: "jazz-no-automatic-rhythm-edit",
  }, { kind: "new" });
  assert.notEqual(production.jazzStructuralMotifRefinement, true);
  assert.equal(production.genreIdentityRefinement, false);
});

test("critic, release and coherence are final arbiters; refusal is non-destructive", () => {
  const source = fixture(), snapshot = structuredClone(source);
  const evaluation = () => ({
    score: 92,
    subscores: { groove: 82, drumVariety: 75, performance: 90 },
    diagnostics: { scaleFit: 1 },
  });
  const denied = applyJazzStructuralMotifRefinement(source,
    { jazzStructuralMotifRefinement: true }, evaluation, () => ({ passed: false }));
  assert.equal(denied.song, source);
  assert.equal(denied.diagnostics.reason, "release-gate");
  assert.deepEqual(source, snapshot);
  const permitted = applyJazzStructuralMotifRefinement(source,
    { jazzStructuralMotifRefinement: true }, evaluation, () => ({ passed: true }));
  assert.equal(permitted.diagnostics.accepted, true, JSON.stringify(permitted.diagnostics));
  assert.deepEqual(noteTopology(permitted.song), noteTopology(source));
  assert.deepEqual(skeleton(permitted.song), skeleton(source));
  assert.deepEqual(source, snapshot);
});

test("three Jazz lab seeds compare structural motif candidates without weakening any release gate", () => {
  const rows = [];
  for (const seed of ["quality-lab-01", "quality-lab-02", "quality-lab-03"]) {
    const config = {
      ...applyOutputQualityEvolution({
        genre: "jazz", seed: `${seed}:jazz`, bars: 16, candidateCount: 1,
      }, { kind: "new" }),
      phraseResolutionRefinement: true, registerHealthRefinement: true,
      genreIdentityRefinement: false, jazzDrumExpressionRefinement: false,
      jazzPhraseReturnRefinement: false, jazzStructuralMotifRefinement: false,
    };
    const original = generateNew(config);
    const baselineRun = applySongOutputQualityPipeline(structuredClone(original), config);
    assert.equal(baselineRun.jazzStructuralMotifDiagnostics, undefined);
    const base = baselineRun.song;
    const tuned = applySongOutputQualityPipeline(structuredClone(original),
      { ...config, jazzStructuralMotifRefinement: true });
    const before = evaluateSongCandidate(base);
    const after = evaluateSongCandidate(tuned.song);
    const diagnostic = tuned.jazzStructuralMotifDiagnostics;
    assert.ok(diagnostic, "opt-in stage must emit diagnostics");
    assert.deepEqual(noteTopology(tuned.song), noteTopology(base),
      "no MIDI note velocity/duration/pitch/count may change");
    assert.deepEqual(skeleton(tuned.song), skeleton(base));
    assert.deepEqual(tuned.song.tracks.filter((track) => track.id !== "drums"),
      base.tracks.filter((track) => track.id !== "drums"));
    for (const [key, old] of Object.entries(before.subscores)) {
      assert.ok(finite(after.subscores[key]) >= finite(old) - 1e-9,
        `${seed}: ${key} ${old} -> ${after.subscores[key]}`);
    }
    if (diagnostic.accepted) {
      assert.equal(evaluateSongReleaseGate(tuned.song, after).passed, true);
      assert.equal(after.diagnostics.scaleFit, 1);
      assert.ok(diagnostic.motifGain >= 1);
      assert.equal(diagnostic.changedNotes, 1);
      assert.ok(Math.abs(diagnostic.shiftBeats) <= 0.28);
    } else {
      assert.deepEqual(tuned.song, base, "rejected Jazz edit must not change output");
    }
    rows.push({
      seed, candidateCount: diagnostic.candidatesEvaluated,
      accepted: diagnostic.accepted, reason: diagnostic.reason,
      motifGain: diagnostic.motifGain ?? 0,
      noteShift: diagnostic.shiftBeats ?? 0,
      grooveBefore: before.subscores.groove, grooveAfter: after.subscores.groove,
      varietyBefore: before.subscores.drumVariety,
      varietyAfter: after.subscores.drumVariety,
      bassRideBefore: analyzeJazzDrumExpression(base).bassCymbalCoincidence,
      bassRideAfter: analyzeJazzDrumExpression(tuned.song).bassCymbalCoincidence,
    });
  }
  console.info("JAZZ_STRUCTURAL_MOTIF_CALIBRATION", JSON.stringify(rows));
});
const finite = (value) => Number(value) || 0;
