import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { adaptGenerationConfig } from "../src/core/adaptive-generation.js";
import { createCreativeGenome } from "../src/core/creative-genome.js";
import {
  CREATIVE_GENOME_MOTIF_STEERING_VERSION,
  resolveCreativeGenomeMotifStrategy,
} from "../src/core/creative-genome-motif-steering.js";
import { applyProducerBrainConfig } from "../src/core/producer-brain.js";
import { createSongFingerprint, generateNew } from "../src/music-engine.js";

const BASE = Object.freeze({
  genre: "hipHop",
  creativeRange: "fresh",
  seed: "phase9c-base",
  bars: 24,
  key: "A",
  scale: "minor",
  energy: 0.7,
  complexity: 0.58,
  variation: 0.56,
  evolution: 0.64,
  surprise: 0.32,
  candidateCount: 1,
  repairAttempts: 2,
});

function seedFor(predicate) {
  for (let index = 0; index < 1024; index += 1) {
    const seed = `phase9c-strategy-${index}`;
    const genome = createCreativeGenome({ ...BASE, seed });
    if (predicate(genome)) return { seed, genome };
  }
  assert.fail("expected deterministic seed for requested Phase 9C strategy");
}

function assertScaleSafe(song) {
  const mod12 = (value) => ((Math.round(value) % 12) + 12) % 12;
  const allowed = new Set(song.meta.scaleIntervals.map((interval) => mod12(song.meta.keyPc + interval)));
  for (const track of song.tracks) {
    for (const note of track.notes) {
      assert.ok(note.pitch >= 0 && note.pitch <= 127);
      assert.ok(note.velocity >= 1 && note.velocity <= 127);
      assert.ok(note.start >= 0);
      assert.ok(note.start + note.duration <= song.meta.totalBeats + 1e-5);
      if (track.id !== "drums") assert.ok(allowed.has(mod12(note.pitch)), `${track.id} pitch ${note.pitch} left the active scale`);
    }
  }
}

test("Phase 9C motif and spotlight strategy is deterministic, bounded and preserves hard controls", () => {
  const { seed } = seedFor((genome) => genome.motifMutation === "contour-rewrite" && genome.spotlightRotation === "bass-to-lead");
  const config = { ...BASE, seed };
  const before = structuredClone(config);
  const first = applyProducerBrainConfig(config, { kind: "new" });
  const repeated = applyProducerBrainConfig(config, { kind: "new" });

  assert.deepEqual(first, repeated);
  assert.deepEqual(config, before);
  assert.equal(first.creativeGenomeMotifSteering.version, CREATIVE_GENOME_MOTIF_STEERING_VERSION);
  assert.equal(first.creativeGenomeMotifSteering.applied, true);
  assert.equal(first.creativeMotifMutation, "contour-rewrite");
  assert.equal(first.creativeSpotlightRotation, "bass-to-lead");
  assert.ok(first.creativeMotifStrength > 0);
  assert.ok(first.creativeMotifMaxEvents >= 1 && first.creativeMotifMaxEvents <= 2);
  assert.equal(first.seed, config.seed);
  assert.equal(first.key, config.key);
  assert.equal(first.scale, config.scale);
  assert.equal(first.bars, config.bars);
  assert.equal(first.candidateCount, config.candidateCount);
  assert.equal(first.repairAttempts, config.repairAttempts);
  assert.deepEqual(first.producerBrain.creativeGenome.guardrails.consumedFields, [
    "energyArc",
    "spaceStrategy",
    "motifMutation",
    "spotlightRotation",
  ]);
});

test("Similar gets a smaller Phase 9C mutation envelope than New", () => {
  const { seed } = seedFor((genome) => !["literal-recall", "instrument-handoff"].includes(genome.motifMutation));
  const config = { ...BASE, seed, creativeRange: "fresh" };
  const fresh = applyProducerBrainConfig(config, { kind: "new" });
  const related = applyProducerBrainConfig(config, { kind: "similar" });

  assert.ok(fresh.creativeGenomeMotifSteering.strength > related.creativeGenomeMotifSteering.strength);
  assert.equal(fresh.creativeMotifMaxEvents, 2);
  assert.equal(related.creativeMotifMaxEvents, 1);
  assert.equal(related.producerBrain.qualityIntent.preserveSongFamily, true);
});

test("instrument-handoff cannot collapse into a lead-led no-op", () => {
  const genome = Object.freeze({
    ...createCreativeGenome({ ...BASE, seed: "phase9c-handoff-noop" }),
    motifMutation: "instrument-handoff",
    spotlightRotation: "lead-led",
  });
  const result = resolveCreativeGenomeMotifStrategy(BASE, genome, { kind: "new", enabled: true });

  assert.equal(result.strategy.motifMutation, "instrument-handoff");
  assert.equal(result.strategy.spotlightRotation, "section-rotation");
  assert.equal(result.strategy.maxMutationEvents, 0);
  assert.equal(result.diagnostics.requestedSpotlightRotation, "lead-led");
});

test("fusion and explicit opt-out fail closed before Phase 9C reaches the engine", () => {
  const fusion = applyProducerBrainConfig({
    ...BASE,
    genre: "pop",
    secondaryGenre: "hipHop",
    fusionBlend: 0.5,
  }, { kind: "new" });
  assert.equal(fusion.creativeGenomeMotifSteering.applied, false);
  assert.equal(fusion.creativeGenomeMotifSteering.reason, "fusion-contract-protected");
  assert.equal(fusion.creativeMotifMutation, undefined);
  assert.equal(fusion.creativeSpotlightRotation, undefined);

  const disabled = applyProducerBrainConfig({ ...BASE, creativeGenomeSteering: false }, { kind: "new" });
  assert.equal(disabled.creativeGenomeMotifSteering.applied, false);
  assert.equal(disabled.creativeGenomeMotifSteering.reason, "disabled");
  assert.equal(disabled.creativeMotifMutation, undefined);
  assert.equal(disabled.creativeSpotlightRotation, undefined);
});

test("ordinary requests remain free of Phase 9C engine tokens", () => {
  const config = { ...BASE, seed: "phase9c-neutral" };
  delete config.creativeRange;
  const result = applyProducerBrainConfig(config, { kind: "new" });

  assert.equal(result.creativeGenomeMotifSteering.applied, false);
  assert.equal(result.creativeMotifMutation, undefined);
  assert.equal(result.creativeSpotlightRotation, undefined);
  assert.equal(result.producerBrain.creativeGenome.guardrails.compositionNeutral, true);
});

test("Phase 9C motif mutation changes real music through the existing hook machinery", () => {
  const { seed } = seedFor((genome) => genome.motifMutation === "contour-rewrite");
  const steered = adaptGenerationConfig({
    ...BASE,
    seed,
    bars: 32,
    candidateCount: 1,
  }, { kind: "new" });
  assert.equal(steered.creativeGenomeMotifSteering.applied, true);
  assert.equal(steered.creativeMotifMutation, "contour-rewrite");

  const neutral = { ...steered };
  delete neutral.creativeMotifMutation;
  delete neutral.creativeSpotlightRotation;
  delete neutral.creativeMotifStrength;
  delete neutral.creativeMotifMaxEvents;

  const activeSong = generateNew(steered);
  const neutralSong = generateNew(neutral);
  assert.notEqual(createSongFingerprint(activeSong), createSongFingerprint(neutralSong));
  assert.equal(activeSong.motifs.creativeGenomeMutation?.mode, "contour-rewrite");
  assert.ok(activeSong.motifs.creativeGenomeMutation?.changedEvents >= 1);
  assert.ok(activeSong.motifs.creativeGenomeMutation?.changedEvents <= 2);
  assertScaleSafe(activeSong);
});

test("Phase 9C spotlight steering moves a proven first return through native orchestration and handoff machinery", () => {
  const input = {
    genre: "pop",
    seed: "section-contrast-pop",
    bars: 32,
    energy: 0.76,
    evolution: 0.84,
    candidateCount: 1,
    creativeSpotlightRotation: "bass-to-lead",
    creativeMotifStrength: 1,
    creativeMotifMaxEvents: 0,
  };
  const song = generateNew(input);
  const firstByName = new Map();
  const firstCoreReturns = [];

  for (const entry of song.orchestrationMatrix) {
    const first = firstByName.get(entry.sectionName);
    if (!first) {
      firstByName.set(entry.sectionName, entry);
      continue;
    }
    if (["verse", "chorus", "theme", "idea"].includes(entry.sectionName) && entry.featureOccurrence === 1) {
      firstCoreReturns.push(entry);
    }
  }

  assert.ok(firstCoreReturns.length > 0, "fixture must contain a repeated core return");
  assert.ok(firstCoreReturns.every((entry) => entry.featuredTrack === "bass"));
  assert.ok(song.tracks.flatMap((track) => track.notes).some((note) => note.motifHandoffRole?.endsWith("-to-bass")));
  assert.equal(song.sectionContrast.phase, 68);
  assert.equal(song.motifHandoff.phase, 69);
  assertScaleSafe(song);
});

test("Phase 9C strategy source contains no unseeded randomness", () => {
  const source = fs.readFileSync(new URL("../src/core/creative-genome-motif-steering.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Math\.random|crypto\.getRandomValues/);
});
