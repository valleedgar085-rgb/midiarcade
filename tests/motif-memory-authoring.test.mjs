import assert from "node:assert/strict";
import test from "node:test";

import { authorMotifMemoryVariants } from "../src/core/motif-memory-authoring.js";
import { generateNew } from "../src/music-engine.js";

function motif(degrees, offsets = null) {
  return {
    lengthBeats: 8,
    phraseShape: "questionAnswer",
    events: degrees.map((degree, index) => ({
      offset: offsets?.[index] ?? index,
      duration: index % 2 ? 0.5 : 0.75,
      degree,
      accent: index === 0 ? 1 : 0.76,
    })),
  };
}

const FAMILY = {
  A: { melody: motif([0, 2, 4, 3, 1, 0]) },
  APrime: { melody: motif([0, 2, 3, 2, 1, 0]) },
  B: { melody: motif([0, 3, 4, 2, 3, 0]) },
  C: { melody: motif([0, -2, -1, 2, -1, 1]) },
};

const ASSIGNMENTS = [
  { sectionId: "verse-1", motifId: "A" },
  { sectionId: "verse-2", motifId: "APrime" },
  { sectionId: "bridge-1", motifId: "C" },
  { sectionId: "outro-1", motifId: "APrime" },
];

const PHRASE_MEMORY = {
  sections: [
    { sectionId: "verse-1", sourceSectionId: "verse-1", relationship: "statement", recallStrength: 1 },
    { sectionId: "verse-2", sourceSectionId: "verse-1", relationship: "recall", recallStrength: 0.78, transform: "contour-echo" },
    { sectionId: "bridge-1", sourceSectionId: "verse-1", relationship: "contrast", recallStrength: 0.52, transform: "harmonic-reframe" },
    { sectionId: "outro-1", sourceSectionId: "verse-1", relationship: "return", recallStrength: 0.9, transform: "motif-return" },
  ],
};

function signature(motifValue) {
  return JSON.stringify(motifValue.events.map((event) => [
    event.offset,
    event.duration,
    event.degree,
  ]));
}

test("motif-memory authoring is deterministic and section-addressable", () => {
  const input = {
    family: FAMILY,
    assignments: ASSIGNMENTS,
    phraseMemory: PHRASE_MEMORY,
    seed: "motif-memory-unit",
  };
  const first = authorMotifMemoryVariants(input);
  const second = authorMotifMemoryVariants(input);

  assert.deepEqual(first, second);
  assert.equal(first.version, 1);
  assert.equal(first.authority, "motif-memory-authoring-v1");
  assert.deepEqual(
    first.sections.map((entry) => entry.sectionId),
    ["verse-2", "bridge-1", "outro-1"],
  );
  assert.equal(first.sectionMotifs["verse-1"], undefined);
});

test("recall and return preserve hook identity without exact cloning", () => {
  const result = authorMotifMemoryVariants({
    family: FAMILY,
    assignments: ASSIGNMENTS,
    phraseMemory: PHRASE_MEMORY,
    seed: "motif-memory-developed",
  });
  const source = FAMILY.A.melody;
  const recall = result.sectionMotifs["verse-2"].melody;
  const returned = result.sectionMotifs["outro-1"].melody;

  for (const variant of [recall, returned]) {
    assert.equal(variant.events.length, source.events.length);
    assert.notEqual(signature(variant), signature(source), "memory variants must develop rather than clone");
    assert.equal(variant.events[0].degree, source.events[0].degree, "opening identity should remain recognizable");
    assert.equal(variant.events.at(-1).degree, source.events.at(-1).degree, "landing identity should remain recognizable");
    assert.equal(variant.memoryAuthoring.sourceSectionId, "verse-1");
    assert.equal(variant.memoryAuthoring.changedFromSource, true);
  }

  const recallMatches = recall.events.filter((event, index) => event.degree === source.events[index].degree).length;
  const returnMatches = returned.events.filter((event, index) => event.degree === source.events[index].degree).length;
  assert.ok(recallMatches >= Math.ceil(source.events.length * 0.5));
  assert.ok(returnMatches >= Math.ceil(source.events.length * 0.5));
});

test("contrast keeps a small family fingerprint while using the contrasting motif", () => {
  const result = authorMotifMemoryVariants({
    family: FAMILY,
    assignments: ASSIGNMENTS,
    phraseMemory: PHRASE_MEMORY,
    seed: "motif-memory-contrast",
  });
  const contrast = result.sectionMotifs["bridge-1"].melody;

  assert.equal(contrast.events.length, FAMILY.C.melody.events.length);
  assert.equal(contrast.events[0].degree, FAMILY.A.melody.events[0].degree);
  assert.equal(
    contrast.events.at(-1).degree,
    FAMILY.A.melody.events.at(-1).degree,
    "contrast should retain the source landing",
  );
  assert.equal(
    Math.sign(contrast.events.at(-1).degree - contrast.events.at(-2).degree),
    Math.sign(FAMILY.A.melody.events.at(-1).degree - FAMILY.A.melody.events.at(-2).degree),
    "contrast should retain the source cadence direction",
  );
  assert.notEqual(signature(contrast), signature(FAMILY.A.melody));
  assert.equal(contrast.memoryAuthoring.relationship, "contrast");
  assert.equal(contrast.memoryAuthoring.fallbackMotifId, "C");
});

test("generated songs commit authored motif-memory variants into final melody notes", { timeout: 120_000 }, () => {
  let observed = null;

  for (let index = 0; index < 6 && !observed; index += 1) {
    const song = generateNew({
      genre: "rnbSoul",
      seed: `motif-memory-live-${index}`,
      bars: 20,
      key: "A",
      scale: "minor",
      complexity: 0.72,
      variation: 0.7,
      evolution: 0.68,
      candidateCount: 1,
    });

    assert.deepEqual(song, generateNew({
      genre: "rnbSoul",
      seed: `motif-memory-live-${index}`,
      bars: 20,
      key: "A",
      scale: "minor",
      complexity: 0.72,
      variation: 0.7,
      evolution: 0.68,
      candidateCount: 1,
    }));

    const authored = song.motifs?.motifMemoryAuthoring?.sections ?? [];
    const melody = song.tracks.find((track) => track.id === "melody");
    for (const sectionReport of authored) {
      const section = song.structure.find((entry) => String(entry.id) === String(sectionReport.sectionId));
      if (!section || !melody) continue;
      const notes = melody.notes.filter((note) => (
        note.start >= section.startBeat - 1e-6
        && note.start < section.endBeat - 1e-6
        && note.motifMemoryVariantId === `motif-memory:${sectionReport.sectionId}`
      ));
      if (notes.length) {
        observed = { song, sectionReport, notes };
        break;
      }
    }
  }

  assert.ok(observed, "at least one generated memory section should retain authored motif evidence");
  assert.ok(observed.song.motifs.sectionMotifs[observed.sectionReport.sectionId]?.melody);
  assert.ok(observed.notes.every((note) => (
    note.motifMemorySourceSectionId === observed.sectionReport.sourceSectionId
    && note.motifMemoryRelationship === observed.sectionReport.relationship
  )));
});


test("hook return keeps its identity while reserving a deliberate breath before the landing", () => {
  const result = authorMotifMemoryVariants({
    family: FAMILY,
    assignments: ASSIGNMENTS,
    phraseMemory: PHRASE_MEMORY,
    seed: "motif-memory-breath",
  });
  const source = FAMILY.A.melody;
  const returned = result.sectionMotifs["outro-1"].melody;
  const penultimate = returned.events.at(-2);
  const landing = returned.events.at(-1);
  const sourcePenultimate = source.events.at(-2);

  assert.equal(returned.events[0].degree, source.events[0].degree);
  assert.equal(landing.degree, source.events.at(-1).degree);
  assert.equal(penultimate.phraseBreathAfter, true);
  assert.ok(
    penultimate.offset + penultimate.duration <= landing.offset - 0.249,
    JSON.stringify({ penultimate, landing }),
  );
  assert.ok(penultimate.duration <= sourcePenultimate.duration);
});
