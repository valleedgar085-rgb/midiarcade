import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateSongCandidate,
  generateNew,
} from "../src/music-engine.js";
import {
  ENSEMBLE_RELATIONSHIP_KINDS,
  createEnsembleCoordinationContract,
  evaluateEnsembleCoordinationAuthority,
} from "../src/core/ensemble-coordination-authority.js";

test("section ensemble contracts publish all required role relationships deterministically", () => {
  const contract = createEnsembleCoordinationContract({
    sectionId: "chorus-1",
    featuredTrack: "melody",
    answerTrack: "counterpoint",
    ensembleRoles: {
      drums: "foundation",
      bass: "foundation",
      chords: "support",
      melody: "foreground",
      counterpoint: "answer",
      pad: "texture",
    },
    cadence: "resolve",
    silenceBudget: 0.18,
  });

  assert.equal(contract.version, 1);
  assert.equal(contract.authority, "ensemble-coordination-v1");
  assert.deepEqual(
    contract.relationships.map((relationship) => relationship.kind),
    ENSEMBLE_RELATIONSHIP_KINDS,
  );
  assert.ok(contract.relationships.every((relationship) => relationship.required));
  assert.deepEqual(
    contract.relationships.find((relationship) => relationship.kind === "rhythm-foundation"),
    {
      id: "ensemble:chorus-1:rhythm-foundation",
      kind: "rhythm-foundation",
      leaders: ["drums"],
      responders: ["bass"],
      authority: "grooveConductor",
      policy: "respond-without-cloning",
      required: true,
    },
  );
});

test("generated songs expose and honor ensemble coordination authority", () => {
  const input = {
    genre: "hipHop",
    seed: "ensemble-authority-proof",
    bars: 12,
    candidateCount: 1,
    targetedRepair: false,
    energy: 0.72,
    complexity: 0.7,
  };
  const song = generateNew(input);
  const repeated = generateNew(input);

  assert.deepEqual(repeated, song, "ensemble authority must preserve deterministic generation");
  assert.equal(song.generationInterlock.ensembleAuthority.version, 1);
  assert.equal(song.generationInterlock.ensembleAuthority.id, "ensemble-coordination-v1");
  assert.equal(song.generationInterlock.ensembleAuthority.sectionCount, song.structure.length);
  assert.equal(
    song.generationInterlock.ensembleAuthority.relationshipCount,
    song.structure.length * ENSEMBLE_RELATIONSHIP_KINDS.length,
  );
  assert.equal(
    song.ensembleCoordination.relationshipContracts,
    song.structure.length * ENSEMBLE_RELATIONSHIP_KINDS.length,
  );
  assert.deepEqual(song.ensembleCoordination.relationshipKinds, ENSEMBLE_RELATIONSHIP_KINDS);

  for (const contract of song.generationInterlock.sectionContracts) {
    assert.equal(contract.coordination.version, 1);
    assert.deepEqual(
      contract.coordination.relationships.map((relationship) => relationship.kind),
      ENSEMBLE_RELATIONSHIP_KINDS,
    );
    assert.equal(contract.coordination.featuredTrack, contract.featuredTrack);
    assert.deepEqual(contract.coordination.roles, contract.ensembleRoles);
  }

  const authority = evaluateEnsembleCoordinationAuthority(song);
  const evaluation = evaluateSongCandidate(song);
  assert.equal(authority.passed, true, JSON.stringify(authority));
  assert.ok(authority.score >= 70, JSON.stringify(authority));
  assert.ok(authority.metrics.contractCoverage >= 0.98);
  assert.ok(authority.metrics.rhythmFoundation >= 0.45);
  assert.ok(authority.metrics.leadDialogue >= 0.6);
  assert.ok(evaluation.subscores.stageInterlock >= 70);
  assert.equal(
    evaluation.diagnostics.ensembleCoordination,
    Math.round(authority.score) / 100,
  );
});

test("critic detects a band that loses its cross-instrument relationship evidence", () => {
  const song = generateNew({
    genre: "hipHop",
    seed: "ensemble-authority-damage-proof",
    bars: 12,
    candidateCount: 1,
    targetedRepair: false,
    energy: 0.76,
    complexity: 0.74,
  });
  const connectedAuthority = evaluateEnsembleCoordinationAuthority(song);
  const connectedEvaluation = evaluateSongCandidate(song);

  const disconnected = structuredClone(song);
  for (const track of disconnected.tracks) {
    for (const note of track.notes ?? []) {
      delete note.ensembleCoordinationRole;
      delete note.ensemblePartner;
    }
  }

  const disconnectedAuthority = evaluateEnsembleCoordinationAuthority(disconnected);
  const disconnectedEvaluation = evaluateSongCandidate(disconnected);

  assert.ok(
    disconnectedAuthority.score <= connectedAuthority.score - 10,
    `${disconnectedAuthority.score} should be materially below ${connectedAuthority.score}`,
  );
  assert.ok(
    disconnectedEvaluation.subscores.stageInterlock < connectedEvaluation.subscores.stageInterlock,
    `${disconnectedEvaluation.subscores.stageInterlock} should be below ${connectedEvaluation.subscores.stageInterlock}`,
  );
  assert.equal(disconnectedEvaluation.diagnostics.ensembleCoordinationPassed, false);
});
