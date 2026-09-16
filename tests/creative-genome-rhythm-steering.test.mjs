import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createCreativeGenome } from "../src/core/creative-genome.js";
import {
  applyCreativeGenomeRhythmSteering,
  CREATIVE_GENOME_RHYTHM_STEERING_VERSION,
} from "../src/core/creative-genome-rhythm-steering.js";
import { applyProducerBrainConfig } from "../src/core/producer-brain.js";
import { createSongFingerprint, generateNew } from "../src/music-engine.js";

const BASE = Object.freeze({
  genre: "hipHop",
  creativeRange: "fresh",
  seed: "phase9f-base",
  bars: 16,
  key: "A",
  scale: "minor",
  energy: 0.68,
  complexity: 0.54,
  variation: 0.42,
  evolution: 0.58,
  surprise: 0.28,
  syncopation: 0.5,
  swing: 0.08,
  humanize: 0.12,
  drumFills: 0.4,
  candidateCount: 1,
  repairAttempts: 2,
});

function genomeWith(overrides = {}) {
  return Object.freeze({
    ...createCreativeGenome(BASE, { consumedByComposition: true }),
    ...overrides,
  });
}

test("Phase 9F rhythm/performance steering is deterministic, bounded and preserves hard request controls", () => {
  const genome = genomeWith({ rhythmTopology: "syncopated", performanceFeel: "ghosted" });
  const before = structuredClone(BASE);
  const first = applyCreativeGenomeRhythmSteering(BASE, genome, { kind: "new", enabled: true });
  const repeated = applyCreativeGenomeRhythmSteering(BASE, genome, { kind: "new", enabled: true });

  assert.deepEqual(first, repeated);
  assert.deepEqual(BASE, before);
  assert.equal(first.diagnostics.version, CREATIVE_GENOME_RHYTHM_STEERING_VERSION);
  assert.equal(first.diagnostics.applied, true);
  assert.equal(first.diagnostics.reason, "rhythm-performance-priors");
  assert.equal(first.diagnostics.rhythmTopology, "syncopated");
  assert.equal(first.diagnostics.performanceFeel, "ghosted");
  assert.ok(first.config.syncopation > BASE.syncopation);
  assert.ok(first.config.humanize > BASE.humanize);
  assert.ok(first.config.drumFills > BASE.drumFills);
  assert.ok(first.config.syncopation >= 0 && first.config.syncopation <= 1);
  assert.ok(first.config.swing >= 0 && first.config.swing <= 0.72);
  assert.ok(first.config.humanize >= 0 && first.config.humanize <= 0.72);
  assert.ok(first.config.drumFills >= 0 && first.config.drumFills <= 1);
  assert.equal(first.config.seed, BASE.seed);
  assert.equal(first.config.key, BASE.key);
  assert.equal(first.config.scale, BASE.scale);
  assert.equal(first.config.bars, BASE.bars);
  assert.equal(first.config.candidateCount, BASE.candidateCount);
  assert.equal(first.config.repairAttempts, BASE.repairAttempts);
});

test("Rhythm Topology and Performance Feel produce distinct bounded prior signatures", () => {
  const lockedTight = applyCreativeGenomeRhythmSteering(
    BASE,
    genomeWith({ rhythmTopology: "locked", performanceFeel: "tight" }),
    { kind: "new", enabled: true },
  );
  const interlockingLaidBack = applyCreativeGenomeRhythmSteering(
    BASE,
    genomeWith({ rhythmTopology: "interlocking", performanceFeel: "laid-back" }),
    { kind: "new", enabled: true },
  );

  assert.notDeepEqual(lockedTight.diagnostics.scalarDeltas, interlockingLaidBack.diagnostics.scalarDeltas);
  assert.ok(lockedTight.diagnostics.scalarDeltas.humanize < 0);
  assert.ok(interlockingLaidBack.diagnostics.scalarDeltas.humanize > 0);
  assert.ok(interlockingLaidBack.diagnostics.scalarDeltas.syncopation > lockedTight.diagnostics.scalarDeltas.syncopation);
});

test("Similar receives a smaller Phase 9F feel envelope than New", () => {
  const genome = genomeWith({ rhythmTopology: "push-pull", performanceFeel: "pushed" });
  const fresh = applyCreativeGenomeRhythmSteering(BASE, genome, { kind: "new", enabled: true });
  const related = applyCreativeGenomeRhythmSteering(BASE, genome, { kind: "similar", enabled: true });

  assert.ok(fresh.diagnostics.strength > related.diagnostics.strength);
  assert.ok(Math.abs(fresh.diagnostics.scalarDeltas.syncopation) > Math.abs(related.diagnostics.scalarDeltas.syncopation));
  assert.ok(Math.abs(fresh.diagnostics.scalarDeltas.humanize) > Math.abs(related.diagnostics.scalarDeltas.humanize));
});

test("fusion protection and explicit opt-out fail closed before Phase 9F changes feel", () => {
  const genome = genomeWith({ rhythmTopology: "syncopated", performanceFeel: "ghosted" });
  const fusionConfig = { ...BASE, genre: "pop", secondaryGenre: "hipHop", fusionBlend: 0.5 };
  const fusion = applyCreativeGenomeRhythmSteering(fusionConfig, genome, { enabled: true });
  assert.equal(fusion.diagnostics.applied, false);
  assert.equal(fusion.diagnostics.reason, "fusion-contract-protected");
  assert.equal(fusion.config.syncopation, fusionConfig.syncopation);
  assert.equal(fusion.config.humanize, fusionConfig.humanize);

  const disabled = applyCreativeGenomeRhythmSteering(BASE, genome, { enabled: false });
  assert.equal(disabled.diagnostics.applied, false);
  assert.equal(disabled.diagnostics.reason, "disabled");
  assert.deepEqual(disabled.config, BASE);
});

test("Producer Brain publishes Phase 9F diagnostics only for explicit Creative Range consumption", () => {
  const active = applyProducerBrainConfig(BASE, { kind: "new" });
  assert.equal(active.creativeGenomeRhythmSteering.applied, true);
  assert.equal(active.creativeGenomeRhythmSteering.rhythmTopology, active.producerBrain.creativeGenome.rhythmTopology);
  assert.equal(active.creativeGenomeRhythmSteering.performanceFeel, active.producerBrain.creativeGenome.performanceFeel);
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
  assert.equal(neutral.creativeGenomeRhythmSteering.applied, false);
  assert.equal(neutral.creativeGenomeRhythmSteering.reason, "disabled");
  assert.equal(neutral.syncopation, neutralConfig.syncopation);
  assert.equal(neutral.swing, neutralConfig.swing);
  assert.equal(neutral.humanize, neutralConfig.humanize);
  assert.equal(neutral.drumFills, neutralConfig.drumFills);
});

test("Phase 9F changes real generated rhythm/performance for at least one deterministic seed", () => {
  let witness = null;
  for (let index = 0; index < 48 && !witness; index += 1) {
    const seed = `phase9f-output-${index}`;
    const config = { ...BASE, seed, creativeRange: "wild", candidateCount: 1 };
    const genome = createCreativeGenome(config, { kind: "new", consumedByComposition: true });
    const active = applyCreativeGenomeRhythmSteering(config, genome, { kind: "new", enabled: true }).config;
    const neutral = { ...config };
    const activeSong = generateNew(active);
    const neutralSong = generateNew(neutral);
    const activeFingerprint = createSongFingerprint(activeSong);
    const neutralFingerprint = createSongFingerprint(neutralSong);
    if (activeFingerprint !== neutralFingerprint) {
      witness = { active, neutral, activeFingerprint, neutralFingerprint };
    }
  }

  assert.ok(witness, "expected bounded Phase 9F priors to change a deterministic musical fingerprint");
  assert.notEqual(witness.activeFingerprint, witness.neutralFingerprint);
  assert.equal(witness.active.seed, witness.neutral.seed);
});

test("Phase 9F rhythm/performance steering contains no unseeded randomness", () => {
  const source = fs.readFileSync(new URL("../src/core/creative-genome-rhythm-steering.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Math\.random|crypto\.getRandomValues/);
});
