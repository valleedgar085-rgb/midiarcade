import test from "node:test";
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
  evaluateSongCandidate,
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

test("Phrase Memory remains critic-neutral on the repair reconciliation seed", () => {
  const input = {
    seed: "repair-reconcile-1",
    bars: 8,
    genre: "jazz",
    energy: 0.05,
    complexity: 0.05,
  };
  const song = generateNew(input);
  assert.equal(song.meta.scoreDetails.criticRepair.selectedFromRepair, true);
  assert.equal(song.generationInterlock.reconciliation?.phase, 40);
  assert.ok(song.phraseMemory?.sections?.length === song.structure.length);

  const withoutPhraseMetadata = structuredClone(song);
  delete withoutPhraseMetadata.phraseMemory;
  delete withoutPhraseMetadata.songBlueprint.phraseMemory;
  for (const section of withoutPhraseMetadata.structure ?? []) {
    if (!section.intent) continue;
    delete section.intent.phraseSentenceRole;
    delete section.intent.phraseMemoryLandingRole;
    delete section.intent.phraseMemoryTransform;
    delete section.intent.phraseRegisterStrategy;
  }
  for (const contract of withoutPhraseMetadata.generationInterlock?.sectionContracts ?? []) {
    delete contract.phraseMemory;
  }
  for (const track of withoutPhraseMetadata.tracks ?? []) {
    for (const note of track.notes ?? []) {
      delete note.phraseMemoryRole;
      delete note.phraseMemoryTransform;
      delete note.phraseMemoryLandingRole;
      delete note.phraseMemorySourceSectionId;
      delete note.phraseRegisterStrategy;
      delete note.phraseRecallStrength;
      delete note.phrasePerformanceDelta;
      delete note.phrasePerformanceDurationScale;
    }
  }

  assert.deepEqual(
    evaluateSongCandidate(song),
    evaluateSongCandidate(withoutPhraseMetadata),
    "Phrase Memory metadata must never change critic scoring or repair selection inputs",
  );
});

test("More like this preserves phrase-memory family identity without cloning the song", () => {
  const current = generateNew({ genre: "neoSoul", seed: "phase5-family-base", bars: 16, candidateCount: 1 });
  const related = generateSimilar(current, { seed: "phase5-family-related", similarity: 0.88, candidateCount: 1 });
  assert.equal(related.phraseMemory.familyId, current.phraseMemory.familyId);
  assert.equal(related.phraseMemory.familyId, related.songDNA.familyId);
  assert.notEqual(related.id, current.id);
  assert.equal(related.phraseMemory.sections.length, related.structure.length);
});