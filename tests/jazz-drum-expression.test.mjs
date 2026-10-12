import assert from "node:assert/strict";
import test from "node:test";
import {
  generateNew, evaluateSongCandidate, evaluateSongReleaseGate,
} from "../src/music-engine.js";
import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import { applySongOutputQualityPipeline } from "../src/core/output-quality-pipeline-register.js";
import { auditStageMutationAuthority } from "../src/core/mutation-authority.js";
import { authorizeQualityStage, qualityStageAuthority } from "../src/core/generation-repair-router.js";
import {
  analyzeJazzDrumExpression,
  createJazzDrumExpressionCandidate,
  applyJazzDrumExpressionRefinement,
} from "../src/core/jazz-drum-expression.js";

function fixture() {
  const notes = [];
  for (let bar = 0; bar < 4; bar += 1) {
    for (let beat = 0; beat < 4; beat += 1) {
      notes.push({
        start: bar * 4 + beat + 0.015,
        duration: 0.12, pitch: 51, velocity: 74,
        grooveSource: "test.ride",
      });
    }
    notes.push({ start: bar * 4, duration: 0.15, pitch: 36, velocity: 82 });
    notes.push({ start: bar * 4 + 1, duration: 0.12, pitch: 38, velocity: 66 });
  }
  return {
    genre: "jazz",
    meta: { genre: "jazz", beatsPerBar: 4, bars: 4 },
    structure: [{ id: "verse-1", startBeat: 0, endBeat: 16, bars: 4 }],
    tracks: [
      { id: "drums", notes },
      { id: "bass", notes: [
        { start: 0, pitch: 43, duration: 0.55, velocity: 75 },
        { start: 4, pitch: 48, duration: 0.55, velocity: 75 },
      ] },
      { id: "melody", notes: [{ start: 0.5, pitch: 64, duration: 0.5, velocity: 80 }] },
    ],
  };
}

function signature(song) {
  return song.tracks.map((track) => [track.id, track.notes.map((note) => [
    note.start, note.duration, note.pitch,
  ])]);
}

test("Jazz groove expression observer exposes compact, deterministic drummer/bass metrics without rewriting notes", () => {
  const source = fixture();
  const original = structuredClone(source);
  const report = analyzeJazzDrumExpression(source);
  assert.deepEqual(source, original);
  assert.equal(report.available, true);
  assert.equal(report.cymbalHits, 16);
  assert.equal(report.kickSnareCounts.kicks, 4);
  assert.equal(report.bars, 4);
  assert.deepEqual(report.densityCurve, [6, 6, 6, 6]);
  assert.ok(report.bassKickCoincidence > 0);
  assert.equal(report.fullBarUniqueness, 0.25);
  assert.equal(report.structuralBarUniqueness, 0.25);
  assert.equal(report.kickSnareSkeletonUniqueness, 0.25);
  assert.equal(report.adjacentCloneRatio, 1);
  assert.equal(report.hatShapeDiversity, 0.25);
  assert.equal(report.protectedFillBars, 0);
  assert.equal(report.possibleOvervariation, false);

  assert.deepEqual(report, analyzeJazzDrumExpression(source));
  assert.equal(analyzeJazzDrumExpression({ genre: "house" }).available, false);
});

test("one safe internal bar gets a bounded Jazz ride accent and a strict velocity-only mutation", () => {
  const source = fixture();
  const original = structuredClone(source);
  const first = createJazzDrumExpressionCandidate(source);
  const second = createJazzDrumExpressionCandidate(source);
  assert.ok(first, "expected one candidate");
  assert.deepEqual(first, second);
  assert.equal(first.targetBar, 1);
  assert.ok(first.changedNotes > 0 && first.changedNotes <= 8);
  assert.ok(first.contrastDelta > 0);
  assert.deepEqual(source, original, "proposal must not mutate input");
  assert.deepEqual(signature(first.song), signature(source));
  assert.deepEqual(
    first.song.tracks.filter((track) => track.id !== "drums"),
    source.tracks.filter((track) => track.id !== "drums"),
  );
  const beforeSkeleton = source.tracks[0].notes.filter((note) =>
    [35, 36, 37, 38, 39, 40].includes(note.pitch));
  const afterSkeleton = first.song.tracks[0].notes.filter((note) =>
    [35, 36, 37, 38, 39, 40].includes(note.pitch));
  assert.deepEqual(afterSkeleton, beforeSkeleton);
  const audit = auditStageMutationAuthority(source, first.song, "jazzDrumExpressionRefinement");
  assert.equal(audit.passed, true, JSON.stringify(audit));
  assert.deepEqual(audit.changedMutations, ["velocity"]);
});

test("jazz shadow is off by default and requires ensemble specialist for a velocity-only stage", () => {
  const song = fixture();
  const result = applyJazzDrumExpressionRefinement(song, {});
  assert.equal(result.song, song);
  assert.equal(result.diagnostics.reason, "disabled");
  const stage = qualityStageAuthority("jazzDrumExpressionRefinement");
  assert.equal(stage.strictMutations, true);
  assert.deepEqual(stage.mutations, ["velocity"]);
  assert.deepEqual(stage.owners, ["ensemble"]);
  for (const owner of ["groove", "harmony", "phrase", "register"]) {
    assert.equal(authorizeQualityStage("jazzDrumExpressionRefinement", {
      allowsSurgicalPostprocess: true, mutationOwner: owner,
    }).allowed, false);
  }
  assert.equal(authorizeQualityStage("jazzDrumExpressionRefinement", {
    allowsSurgicalPostprocess: true, mutationOwner: "ensemble",
  }).allowed, true);
  const evolution = applyOutputQualityEvolution({ genre: "jazz", seed: "jazz-expression-default" });
  assert.notEqual(evolution.jazzDrumExpressionRefinement, true);
  assert.equal(evolution.genreIdentityRefinement, false, "preserve explicit playback rollback");
});

test("candidate rejection is non-destructive when critic/release refuses Jazz expression", () => {
  const source = fixture();
  const original = structuredClone(source);
  const evalFn = () => ({ score: 90, subscores: { groove: 90, drumVariety: 75, separation: 92 },
    diagnostics: { scaleFit: 1 } });
  const refused = applyJazzDrumExpressionRefinement(source,
    { jazzDrumExpressionRefinement: true }, evalFn, () => ({ passed: false }));
  assert.equal(refused.song, source);
  assert.equal(refused.diagnostics.reason, "release-gate");
  assert.deepEqual(source, original);
});

test("Jazz expression proposal may pass only the existing critic/release/coherence gates", () => {
  const source = fixture();
  const evalFn = () => ({ score: 90, subscores: { groove: 90, drumVariety: 75, separation: 92 },
    diagnostics: { scaleFit: 1 } });
  const result = applyJazzDrumExpressionRefinement(source,
    { jazzDrumExpressionRefinement: true }, evalFn, () => ({ passed: true }));
  assert.equal(result.diagnostics.accepted, true, JSON.stringify(result.diagnostics));
  assert.deepEqual(signature(result.song), signature(source));
});

test("Jazz three-seed opt-in shadow retains release-gate, determinism and production defaults", () => {
  const rows = [];
  for (const seed of ["quality-lab-01", "quality-lab-02", "quality-lab-03"]) {
    const config = {
      ...applyOutputQualityEvolution({
        genre: "jazz", seed: `${seed}:jazz`, bars: 16, candidateCount: 1,
      }, { kind: "new" }),
      phraseResolutionRefinement: true, registerHealthRefinement: true,
      jazzDrumExpressionRefinement: false,
    };
    const source = generateNew(config);
    const baseline = applySongOutputQualityPipeline(structuredClone(source), config).song;
    const afterPipeline = applySongOutputQualityPipeline(structuredClone(source), {
      ...config, jazzDrumExpressionRefinement: true,
    });
    const before = evaluateSongCandidate(baseline);
    const after = evaluateSongCandidate(afterPipeline.song);
    const release = evaluateSongReleaseGate(afterPipeline.song, after);
    const diag = afterPipeline.jazzDrumExpressionDiagnostics;
    assert.ok(diag, `${seed}: stage diagnostics must be present`);
    assert.deepEqual(signature(afterPipeline.song), signature(baseline),
      `${seed}: no pitches, timing, note count, or other-track notes may change`);
    for (const [key, value] of Object.entries(before.subscores)) {
      assert.ok(Number(after.subscores[key]) >= Number(value),
        `${seed}: ${key} decreased from ${value} to ${after.subscores[key]}`);
    }
    if (diag.accepted) {
      assert.equal(release.passed, true);
      assert.ok(diag.contrastDelta > 0);
      assert.equal(after.diagnostics.scaleFit, 1);
    } else {
      assert.deepEqual(afterPipeline.song, baseline,
        `${seed}: rejected shadow proposal must leave everything unchanged`);
    }
    rows.push({
      seed, beforeDrumVariety: before.subscores.drumVariety,
      afterDrumVariety: after.subscores.drumVariety,
      beforeGroove: before.subscores.groove, afterGroove: after.subscores.groove,
      beforeExpression: analyzeJazzDrumExpression(baseline).velocityContrast,
      afterExpression: analyzeJazzDrumExpression(afterPipeline.song).velocityContrast,
      fullBarUniqueness: analyzeJazzDrumExpression(baseline).fullBarUniqueness,
      structuralBarUniqueness: analyzeJazzDrumExpression(baseline).structuralBarUniqueness,
      humanizedRepeatLikely: analyzeJazzDrumExpression(baseline).humanizedRepeatLikely,
      skeletonUniqueness: analyzeJazzDrumExpression(baseline).kickSnareSkeletonUniqueness,
      hatShapeDiversity: analyzeJazzDrumExpression(baseline).hatShapeDiversity,
      overvariationFlag: analyzeJazzDrumExpression(baseline).possibleOvervariation,
      bassKickCoincidence: analyzeJazzDrumExpression(baseline).bassKickCoincidence,
      accepted: diag.accepted, reason: diag.reason,
      moved: diag.changedNotes ?? 0,
    });
  }
  console.info("JAZZ_DRUM_EXPRESSION_SHADOW", JSON.stringify(rows));
});
