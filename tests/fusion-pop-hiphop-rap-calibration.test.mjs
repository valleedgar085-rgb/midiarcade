import assert from "node:assert/strict";
import test from "node:test";
import * as engine from "../src/music-engine.js";
import { adaptGenerationConfig } from "../src/core/adaptive-generation.js";
import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import { applySongOutputQualityPipeline } from "../src/core/output-quality-pipeline-register.js";

const GENRES = ["pop", "hipHop", "rap"];
const PAIRS = [
  ["pop", "hipHop"],
  ["pop", "rap"],
  ["hipHop", "rap"],
];
const SEEDS = ["fusion-quality-01", "fusion-quality-02", "fusion-quality-03"];

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value, digits = 1) => Number(finite(value).toFixed(digits));

function qualityRow(song) {
  const details = song?.meta?.scoreDetails ?? {};
  const subscores = details.subscores ?? {};
  const tracks = Object.fromEntries((song?.tracks ?? []).map((track) => [track.id, track]));
  const bars = Math.max(1, finite(song?.meta?.bars, 1));
  const perBar = (id) => round((tracks[id]?.notes?.length ?? 0) / bars, 2);
  return {
    score: finite(details.totalScore),
    floor: finite(details.balance?.creativeFloor),
    groove: finite(subscores.groove),
    motif: finite(subscores.motif),
    repetition: finite(subscores.repetition),
    phraseResolution: finite(subscores.phraseResolution),
    performance: finite(subscores.performance),
    separation: finite(subscores.separation),
    density: finite(subscores.density),
    genreAuthenticity: finite(subscores.genreAuthenticity),
    melodyPerBar: perBar("melody"),
    counterpointPerBar: perBar("counterpoint"),
    chordsPerBar: perBar("chords"),
    padPerBar: perBar("pad"),
    bassPerBar: perBar("bass"),
    scaleFit: finite(details.diagnostics?.scaleFit),
    producerStatus: song?.producerPass?.status ?? "",
  };
}

function generationConfig(genre, seed, secondaryGenre = null, fusionBlend = 0.5) {
  const adapted = adaptGenerationConfig({
    genre,
    ...(secondaryGenre ? { secondaryGenre, fusionBlend } : {}),
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

function generate(genre, seed, secondaryGenre = null, fusionBlend = 0.5) {
  const config = generationConfig(genre, seed, secondaryGenre, fusionBlend);
  const generated = engine.generateNew(config);
  return applySongOutputQualityPipeline(generated, config).song;
}

test("Pop, Hip-Hop and Rap fusion calibration protects parent-relative musical quality", { timeout: 120_000 }, () => {
  const rows = [];
  for (const seed of SEEDS) {
    const parents = new Map(GENRES.map((genre) => [genre, qualityRow(generate(genre, `${seed}:${genre}`))]));
    for (const [primary, secondary] of PAIRS) {
      const song = generate(primary, `${seed}:${primary}+${secondary}`, secondary, 0.5);
      const fused = qualityRow(song);
      const a = parents.get(primary);
      const b = parents.get(secondary);
      const parentAverage = (key) => (finite(a[key]) + finite(b[key])) / 2;
      const delta = (key) => round(finite(fused[key]) - parentAverage(key));
      const scoreDelta = delta("score");
      const floorDelta = delta("floor");
      const grooveDelta = delta("groove");
      const motifDelta = delta("motif");
      const repetitionDelta = delta("repetition");
      const phraseDelta = delta("phraseResolution");
      const performanceDelta = delta("performance");
      const separationDelta = delta("separation");
      rows.push({
        seed,
        pair: `${primary}+${secondary}`,
        ...fused,
        scoreDelta,
        floorDelta,
        grooveDelta,
        motifDelta,
        repetitionDelta,
        phraseDelta,
        performanceDelta,
        separationDelta,
      });

      const label = `${primary}+${secondary} ${seed}`;
      assert.equal(song.meta.isFusion, true);
      assert.equal(song.meta.secondaryGenre, secondary);
      assert.equal(fused.scaleFit, 1);
      assert.match(fused.producerStatus, /passed|best-available/);
      assert.ok(fused.score >= 90, `${label} score=${fused.score}`);
      assert.ok(fused.floor >= 75, `${label} floor=${fused.floor}`);
      assert.ok(
        fused.groove >= 90 && grooveDelta >= -8,
        `${label} groove=${fused.groove} parentDelta=${grooveDelta}`,
      );
      assert.ok(
        fused.motif >= 85 && motifDelta >= -8,
        `${label} motif=${fused.motif} parentDelta=${motifDelta}`,
      );
      assert.ok(
        fused.repetition >= 78 && repetitionDelta >= -12,
        `${label} repetition=${fused.repetition} parentDelta=${repetitionDelta}`,
      );
      assert.ok(
        fused.phraseResolution >= 79 && phraseDelta >= -8,
        `${label} phraseResolution=${fused.phraseResolution} parentDelta=${phraseDelta}`,
      );
      assert.ok(
        fused.performance >= 83 && performanceDelta >= -8,
        `${label} performance=${fused.performance} parentDelta=${performanceDelta}`,
      );
      assert.ok(scoreDelta >= -4, `${label} score parentDelta=${scoreDelta}`);
      assert.ok(floorDelta >= -7, `${label} floor parentDelta=${floorDelta}`);
    }
  }
  console.log("POP_HIPHOP_RAP_FUSION_CALIBRATION", JSON.stringify(rows));
});

test("fusion profile midpoint keeps both parent identities represented", () => {
  for (const [primary, secondary] of PAIRS) {
    const fused = engine.createFusedGenreProfile(primary, secondary, 0.5);
    const first = engine.GENRE_PROFILES[primary];
    const second = engine.GENRE_PROFILES[secondary];
    assert.equal(fused.isFusion, true);
    assert.equal(fused.primaryGenre, primary);
    assert.equal(fused.secondaryGenre, secondary);
    assert.ok(fused.preferredScales.some((scale) => first.preferredScales.includes(scale)));
    assert.ok(fused.preferredScales.some((scale) => second.preferredScales.includes(scale)));
    for (const role of ["drums", "bass", "chords", "melody"]) {
      assert.ok(fused.instrumentPrograms[role].some((program) => first.instrumentPrograms[role].includes(program)));
      assert.ok(fused.instrumentPrograms[role].some((program) => second.instrumentPrograms[role].includes(program)));
    }
  }
});
