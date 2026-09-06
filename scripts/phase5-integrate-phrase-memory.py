from pathlib import Path

ENGINE = Path("src/music-engine.js")
APP = Path("src/app.js")
PHRASE_TEST = Path("tests/phrase-memory-intelligence.test.mjs")
APP_TEST = Path("tests/app-smoke.test.mjs")
engine = ENGINE.read_text()
app = APP.read_text()
app_test = APP_TEST.read_text()


def replace_once(text, before, after, label):
    count = text.count(before)
    if count != 1:
        raise RuntimeError(f"{label}: expected exactly one anchor, found {count}")
    return text.replace(before, after, 1)


engine = replace_once(
    engine,
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
  renderPhrasePerformance,
} from "./core/phrase-memory.js";
import {
  createSongDNA as createDeterministicSongDNA,
} from "./core/song-dna.js";
''',
    "phrase memory import",
)

engine = replace_once(
    engine,
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
engine = replace_once(
    engine,
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

engine = replace_once(
    engine,
    '''  const memories = new Map((blueprint?.memoryMap ?? []).map((entry) => [entry.sectionId, entry]));
  const dnaSections = new Map((blueprint?.songDNA?.sections ?? []).map((entry) => [entry.sectionId, entry]));
  return structure.map((section) => {
''',
    '''  const memories = new Map((blueprint?.memoryMap ?? []).map((entry) => [entry.sectionId, entry]));
  const phraseMemories = new Map((blueprint?.phraseMemory?.sections ?? []).map((entry) => [entry.sectionId, entry]));
  const dnaSections = new Map((blueprint?.songDNA?.sections ?? []).map((entry) => [entry.sectionId, entry]));
  return structure.map((section) => {
''',
    "section phrase memory map",
)
engine = replace_once(
    engine,
    '''        memoryRelationship: memories.get(section.id)?.relationship ?? "statement",
        songDNADevelopmentSeed: dnaSections.get(section.id)?.developmentSeed ?? null,
''',
    '''        memoryRelationship: memories.get(section.id)?.relationship ?? "statement",
        phraseSentenceRole: phraseMemories.get(section.id)?.sentenceRole ?? "statement",
        phraseMemoryLandingRole: phraseMemories.get(section.id)?.landingRole ?? null,
        phraseMemoryTransform: phraseMemories.get(section.id)?.transform ?? "statement",
        phraseRegisterStrategy: phraseMemories.get(section.id)?.registerStrategy ?? "preserve",
        songDNADevelopmentSeed: dnaSections.get(section.id)?.developmentSeed ?? null,
''',
    "section phrase intent",
)

engine = replace_once(
    engine,
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
engine = replace_once(
    engine,
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

engine = replace_once(
    engine,
    '''      const phraseRole = barContract?.role ?? "statement";
      const phraseDynamic = {
''',
    '''      const phraseRole = barContract?.role ?? "statement";
      const phraseMemoryDelta = phrasePerformanceAdjustment(contract.phraseMemory, trackId, phraseRole);
      const phraseMemoryDurationScale = contract.phraseMemory && phraseRole === "turnaround"
        ? clamp(finite(contract.phraseMemory.performance?.durationScale, 1), 0.72, 1.28)
        : 1;
      const phraseDynamic = {
''',
    "phrase render instructions",
)
engine = replace_once(
    engine,
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
          ? clamp(Math.round(note.velocity * sharedDynamic + accentBoost), 1, 127)
          : note.velocity,
        connectionId: contract.id,
        connectionRole: contract.role,
        sectionPatternId: `${contract.motifId}:${contract.role}`,
        phraseRole,
        ...(contract.phraseMemory ? {
          phraseMemoryRole: contract.phraseMemory.sentenceRole,
          phraseMemoryTransform: contract.phraseMemory.transform,
          phraseMemoryLandingRole: contract.phraseMemory.landingRole,
          phraseMemorySourceSectionId: contract.phraseMemory.sourceSectionId,
          phraseRegisterStrategy: contract.phraseMemory.registerStrategy,
          phraseRecallStrength: contract.phraseMemory.recallStrength,
        } : {}),
        ...(phraseMemoryDelta ? { phrasePerformanceDelta: phraseMemoryDelta } : {}),
        ...(Math.abs(phraseMemoryDurationScale - 1) > 1e-6 ? {
          phrasePerformanceDurationScale: round(phraseMemoryDurationScale),
        } : {}),
        ...(ensembleAccent ? { ensembleAccent: true } : {}),
''',
    "interlock phrase metadata",
)

engine = replace_once(
    engine,
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
engine = replace_once(
    engine,
    '''      landing.articulationIntent = landingProfile.articulation;
    }
  }
''',
    '''      landing.articulationIntent = landingProfile.articulation;
      if (sectionPhraseMemory) {
        landing.phraseMemoryRole = sectionPhraseMemory.sentenceRole;
        landing.phraseMemoryTransform = sectionPhraseMemory.transform;
        landing.phraseMemoryLandingRole = sectionPhraseMemory.landingRole;
        landing.phraseMemorySourceSectionId = sectionPhraseMemory.sourceSectionId;
        landing.phraseRegisterStrategy = sectionPhraseMemory.registerStrategy;
        landing.phraseRecallStrength = sectionPhraseMemory.recallStrength;
      }
    }
  }
''',
    "phrase resolver metadata",
)

engine = replace_once(
    engine,
    '''      ...(note.phraseRole ? { phraseRole: note.phraseRole } : {}),
      ...(note.phraseCadenceRole ? { phraseCadenceRole: note.phraseCadenceRole } : {}),
      ...(note.ensembleAccent ? { ensembleAccent: true } : {}),
''',
    '''      ...(note.phraseRole ? { phraseRole: note.phraseRole } : {}),
      ...(note.phraseCadenceRole ? { phraseCadenceRole: note.phraseCadenceRole } : {}),
      ...(note.phraseMemoryRole ? { phraseMemoryRole: note.phraseMemoryRole } : {}),
      ...(note.phraseMemoryTransform ? { phraseMemoryTransform: note.phraseMemoryTransform } : {}),
      ...(note.phraseMemoryLandingRole ? { phraseMemoryLandingRole: note.phraseMemoryLandingRole } : {}),
      ...(note.phraseMemorySourceSectionId ? { phraseMemorySourceSectionId: note.phraseMemorySourceSectionId } : {}),
      ...(note.phraseRegisterStrategy ? { phraseRegisterStrategy: note.phraseRegisterStrategy } : {}),
      ...(Number.isFinite(note.phraseRecallStrength) ? { phraseRecallStrength: round(note.phraseRecallStrength) } : {}),
      ...(Number.isFinite(note.phrasePerformanceDelta) ? { phrasePerformanceDelta: note.phrasePerformanceDelta } : {}),
      ...(Number.isFinite(note.phrasePerformanceDurationScale) ? {
        phrasePerformanceDurationScale: round(note.phrasePerformanceDurationScale),
      } : {}),
      ...(note.ensembleAccent ? { ensembleAccent: true } : {}),
''',
    "finalized phrase metadata",
)

engine = replace_once(
    engine,
    '''    for (const note of track.notes ?? []) {
      const pitch = clamp(Math.round(finite(note.pitch, 60)), 0, 127);
      const velocity = clamp(Math.round(finite(note.velocity, 90) * velocityScale), 1, 127);
      const onTick = clamp(Math.round(finite(note.start, 0) * ppq), 0, Math.max(0, totalTicks - 1));
      const offTick = clamp(
        Math.max(onTick + 1, Math.round((finite(note.start, 0) + finite(note.duration, 0.25) * gateScale) * ppq)),
''',
    '''    for (const note of track.notes ?? []) {
      const phrasePerformance = renderPhrasePerformance(note);
      const pitch = clamp(Math.round(finite(note.pitch, 60)), 0, 127);
      const velocity = clamp(Math.round(
        (finite(note.velocity, 90) + phrasePerformance.velocityDelta) * velocityScale,
      ), 1, 127);
      const onTick = clamp(Math.round(finite(note.start, 0) * ppq), 0, Math.max(0, totalTicks - 1));
      const offTick = clamp(
        Math.max(onTick + 1, Math.round((
          finite(note.start, 0)
          + finite(note.duration, 0.25) * gateScale * phrasePerformance.durationScale
        ) * ppq)),
''',
    "MIDI phrase performance",
)

engine = replace_once(
    engine,
    '''    memoryMap: clone(songBlueprint.memoryMap),
    producerPass: produced.report,
''',
    '''    memoryMap: clone(songBlueprint.memoryMap),
    phraseMemory: clone(songBlueprint.phraseMemory),
    producerPass: produced.report,
''',
    "song phrase memory output",
)

app = replace_once(
    app,
    '''import { previewDrumCharacter, previewDrumEnvelope } from "./core/preview-drums.js";
''',
    '''import { previewDrumCharacter, previewDrumEnvelope } from "./core/preview-drums.js";
import { renderPhrasePerformance } from "./core/phrase-memory.js";
''',
    "preview phrase performance import",
)
app = replace_once(
    app,
    '''    return trackNotes(track).map((note) => {
      const startBeat = Math.max(0, noteStart(note));
      const durationBeats = Math.max(0.01, noteDuration(note));
      const audibleDurationBeats = durationBeats * clamp(gateScale, 0.65, 1.4);
''',
    '''    return trackNotes(track).map((note) => {
      const startBeat = Math.max(0, noteStart(note));
      const durationBeats = Math.max(0.01, noteDuration(note));
      const phrasePerformance = renderPhrasePerformance(note);
      const audibleDurationBeats = durationBeats
        * clamp(gateScale, 0.65, 1.4)
        * phrasePerformance.durationScale;
''',
    "preview phrase duration",
)
app = replace_once(
    app,
    '''      const baseVelocity = clamp(noteVelocity(note) * velocityScale, 1, 127);
''',
    '''      const baseVelocity = clamp(
        (noteVelocity(note) + phrasePerformance.velocityDelta) * velocityScale,
        1,
        127,
      );
''',
    "preview phrase velocity",
)

app_test = replace_once(
    app_test,
    '''test("smart performance mix stays bounded, comparable, and user-directed", () => {
''',
    '''test("phrase performance is interpreted at the preview boundary", () => {
  assert.match(appSource, /renderPhrasePerformance\\(note\\)/);
  assert.match(appSource, /phrasePerformance\\.durationScale/);
  assert.match(appSource, /phrasePerformance\\.velocityDelta/);
});

test("smart performance mix stays bounded, comparable, and user-directed", () => {
''',
    "preview phrase performance seam test",
)

ENGINE.write_text(engine)
APP.write_text(app)
APP_TEST.write_text(app_test)

PHRASE_TEST.write_text(r'''import test from "node:test";
import assert from "node:assert/strict";
import {
  createPhraseMemoryContract,
  phraseMemoryForSection,
  phrasePerformanceAdjustment,
  renderPhrasePerformance,
} from "../src/core/phrase-memory.js";
import {
  createSongFingerprint,
  encodeMidi,
  generateNew,
  generateSimilar,
} from "../src/music-engine.js";

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

test("phrase performance stays bounded and is interpreted only at render time", () => {
  const contract = createPhraseMemoryContract({ structure: STRUCTURE, sectionPlans: PLANS, memoryMap: MEMORIES, songDNA: DNA });
  const resolution = phraseMemoryForSection(contract, "outro-1");
  assert.equal(phrasePerformanceAdjustment(resolution, "melody", "statement"), 0);
  const leadDelta = phrasePerformanceAdjustment(resolution, "melody", "turnaround");
  const bassDelta = phrasePerformanceAdjustment(resolution, "bass", "turnaround");
  assert.ok(leadDelta > 0 && leadDelta <= 6);
  assert.ok(bassDelta >= 0 && bassDelta <= leadDelta);
  assert.deepEqual(renderPhrasePerformance({ phrasePerformanceDelta: 99, phrasePerformanceDurationScale: 5 }), { velocityDelta: 6, durationScale: 1.28 });
  assert.deepEqual(renderPhrasePerformance({ phrasePerformanceDelta: -99, phrasePerformanceDurationScale: 0.1 }), { velocityDelta: -6, durationScale: 0.72 });
});

test("generated songs carry phrase memory through blueprint, interlock, and final notes", () => {
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
    assert.equal(section.intent.phraseMemoryLandingRole, memory.landingRole);
    assert.equal(interlock.phraseMemory.transform, memory.transform);
  }
  const tagged = first.tracks.flatMap((track) => track.notes).filter((note) => note.phraseMemoryRole && note.phraseMemoryTransform);
  assert.ok(tagged.length > 0, "final notes should retain phrase-memory metadata");
  assert.ok(tagged.every((note) => !Number.isFinite(note.phrasePerformanceDelta) || Math.abs(note.phrasePerformanceDelta) <= 6));
  assert.ok(tagged.every((note) => !Number.isFinite(note.phrasePerformanceDurationScale) || (note.phrasePerformanceDurationScale >= 0.72 && note.phrasePerformanceDurationScale <= 1.28)));
  const finalSection = first.structure.at(-1);
  const finalMemory = phraseMemoryForSection(first.phraseMemory, finalSection.id);
  const finalLeadLandings = first.tracks.find((track) => track.id === "melody").notes.filter((note) => note.phraseBoundary >= finalSection.endBeat - 0.05);
  assert.ok(finalLeadLandings.length > 0, "the final lead phrase should expose a resolved landing");
  assert.equal(finalLeadLandings.at(-1).phraseMemoryLandingRole, finalMemory.landingRole);
  assert.equal(finalLeadLandings.at(-1).phraseMemoryRole, finalMemory.sentenceRole);
});

test("phrase metadata preserves composition identity while changing MIDI rendering", () => {
  const song = generateNew({ genre: "pop", seed: "phase5-render-boundary", bars: 16, candidateCount: 1 });
  const rendered = structuredClone(song);
  const plain = structuredClone(song);
  const renderedNote = rendered.tracks.find((track) => track.id === "melody")?.notes?.[0];
  const plainNote = plain.tracks.find((track) => track.id === "melody")?.notes?.[0];
  assert.ok(renderedNote && plainNote);
  renderedNote.phrasePerformanceDelta = 6;
  renderedNote.phrasePerformanceDurationScale = 1.28;
  delete plainNote.phrasePerformanceDelta;
  delete plainNote.phrasePerformanceDurationScale;
  assert.deepEqual(createSongFingerprint(rendered), createSongFingerprint(plain));
  assert.notDeepEqual(encodeMidi(rendered), encodeMidi(plain));
});

test("More like this preserves phrase-memory family identity without cloning the song", () => {
  const current = generateNew({ genre: "neoSoul", seed: "phase5-family-base", bars: 16, candidateCount: 1 });
  const related = generateSimilar(current, { seed: "phase5-family-related", similarity: 0.88, candidateCount: 1 });
  assert.equal(related.phraseMemory.familyId, current.phraseMemory.familyId);
  assert.equal(related.phraseMemory.familyId, related.songDNA.familyId);
  assert.notEqual(related.id, current.id);
  assert.equal(related.phraseMemory.sections.length, related.structure.length);
});
''')

print("Integrated Phase 5 as critic-neutral intent metadata with shared preview/MIDI performance rendering.")
