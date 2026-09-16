import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createCreativeGenome } from "../src/core/creative-genome.js";
import {
  applyCreativeGenomeSurpriseSteering,
  CREATIVE_GENOME_SURPRISE_STEERING_VERSION,
} from "../src/core/creative-genome-surprise-steering.js";
import { applyProducerBrainConfig } from "../src/core/producer-brain.js";
import { createSongFingerprint, generateNew } from "../src/music-engine.js";

const BASE = Object.freeze({
  genre: "hipHop",
  creativeRange: "fresh",
  seed: "phase9g-base",
  bars: 16,
  key: "A",
  scale: "minor",
  energy: 0.68,
  complexity: 0.54,
  variation: 0.42,
  evolution: 0.58,
  surprise: 0.28,
  candidateCount: 1,
  repairAttempts: 2,
});

function genomeWith(overrides = {}) {
  return Object.freeze({
    ...createCreativeGenome(BASE, { consumedByComposition: true }),
    ...overrides,
  });
}

test("Phase 9G Surprise Budget steering is deterministic, bounded and preserves hard request controls", () => {
  const genome = genomeWith({ creativeRange: "wild", surpriseBudget: 2 });
  const before = structuredClone(BASE);
  const first = applyCreativeGenomeSurpriseSteering(BASE, genome, { kind: "new", enabled: true });
  const repeated = applyCreativeGenomeSurpriseSteering(BASE, genome, { kind: "new", enabled: true });

  assert.deepEqual(first, repeated);
  assert.deepEqual(BASE, before);
  assert.equal(first.diagnostics.version, CREATIVE_GENOME_SURPRISE_STEERING_VERSION);
  assert.equal(first.diagnostics.applied, true);
  assert.equal(first.diagnostics.reason, "surprise-budget-prior");
  assert.equal(first.diagnostics.surpriseBudget, 2);
  assert.ok(first.config.surprise > BASE.surprise);
  assert.ok(first.config.surprise >= 0 && first.config.surprise <= 1);
  assert.equal(first.config.seed, BASE.seed);
  assert.equal(first.config.key, BASE.key);
  assert.equal(first.config.scale, BASE.scale);
  assert.equal(first.config.bars, BASE.bars);
  assert.equal(first.config.candidateCount, BASE.candidateCount);
  assert.equal(first.config.repairAttempts, BASE.repairAttempts);
});

test("Surprise Budget exposes restrained, neutral and adventurous bounded priors", () => {
  const restrained = applyCreativeGenomeSurpriseSteering(
    BASE,
    genomeWith({ surpriseBudget: 0 }),
    { kind: "new", enabled: true },
  );
  const neutral = applyCreativeGenomeSurpriseSteering(
    BASE,
    genomeWith({ surpriseBudget: 1 }),
    { kind: "new", enabled: true },
  );
  const adventurous = applyCreativeGenomeSurpriseSteering(
    BASE,
    genomeWith({ surpriseBudget: 2 }),
    { kind: "new", enabled: true },
  );

  assert.ok(restrained.diagnostics.surpriseDelta < 0);
  assert.equal(neutral.diagnostics.surpriseDelta, 0);
  assert.ok(adventurous.diagnostics.surpriseDelta > 0);
  assert.ok(restrained.config.surprise < neutral.config.surprise);
  assert.ok(neutral.config.surprise < adventurous.config.surprise);
});

test("Similar receives a smaller Phase 9G surprise envelope than New", () => {
  const genome = genomeWith({ creativeRange: "wild", surpriseBudget: 2 });
  const fresh = applyCreativeGenomeSurpriseSteering(BASE, genome, { kind: "new", enabled: true });
  const related = applyCreativeGenomeSurpriseSteering(BASE, genome, { kind: "similar", enabled: true });

  assert.ok(fresh.diagnostics.strength > related.diagnostics.strength);
  assert.ok(Math.abs(fresh.diagnostics.surpriseDelta) > Math.abs(related.diagnostics.surpriseDelta));
  assert.equal(fresh.config.seed, related.config.seed);
});

test("fusion protection and explicit opt-out fail closed before Phase 9G changes surprise", () => {
  const genome = genomeWith({ surpriseBudget: 2 });
  const fusionConfig = { ...BASE, genre: "pop", secondaryGenre: "hipHop", fusionBlend: 0.5 };
  const fusion = applyCreativeGenomeSurpriseSteering(fusionConfig, genome, { enabled: true });
  assert.equal(fusion.diagnostics.applied, false);
  assert.equal(fusion.diagnostics.reason, "fusion-contract-protected");
  assert.equal(fusion.config.surprise, fusionConfig.surprise);

  const disabled = applyCreativeGenomeSurpriseSteering(BASE, genome, { enabled: false });
  assert.equal(disabled.diagnostics.applied, false);
  assert.equal(disabled.diagnostics.reason, "disabled");
  assert.deepEqual(disabled.config, BASE);
});

test("Producer Brain publishes Phase 9G diagnostics only for explicit Creative Range consumption", () => {
  const active = applyProducerBrainConfig(BASE, { kind: "new" });
  assert.equal(active.creativeGenomeSurpriseSteering.applied, true);
  assert.equal(active.creativeGenomeSurpriseSteering.surpriseBudget, active.producerBrain.creativeGenome.surpriseBudget);
  assert.deepEqual(active.producerBrain.creativeGenome.guardrails.consumedFields, [
    "energyArc",
    "spaceStrategy",
    "motifMutation",
    "spotlightRotation",
    "rhythmTopology",
    "performanceFeel",
    "surpriseBudget",
  ]);

  const neutralConfig = { ...BASE };
  delete neutralConfig.creativeRange;
  const neutral = applyProducerBrainConfig(neutralConfig, { kind: "new" });
  assert.equal(neutral.creativeGenomeSurpriseSteering.applied, false);
  assert.equal(neutral.creativeGenomeSurpriseSteering.reason, "disabled");
});

test("Phase 9G changes real generated music for at least one deterministic seed", () => {
  let witness = null;
  for (let index = 0; index < 96 && !witness; index += 1) {
    const seed = `phase9g-output-${index}`;
    const config = { ...BASE, seed, creativeRange: "wild", surprise: 0.48 };
    const genome = Object.freeze({
      ...createCreativeGenome(config, { kind: "new", consumedByComposition: true }),
      surpriseBudget: 2,
    });
    const active = applyCreativeGenomeSurpriseSteering(config, genome, { kind: "new", enabled: true }).config;
    const neutral = { ...config };
    const activeSong = generateNew(active);
    const neutralSong = generateNew(neutral);
    const activeFingerprint = createSongFingerprint(activeSong);
    const neutralFingerprint = createSongFingerprint(neutralSong);
    if (activeFingerprint !== neutralFingerprint) {
      witness = { active, neutral, activeFingerprint, neutralFingerprint };
    }
  }

  assert.ok(witness, "expected bounded Phase 9G surprise steering to change a deterministic musical fingerprint");
  assert.notEqual(witness.activeFingerprint, witness.neutralFingerprint);
  assert.equal(witness.active.seed, witness.neutral.seed);
});

test("Phase 9G Surprise Budget steering contains no unseeded randomness", () => {
  const source = fs.readFileSync(new URL("../src/core/creative-genome-surprise-steering.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Math\.random|crypto\.getRandomValues/);
});
