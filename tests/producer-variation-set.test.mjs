import assert from "node:assert/strict";
import test from "node:test";
import {
  ELEMENT_PROFILES,
  generateProducerVariationSet,
  producerVariationDirectionAssessment,
  producerVariationDirectionScore,
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
    tracks: [
      { id: "drums", settings: { density: 0.72, variation: 0.58, humanize: 0.65 }, notes: [] },
      { id: "bass", settings: { density: 0.62, variation: 0.4, humanize: 0.5 }, notes: [] },
      { id: "chords", settings: { density: 0.58, variation: 0.38, humanize: 0.42 }, notes: [] },
      { id: "melody", settings: { density: 0.64, variation: 0.5, humanize: 0.55 }, notes: [] },
      { id: "counterpoint", settings: { density: 0.38, variation: 0.55, humanize: 0.5 }, notes: [] },
      { id: "pad", settings: { density: 0.82, variation: 0.28, humanize: 0.24 }, notes: [] },
    ],
    oneShotKit: { id: "kit-source" },
  };
}

function scoreSong({ id = "score-song", overall = 90, role = 90, releasePassed = true } = {}, direction = ELEMENT_PROFILES[0]) {
  const subscores = Object.fromEntries(direction.criticDimensions.map((dimension) => [dimension, role]));
  return {
    id,
    generation: "similar",
    meta: {
      key: "A",
      mode: "minor",
      tempo: 96,
      bars: 16,
      beatsPerBar: 4,
      totalBeats: 64,
      scoreDetails: {
        totalScore: overall,
        subscores,
        balance: { balanceScore: overall },
        releaseGate: { passed: releasePassed },
      },
    },
    settings: { bars: 16, similarity: direction.similarity },
    tracks: [
      { id: "drums", notes: [{ pitch: 36, start: 0, duration: 0.1, velocity: 100 }] },
      { id: "bass", notes: [{ pitch: 45, start: 0, duration: 0.5, velocity: 90 }] },
      { id: "chords", notes: [{ pitch: 57, start: 0, duration: 4, velocity: 80 }] },
      { id: "melody", notes: [{ pitch: 69, start: 0, duration: 0.5, velocity: 88 }] },
      { id: "counterpoint", notes: [] },
      { id: "pad", notes: [] },
    ],
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
      key: "A",
      mode: "minor",
      tempo: 96,
      bars: 16,
      beatsPerBar: 4,
      totalBeats: 64,
      scoreDetails: {
        totalScore: 88 + bonus,
        subscores,
        balance: { balanceScore: 87 + bonus },
        releaseGate: { passed: true },
      },
    },
    settings: { bars: 16, similarity: config.similarity },
    tracks: sourceSong().tracks,
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
  assert.ok(variations.every((song) => song.variationSet.version === 4));
  assert.ok(variations.every((song) => song.variationSet.moodIntent.id === "balanced"));
  assert.ok(variations.every((song) => song.title === source.title));
  assert.ok(variations.every((song) => song.parentId === source.id));
  assert.ok(variations.every((song) => song.variationSet.identityLocked.key));
  assert.ok(variations.every((song) => song.variationSet.identityLocked.tempo));
  assert.ok(variations.every((song) => song.variationSet.identityLocked.chordPath));
  assert.ok(variations.every((song) => song.id.endsWith("-1")), "element-specific critic scoring should choose the stronger audition");
  assert.ok(variations.every((song) => song.variationSet.selectedAudition === 1));
  assert.ok(variations.every((song) => song.variationSet.eligibleAuditions === 2));
  assert.ok(variations.every((song) => song.variationSet.elementAssessment.roleScore > 0));
  assert.equal(new Set(variations.map((song) => song.variationSet.familyFingerprint)).size, 1);
  assert.deepEqual(
    variations.map((song) => song.variationSet.direction.route),
    ["groove-first", "hook-first", "harmony-first"],
    "each Element must retain a distinct musical route",
  );
});

test("element meters are deterministic and drive clearly separated generation parameters", () => {
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
  assert.deepEqual(first.map((song) => song.variationSet.element.meter.label), ["Heat", "Voltage", "Flow"]);
  assert.ok(firstCalls.every((config) => config.key === "A"));
  assert.ok(firstCalls.every((config) => config.tempo === 96));
  assert.ok(firstCalls.every((config) => config.chordPath === "i-VI-III-VII"));
  assert.ok(firstCalls.every((config) => config.moodIntent === "romantic"));
  assert.deepEqual(firstCalls.map((config) => config.compositionRoute), ["groove-first", "hook-first", "harmony-first"]);
  assert.ok(firstCalls[0].energy > firstCalls[2].energy, "full-strength Fire should push more energy than low-strength Drip");
  assert.ok(firstCalls[1].syncopation > firstCalls[2].syncopation, "Electric should add more rhythmic motion than Drip");
  assert.ok(firstCalls[0].tracks.drums.density > firstCalls[2].tracks.drums.density, "Fire should hit more densely than Drip");
  assert.ok(firstCalls[1].tracks.melody.variation > firstCalls[0].tracks.melody.variation, "Electric should animate melody more than Fire");
  assert.ok(firstCalls[2].tracks.pad.density > firstCalls[0].tracks.pad.density, "Drip should favor a wider pad bed than Fire");
  assert.ok(new Set(firstCalls.map((config) => config.similarity)).size === 3, "Element similarity targets should be intentionally separated");
});

test("Phase 6C prefers strong Element identity over a generic high total score", () => {
  const direction = ELEMENT_PROFILES.find(({ id }) => id === "electric");
  const generic = scoreSong({ id: "generic", overall: 95, role: 78 }, direction);
  const elemental = scoreSong({ id: "elemental", overall: 91, role: 97 }, direction);
  const genericAssessment = producerVariationDirectionAssessment(generic, direction);
  const elementalAssessment = producerVariationDirectionAssessment(elemental, direction);

  assert.ok(genericAssessment.overallScore > elementalAssessment.overallScore);
  assert.ok(elementalAssessment.roleScore > genericAssessment.roleScore);
  assert.ok(elementalAssessment.score > genericAssessment.score, "Element-specific critic axes should outweigh a modest generic-score lead");
  assert.equal(producerVariationDirectionScore(elemental, direction), elementalAssessment.score);
});

test("Phase 6C only penalizes near-cloned siblings and never rewards arbitrary divergence", () => {
  const direction = ELEMENT_PROFILES.find(({ id }) => id === "drip");
  const candidate = scoreSong({ id: "drip-candidate", overall: 92, role: 94 }, direction);
  const withoutSibling = producerVariationDirectionAssessment(candidate, direction);
  const withClone = producerVariationDirectionAssessment(candidate, direction, { siblings: [structuredClone(candidate)] });

  assert.equal(withoutSibling.siblingClonePenalty, 0);
  assert.equal(withClone.siblingMaxSimilarity, 1);
  assert.equal(withClone.siblingClonePenalty, 4);
  assert.equal(withClone.score, withoutSibling.score - 4);
  assert.equal(withClone.comparedSiblings, 1);
});

test("release-failed Element auditions are ineligible and cannot beat a safe candidate", () => {
  const direction = ELEMENT_PROFILES[0];
  const failed = scoreSong({ id: "failed", overall: 100, role: 100, releasePassed: false }, direction);
  const safe = scoreSong({ id: "safe", overall: 84, role: 86, releasePassed: true }, direction);
  const failedAssessment = producerVariationDirectionAssessment(failed, direction);
  const safeAssessment = producerVariationDirectionAssessment(safe, direction);
  assert.equal(failedAssessment.eligible, false);
  assert.equal(failedAssessment.score, -1000);
  assert.equal(safeAssessment.eligible, true);

  const source = sourceSong();
  const variations = generateProducerVariationSet(source, { count: 1, candidatesPerVariation: 2 }, {
    generateSimilar(_source, config) {
      const candidateIndex = Number(String(config.seed).split(":").at(-1));
      const song = candidateIndex === 0 ? structuredClone(failed) : structuredClone(safe);
      song.id = candidateIndex === 0 ? "unsafe-winner-trap" : "safe-winner";
      return song;
    },
  });

  assert.equal(variations.length, 1);
  assert.equal(variations[0].id, "safe-winner");
  assert.equal(variations[0].variationSet.eligibleAuditions, 1);
  assert.equal(variations[0].variationSet.selectedAudition, 1);
});

test("Elements reject piercing upper-register auditions before selection", () => {
  const direction = ELEMENT_PROFILES[0];
  const high = scoreSong({ id: "piercing", overall: 99, role: 99, releasePassed: true }, direction);
  high.tracks.find((track) => track.id === "melody").notes[0].pitch = 96;
  const safe = scoreSong({ id: "safe-register", overall: 84, role: 86, releasePassed: true }, direction);
  const highAssessment = producerVariationDirectionAssessment(high, direction);
  const safeAssessment = producerVariationDirectionAssessment(safe, direction);

  assert.equal(highAssessment.registerSafe, false);
  assert.equal(highAssessment.eligible, false);
  assert.equal(highAssessment.score, -1000);
  assert.equal(safeAssessment.registerSafe, true);

  const variations = generateProducerVariationSet(sourceSong(), { count: 1, candidatesPerVariation: 2 }, {
    generateSimilar(_source, config) {
      const candidateIndex = Number(String(config.seed).split(":").at(-1));
      return structuredClone(candidateIndex === 0 ? high : safe);
    },
  });

  assert.equal(variations.length, 1);
  assert.equal(variations[0].id, "safe-register");
  assert.equal(variations[0].variationSet.eligibleAuditions, 1);
  assert.equal(variations[0].variationSet.selectedAudition, 1);
});

test("Elements preserve accepted Shape register authority but reject a worse high outlier", () => {
  const direction = ELEMENT_PROFILES[0];
  const source = sourceSong();
  source.tracks.find((track) => track.id === "melody").notes = [
    { pitch: 88, start: 0, duration: 0.5, velocity: 88 },
  ];
  const inherited = scoreSong({ id: "inherited-high", overall: 90, role: 92, releasePassed: true }, direction);
  inherited.tracks.find((track) => track.id === "melody").notes[0].pitch = 88;
  const worse = structuredClone(inherited);
  worse.id = "worse-high";
  worse.tracks.find((track) => track.id === "melody").notes[0].pitch = 96;

  const inheritedAssessment = producerVariationDirectionAssessment(inherited, direction, { sourceSong: source });
  const worseAssessment = producerVariationDirectionAssessment(worse, direction, { sourceSong: source });
  assert.equal(inheritedAssessment.registerSafe, true);
  assert.equal(worseAssessment.registerSafe, false);
});

test("Elements fail closed when every audition exceeds a role register ceiling", () => {
  const direction = ELEMENT_PROFILES[0];
  const high = scoreSong({ id: "all-high", overall: 99, role: 99, releasePassed: true }, direction);
  high.tracks.find((track) => track.id === "counterpoint").notes = [
    { pitch: 97, start: 0.5, duration: 0.5, velocity: 84 },
  ];
  const variations = generateProducerVariationSet(sourceSong(), { count: 1, candidatesPerVariation: 2 }, {
    generateSimilar() {
      return structuredClone(high);
    },
  });
  assert.deepEqual(variations, []);
});

test("an Element with no release-safe auditions fails closed instead of returning an unsafe card", () => {
  const direction = ELEMENT_PROFILES[0];
  const failed = scoreSong({ id: "failed", overall: 100, role: 100, releasePassed: false }, direction);
  const variations = generateProducerVariationSet(sourceSong(), { count: 1, candidatesPerVariation: 2 }, {
    generateSimilar() {
      return structuredClone(failed);
    },
  });
  assert.deepEqual(variations, []);
});
