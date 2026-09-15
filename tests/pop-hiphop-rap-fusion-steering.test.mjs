import assert from "node:assert/strict";
import test from "node:test";
import { adaptGenerationConfig, generationCharacter } from "../src/core/adaptive-generation.js";
import {
  fusionCharacter,
  fusionDevelopment,
  popHipHopRapFusionContext,
} from "../src/core/genre-fusion-steering.js";
import {
  applyOutputQualityEvolution,
  createOutputQualityProfile,
  outputQualityDevelopment,
} from "../src/core/output-quality-evolution.js";

const PAIRS = [
  ["pop", "hipHop"],
  ["pop", "rap"],
  ["hipHop", "rap"],
];
const numericProfile = (profile) => Object.fromEntries(Object.entries(profile).filter(([, value]) => Number.isFinite(Number(value))));

function complementary(primary, secondary, blend) {
  const a = { genre: primary, secondaryGenre: secondary, fusionBlend: blend, seed: "fusion-symmetry" };
  const b = { genre: secondary, secondaryGenre: primary, fusionBlend: 1 - blend, seed: "fusion-symmetry" };
  return [a, b];
}

test("target fusion context is bounded, complementary and endpoint-safe", () => {
  for (const [primary, secondary] of PAIRS) {
    const middle = popHipHopRapFusionContext({ genre: primary, secondaryGenre: secondary, fusionBlend: 0.5 });
    assert.equal(middle.balanceStrength, 1);
    const left = fusionCharacter({ genre: primary, secondaryGenre: secondary, fusionBlend: 0 }, generationCharacter);
    const right = fusionCharacter({ genre: primary, secondaryGenre: secondary, fusionBlend: 1 }, generationCharacter);
    assert.deepEqual(left, generationCharacter(primary));
    assert.deepEqual(right, generationCharacter(secondary));
  }
  assert.equal(popHipHopRapFusionContext({ genre: "jazz", secondaryGenre: "rap", fusionBlend: 0.5 }), null);
  assert.equal(popHipHopRapFusionContext({ genre: "pop", secondaryGenre: "pop", fusionBlend: 0.5 }), null);
});

test("complementary Pop Hip-Hop Rap directions receive equivalent hybrid character", () => {
  for (const [primary, secondary] of PAIRS) {
    const [a, b] = complementary(primary, secondary, 0.35);
    assert.deepEqual(
      fusionCharacter(a, generationCharacter),
      fusionCharacter(b, generationCharacter),
      `${primary}+${secondary} should not depend on which parent is labeled primary`,
    );
    assert.deepEqual(
      fusionDevelopment(a, outputQualityDevelopment),
      fusionDevelopment(b, outputQualityDevelopment),
    );
  }
});

test("hybrid role steering keeps Pop hooks, Hip-Hop pocket and Rap space represented", () => {
  const popHipHop = fusionCharacter({ genre: "pop", secondaryGenre: "hipHop", fusionBlend: 0.5 }, generationCharacter);
  assert.ok(popHipHop.melodyMotion > (generationCharacter("pop").melodyMotion + generationCharacter("hipHop").melodyMotion) / 2);
  assert.ok(popHipHop.grooveDepth > (generationCharacter("pop").grooveDepth + generationCharacter("hipHop").grooveDepth) / 2);
  assert.ok(popHipHop.bassMotion > (generationCharacter("pop").bassMotion + generationCharacter("hipHop").bassMotion) / 2);

  const popRap = fusionCharacter({ genre: "pop", secondaryGenre: "rap", fusionBlend: 0.5 }, generationCharacter);
  assert.ok(popRap.melodyMotion > (generationCharacter("pop").melodyMotion + generationCharacter("rap").melodyMotion) / 2);
  assert.ok(popRap.space > (generationCharacter("pop").space + generationCharacter("rap").space) / 2);

  const hipHopRap = fusionDevelopment({ genre: "hipHop", secondaryGenre: "rap", fusionBlend: 0.5 }, outputQualityDevelopment);
  assert.ok(hipHopRap.grooveEvolution > (outputQualityDevelopment("hipHop").grooveEvolution + outputQualityDevelopment("rap").grooveEvolution) / 2);
  assert.ok(hipHopRap.breathingRoom > (outputQualityDevelopment("hipHop").breathingRoom + outputQualityDevelopment("rap").breathingRoom) / 2);
  assert.ok(hipHopRap.repetitionGuard > Math.max(outputQualityDevelopment("hipHop").repetitionGuard, outputQualityDevelopment("rap").repetitionGuard));
});

test("adaptive and Phase 6 profiles both honor the secondary genre without touching unrelated fusions", () => {
  for (const [primary, secondary] of PAIRS) {
    const [a, b] = complementary(primary, secondary, 0.35);
    const adaptedA = adaptGenerationConfig(a);
    const adaptedB = adaptGenerationConfig(b);
    assert.deepEqual(adaptedA.adaptiveTaste.character, adaptedB.adaptiveTaste.character);

    const qualityA = createOutputQualityProfile(a);
    const qualityB = createOutputQualityProfile(b);
    assert.deepEqual(numericProfile(qualityA), numericProfile(qualityB));
    assert.ok(qualityA.fusion);
    assert.ok(qualityB.fusion);
  }

  const unrelated = { genre: "jazz", secondaryGenre: "rap", fusionBlend: 0.5, seed: "unrelated-fusion" };
  const quality = createOutputQualityProfile(unrelated);
  assert.equal(quality.fusion, null);
  const expected = createOutputQualityProfile({ genre: "jazz", seed: "unrelated-fusion" });
  assert.deepEqual(numericProfile(quality), numericProfile(expected));
});

test("fusion steering remains deterministic, bounded and preserves explicit quality switches", () => {
  const config = {
    genre: "pop",
    secondaryGenre: "rap",
    fusionBlend: 0.5,
    seed: "fusion-bounds",
    arrangementEvolution: false,
    returnDevelopment: false,
    densityRefinement: false,
    repetitionRefinement: false,
    genreIdentityRefinement: false,
    groovePocketRefinement: false,
  };
  assert.deepEqual(adaptGenerationConfig(config), adaptGenerationConfig(config));
  const evolved = applyOutputQualityEvolution(config);
  for (const key of ["variation", "evolution", "surprise", "syncopation", "drumFills", "harmonicRhythm"]) {
    assert.ok(evolved[key] >= 0 && evolved[key] <= 1, `${key} must remain bounded`);
  }
  for (const key of ["arrangementEvolution", "returnDevelopment", "densityRefinement", "repetitionRefinement", "genreIdentityRefinement", "groovePocketRefinement"]) {
    assert.equal(evolved[key], false, `${key} explicit opt-out must remain authoritative`);
  }
});
