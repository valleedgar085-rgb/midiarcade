import assert from "node:assert/strict";
import test from "node:test";
import {
  ELEMENT_PROFILES,
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
      chordPath: "i-VI-III-VII",
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
  const seedParts = String(config.seed).split(":");
  const candidateIndex = Number(seedParts.at(-1));
  const element = seedParts.at(-2);
  const bonus = candidateIndex === 1 ? 6 : 0;
  const base = 82 + bonus;
  const subscores = {
    harmonic: element === "drip" ? 93 + bonus : base,
    voiceLeading: element === "drip" ? 92 + bonus : base,
    motif: element === "electric" ? 92 + bonus : 86 + bonus,
    phraseResolution: element === "drip" ? 91 + bonus : base,
    performance: element === "electric" ? 91 + bonus : 87 + bonus,
    separation: element === "drip" || element === "electric" ? 90 + bonus : 88 + bonus,
    groove: element === "fire" ? 94 + bonus : base,
    drumVariety: element === "fire" ? 93 + bonus : base,
    density: element === "fire" ? 92 + bonus : base,
    transitions: element === "fire" || element === "electric" ? 92 + bonus : base,
    production: 89 + bonus,
    stageInterlock: element === "fire" ? 91 + bonus : base,
    storyArc: element === "electric" ? 90 + bonus : 86 + bonus,
  };
  return {
    id: `candidate-${element}-${candidateIndex}`,
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
    oneShotKit: { id: `kit-${element}-${candidateIndex}` },
  };
}

test("producer variations are Fire, Electric and Drip interpretations of one song family", () => {
  const calls = [];
  const source = sourceSong();
  const variations = generateProducerVariationSet(source, { candidatesPerVariation: 2 }, {
    generateSimilar(_source, config) {
      return candidateFrom(config, calls);
    },
  });

  assert.deepEqual(PRODUCER_VARIATION_DIRECTIONS.map(({ id }) => id), ["fire", "electric", "drip"]);
  assert.equal(PRODUCER_VARIATION_DIRECTIONS, ELEMENT_PROFILES);
  assert.equal(variations.length, 3);
  assert.equal(calls.length, 6, "three elements should audition two complete arrangements each");
  assert.deepEqual(variations.map((song) => song.variationSet.element.label), ["Fire", "Electric", "Drip"]);
  assert.deepEqual(variations.map((song) => song.variationSet.producerIntent), ["fire", "electric", "drip"]);
  assert.ok(variations.every((song) => song.variationSet.moodIntent.id === "balanced"));
  assert.ok(variations.every((song) => song.title === source.title));
  assert.ok(variations.every((song) => song.parentId === source.id));
  assert.ok(variations.every((song) => song.variationSet.identityLocked.key));
  assert.ok(variations.every((song) => song.variationSet.identityLocked.tempo));
  assert.ok(variations.every((song) => song.variationSet.identityLocked.chordPath));
  assert.ok(variations.every((song) => song.id.endsWith("-1")), "element-specific critic scoring should choose the stronger audition");
  assert.equal(new Set(variations.map((song) => song.variationSet.familyFingerprint)).size, 1);
});

test("element meters are deterministic and actually drive generation parameters", () => {
  const firstCalls = [];
  const secondCalls = [];
  const source = sourceSong();
  const options = {
    seed: "same-family",
    moodIntent: "romantic",
    elementIntensity: { fire: 1, electric: 0.5, drip: 0.25 },
    candidatesPerVariation: 1,
  };
  const generate = (calls) => generateProducerVariationSet(source, options, {
    generateSimilar(_source, config) {
      return candidateFrom(config, calls);
    },
  });
  const first = generate(firstCalls);
  const second = generate(secondCalls);

  assert.deepEqual(
    first.map((song) => song.variationSet.element.meter),
    second.map((song) => song.variationSet.element.meter),
  );
  assert.deepEqual(first.map((song) => song.variationSet.element.meter.value), [3000, 1500, 750]);
  assert.deepEqual(first.map((song) => song.variationSet.element.meter.unit), ["°F", "V", "mL/min"]);
  assert.ok(firstCalls.every((config) => config.key === "A"));
  assert.ok(firstCalls.every((config) => config.tempo === 96));
  assert.ok(firstCalls.every((config) => config.chordPath === "i-VI-III-VII"));
  assert.ok(firstCalls.every((config) => config.moodIntent === "romantic"));
  assert.ok(firstCalls.every((config) => config.compositionRoute === "harmony-first"));
  assert.ok(firstCalls[0].energy > firstCalls[2].energy, "full-strength Fire should push more energy than low-strength Drip");
  assert.ok(firstCalls[1].syncopation > firstCalls[2].syncopation, "Electric should add more rhythmic motion than Drip");
});
