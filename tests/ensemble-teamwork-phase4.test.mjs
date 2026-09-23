import assert from "node:assert/strict";
import test from "node:test";

import { generateNew } from "../src/music-engine.js";

const TRACKS = ["drums", "bass", "chords", "melody", "counterpoint", "pad"];

function notesInSection(song, trackId, sectionId) {
  const section = song.structure.find((entry) => entry.id === sectionId);
  const track = song.tracks.find((entry) => entry.id === trackId);
  if (!section || !track) return [];
  return track.notes.filter((note) => (
    note.start >= section.startBeat - 1e-6
    && note.start < section.endBeat - 1e-6
  ));
}

test("Phase 4 interlock publishes one explicit ensemble hierarchy per section", () => {
  const song = generateNew({
    genre: "hipHop",
    seed: "phase4-ensemble-hierarchy",
    bars: 24,
    candidateCount: 1,
    professionalUpgrade: true,
  });

  assert.equal(song.generationInterlock.sectionContracts.length, song.structure.length);
  for (const contract of song.generationInterlock.sectionContracts) {
    assert.ok(TRACKS.every((id) => typeof contract.ensembleRoles?.[id] === "string"));
    assert.ok(contract.silenceBudget >= 0.05 && contract.silenceBudget <= 0.4);
    assert.ok(contract.densityCeiling >= 0.5 && contract.densityCeiling <= 0.98);
    assert.ok(contract.scenePurpose);
    assert.ok(contract.featuredTrack);
    assert.equal(
      Object.values(contract.ensembleRoles).filter((role) => role === "foreground").length,
      1,
      `${contract.sectionId} should expose one foreground owner`,
    );
  }
});

test("Phase 4 ensemble coordination is deterministic and records support yielding", () => {
  const options = {
    genre: "pop",
    seed: "phase4-negative-space-yield",
    bars: 24,
    candidateCount: 1,
    professionalUpgrade: true,
    energy: 0.72,
    complexity: 0.68,
  };
  const first = generateNew(options);
  const second = generateNew(options);

  assert.deepEqual(first, second);
  assert.equal(first.ensembleCoordination.active, true);
  assert.equal(first.ensembleCoordination.sharedIntentSections, first.structure.length);
  assert.ok(first.ensembleCoordination.supportSpaceYields >= 0);
  assert.ok(first.ensembleCoordination.restingRoleNotesRemoved >= 0);

  const restContracts = first.generationInterlock.sectionContracts.filter((contract) => (
    Object.values(contract.ensembleRoles ?? {}).includes("rest")
  ));
  for (const contract of restContracts) {
    for (const [trackId, role] of Object.entries(contract.ensembleRoles)) {
      if (role !== "rest") continue;
      const notes = notesInSection(first, trackId, contract.sectionId);
      assert.ok(
        notes.every((note) => (
          note.phraseAnchor
          || note.resolutionRole
          || note.transitionRole
          || note.transitionFeature
          || note.transitionHandoffRole
          || note.memoryRole
          || note.motifHandoffRole
          || note.finalAssemblyRole
          || note.ensembleCadenceRole
          || note.producerRole !== "rest"
        )),
        `${trackId} should not freely fill a section where the pre-note contract assigns rest`,
      );
    }
  }
});

test("Phase 4 preserves foundation ownership while separating lead and counter roles", () => {
  const song = generateNew({
    genre: "neoSoul",
    seed: "phase4-rhythm-and-dialogue",
    bars: 24,
    candidateCount: 1,
    professionalUpgrade: true,
  });

  for (const contract of song.generationInterlock.sectionContracts) {
    assert.equal(contract.ensembleRoles.drums, contract.featuredTrack === "drums" ? "foreground" : "foundation");
    assert.equal(contract.ensembleRoles.bass, contract.featuredTrack === "bass" ? "foreground" : "foundation");
    if (contract.featuredTrack === "melody" && contract.answerTrack === "counterpoint") {
      assert.equal(contract.ensembleRoles.melody, "foreground");
      assert.equal(contract.ensembleRoles.counterpoint, "answer");
    }
  }
});
