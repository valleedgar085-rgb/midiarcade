import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { adaptGenerationConfig } from "../src/core/adaptive-generation.js";
import { createCreativeGenome } from "../src/core/creative-genome.js";
import {
  applyCreativeGenomeSteering,
  CREATIVE_GENOME_STEERING_VERSION,
} from "../src/core/creative-genome-steering.js";
import { applyProducerBrainConfig } from "../src/core/producer-brain.js";
import { createSongFingerprint, generateNew } from "../src/music-engine.js";

const TRACKS = Object.freeze({
  drums: Object.freeze({ density: 0.72, variation: 0.58 }),
  bass: Object.freeze({ density: 0.62, variation: 0.4 }),
  chords: Object.freeze({ density: 0.58, variation: 0.38 }),
  melody: Object.freeze({ density: 0.64, variation: 0.5 }),
  counterpoint: Object.freeze({ density: 0.38, variation: 0.55 }),
  pad: Object.freeze({ density: 0.82, variation: 0.28 }),
});

const BASE = Object.freeze({
  genre: "hipHop",
  creativeRange: "fresh",
  seed: "phase9b-base",
  bars: 16,
  key: "A",
  scale: "minor",
  energy: 0.68,
  complexity: 0.54,
  variation: 0.42,
  evolution: 0.58,
  surprise: 0.28,
  drumFills: 0.4,
  candidateCount: 5,
  repairAttempts: 2,
  tracks: TRACKS,
});

function seedFor(predicate) {
  for (let index = 0; index < 512; index += 1) {
    const seed = `phase9b-strategy-${index}`;
    const genome = createCreativeGenome({ ...BASE, seed });
    if (predicate(genome)) return { seed, genome };
  }
  assert.fail("expected deterministic seed for requested Creative Genome strategy");
}

test("Phase 9B Energy Arc + Space Strategy steering is deterministic, bounded and preserves hard request controls", () => {
  const { seed } = seedFor((genome) => genome.spaceStrategy === "vacuum-before-payoff");
  const config = { ...BASE, seed };
  const before = structuredClone(config);
  const first = applyProducerBrainConfig(config, { kind: "new" });
  const repeated = applyProducerBrainConfig(config, { kind: "new" });

  assert.deepEqual(first, repeated, "same seed/config must produce identical steering");
  assert.deepEqual(config, before, "steering must not mutate caller config");
  assert.equal(first.creativeGenomeSteering.version, CREATIVE_GENOME_STEERING_VERSION);
  assert.equal(first.creativeGenomeSteering.applied, true);
  assert.equal(first.producerBrain.creativeGenome.guardrails.consumedByComposition, true);
  assert.deepEqual(first.producerBrain.creativeGenome.guardrails.consumedFields, [
    "energyArc",
    "spaceStrategy",
    "motifMutation",
    "spotlightRotation",
    "rhythmTopology",
    "performanceFeel",
  ]);
  assert.equal(first.seed, config.seed);
  assert.equal(first.key, config.key);
  assert.equal(first.scale, config.scale);
  assert.equal(first.bars, config.bars);
  assert.equal(first.candidateCount, config.candidateCount);
  assert.equal(first.repairAttempts, config.repairAttempts);
  assert.ok(Object.keys(first.creativeGenomeSteering.scalarDeltas).length > 0);
  assert.ok(Object.keys(first.creativeGenomeSteering.trackDensityDeltas).length > 0);
  for (const settings of Object.values(first.tracks)) {
    assert.ok(settings.density >= 0.08 && settings.density <= 1);
  }
});

test("Space Strategy changes support density without directly rewriting melody density", () => {
  const { seed } = seedFor((genome) => genome.spaceStrategy === "strategic-dropouts");
  const result = applyProducerBrainConfig({ ...BASE, seed }, { kind: "new" });
  const diagnostics = result.creativeGenomeSteering;

  assert.equal(diagnostics.spaceStrategy, "strategic-dropouts");
  assert.ok(diagnostics.trackDensityDeltas.chords < 0);
  assert.ok(diagnostics.trackDensityDeltas.counterpoint < 0);
  assert.ok(diagnostics.trackDensityDeltas.pad < 0);
  assert.equal(diagnostics.trackDensityDeltas.melody, undefined);
  assert.equal(result.tracks.melody.density, BASE.tracks.melody.density);
});

test("Similar uses a smaller Genome steering envelope than New", () => {
  const { seed } = seedFor((genome) => genome.energyArc === "two-waves");
  const config = { ...BASE, seed };
  const fresh = applyProducerBrainConfig(config, { kind: "new" });
  const related = applyProducerBrainConfig(config, { kind: "similar" });

  assert.ok(fresh.creativeGenomeSteering.strength > related.creativeGenomeSteering.strength);
  assert.equal(related.producerBrain.qualityIntent.preserveSongFamily, true);
  assert.equal(related.seed, fresh.seed);
});

test("fusion calibration defers audible Genome steering instead of weakening parent contracts", () => {
  const config = {
    ...BASE,
    seed: "phase9b-fusion-protection",
    genre: "pop",
    secondaryGenre: "hipHop",
    fusionBlend: 0.5,
  };
  const result = applyProducerBrainConfig(config, { kind: "new" });

  assert.equal(result.creativeGenomeSteering.applied, false);
  assert.equal(result.creativeGenomeSteering.reason, "fusion-contract-protected");
  assert.equal(result.producerBrain.creativeGenome.guardrails.consumedByComposition, false);
  assert.equal(result.energy, config.energy);
  assert.equal(result.complexity, config.complexity);
  assert.equal(result.variation, config.variation);
  assert.deepEqual(result.tracks, config.tracks);
});

test("ordinary requests stay composition-neutral until Creative Range is explicitly selected", () => {
  const config = { ...BASE, seed: "phase9b-neutral-default" };
  delete config.creativeRange;
  const result = applyProducerBrainConfig(config, { kind: "new" });

  assert.equal(result.creativeGenomeSteering.applied, false);
  assert.equal(result.creativeGenomeSteering.reason, "disabled");
  assert.equal(result.producerBrain.creativeGenome.guardrails.compositionNeutral, true);
  assert.equal(result.energy, config.energy);
  assert.equal(result.evolution, config.evolution);
  assert.deepEqual(result.tracks, config.tracks);
});

test("explicit Genome steering opt-out keeps composition priors unchanged", () => {
  const config = { ...BASE, seed: "phase9b-opt-out", creativeGenomeSteering: false };
  const result = applyProducerBrainConfig(config, { kind: "new" });

  assert.equal(result.creativeGenomeSteering.applied, false);
  assert.equal(result.creativeGenomeSteering.reason, "disabled");
  assert.equal(result.producerBrain.creativeGenome.guardrails.compositionNeutral, true);
  assert.equal(result.energy, config.energy);
  assert.equal(result.evolution, config.evolution);
  assert.deepEqual(result.tracks, config.tracks);
});

test("adaptive generation routes explicit Creative Range requests through Phase 9B steering", () => {
  const { seed } = seedFor((genome) => genome.spaceStrategy === "breathing");
  const adapted = adaptGenerationConfig({ ...BASE, seed }, { kind: "new" });
  assert.equal(adapted.creativeGenomeSteering.applied, true);
  assert.equal(adapted.producerBrain.creativeGenome.guardrails.consumedByComposition, true);
  assert.equal(adapted.creativeGenomeSteering.spaceStrategy, "breathing");
});

test("Creative Range can produce distinct deterministic musical output from the same seed", () => {
  let witness = null;
  for (let index = 0; index < 96 && !witness; index += 1) {
    const seed = `phase9b-range-output-${index}`;
    const familiar = adaptGenerationConfig({ ...BASE, seed, creativeRange: "familiar", candidateCount: 1 }, { kind: "new" });
    const wild = adaptGenerationConfig({ ...BASE, seed, creativeRange: "wild", candidateCount: 1 }, { kind: "new" });
    if (JSON.stringify(familiar.creativeGenomeSteering.scalarDeltas) === JSON.stringify(wild.creativeGenomeSteering.scalarDeltas)
      && JSON.stringify(familiar.creativeGenomeSteering.trackDensityDeltas) === JSON.stringify(wild.creativeGenomeSteering.trackDensityDeltas)) continue;
    const familiarSong = generateNew(familiar);
    const wildSong = generateNew(wild);
    const familiarFingerprint = createSongFingerprint(familiarSong);
    const wildFingerprint = createSongFingerprint(wildSong);
    if (familiarFingerprint !== wildFingerprint) witness = { familiar, wild, familiarFingerprint, wildFingerprint };
  }

  assert.ok(witness, "expected at least one deterministic seed where Creative Range changes the musical fingerprint");
  assert.notEqual(witness.familiarFingerprint, witness.wildFingerprint);
  assert.equal(witness.familiar.seed, witness.wild.seed);
});

test("Phase 9B steering contains no unseeded randomness and direct helper keeps fusion fail-closed", () => {
  const source = fs.readFileSync(new URL("../src/core/creative-genome-steering.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Math\.random|crypto\.getRandomValues/);

  const genome = createCreativeGenome(BASE, { consumedByComposition: true });
  const protectedResult = applyCreativeGenomeSteering({ ...BASE, genre: "pop", secondaryGenre: "rap" }, genome, { enabled: true });
  assert.equal(protectedResult.diagnostics.applied, false);
  assert.equal(protectedResult.diagnostics.reason, "fusion-contract-protected");
});
