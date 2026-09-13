import assert from "node:assert/strict";
import test from "node:test";
import {
  generateProducerVariationSet,
  PRODUCER_VARIATION_DIRECTIONS,
} from "../src/core/producer-variation-set.js";

function sourceSong() {
  return {
    id: "source-song",
    seed: "family-seed",
    title: "Same Song",
    meta: { key: "A", mode: "minor", tempo: 96 },
    settings: {
      bars: 16,
      energy: 0.66,
      complexity: 0.55,
      variation: 0.42,
      evolution: 0.58,
      surprise: 0.28,
      syncopation: 0.4,
    },
    tracks: [{ id: "drums", notes: [] }],
    oneShotKit: { id: "kit-source" },
  };
}

function candidateFrom(config, calls) {
  calls.push(config);
  const candidateIndex = Number(String(config.seed).split(":").at(-1));
  const route = config.compositionRoute;
  const role = route === "harmony-first" ? "romantic" : route === "groove-first" ? "club" : "balanced";
  const bonus = candidateIndex === 1 ? 6 : 0;
  const base = 82 + bonus;
  const subscores = {
    harmonic: role === "romantic" ? 92 + bonus : base,
    voiceLeading: role === "romantic" ? 91 + bonus : base,
    motif: 86 + bonus,
    phraseResolution: role === "romantic" ? 90 + bonus : base,
    performance: 87 + bonus,
    separation: 88 + bonus,
    groove: role === "club" ? 93 + bonus : base,
    drumVariety: role === "club" ? 92 + bonus : base,
    density: role === "club" ? 91 + bonus : base,
    transitions: role === "club" ? 92 + bonus : base,
    production: 88 + bonus,
    stageInterlock: role === "club" ? 90 + bonus : base,
    storyArc: 86 + bonus,
  };
  return {
    id: `candidate-${role}-${candidateIndex}`,
    title: "temporary",
    meta: {
      scoreDetails: {
        totalScore: 88 + bonus,
        subscores,
        balance: { balanceScore: 87 + bonus },
        releaseGate: { passed: true },
      },
    },
    tracks: [{ id: "drums", notes: [] }],
    oneShotKit: { id: `kit-${role}-${candidateIndex}` },
  };
}

test("producer variations are Balanced, Romantic and Club interpretations of one song", () => {
  const calls = [];
  const source = sourceSong();
  const variations = generateProducerVariationSet(source, { candidatesPerVariation: 2 }, {
    generateSimilar(_source, config) {
      return candidateFrom(config, calls);
    },
  });

  assert.deepEqual(PRODUCER_VARIATION_DIRECTIONS.map(({ id }) => id), ["balanced", "romantic", "club"]);
  assert.equal(variations.length, 3);
  assert.equal(calls.length, 6, "three roles should audition two complete arrangements each");
  assert.deepEqual(variations.map((song) => song.variationSet.direction.label), ["Balanced", "Romantic", "Club"]);
  assert.deepEqual(variations.map((song) => song.variationSet.producerIntent), ["balanced", "romantic", "club"]);
  assert.ok(variations.every((song) => song.title === source.title));
  assert.ok(variations.every((song) => song.parentId === source.id));
  assert.ok(variations.every((song) => song.variationSet.identityLocked.key));
  assert.ok(variations.every((song) => song.variationSet.identityLocked.tempo));
  assert.ok(variations.every((song) => song.id.endsWith("-1")), "role-specific critic scoring should choose the stronger audition");
});

test("producer variation directions lock source key and tempo while changing emotional intent", () => {
  const calls = [];
  const source = sourceSong();
  generateProducerVariationSet(source, {
    key: "C",
    tempo: 140,
    energy: 0.65,
    candidatesPerVariation: 1,
  }, {
    generateSimilar(_source, config) {
      return candidateFrom(config, calls);
    },
  });

  assert.ok(calls.every((config) => config.key === "A"));
  assert.ok(calls.every((config) => config.tempo === 96));
  const [balanced, romantic, club] = calls;
  assert.equal(balanced.compositionRoute, undefined);
  assert.equal(romantic.compositionRoute, "harmony-first");
  assert.equal(club.compositionRoute, "groove-first");
  assert.ok(romantic.energy < balanced.energy);
  assert.ok(club.energy > balanced.energy);
  assert.ok(club.variation > romantic.variation);
  assert.ok(romantic.surprise < balanced.surprise);
});
