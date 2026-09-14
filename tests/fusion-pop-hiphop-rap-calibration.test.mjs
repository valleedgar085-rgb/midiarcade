import assert from "node:assert/strict";
import test from "node:test";
import * as engine from "../src/music-engine.js";

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

function generate(genre, seed, secondaryGenre = null, fusionBlend = 0.5) {
  return engine.generateNew({
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
  });
}

test("Pop, Hip-Hop and Rap fusion calibration exposes parent-relative musical quality", { timeout: 120_000 }, () => {
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
      rows.push({
        seed,
        pair: `${primary}+${secondary}`,
        ...fused,
        scoreDelta: delta("score"),
        floorDelta: delta("floor"),
        grooveDelta: delta("groove"),
        motifDelta: delta("motif"),
        repetitionDelta: delta("repetition"),
        phraseDelta: delta("phraseResolution"),
        performanceDelta: delta("performance"),
        separationDelta: delta("separation"),
      });

      assert.equal(song.meta.isFusion, true);
      assert.equal(song.meta.secondaryGenre, secondary);
      assert.equal(fused.scaleFit, 1);
      assert.match(fused.producerStatus, /passed|best-available/);
      assert.ok(fused.score >= 82, `${primary}+${secondary} total quality collapsed`);
      assert.ok(fused.floor >= 55, `${primary}+${secondary} creative floor collapsed`);
      assert.ok(fused.groove >= Math.min(a.groove, b.groove) - 12, `${primary}+${secondary} lost too much groove`);
      assert.ok(fused.motif >= Math.min(a.motif, b.motif) - 12, `${primary}+${secondary} lost too much hook identity`);
      assert.ok(fused.performance >= Math.min(a.performance, b.performance) - 12, `${primary}+${secondary} lost too much performance feel`);
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