import assert from "node:assert/strict";
import test from "node:test";

import { createMelodyPhrasePlan } from "../src/core/melody-phrase-composer.js";
import { createPhraseMemoryContract } from "../src/core/phrase-memory.js";
import { generateNew } from "../src/music-engine.js";

test("Melody Director v2 creates deterministic 4-bar question/answer phrases", () => {
  const input = {
    section: { id: "verse-1", name: "verse", role: "verse", bars: 8 },
    memory: {
      sourceSectionId: "verse-1",
      relationship: "statement",
      sentenceRole: "statement",
      landingRole: "answer",
      registerStrategy: "preserve",
      motifMemory: { contourRecall: 1, rhythmRecall: 1, endingRecall: 1 },
    },
    nextSection: { id: "chorus-1", name: "chorus", role: "peak", bars: 8 },
  };
  const first = createMelodyPhrasePlan(input);
  const second = createMelodyPhrasePlan(input);

  assert.deepEqual(first, second);
  assert.equal(first.version, 2);
  assert.equal(first.authority, "melody-director-v2");
  assert.equal(first.mutatesNotes, false);
  assert.equal(first.phraseBars, 8);
  assert.equal(first.phraseCount, 1);
  assert.equal(first.phrases[0].lookAhead.enabled, true);
  assert.equal(first.phrases[0].lookAhead.nextSectionId, "chorus-1");
});

test("short sections use bounded phrase spans and preserve breathing room", () => {
  const plan = createMelodyPhrasePlan({
    section: { id: "intro", name: "intro", role: "intro", bars: 2 },
    memory: {
      relationship: "introduction",
      sentenceRole: "question",
      landingRole: "question",
      registerStrategy: "preserve",
    },
  });

  assert.equal(plan.phraseBars, 2);
  assert.equal(plan.phraseCount, 1);
  assert.ok(plan.phrases[0].restBudget >= 0.3);
  assert.equal(plan.phrases[0].landingIntent, "question");
});

test("return phrases remember their source while avoiding direct note mutation", () => {
  const plan = createMelodyPhrasePlan({
    section: { id: "verse-2", name: "verse", role: "verse", bars: 4 },
    memory: {
      sourceSectionId: "verse-1",
      relationship: "return",
      sentenceRole: "return",
      landingRole: "answer",
      transform: "motif-return",
      registerStrategy: "settle",
      motifMemory: {
        contourRecall: 0.82,
        rhythmRecall: 0.88,
        endingRecall: 0.91,
      },
    },
  });

  assert.equal(plan.phrases[0].sourceSectionId, "verse-1");
  assert.equal(plan.phrases[0].relationship, "return");
  assert.equal(plan.phrases[0].transform, "motif-return");
  assert.equal(plan.phrases[0].registerMotion, "down");
  assert.equal(plan.phrases[0].motifRecall, 0.82);
  assert.equal(plan.mutatesNotes, false);
});

test("phrase-memory contract exposes Melody Director v2 without changing existing memory fields", () => {
  const contract = createPhraseMemoryContract({
    structure: [
      { id: "verse-1", name: "verse", bars: 4 },
      { id: "chorus-1", name: "chorus", bars: 8 },
    ],
    sectionPlans: [
      { sectionId: "verse-1", role: "verse", cadence: "open" },
      { sectionId: "chorus-1", role: "peak", cadence: "resolve" },
    ],
    memoryMap: [
      { sectionId: "verse-1", originSectionId: "verse-1", relationship: "statement", recallStrength: 1, contrastAxis: "none" },
      { sectionId: "chorus-1", originSectionId: "verse-1", relationship: "recall", recallStrength: 0.85, contrastAxis: "none" },
    ],
    songDNA: {
      familyId: "family-a",
      melodic: { direction: 1 },
      sections: [
        { sectionId: "verse-1", phraseSeed: 1 },
        { sectionId: "chorus-1", phraseSeed: 2 },
      ],
    },
  });

  assert.equal(contract.version, 1);
  assert.equal(contract.sections[0].relationship, "statement");
  assert.equal(contract.sections[0].melodyDirector.authority, "melody-director-v2");
  assert.equal(contract.sections[0].melodyDirector.phrases[0].lookAhead.nextSectionId, "chorus-1");
  assert.equal(contract.sections[1].melodyDirector.phrases[0].landingIntent, "resolution");
  assert.equal(contract.sections[1].melodyDirector.mutatesNotes, false);
});


test("generated melody landings publish and follow Melody Director v2 intent", () => {
  const song = generateNew({
    genre: "pop",
    seed: "melody-director-v2-render",
    bars: 32,
    candidateCount: 1,
  });
  const melody = song.tracks.find((track) => track.id === "melody");
  assert.ok(melody?.notes?.length > 0);

  const directedLandings = melody.notes.filter((note) => note.melodyDirectorVersion === 2);
  assert.ok(directedLandings.length > 0, "melody phrase landings should expose Melody Director v2 intent");
  assert.ok(directedLandings.every((note) => [
    "question", "answer", "statement", "resolution", "return", "callback", "contrast",
  ].includes(note.melodyDirectorSentenceRole)));
  assert.ok(directedLandings.every((note) => [
    "up", "down", "slight-up", "slight-down", "contrast", "center",
  ].includes(note.melodyDirectorRegisterMotion)));
  assert.ok(directedLandings.every((note) => note.melodyDirectorRestBudget >= 0.08 && note.melodyDirectorRestBudget <= 0.42));

  const eightBarSections = song.phraseMemory.sections.filter((entry) => entry.melodyDirector?.phraseBars === 8);
  for (const memory of eightBarSections) {
    const section = song.structure.find((entry) => entry.id === memory.sectionId);
    if (!section) continue;
    const boundaries = directedLandings.filter((note) => (
      note.start >= section.startBeat - 1e-6
      && note.start < section.endBeat - 1e-6
      && Number.isFinite(note.phraseBoundary)
    ));
    assert.ok(
      boundaries.length <= Math.max(1, Math.ceil(section.bars / 8)),
      `8-bar melody thought in ${section.id} should not restart every 2-4 bars`,
    );
  }
});
