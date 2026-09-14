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

function configFor(genre, seed) {
  return {
    ...applyOutputQualityEvolution({ genre, seed: `${seed}:${genre}`, bars: 16, candidateCount: 1 }, { kind: "new" }),
    phraseResolutionRefinement: true,
    registerHealthRefinement: true,
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

test("Jazz drum-memory candidate stays genre-specific", () => {
  for (const genre of ["funk", "drumBass", "house", "trap"]) {
    const config = configFor(genre, SEEDS[0]);
    const song = applySongOutputQualityPipeline(generateNew(config), config).song;
    assert.equal(createJazzDrumMemoryCandidate(song), null);
  }
});
