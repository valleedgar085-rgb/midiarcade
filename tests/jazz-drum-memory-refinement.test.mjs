import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateSongCandidate,
  evaluateSongReleaseGate,
  generateNew,
} from "../src/music-engine.js";
import {
  adjacentDrumDuplicateCount,
  createJazzDrumMemoryCandidate,
} from "../src/core/jazz-drum-memory-refinement.js";
import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import { applySongOutputQualityPipeline } from "../src/core/output-quality-pipeline-register.js";

const SEEDS = ["quality-lab-01", "quality-lab-02", "quality-lab-03"];
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const floor = (evaluation) => Math.min(...Object.values(evaluation.subscores ?? {}).map((value) => finite(value)));

function configFor(genre, seed, { identity = false, kind = "new" } = {}) {
  return {
    ...applyOutputQualityEvolution({ genre, seed: `${seed}:${genre}`, bars: 16, candidateCount: 1 }, { kind }),
    phraseResolutionRefinement: true,
    registerHealthRefinement: true,
    genreIdentityRefinement: identity,
  };
}

function jazzSong(seed) {
  const config = configFor("jazz", seed);
  return applySongOutputQualityPipeline(generateNew(config), config).song;
}

test("Jazz drum-memory candidate is deterministic, immutable, drum-only and bounded to one non-adjacent return bar", () => {
  const source = jazzSong(SEEDS[0]);
  const snapshot = structuredClone(source);
  const first = createJazzDrumMemoryCandidate(source);
  const second = createJazzDrumMemoryCandidate(source);
  assert.ok(first);
  assert.deepEqual(first, second);
  assert.deepEqual(source, snapshot);
  assert.equal(first.changedBars, 1);
  assert.ok(Math.abs(first.sourceBar - first.targetBar) > 1);
  assert.ok(first.adjacentDuplicatesAfter <= first.adjacentDuplicatesBefore);
  assert.deepEqual(
    first.song.tracks.filter((track) => track.id !== "drums"),
    source.tracks.filter((track) => track.id !== "drums"),
  );
});

test("Jazz fixed seeds gain drum memory without groove, performance, authenticity, floor, scale or release regression", () => {
  const rows = [];
  for (const seed of SEEDS) {
    const source = jazzSong(seed);
    const candidate = createJazzDrumMemoryCandidate(source);
    assert.ok(candidate, `expected Jazz candidate for ${seed}`);
    const before = evaluateSongCandidate(source);
    const after = evaluateSongCandidate(candidate.song);
    const release = evaluateSongReleaseGate(candidate.song, after);
    const row = {
      seed,
      drumVarietyDelta: finite(after.subscores?.drumVariety) - finite(before.subscores?.drumVariety),
      grooveDelta: finite(after.subscores?.groove) - finite(before.subscores?.groove),
      performanceDelta: finite(after.subscores?.performance) - finite(before.subscores?.performance),
      authenticityDelta: finite(after.subscores?.genreAuthenticity) - finite(before.subscores?.genreAuthenticity),
      scoreDelta: finite(after.score) - finite(before.score),
      floorDelta: floor(after) - floor(before),
      scaleFit: finite(after.diagnostics?.scaleFit),
      releasePassed: Boolean(release.passed),
      adjacentBefore: adjacentDrumDuplicateCount(source),
      adjacentAfter: adjacentDrumDuplicateCount(candidate.song),
    };
    rows.push(row);
    assert.ok(row.drumVarietyDelta >= 2, `${seed} drum variety must improve materially`);
    assert.ok(row.grooveDelta >= 0, `${seed} groove regressed`);
    assert.ok(row.performanceDelta >= 0, `${seed} performance regressed`);
    assert.ok(row.authenticityDelta >= 0, `${seed} authenticity regressed`);
    assert.ok(row.scoreDelta >= -0.25, `${seed} total score regressed`);
    assert.ok(row.floorDelta >= -0.5, `${seed} creative floor regressed`);
    assert.ok(row.adjacentAfter <= row.adjacentBefore, `${seed} adjacent cloning worsened`);
    assert.ok(row.scaleFit >= 0.999999, `${seed} scale safety regressed`);
    assert.equal(row.releasePassed, true, `${seed} release gate failed`);
  }
  console.log("JAZZ_DRUM_MEMORY_FIXED_SEEDS", JSON.stringify(rows));
});

test("quality-lab-03 recalls a remembered Jazz pocket without weakening groove identity", () => {
  const source = jazzSong("quality-lab-03");
  const candidate = createJazzDrumMemoryCandidate(source);
  assert.ok(candidate, "quality-lab-03 needs a critic-safe Jazz memory candidate");

  const beforeDrums = source.tracks.find((track) => track.id === "drums").notes;
  const afterDrums = candidate.song.tracks.find((track) => track.id === "drums").notes;
  const skeleton = (notes) => notes
    .filter((note) => [35, 36, 37, 38, 39, 40].includes(Number(note.pitch)))
    .map((note) => [Number(note.pitch), Number(note.start)])
    .sort((left, right) => left[1] - right[1] || left[0] - right[0]);
  const offbeatCount = (notes) => notes
    .filter((note) => Math.abs(Number(note.start) - Math.round(Number(note.start))) > 0.08).length;

  assert.equal(candidate.noteCountDelta, 0);
  assert.equal(afterDrums.length, beforeDrums.length, "bounded Jazz memory must preserve total drum density");
  assert.equal(offbeatCount(afterDrums), offbeatCount(beforeDrums), "bounded Jazz memory must preserve the global syncopation count");
  assert.deepEqual(skeleton(afterDrums), skeleton(beforeDrums), "kick/snare pocket must remain byte-equivalent");
  assert.ok(
    afterDrums.some((note) => note.jazzMemoryPocketRecall === true || note.jazzMemoryColorRecall === true),
    "the return must carry an explicit remembered/developed drum event",
  );

  const before = evaluateSongCandidate(source);
  const after = evaluateSongCandidate(candidate.song);
  assert.ok(finite(after.subscores?.drumVariety) - finite(before.subscores?.drumVariety) >= 2);
  assert.ok(finite(after.subscores?.groove) >= finite(before.subscores?.groove));
  assert.ok(finite(after.subscores?.genreAuthenticity) >= finite(before.subscores?.genreAuthenticity));
});

test("explicit Jazz identity opt-in accepts only critic-safe groove memory", () => {
  const rows = [];
  for (const seed of SEEDS) {
    const baselineConfig = configFor("jazz", seed, { identity: false });
    const source = applySongOutputQualityPipeline(generateNew(baselineConfig), baselineConfig).song;
    const productionConfig = {
      ...baselineConfig,
      genreIdentityRefinement: true,
    };
    const processed = applySongOutputQualityPipeline(generateNew(productionConfig), productionConfig);
    const before = evaluateSongCandidate(source);
    const after = evaluateSongCandidate(processed.song);
    const diagnostics = processed.genreIdentityDiagnostics;
    assert.equal(diagnostics?.accepted, true, `${seed} explicit identity candidate should be accepted`);
    assert.equal(diagnostics?.id, "jazz-return-groove-recall");
    assert.ok(finite(after.subscores?.drumVariety) - finite(before.subscores?.drumVariety) >= 2);
    assert.ok(finite(after.subscores?.groove) >= finite(before.subscores?.groove));
    assert.ok(finite(after.subscores?.performance) >= finite(before.subscores?.performance));
    assert.ok(finite(after.subscores?.genreAuthenticity) >= finite(before.subscores?.genreAuthenticity));
    assert.ok(diagnostics.adjacentDuplicatesAfter <= diagnostics.adjacentDuplicatesBefore);
    rows.push({
      seed,
      drumVarietyDelta: diagnostics.drumVarietyDelta,
      grooveDelta: diagnostics.grooveDelta,
      performanceDelta: diagnostics.performanceDelta,
      authenticityDelta: diagnostics.authenticityDelta,
      scoreDelta: diagnostics.scoreDelta,
      floorDelta: diagnostics.floorDelta,
    });
  }
  console.log("JAZZ_GENRE_IDENTITY_PIPELINE", JSON.stringify(rows));
});

test("genre identity defaults off after device playback feedback and explicit opt-in remains available", () => {
  const seed = SEEDS[0];
  const fresh = {
    ...applyOutputQualityEvolution({ genre: "jazz", seed: `${seed}:jazz`, bars: 16, candidateCount: 1 }, { kind: "new" }),
    phraseResolutionRefinement: true,
    registerHealthRefinement: true,
  };
  assert.equal(fresh.genreIdentityRefinement, false);
  const freshResult = applySongOutputQualityPipeline(generateNew(fresh), fresh);
  assert.equal(freshResult.genreIdentityDiagnostics?.attempted, false);

  const similar = {
    ...applyOutputQualityEvolution({ genre: "jazz", seed: `${seed}:jazz:similar`, bars: 16, candidateCount: 1 }, { kind: "similar" }),
    phraseResolutionRefinement: false,
    registerHealthRefinement: false,
  };
  assert.equal(similar.genreIdentityRefinement, false);
  const similarResult = applySongOutputQualityPipeline(generateNew(similar), similar);
  assert.equal(similarResult.genreIdentityDiagnostics?.attempted, false);

  const optedIn = { ...fresh, genreIdentityRefinement: true };
  const optedInResult = applySongOutputQualityPipeline(generateNew(optedIn), optedIn);
  assert.equal(optedInResult.genreIdentityDiagnostics?.accepted, true);

  const optedOut = { ...fresh, genreIdentityRefinement: false };
  const optedOutResult = applySongOutputQualityPipeline(generateNew(optedOut), optedOut);
  assert.equal(optedOutResult.genreIdentityDiagnostics?.attempted, false);
});

test("Jazz drum-memory candidate stays genre-specific", () => {
  for (const genre of ["funk", "drumBass", "house", "trap"]) {
    const config = configFor(genre, SEEDS[0]);
    const song = applySongOutputQualityPipeline(generateNew(config), config).song;
    assert.equal(createJazzDrumMemoryCandidate(song), null);
  }
});
