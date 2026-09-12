import test from "node:test";
import assert from "node:assert/strict";
import {
  createSongDNA,
  sameSongDNAFamily,
  songDNASection,
} from "../src/core/song-dna.js";
import { generateNew, generateSimilar } from "../src/music-engine.js";

const BASE = {
  genre: "trap",
  bpm: 140,
  key: "F#",
  scale: "harmonicMinor",
  seed: "dna-core-seed",
  narrativeId: "lift-release",
  styleAnchor: {
    drumGroove: "halfTime",
    bassGroove: "syncopated",
    chordMotion: "sustained",
    melodyShape: "arch",
  },
  syncopation: 0.66,
  swing: 0.06,
  melodicRange: 12,
  phraseBars: 4,
  structure: [
    { id: "intro-1", name: "intro", bars: 2, intensity: 0.58 },
    { id: "verse-1", name: "verse", bars: 4, intensity: 0.78 },
    { id: "chorus-1", name: "chorus", bars: 4, intensity: 1.12 },
    { id: "verse-2", name: "verse", bars: 4, intensity: 0.78 },
  ],
};

test("Song DNA v2 is pure and deterministic", () => {
  const first = createSongDNA(BASE);
  const second = createSongDNA(BASE);
  assert.deepEqual(first, second);
  assert.equal(first.version, 2);
  assert.match(first.id, /^dna-/);
  assert.match(first.familyId, /^dna-family-/);
  assert.equal(first.identity.genre, "trap");
  assert.equal(first.melodic.direction === 1 || first.melodic.direction === -1, true);
  assert.equal(first.sections.length, BASE.structure.length);
  assert.equal("created" in first, false);
  assert.equal("crypto" in first, false);
});

test("Song DNA records an upstream deterministic melodic direction", () => {
  const ascending = createSongDNA({ ...BASE, melodicDirection: 1 });
  const descending = createSongDNA({ ...BASE, melodicDirection: -1 });
  assert.equal(ascending.melodic.direction, 1);
  assert.equal(descending.melodic.direction, -1);
  assert.equal(createSongDNA({ ...BASE, melodicDirection: -1 }).melodic.direction, -1);
});

test("Song DNA splits deterministic domain seeds and section memories", () => {
  const dna = createSongDNA(BASE);
  assert.equal(new Set(Object.values(dna.seeds)).size, Object.keys(dna.seeds).length);
  for (const section of BASE.structure) {
    const memory = songDNASection(dna, section.id);
    assert.ok(memory);
    assert.equal(Number.isInteger(memory.developmentSeed), true);
    assert.equal(Number.isInteger(memory.phraseSeed), true);
    assert.equal(Number.isInteger(memory.grooveSeed), true);
  }
});

test("related DNA keeps one musical family while creating a deterministic revision", () => {
  const original = createSongDNA(BASE);
  const relatedInput = { ...BASE, seed: "dna-related-seed", sourceDNA: original };
  const first = createSongDNA(relatedInput);
  const repeated = createSongDNA(relatedInput);
  assert.deepEqual(first, repeated);
  assert.equal(sameSongDNAFamily(original, first), true);
  assert.notEqual(first.id, original.id);
  assert.equal(first.revision, original.revision + 1);
  assert.deepEqual(first.identity, original.identity);
  assert.deepEqual(first.harmonic, original.harmonic);
  assert.deepEqual(first.rhythmic, original.rhythmic);
  assert.deepEqual(first.melodic, original.melodic);
});

test("generated songs expose one DNA contract that drives the blueprint", () => {
  const input = { genre: "rnbSoul", seed: "phase4-integration", bars: 16, candidateCount: 1 };
  const first = generateNew(input);
  const repeated = generateNew(input);
  assert.deepEqual(first.songDNA, repeated.songDNA);
  assert.deepEqual(first.songDNA, first.songBlueprint.songDNA);
  assert.equal(first.songDNA.version, 2);
  assert.equal(first.songBlueprint.version, 6);
  assert.equal(first.producerIntent.identity.songDNAId, first.songDNA.id);
  assert.equal(first.producerIntent.identity.songDNAFamilyId, first.songDNA.familyId);
  assert.ok(first.songBlueprint.sectionPlans.every((plan) => plan.direction === first.songDNA.melodic.direction));
  for (const section of first.structure) {
    const dnaSection = songDNASection(first.songDNA, section.id);
    assert.equal(section.intent.songDNADevelopmentSeed, dnaSection.developmentSeed);
  }
});

test("More like this stays in the same DNA family without cloning the instance", () => {
  const current = generateNew({ genre: "techno", seed: "phase4-family-base", bars: 16, candidateCount: 1 });
  const first = generateSimilar(current, { seed: "phase4-family-related", similarity: 0.9, candidateCount: 1 });
  const repeated = generateSimilar(current, { seed: "phase4-family-related", similarity: 0.9, candidateCount: 1 });
  assert.deepEqual(first.songDNA, repeated.songDNA);
  assert.equal(sameSongDNAFamily(current.songDNA, first.songDNA), true);
  assert.notEqual(first.songDNA.id, current.songDNA.id);
  assert.deepEqual(first.songDNA.identity, current.songDNA.identity);
  assert.deepEqual(first.songDNA.harmonic, current.songDNA.harmonic);
  assert.deepEqual(first.songDNA.rhythmic, current.songDNA.rhythmic);
  assert.deepEqual(first.songDNA.melodic, current.songDNA.melodic);
});
