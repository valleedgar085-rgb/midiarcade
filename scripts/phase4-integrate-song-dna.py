from pathlib import Path

engine_path = Path("src/music-engine.js")
source = engine_path.read_text()


def replace_once(before, after, label):
    global source
    if source.count(before) != 1:
        raise RuntimeError(f"{label}: expected exactly one anchor, found {source.count(before)}")
    source = source.replace(before, after, 1)


# Pure core contract import.
replace_once(
    '''import {
  cadentialHarmonyDegree,
  phraseLandingProfile,
  phraseLandingRole,
} from "./core/phrase-architecture.js";
''',
    '''import {
  cadentialHarmonyDegree,
  phraseLandingProfile,
  phraseLandingRole,
} from "./core/phrase-architecture.js";
import {
  createSongDNA as createDeterministicSongDNA,
  songDNASection,
} from "./core/song-dna.js";
''',
    "Song DNA import",
)

# Producer intent carries DNA identity so every consumer sees the same family.
replace_once(
    '''  narrative,
  hookSectionId,
  peakSectionId,
) {''',
    '''  narrative,
  hookSectionId,
  peakSectionId,
  songDNA = null,
) {''',
    "producer intent signature",
)
replace_once(
    '''      signatureTrack,
      grooveIdentity: ["house", "techno", "drumBass", "trap", "drill", "funk"].includes(config.genre)''',
    '''      signatureTrack,
      songDNAId: songDNA?.id ?? null,
      songDNAFamilyId: songDNA?.familyId ?? null,
      signatureBias: songDNA?.identity?.signatureBias ?? "hook",
      grooveIdentity: ["house", "techno", "drumBass", "trap", "drill", "funk"].includes(config.genre)''',
    "producer intent DNA identity",
)

# Create DNA immediately after the narrative is selected and before section plans.
replace_once(
    '''  const narrative = SONG_NARRATIVES.find((item) => item.id === sourceNarrativeId)
    ?? rng.weighted(SONG_NARRATIVES.map((item) => [item, item.weight]));
  const hookCandidates = structure.filter((section) => ["chorus", "drop", "theme", "idea"].includes(section.name));''',
    '''  const narrative = SONG_NARRATIVES.find((item) => item.id === sourceNarrativeId)
    ?? rng.weighted(SONG_NARRATIVES.map((item) => [item, item.weight]));
  const songDNA = createDeterministicSongDNA({
    genre: config.genre,
    bpm: config.tempo,
    key: config.key,
    scale: config.scale,
    seed: config.seed,
    narrativeId: narrative.id,
    styleAnchor: {
      drumGroove: style.drumGroove,
      bassGroove: style.bassGroove,
      chordMotion: style.chordMotion,
      melodyShape: style.melodyShape,
    },
    structure,
    sourceDNA: source?.songDNA ?? null,
    syncopation: config.syncopation,
    swing: config.swing,
    melodicRange: config.melodicRange,
    phraseBars: clamp(
      Math.round(finite(style.rhythmIdentity?.phraseCycle, GENRE_PROFILES[config.genre].arrangement.phraseBars)),
      2,
      8,
    ),
  });
  const hookCandidates = structure.filter((section) => ["chorus", "drop", "theme", "idea"].includes(section.name));''',
    "blueprint DNA creation",
)
replace_once(
    '''  const direction = rng.bool(0.58) ? 1 : -1;
  const sectionPlans = structure.map((section, index) => {''',
    '''  const direction = songDNA.melodic.direction;
  const sectionPlans = structure.map((section, index) => {''',
    "DNA melodic direction",
)
replace_once(
    '''    const baseDevelopmentPath = developmentPathForTransform(motifTransform);
    const patternVariant = Number.isFinite(Number(sourcePlan?.patternVariant))
      ? mod(Math.round(sourcePlan.patternVariant), baseDevelopmentPath.length)
      : rng.int(0, Math.max(0, baseDevelopmentPath.length - 1));''',
    '''    const baseDevelopmentPath = developmentPathForTransform(motifTransform);
    const dnaSection = songDNASection(songDNA, section.id);
    const patternVariant = Number.isFinite(Number(sourcePlan?.patternVariant))
      ? mod(Math.round(sourcePlan.patternVariant), baseDevelopmentPath.length)
      : mod(dnaSection?.developmentSeed ?? rng.int(0, 0x7fffffff), baseDevelopmentPath.length);''',
    "DNA section development seed",
)
replace_once(
    '''    narrative,
    hookSection?.id,
    peakSection?.id,
  );''',
    '''    narrative,
    hookSection?.id,
    peakSection?.id,
    songDNA,
  );''',
    "producer intent DNA argument",
)
replace_once(
    '''  return {
    version: 6,
    narrative: { id: narrative.id, label: narrative.label },''',
    '''  return {
    version: 7,
    narrative: { id: narrative.id, label: narrative.label },
    songDNA,''',
    "blueprint version and DNA",
)

# Carry the section-level DNA seed into the applied intent so downstream lanes
# can observe which deterministic development decision shaped the section.
replace_once(
    '''  const orchestration = new Map((blueprint?.orchestrationMatrix ?? []).map((entry) => [entry.sectionId, entry]));
  const memories = new Map((blueprint?.memoryMap ?? []).map((entry) => [entry.sectionId, entry]));''',
    '''  const orchestration = new Map((blueprint?.orchestrationMatrix ?? []).map((entry) => [entry.sectionId, entry]));
  const memories = new Map((blueprint?.memoryMap ?? []).map((entry) => [entry.sectionId, entry]));
  const dnaSections = new Map((blueprint?.songDNA?.sections ?? []).map((entry) => [entry.sectionId, entry]));''',
    "applied blueprint DNA sections",
)
replace_once(
    '''        featuredTrack: orchestration.get(section.id)?.featuredTrack ?? null,
        memoryRelationship: memories.get(section.id)?.relationship ?? "statement",''',
    '''        featuredTrack: orchestration.get(section.id)?.featuredTrack ?? null,
        memoryRelationship: memories.get(section.id)?.relationship ?? "statement",
        songDNADevelopmentSeed: dnaSections.get(section.id)?.developmentSeed ?? null,''',
    "section DNA intent seed",
)

# Expose the canonical DNA on the final song beside producer intent.
replace_once(
    '''    characteristicVoice: characteristicVoice.report,
    producerIntent: clone(songBlueprint.producerIntent),''',
    '''    characteristicVoice: characteristicVoice.report,
    songDNA: clone(songBlueprint.songDNA),
    producerIntent: clone(songBlueprint.producerIntent),''',
    "song DNA output",
)

engine_path.write_text(source)

# Blueprint schema moved from v6 to v7 because it now contains canonical Song DNA.
test_path = Path("tests/music-engine.test.mjs")
tests = test_path.read_text()
old = "  assert.equal(blueprint.version, 6);"
if tests.count(old) != 1:
    raise RuntimeError(f"blueprint version assertion: expected one anchor, found {tests.count(old)}")
tests = tests.replace(old, "  assert.equal(blueprint.version, 7);", 1)
test_path.write_text(tests)

# Dedicated pure + integration contracts.
Path("tests/song-dna.test.mjs").write_text(r'''import test from "node:test";
import assert from "node:assert/strict";
import {
  createSongDNA,
  sameSongDNAFamily,
  songDNASection,
} from "../src/core/song-dna.js";
import { createSongDNA as createLegacySongDNA } from "../src/song-dna.js";
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

test("legacy ArrangementEngine Song DNA facade is deterministic", () => {
  const input = { genre: "house", bpm: 124, key: "A", scale: "minor", seed: "legacy-dna" };
  const first = createLegacySongDNA(input);
  const second = createLegacySongDNA(input);
  assert.deepEqual(first, second);
  assert.equal(first.bpm, 124);
  assert.equal(first.genre, "house");
  assert.equal(Number.isInteger(first.grooveSeed), true);
  assert.equal("created" in first, false);
});

test("generated songs expose one DNA contract that drives the blueprint", () => {
  const input = { genre: "rnbSoul", seed: "phase4-integration", bars: 16, candidateCount: 1 };
  const first = generateNew(input);
  const repeated = generateNew(input);
  assert.deepEqual(first.songDNA, repeated.songDNA);
  assert.deepEqual(first.songDNA, first.songBlueprint.songDNA);
  assert.equal(first.songDNA.version, 2);
  assert.equal(first.songBlueprint.version, 7);
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
''')

print("Integrated deterministic Song DNA v2 into the producer blueprint.")
