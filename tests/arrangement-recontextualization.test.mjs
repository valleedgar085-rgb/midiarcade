import assert from "node:assert/strict";
import test from "node:test";

import { createArrangementCandidates, MAX_ARRANGEMENT_CANDIDATES } from "../src/core/arrangement-candidates.js";
import { evolveSongArrangement } from "../src/core/arrangement-evolution.js";

function fixtureSong() {
  const definitions = [
    ["intro", 0.32],
    ["verse", 0.52],
    ["chorus", 0.88],
    ["bridge", 0.42],
    ["chorus", 0.94],
    ["outro", 0.28],
  ];
  const structure = definitions.map(([name], index) => ({
    id: `${name}-${index + 1}`,
    name,
    bars: 2,
    start: index * 2,
    startBar: index * 2,
    startBeat: index * 8,
    endBeat: (index + 1) * 8,
  }));
  const makeNote = (trackId, section, suffix, start, pitch, velocity) => ({
    tag: `${trackId}:${section.id}:${suffix}`,
    sourceSectionId: section.id,
    start,
    duration: 0.25,
    pitch,
    velocity,
  });
  const tracks = [
    { id: "drums", pitch: 49, velocity: 90 },
    { id: "bass", pitch: 42, velocity: 82 },
    { id: "melody", pitch: 67, velocity: 86 },
  ].map((definition) => ({
    id: definition.id,
    notes: structure.flatMap((section) => [
      makeNote(definition.id, section, "arrival", section.startBeat, definition.pitch, definition.velocity),
      makeNote(definition.id, section, "pickup", section.endBeat - 0.25, definition.pitch, definition.velocity),
    ]),
  }));
  return {
    id: "arrangement-context-fixture",
    bars: 12,
    meta: { bars: 12, beatsPerBar: 4, totalBeats: 48 },
    structure,
    sections: structuredClone(structure),
    tracks,
    harmony: [],
    songBlueprint: {
      sectionPlans: structure.map((section, index) => ({
        sectionId: section.id,
        energy: definitions[index][1],
      })),
      transitions: structure.slice(0, -1).map((section, index) => ({
        connectionId: `stale:${section.id}->${structure[index + 1].id}`,
        fromSectionId: section.id,
        toSectionId: structure[index + 1].id,
        type: "push",
        pickupBeats: 0.5,
      })),
    },
    arrangementTransitions: structure.slice(0, -1).map((section, index) => ({
      connectionId: `stale:${section.id}->${structure[index + 1].id}`,
      fromSectionId: section.id,
      toSectionId: structure[index + 1].id,
      type: "push",
      pickupBeats: 0.5,
    })),
    phraseMemory: { sections: structure.map((section) => ({ sectionId: section.id })) },
    songDNA: { sections: structure.map((section) => ({ sectionId: section.id })) },
    generationInterlock: { sectionContracts: structure.map((section) => ({ sectionId: section.id })) },
  };
}

function changingConfig(song) {
  for (let index = 0; index < 128; index += 1) {
    const config = {
      genre: "pop",
      bars: song.bars,
      seed: `phase8-context-${index}`,
      arrangementEvolution: true,
    };
    if (evolveSongArrangement(song, config).changed) return config;
  }
  assert.fail("expected a deterministic arrangement family that changes the fixture order");
}

function notesByTag(song) {
  return new Map(song.tracks.flatMap((track) => (
    track.notes.map((note) => [note.tag, { trackId: track.id, ...note }])
  )));
}

test("reordered sections rebuild every transition against the new adjacency", () => {
  const source = fixtureSong();
  const before = structuredClone(source);
  const config = changingConfig(source);
  const result = evolveSongArrangement(source, config);

  assert.equal(result.changed, true);
  assert.deepEqual(source, before, "arrangement recontextualization must remain source-immutable");
  assert.equal(result.song.arrangementTransitions.length, result.song.structure.length - 1);
  assert.equal(result.song.songBlueprint.transitions.length, result.song.structure.length - 1);

  result.song.arrangementTransitions.forEach((transition, index) => {
    const from = result.song.structure[index];
    const to = result.song.structure[index + 1];
    assert.equal(transition.fromSectionId, from.id);
    assert.equal(transition.toSectionId, to.id);
    assert.equal(transition.connectionId, `connection:${from.id}->${to.id}`);
    assert.ok(["lift", "push", "drop-out"].includes(transition.type));
    assert.ok(transition.pickupBeats >= 0.25 && transition.pickupBeats <= 1.25);
    assert.deepEqual(result.song.songBlueprint.transitions[index], {
      connectionId: transition.connectionId,
      index: transition.index,
      fromSectionId: transition.fromSectionId,
      toSectionId: transition.toSectionId,
      fromSection: transition.fromSection,
      toSection: transition.toSection,
      type: transition.type,
      strength: transition.strength,
      pickupBeats: transition.pickupBeats,
    });
  });

  assert.equal(result.song.outputQualityEvolution.arrangement.transitionsRebuilt, result.song.structure.length - 1);
  assert.ok(result.song.outputQualityEvolution.arrangement.transitionNotesShaped > 0);
});

test("transition shaping is audible but bounded and never rewrites pitch, duration, or note count", () => {
  const source = fixtureSong();
  const config = changingConfig(source);
  const first = evolveSongArrangement(source, config);
  const repeated = evolveSongArrangement(source, config);

  assert.deepEqual(first, repeated, "same song and seed must produce the exact same arrangement context");

  const sourceNotes = notesByTag(source);
  const evolvedNotes = notesByTag(first.song);
  assert.equal(evolvedNotes.size, sourceNotes.size);

  let velocityChanges = 0;
  let markedNotes = 0;
  for (const [tag, note] of evolvedNotes) {
    const original = sourceNotes.get(tag);
    assert.ok(original, `missing source note ${tag}`);
    assert.equal(note.pitch, original.pitch, `${tag} pitch must stay authoritative`);
    assert.equal(note.duration, original.duration, `${tag} duration must stay authoritative`);
    assert.ok(note.velocity >= 1 && note.velocity <= 127, `${tag} velocity must remain MIDI-safe`);
    if (note.velocity !== original.velocity) velocityChanges += 1;
    if (note.transitionFeature) {
      markedNotes += 1;
      assert.ok(["lift", "push"].includes(note.transitionFeature), "only audibly shaped pickup/arrival notes receive transition markers");
      assert.ok(first.song.arrangementTransitions.some((transition) => transition.connectionId === note.connectionId));
    }
  }

  assert.equal(velocityChanges, first.song.outputQualityEvolution.arrangement.transitionNotesShaped);
  assert.equal(markedNotes, velocityChanges);
  assert.ok(velocityChanges <= first.song.arrangementTransitions.length * 3, "each boundary may shape at most two pickups and one arrival");
});

test("Phase 8 recontextualization does not widen the critic candidate ceiling", () => {
  const source = fixtureSong();
  const config = changingConfig(source);
  const candidates = createArrangementCandidates(source, config, { maxCandidates: 99 });

  assert.ok(candidates.length > 0);
  assert.ok(candidates.length <= MAX_ARRANGEMENT_CANDIDATES);
  assert.equal(MAX_ARRANGEMENT_CANDIDATES, 3);
  for (const candidate of candidates) {
    assert.ok(candidate.song.arrangementTransitions.length === candidate.song.structure.length - 1);
    assert.ok(candidate.song.outputQualityEvolution.arrangement.transitionNotesShaped <= candidate.song.arrangementTransitions.length * 3);
  }
});
