import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createCreativeGenome, CREATIVE_GENOME_VERSION } from "../src/core/creative-genome.js";
import { createProducerBrainPlan } from "../src/core/producer-brain.js";

const BASE = Object.freeze({
  genre: "hipHop",
  bars: 16,
  energy: 0.72,
  complexity: 0.58,
  variation: 0.52,
  evolution: 0.58,
  surprise: 0.28,
});

test("Creative Genome is exact-repeat deterministic and composition-neutral", () => {
  const config = { ...BASE, seed: "creative-genome-repeat" };
  const before = structuredClone(config);
  const first = createCreativeGenome(config, { kind: "new" });
  const second = createCreativeGenome(config, { kind: "new" });

  assert.deepEqual(first, second);
  assert.deepEqual(config, before, "genome planning must not mutate the request");
  assert.equal(first.version, CREATIVE_GENOME_VERSION);
  assert.equal(first.id, "creative-genome-v1");
  assert.equal(first.genre, "hipHop");
  assert.equal(first.creativeRange, "fresh");
  assert.match(first.signature, /^[0-9a-f]{8}$/);
  assert.equal(first.guardrails.compositionNeutral, true);
  assert.equal(first.guardrails.consumedByComposition, false);
  assert.equal(first.guardrails.preserveDeterminism, true);
  assert.equal(first.guardrails.preserveCandidateBudgets, true);
  assert.equal(first.guardrails.preserveCriticCalibration, true);
  assert.equal(first.guardrails.preserveMidiAndExport, true);
  assert.ok(first.surpriseBudget >= 0 && first.surpriseBudget <= 2);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.guardrails));
});

test("different deterministic seeds create meaningfully diverse strategy identities", () => {
  const genomes = Array.from({ length: 32 }, (_, index) => createCreativeGenome({
    ...BASE,
    seed: `creative-genome-diversity-${index}`,
  }));
  const signatures = new Set(genomes.map((genome) => genome.signature));
  const forms = new Set(genomes.map((genome) => genome.formArchetype));
  const spaces = new Set(genomes.map((genome) => genome.spaceStrategy));
  const rhythms = new Set(genomes.map((genome) => genome.rhythmTopology));
  const motifs = new Set(genomes.map((genome) => genome.motifMutation));

  assert.ok(signatures.size >= 24, `expected broad strategy diversity, got ${signatures.size}/32 unique signatures`);
  assert.ok(forms.size >= 4, `expected form diversity, got ${forms.size}`);
  assert.ok(spaces.size >= 4, `expected space-strategy diversity, got ${spaces.size}`);
  assert.ok(rhythms.size >= 4, `expected rhythm-topology diversity, got ${rhythms.size}`);
  assert.ok(motifs.size >= 5, `expected motif-mutation diversity, got ${motifs.size}`);
});

test("Creative Range is deterministic and familiar/fresh/wild remain explicit strategy modes", () => {
  const seed = "creative-range-contract";
  const familiar = createCreativeGenome({ ...BASE, seed, creativeRange: "familiar" });
  const fresh = createCreativeGenome({ ...BASE, seed, creativeRange: "fresh" });
  const wild = createCreativeGenome({ ...BASE, seed, creativeRange: "wild" });
  const invalid = createCreativeGenome({ ...BASE, seed, creativeRange: "unknown" });

  assert.equal(familiar.creativeRange, "familiar");
  assert.equal(fresh.creativeRange, "fresh");
  assert.equal(wild.creativeRange, "wild");
  assert.equal(invalid.creativeRange, "fresh");
  assert.deepEqual(familiar, createCreativeGenome({ ...BASE, seed, creativeRange: "familiar" }));
  assert.deepEqual(wild, createCreativeGenome({ ...BASE, seed, creativeRange: "wild" }));
  assert.ok(wild.surpriseBudget >= familiar.surpriseBudget, "wild must not have a smaller surprise budget for the same request");
});

test("Producer Brain publishes Creative Genome as request strategy metadata", () => {
  const plan = createProducerBrainPlan({
    ...BASE,
    seed: "producer-genome-integration",
    creativeRange: "wild",
    thinkingDepth: "deep",
  }, { kind: "new" });

  assert.equal(plan.version, 2, "Producer Brain result contract stays v2");
  assert.equal(plan.creativeGenome.version, CREATIVE_GENOME_VERSION);
  assert.equal(plan.creativeGenome.creativeRange, "wild");
  assert.equal(plan.creativeGenome.guardrails.consumedByComposition, false);
  assert.match(plan.creativeGenome.signature, /^[0-9a-f]{8}$/);
});

test("Creative Genome contains no unseeded random source", () => {
  const source = fs.readFileSync(new URL("../src/core/creative-genome.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Math\.random|crypto\.getRandomValues/);
});
