from pathlib import Path

ENGINE = Path("src/music-engine.js")
TEST = Path("tests/phrase-memory-intelligence.test.mjs")
source = ENGINE.read_text()


def replace_once(before, after, label):
    global source
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one anchor, found {count}")
    source = source.replace(before, after, 1)


# 1) Import the pure phrase-memory contract beside phrase architecture.
replace_once(
    '''import {
  cadentialHarmonyDegree,
  phraseLandingProfile,
  phraseLandingRole,
} from "./core/phrase-architecture.js";
import {
  createSongDNA as createDeterministicSongDNA,
} from "./core/song-dna.js";
''',
    '''import {
  cadentialHarmonyDegree,
  phraseLandingProfile,
  phraseLandingRole,
} from "./core/phrase-architecture.js";
import {
  createPhraseMemoryContract,
  phraseMemoryForSection,
  phrasePerformanceAdjustment,
} from "./core/phrase-memory.js";
import {
  createSongDNA as createDeterministicSongDNA,
} from "./core/song-dna.js";
''',
    "phrase memory import",
)

# 2) Build phrase memory only after section plans + memory map exist.
replace_once(
    '''  const memoryMap = createMemoryMap(structure, sectionPlans, hookSection?.id, source);
  return {
    version: 6,
''',
    '''  const memoryMap = createMemoryMap(structure, sectionPlans, hookSection?.id, source);
  const phraseMemory = createPhraseMemoryContract({
    structure,
    sectionPlans,
    memoryMap,
    songDNA,
  });
  return {
    version: 6,
''',
    "phrase memory blueprint creation",
)
replace_once(
    '''    producerIntent,
    memoryMap,
  };
}

function applySongBlueprint''',
    '''    producerIntent,
    memoryMap,
    phraseMemory,
  };
}

function applySongBlueprint''',
    "phrase memory blueprint output",
)

# 3) Surface phrase intent on each section without changing structure schema.
replace_once(
    '''  const memories = new Map((blueprint?.memoryMap ?? []).map((entry) => [entry.sectionId, entry]));
  const dnaSections = new Map((blueprint?.songDNA?.sections ?? []).map((entry) => [entry.sectionId, entry]));
  return structure.map((section) => {
    const plan = plans.get(section.id);
''',
    '''  const memories = new Map((blueprint?.memoryMap ?? []).map((entry) => [entry.sectionId, entry]));
  const phraseMemories = new Map((blueprint?.phraseMemory?.sections ?? []).map((entry) => [entry.sectionId, entry]));
  const dnaSections = new Map((blueprint?.songDNA?.sections ?? []).map((entry) => [entry.sectionId, entry]));
  return structure.map((section) => {
    const plan = plans.get(section.id);
''',
    "section phrase memory map",
)
replace_once(
    '''        memoryRelationship: memories.get(section.id)?.relationship ?? "statement",
        songDNADevelopmentSeed: dnaSections.get(section.id)?.developmentSeed ?? null,
''',
    '''        memoryRelationship: memories.get(section.id)?.relationship ?? "statement",
        phraseSentenceRole: phraseMemories.get(section.id)?.sentenceRole ?? "statement",
        phraseLandingRole: phraseMemories.get(section.id)?.landingRole ?? null,
        phraseMemoryTransform: phraseMemories.get(section.id)?.transform ?? "statement",
        phraseRegisterStrategy: phraseMemories.get(section.id)?.registerStrategy ?? "preserve",
        songDNADevelopmentSeed: dnaSections.get(section.id)?.developmentSeed ?? null,
''',
    "section phrase intent",
)

# 4) Carry phrase memory into the interlock section contract.
replace_once(
    '''  const sectionContracts = structure.map((section) => {
    const plan = blueprintPlanForSection(songBlueprint, section);
    const sectionHarmony = harmony.filter((event) => (
''',
    '''  const sectionContracts = structure.map((section) => {
    const plan = blueprintPlanForSection(songBlueprint, section);
    const phraseMemory = phraseMemoryForSection(songBlueprint?.phraseMemory, section.id);
    const sectionHarmony = harmony.filter((event) => (
''',
    "interlock phrase memory lookup",
)
replace_once(
    '''      performanceFeel: performanceProfile?.feel?.id ?? "balanced",
      transitionOut: outgoing.get(section.id)?.type ?? null,
      bars,
''',
    '''      performanceFeel: performanceProfile?.feel?.id ?? "balanced",
      transitionOut: outgoing.get(section.id)?.type ?? null,
      phraseMemory: phraseMemory ? clone(phraseMemory) : null,
      bars,
''',
    "interlock phrase memory contract",
)

# 5) Add a restrained phrase-ending dynamic to existing ensemble turnarounds.
replace_once(
    '''      const phraseRole = barContract?.role ?? "statement";
      const phraseDynamic = {
''',
    '''      const phraseRole = barContract?.role ?? "statement";
      const phraseMemoryDelta = phrasePerformanceAdjustment(contract.phraseMemory, trackId, phraseRole);
      const phraseDynamic = {
''',
    "phrase performance delta",
)
replace_once(
    '''        velocity: adjustVelocity
          ? clamp(Math.round(note.velocity * sharedDynamic + accentBoost), 1, 127)
          : note.velocity,
        connectionId: contract.id,
        connectionRole: contract.role,
        sectionPatternId: `${contract.motifId}:${contract.role}`,
        phraseRole,
        ...(ensembleAccent ? { ensembleAccent: true } : {}),
''',
    '''        velocity: adjustVelocity
          ? clamp(Math.round(note.velocity * sharedDynamic + accentBoost + phraseMemoryDelta), 1, 127)
          : note.velocity,
        connectionId: contract.id,
        connectionRole: contract.role,
        sectionPatternId: `${contract.motifId}:${contract.role}`,
        phraseRole,
        ...(contract.phraseMemory ? {
          phraseMemoryRole: contract.phraseMemory.sentenceRole,
          phraseMemoryTransform: contract.phraseMemory.transform,
          phraseLandingRole: contract.phraseMemory.landingRole,
          phraseMemorySourceSectionId: contract.phraseMemory.sourceSectionId,
          phraseRegisterStrategy: contract.phraseMemory.registerStrategy,
          phraseRecallStrength: contract.phraseMemory.recallStrength,
        } : {}),
        ...(adjustVelocity && phraseMemoryDelta ? { phrasePerformanceDelta: phraseMemoryDelta } : {}),
        ...(ensembleAccent ? { ensembleAccent: true } : {}),
''',
    "interlock phrase tags and performance",
)

# 6) Let the existing scale-safe phrase resolver honor the section's memory role
# only at the section-ending boundary. Internal phrase cadence behavior stays intact.
replace_once(
    '''  const barBeats = beatsPerBar(config);
  for (const section of structure) {
    const plan = blueprintPlanForSection(songBlueprint, section);
''',
    '''  const barBeats = beatsPerBar(config);
  for (const section of structure) {
    const plan = blueprintPlanForSection(songBlueprint, section);
    const sectionPhraseMemory = phraseMemoryForSection(songBlueprint?.phraseMemory, section.id);
''',
    "phrase resolver memory lookup",
)
replace_once(
    '''      const landingRole = phraseLandingRole({
        boundaryIndex,
        boundaryCount: boundaries.length,
        cadence,
        trackId,
      });
''',
    '''      const landingRole = sectionBoundary && sectionPhraseMemory?.landingRole
        ? sectionPhraseMemory.landingRole
        : phraseLandingRole({
          boundaryIndex,
          boundaryCount: boundaries.length,
          cadence,
          trackId,
        });
''',
    "phrase resolver memory role",
)
replace_once(
    '''      landing.articulationIntent = landingProfile.articulation;
    }
  }
''',
    '''      landing.articulationIntent = landingProfile.articulation;
      if (sectionPhraseMemory) {
        landing.phraseMemoryRole = sectionPhraseMemory.sentenceRole;
        landing.phraseMemoryTransform = sectionPhraseMemory.transform;
        landing.phraseLandingRole = sectionPhraseMemory.landingRole;
        landing.phraseMemorySourceSectionId = sectionPhraseMemory.sourceSectionId;
        landing.phraseRegisterStrategy = sectionPhraseMemory.registerStrategy;
        landing.phraseRecallStrength = sectionPhraseMemory.recallStrength;
      }
    }
  }
''',
    "phrase resolver metadata",
)

# 7) Preserve phrase-memory metadata through humanization/finalization.
replace_once(
    '''      ...(note.phraseRole ? { phraseRole: note.phraseRole } : {}),
      ...(note.phraseCadenceRole ? { phraseCadenceRole: note.phraseCadenceRole } : {}),
      ...(note.ensembleAccent ? { ensembleAccent: true } : {}),
''',
    '''      ...(note.phraseRole ? { phraseRole: note.phraseRole } : {}),
      ...(note.phraseCadenceRole ? { phraseCadenceRole: note.phraseCadenceRole } : {}),
      ...(note.phraseMemoryRole ? { phraseMemoryRole: note.phraseMemoryRole } : {}),
      ...(note.phraseMemoryTransform ? { phraseMemoryTransform: note.phraseMemoryTransform } : {}),
      ...(note.phraseLandingRole ? { phraseLandingRole: note.phraseLandingRole } : {}),
      ...(note.phraseMemorySourceSectionId ? { phraseMemorySourceSectionId: note.phraseMemorySourceSectionId } : {}),
      ...(note.phraseRegisterStrategy ? { phraseRegisterStrategy: note.phraseRegisterStrategy } : {}),
      ...(Number.isFinite(note.phraseRecallStrength) ? { phraseRecallStrength: round(note.phraseRecallStrength) } : {}),
      ...(Number.isFinite(note.phrasePerformanceDelta) ? { phrasePerformanceDelta: note.phrasePerformanceDelta } : {}),
      ...(note.ensembleAccent ? { ensembleAccent: true } : {}),
''',
    "finalized phrase metadata",
)

# 8) Expose the contract beside the existing memory map for diagnostics/UI.
replace_once(
    '''    memoryMap: clone(songBlueprint.memoryMap),
    producerPass: produced.report,
''',
    '''    memoryMap: clone(songBlueprint.memoryMap),
    phraseMemory: clone(songBlueprint.phraseMemory),
    producerPass: produced.report,
''',
    "song phrase memory output",
)

ENGINE.write_text(source)

TEST.write_text(r'''import test from "node:test";
import assert from "node:assert/strict";
import {
  createPhraseMemoryContract,
  phraseMemoryForSection,
  phrasePerformanceAdjustment,
} from "../src/core/phrase-memory.js";
import { generateNew, generateSimilar } from "../src/music-engine.js";

const STRUCTURE = [
  { id: "intro-1", name: "intro", bars: 2 },
  { id: "verse-1", name: "verse", bars: 4 },
  { id: "verse-2", name: "verse", bars: 4 },
  { id: "outro-1", name: "outro", bars: 2 },
];
const PLANS = [
  { sectionId: "intro-1", role: "statement", cadence: "open" },
  { sectionId: "verse-1", role: "development", cadence: "open" },
  { sectionId: "verse-2", role: "development", cadence: "open" },
  { sectionId: "outro-1", role: "release", cadence: "resolve" },
];
const MEMORIES = [
  { sectionId: "intro-1", originSectionId: "intro-1", relationship: "introduction", recallStrength: 1, contrastAxis: "none" },
  { sectionId: "verse-1", originSectionId: "verse-1", relationship: "statement", recallStrength: 1, contrastAxis: "none" },
  { sectionId: "verse-2", originSectionId: "verse-1", relationship: "recall", recallStrength: 0.78, contrastAxis: "rhythm" },
  { sectionId: "outro-1", originSectionId: "verse-1", relationship: "return", recallStrength: 0.88, contrastAxis: "register" },
];
const DNA = {
  familyId: "dna-family-phase5",
  melodic: { direction: 1 },
  sections: STRUCTURE.map((section, index) => ({ sectionId: section.id, phraseSeed: 1000 + index })),
};

test("phrase memory contract is deterministic and section-addressable", () => {
  const input = { structure: STRUCTURE, sectionPlans: PLANS, memoryMap: MEMORIES, songDNA: DNA };
  const first = createPhraseMemoryContract(input);
  const second = createPhraseMemoryContract(input);
  assert.deepEqual(first, second);
  assert.equal(first.version, 1);
  assert.equal(first.familyId, DNA.familyId);
  assert.equal(first.sections.length, STRUCTURE.length);
  assert.equal(phraseMemoryForSection(first, "verse-2").relationship, "recall");
  assert.equal(phraseMemoryForSection(first, "verse-2").sentenceRole, "callback");
  assert.match(phraseMemoryForSection(first, "verse-2").transform, /echo|answer/);
  assert.equal(phraseMemoryForSection(first, "outro-1").landingRole, "resolution");
  assert.equal(phraseMemoryForSection(first, "outro-1").registerStrategy, "lift");
});

test("phrase performance adjustment is bounded and only touches turnaround cells", () => {
  const contract = createPhraseMemoryContract({
    structure: STRUCTURE,
    sectionPlans: PLANS,
    memoryMap: MEMORIES,
    songDNA: DNA,
  });
  const resolution = phraseMemoryForSection(contract, "outro-1");
  assert.equal(phrasePerformanceAdjustment(resolution, "melody", "statement"), 0);
  const leadDelta = phrasePerformanceAdjustment(resolution, "melody", "turnaround");
  const bassDelta = phrasePerformanceAdjustment(resolution, "bass", "turnaround");
  assert.ok(leadDelta > 0 && leadDelta <= 6);
  assert.ok(bassDelta >= 0 && bassDelta <= leadDelta);
});

test("generated songs carry one phrase-memory contract from blueprint through interlock and notes", () => {
  const input = { genre: "rnbSoul", seed: "phase5-phrase-memory", bars: 20, candidateCount: 1 };
  const first = generateNew(input);
  const repeated = generateNew(input);
  assert.deepEqual(first, repeated, "Phase 5 must remain deterministic");
  assert.deepEqual(first.phraseMemory, first.songBlueprint.phraseMemory);
  assert.equal(first.phraseMemory.version, 1);
  assert.equal(first.phraseMemory.familyId, first.songDNA.familyId);
  assert.equal(first.phraseMemory.sections.length, first.structure.length);

  for (const section of first.structure) {
    const memory = phraseMemoryForSection(first.phraseMemory, section.id);
    const interlock = first.generationInterlock.sectionContracts.find((entry) => entry.sectionId === section.id);
    assert.ok(memory, `${section.id} should have phrase memory`);
    assert.ok(interlock?.phraseMemory, `${section.id} should publish phrase memory to the interlock`);
    assert.equal(section.intent.phraseSentenceRole, memory.sentenceRole);
    assert.equal(section.intent.phraseLandingRole, memory.landingRole);
    assert.equal(interlock.phraseMemory.transform, memory.transform);
  }

  const tagged = first.tracks.flatMap((track) => track.notes)
    .filter((note) => note.phraseMemoryRole && note.phraseMemoryTransform);
  assert.ok(tagged.length > 0, "rendered notes should retain phrase-memory metadata");
  assert.ok(tagged.every((note) => !Number.isFinite(note.phrasePerformanceDelta) || Math.abs(note.phrasePerformanceDelta) <= 6));

  const finalSection = first.structure.at(-1);
  const finalMemory = phraseMemoryForSection(first.phraseMemory, finalSection.id);
  const finalLeadLandings = first.tracks.find((track) => track.id === "melody").notes
    .filter((note) => note.phraseBoundary >= finalSection.endBeat - 0.05);
  assert.ok(finalLeadLandings.length > 0, "the final lead phrase should expose a resolved landing");
  assert.equal(finalLeadLandings.at(-1).phraseLandingRole, finalMemory.landingRole);
  assert.equal(finalLeadLandings.at(-1).phraseMemoryRole, finalMemory.sentenceRole);
});

test("More like this preserves phrase-memory family identity without cloning the song", () => {
  const current = generateNew({ genre: "neoSoul", seed: "phase5-family-base", bars: 16, candidateCount: 1 });
  const related = generateSimilar(current, {
    seed: "phase5-family-related",
    similarity: 0.88,
    candidateCount: 1,
  });
  assert.equal(related.phraseMemory.familyId, current.phraseMemory.familyId);
  assert.equal(related.phraseMemory.familyId, related.songDNA.familyId);
  assert.notEqual(related.id, current.id);
  assert.equal(related.phraseMemory.sections.length, related.structure.length);
});
''')

print("Integrated Phase 5 phrase memory into blueprint, interlock, phrase resolution, and performance metadata.")
