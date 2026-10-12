import assert from "node:assert/strict";
import test from "node:test";
import { generateNew, evaluateSongCandidate, evaluateSongReleaseGate } from "../src/music-engine.js";
import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import { applySongOutputQualityPipeline } from "../src/core/output-quality-pipeline-register.js";
import { auditStageMutationAuthority } from "../src/core/mutation-authority.js";
import { qualityStageAuthority, authorizeQualityStage } from "../src/core/generation-repair-router.js";
import {
  JAZZ_PHRASE_RETURN_LIMITS,
  createJazzPhraseReturnCandidates,
  applyJazzPhraseReturnRefinement,
} from "../src/core/jazz-phrase-return-refinement.js";

function fixture() {
  const notes = [];
  const source = [60, 91, 65, 89];
  const target = [84, 63, 83, 64];
  for (let bar = 0; bar < 8; bar += 1) {
    const velocities = bar >= 4 ? target : source;
    for (const [step, velocity] of velocities.entries()) {
      notes.push({
        start: bar * 4 + step * 0.5 + 0.012, duration: 0.12,
        pitch: 51, velocity, grooveSource: "jazz-ride",
      });
    }
    notes.push({ start: bar * 4, duration: 0.16, pitch: 36, velocity: 80 });
    notes.push({ start: bar * 4 + 1, duration: 0.15, pitch: 38, velocity: 75 });
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
        { start: 4, duration: 0.55, pitch: 43, velocity: 78 },
        { start: 20, duration: 0.55, pitch: 43, velocity: 78 },
      ] },
      { id: "melody", notes: [{ start: 4.5, duration: 0.5, pitch: 66, velocity: 79 }] },
    ],
  };
}

const topology = (song) => song.tracks.map((track) => ({
  id: track.id,
  notes: track.notes.map((note) => [
    note.start, note.duration, note.pitch,
  ]),
}));

test("source-aware 2-beat Jazz echo changes only a small return-bar accent contour", () => {
  const song = fixture();
  const snapshot = structuredClone(song);
  const first = createJazzPhraseReturnCandidates(song);
  assert.ok(first.length > 0, "expected a related-section Jazz phrase return");
  assert.ok(first.length <= JAZZ_PHRASE_RETURN_LIMITS.candidateLimit);
  assert.deepEqual(first, createJazzPhraseReturnCandidates(song));
  assert.deepEqual(song, snapshot, "proposal must never mutate source notes");
  const candidate = first[0];
  assert.ok(candidate.sourceBar < candidate.targetBar - 1);
  assert.ok([5, 6].includes(candidate.targetBar), "do not touch section boundaries");
  assert.equal(candidate.song.tracks[0].notes.length, song.tracks[0].notes.length);
  assert.ok(candidate.changedNotes >= 2 && candidate.changedNotes <= 4);
  assert.ok(candidate.contourImprovement >= 1.25);
  assert.ok(candidate.meanVelocityShift <= 2.5);
  assert.deepEqual(topology(candidate.song), topology(song));
  assert.deepEqual(candidate.song.tracks.slice(1), song.tracks.slice(1));
  let changes = 0;
  for (const [index, note] of song.tracks[0].notes.entries()) {
    const changed = candidate.song.tracks[0].notes[index];
    if (changed.velocity === note.velocity) continue;
    changes += 1;
    assert.equal(note.pitch, 51, "only cymbal dynamics may be edited");
    assert.equal(Math.floor(note.start / 4), candidate.targetBar);
    assert.ok(note.start % 4 >= candidate.phraseStart);
    assert.ok(note.start % 4 < candidate.phraseStart + 2);
    assert.ok(Math.abs(changed.velocity - note.velocity) <= 8);
  }
  assert.equal(changes, candidate.changedNotes);
  const audit = auditStageMutationAuthority(song, candidate.song, "jazzPhraseReturnRefinement");
  assert.equal(audit.passed, true, JSON.stringify(audit));
  assert.deepEqual(audit.changedMutations, ["velocity"]);
});

test("safe Jazz phrase return remains opt-in and requires ensemble specialist", () => {
  const source = fixture();
  const baseline = applyJazzPhraseReturnRefinement(source, {});
  assert.equal(baseline.song, source);
  assert.equal(baseline.diagnostics.reason, "disabled");
  const authority = qualityStageAuthority("jazzPhraseReturnRefinement");
  assert.equal(authority.strictMutations, true);
  assert.deepEqual(authority.mutations, ["velocity"]);
  assert.deepEqual(authority.owners, ["ensemble"]);
  assert.equal(authorizeQualityStage("jazzPhraseReturnRefinement", {
    allowsSurgicalPostprocess: true, mutationOwner: "ensemble",
  }).allowed, true);
  for (const owner of ["groove", "phrase", "harmony", "register"]) {
    assert.equal(authorizeQualityStage("jazzPhraseReturnRefinement", {
      allowsSurgicalPostprocess: true, mutationOwner: owner,
    }).allowed, false);
  }
  const defaultConfig = applyOutputQualityEvolution({
    genre: "jazz", seed: "jazz-phrase-echo-default",
  }, { kind: "new" });
  assert.notEqual(defaultConfig.jazzPhraseReturnRefinement, true);
  assert.equal(defaultConfig.genreIdentityRefinement, false);
});

test("no candidate invents notes, rewrites protected fill/transition bars, or runs on other genres", () => {
  const protectedSong = fixture();
  for (const note of protectedSong.tracks[0].notes) {
    if ([5, 6].includes(Math.floor(note.start / 4))) note.transitionFeature = "fill";
  }
  assert.deepEqual(createJazzPhraseReturnCandidates(protectedSong), []);
  const unrelated = fixture();
  unrelated.genre = "house";
  assert.deepEqual(createJazzPhraseReturnCandidates(unrelated), []);
  const noMemory = fixture();
  noMemory.memoryMap = [];
  noMemory.structure[1].name = "Outro";
  assert.deepEqual(createJazzPhraseReturnCandidates(noMemory), []);
});

test("critic and release veto reject non-destructively; admitted candidates cannot alter melody/drum timing", () => {
  const song = fixture();
  const snapshot = structuredClone(song);
  const evalFn = () => ({
    score: 91, subscores: {
      drumVariety: 75, groove: 82, harmonic: 98, separation: 92,
    },
    diagnostics: { scaleFit: 1 },
  });
  const rejected = applyJazzPhraseReturnRefinement(
    song, { jazzPhraseReturnRefinement: true }, evalFn, () => ({ passed: false }));
  assert.equal(rejected.song, song);
  assert.equal(rejected.diagnostics.reason, "release-gate");
  assert.deepEqual(song, snapshot);
  const admitted = applyJazzPhraseReturnRefinement(
    song, { jazzPhraseReturnRefinement: true }, evalFn, () => ({ passed: true }));
  assert.equal(admitted.diagnostics.accepted, true, JSON.stringify(admitted.diagnostics));
  assert.deepEqual(topology(admitted.song), topology(song));
  assert.deepEqual(admitted.song.tracks.slice(1), song.tracks.slice(1));
  assert.equal(admitted.diagnostics.changedNotes <= 4, true);
  assert.deepEqual(song, snapshot);
});

test("three real Jazz seeds preserve critic, release, MIDI note topology and no-change baseline", () => {
  const rows = [];
  for (const seed of ["quality-lab-01", "quality-lab-02", "quality-lab-03"]) {
    const config = {
      ...applyOutputQualityEvolution({
        genre: "jazz", seed: `${seed}:jazz`, bars: 16, candidateCount: 1,
      }, { kind: "new" }),
      phraseResolutionRefinement: true,
      registerHealthRefinement: true,
      genreIdentityRefinement: false,
      jazzDrumExpressionRefinement: false,
      jazzPhraseReturnRefinement: false,
    };
    const source = generateNew(config);
    const baselineResult = applySongOutputQualityPipeline(structuredClone(source), config);
    assert.equal(baselineResult.jazzPhraseReturnDiagnostics, undefined,
      "the normal generator must never run expensive Jazz echo candidates");
    const baseline = baselineResult.song;
    const tuned = applySongOutputQualityPipeline(structuredClone(source), {
      ...config, jazzPhraseReturnRefinement: true,
    });
    const before = evaluateSongCandidate(baseline);
    const after = evaluateSongCandidate(tuned.song);
    const release = evaluateSongReleaseGate(tuned.song, after);
    const report = tuned.jazzPhraseReturnDiagnostics;
    assert.ok(report && report.candidateLimit === 3);
    assert.deepEqual(topology(tuned.song), topology(baseline), "MIDI pitches and note timing unchanged");
    assert.deepEqual(tuned.song.tracks.filter((track) => track.id !== "drums"),
      baseline.tracks.filter((track) => track.id !== "drums"));
    for (const [name, oldScore] of Object.entries(before.subscores)) {
      assert.ok(Number(after.subscores[name]) >= Number(oldScore) - 1e-9,
        `${seed}: ${name} ${oldScore} -> ${after.subscores[name]}`);
    }
    if (report.accepted) {
      assert.equal(release.passed, true);
      assert.equal(after.diagnostics.scaleFit, 1);
      assert.ok(report.contourImprovement >= 1.25);
      assert.ok(report.changedNotes <= 4);
    } else {
      assert.deepEqual(tuned.song, baseline,
        `${seed}: rejected candidate must not modify released song`);
    }
    rows.push({
      seed, accepted: report.accepted, reason: report.reason,
      evaluated: report.candidatesEvaluated,
      contourImprovement: report.contourImprovement ?? null,
      changedNotes: report.changedNotes ?? 0,
      oldVariety: before.subscores.drumVariety,
      newVariety: after.subscores.drumVariety,
      oldGroove: before.subscores.groove,
      newGroove: after.subscores.groove,
    });
  }
  console.info("JAZZ_PHRASE_RETURN_CALIBRATION", JSON.stringify(rows));
});
