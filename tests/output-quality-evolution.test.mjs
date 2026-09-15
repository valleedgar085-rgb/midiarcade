import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createGenerationExecutor } from "../src/core/generation-executor.js";
import {
  applyOutputQualityEvolution,
  createOutputQualityProfile,
  outputQualityDevelopment,
} from "../src/core/output-quality-evolution.js";

const BASE = {
  seed: "phase6a-quality-proof",
  genre: "techno",
  variation: 0.48,
  evolution: 0.52,
  surprise: 0.24,
  syncopation: 0.46,
  drumFills: 0.36,
  harmonicRhythm: 0.42,
  tracks: {
    drums: { density: 0.7, variation: 0.44, feel: 0.86 },
    bass: { density: 0.58, variation: 0.4, feel: 0.82 },
    melody: { density: 0.56, variation: 0.46, feel: 0.6 },
    counterpoint: { density: 0.36, variation: 0.48, feel: 0.5 },
    chords: { density: 0.52, variation: 0.34, feel: 0.62 },
    pad: { density: 0.5, variation: 0.28, feel: 0.2 },
  },
};

test("Phase 6A quality profile is deterministic, seed-aware, and genre-aware", () => {
  const first = createOutputQualityProfile(BASE);
  const repeated = createOutputQualityProfile(BASE);
  const differentSeed = createOutputQualityProfile({ ...BASE, seed: "phase6a-quality-proof-b" });

  assert.deepEqual(first, repeated);
  assert.notEqual(first.seedSignature, differentSeed.seedSignature);
  assert.ok(first.repetitionGuard >= 0.9, "techno should aggressively guard against perceptual cloning");
  assert.ok(outputQualityDevelopment("techno").sectionMotion > outputQualityDevelopment("ambient").sectionMotion);
  assert.ok(outputQualityDevelopment("popRadio").melodicContrast > outputQualityDevelopment("techno").melodicContrast);
});

test("quality evolution raises development while creating breathing room instead of only adding notes", () => {
  const input = structuredClone(BASE);
  const before = structuredClone(input);
  const result = applyOutputQualityEvolution(input);

  assert.deepEqual(input, before, "Phase 6A must not mutate caller configuration");
  assert.ok(result.variation > BASE.variation);
  assert.ok(result.evolution > BASE.evolution);
  assert.ok(result.syncopation > BASE.syncopation);
  assert.ok(result.drumFills > BASE.drumFills);
  assert.ok(result.tracks.drums.variation > BASE.tracks.drums.variation);
  assert.ok(result.tracks.bass.variation > BASE.tracks.bass.variation);
  assert.ok(result.tracks.melody.variation > BASE.tracks.melody.variation);
  assert.ok(result.tracks.melody.density < BASE.tracks.melody.density, "lead development should include rests and breathing room");
  assert.ok(result.tracks.counterpoint.density < BASE.tracks.counterpoint.density, "counter lines should leave foreground space");
  assert.equal(result.outputQuality.version, 1);
});

test("all Phase 6A steering remains bounded under adversarial controls", () => {
  const result = applyOutputQualityEvolution({
    ...BASE,
    variation: 99,
    evolution: -99,
    surprise: 99,
    syncopation: 99,
    drumFills: -99,
    harmonicRhythm: 99,
    tracks: Object.fromEntries(Object.entries(BASE.tracks).map(([id, track]) => [id, {
      ...track,
      density: id === "melody" ? -99 : 99,
      variation: 99,
      feel: -99,
    }])),
  });

  for (const key of ["variation", "evolution", "surprise", "syncopation", "drumFills", "harmonicRhythm"]) {
    assert.ok(result[key] >= 0 && result[key] <= 1, `${key} must stay normalized`);
  }
  for (const [trackId, track] of Object.entries(result.tracks)) {
    for (const key of ["density", "variation", "feel"]) {
      assert.ok(track[key] >= 0 && track[key] <= 1, `${trackId}.${key} must stay normalized`);
    }
  }
});

test("Similar receives the same quality system without losing family-preserving restraint", () => {
  const fresh = createOutputQualityProfile(BASE, { kind: "new" });
  const related = createOutputQualityProfile(BASE, { kind: "similar" });
  assert.equal(related.kind, "similar");
  assert.notEqual(fresh.seedSignature, related.seedSignature);
  assert.ok(Math.abs(related.grooveEvolution - outputQualityDevelopment("techno").grooveEvolution) <= 0.012);
  assert.ok(Math.abs(related.phraseDevelopment - outputQualityDevelopment("techno").phraseDevelopment) <= 0.012);
});

test("generation executor applies Phase 6A exactly once before worker or fallback execution", async () => {
  let received;
  const executor = createGenerationExecutor({
    fallback(kind, payload) {
      received = { kind, payload };
      return { status: "committed", song: { id: "phase6a" } };
    },
  });
  const caller = { config: structuredClone(BASE) };
  const before = structuredClone(caller);
  await executor.run("new", caller);

  assert.deepEqual(caller, before);
  assert.equal(received.kind, "new");
  assert.equal(received.payload.config.outputQuality.version, 1);
  assert.ok(received.payload.config.outputQuality.seedSignature);
  assert.ok(received.payload.config.variation > BASE.variation);
});

test("Phase 6A quality steering has no unseeded randomness", () => {
  const source = fs.readFileSync(new URL("../src/core/output-quality-evolution.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /Math\.random/);
});
