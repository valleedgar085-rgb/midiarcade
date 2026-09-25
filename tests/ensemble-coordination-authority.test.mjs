import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateSongCandidate,
  generateNew,
  refreshCommittedGenerationDiagnostics,
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

test("critic detects rendered parts that stop honoring the ensemble authority", () => {
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
  const sectionFor = (beat) => disconnected.structure.find((section) => (
    beat >= section.startBeat - 1e-6 && beat < section.endBeat - 1e-6
  )) ?? disconnected.structure.at(-1);
  const dislocate = (trackId) => {
    const track = disconnected.tracks.find((candidate) => candidate.id === trackId);
    for (const note of track?.notes ?? []) {
      const section = sectionFor(note.start);
      note.start = Math.min(section.endBeat - 0.03, Math.max(section.startBeat, note.start + 0.125));
    }
  };
  dislocate("bass");
  dislocate("chords");

  const melody = disconnected.tracks.find((track) => track.id === "melody")?.notes ?? [];
  const counterpoint = disconnected.tracks.find((track) => track.id === "counterpoint")?.notes ?? [];
  for (const answer of counterpoint) {
    const section = sectionFor(answer.start);
    const calls = melody.filter((note) => (
      note.start >= section.startBeat - 1e-6 && note.start < section.endBeat - 1e-6
    ));
    if (!calls.length) continue;
    const call = calls.reduce((best, note) => (
      Math.abs(note.start - answer.start) < Math.abs(best.start - answer.start) ? note : best
    ), calls[0]);
    answer.start = call.start;
  }

  const disconnectedAuthority = evaluateEnsembleCoordinationAuthority(disconnected);
  const disconnectedEvaluation = evaluateSongCandidate(disconnected);

  assert.ok(
    disconnectedAuthority.score <= connectedAuthority.score - 10,
    `${disconnectedAuthority.score} should be materially below ${connectedAuthority.score}`,
  );
  assert.ok(
    disconnectedAuthority.metrics.rhythmFoundation < connectedAuthority.metrics.rhythmFoundation,
    "bass should lose Groove DNA alignment",
  );
  assert.ok(
    disconnectedAuthority.metrics.leadDialogue < connectedAuthority.metrics.leadDialogue,
    "counterpoint should lose call/response separation",
  );
  assert.ok(
    disconnectedAuthority.metrics.phraseSeparation < connectedAuthority.metrics.phraseSeparation,
    "synchronized counterpoint should create more phrase overlap",
  );
  assert.ok(
    disconnectedEvaluation.subscores.stageInterlock < connectedEvaluation.subscores.stageInterlock,
    `${disconnectedEvaluation.subscores.stageInterlock} should be below ${connectedEvaluation.subscores.stageInterlock}`,
  );
});


test("critic fails closed when an accepted section loses a required ensemble relationship", () => {
  const song = generateNew({
    genre: "hipHop",
    seed: "ensemble-contract-removal-proof",
    bars: 12,
    candidateCount: 1,
    targetedRepair: false,
    energy: 0.7,
    complexity: 0.68,
  });
  const intact = evaluateEnsembleCoordinationAuthority(song);
  const broken = structuredClone(song);
  const first = broken.generationInterlock.sectionContracts[0];
  first.coordination.relationships = first.coordination.relationships.filter(
    (relationship) => relationship.kind !== "cadence-team",
  );

  const degraded = evaluateEnsembleCoordinationAuthority(broken);

  assert.equal(intact.metrics.contractCoverage, 1);
  assert.ok(degraded.metrics.contractCoverage < 0.98);
  assert.equal(degraded.passed, false);
  assert.ok(
    degraded.score <= intact.score,
    `degraded contract score ${degraded.score} must not improve over intact ${intact.score}`,
  );
});


test("committed diagnostic refresh publishes read-only ensemble coordination from final tracks", () => {
  const song = generateNew({
    genre: "hipHop",
    seed: "committed-ensemble-diagnostic-proof",
    bars: 16,
    candidateCount: 1,
    targetedRepair: false,
  });
  const beforeTracks = structuredClone(song.tracks);
  const refreshed = refreshCommittedGenerationDiagnostics(song);

  assert.deepEqual(song.tracks, beforeTracks, "committed ensemble evaluation must not mutate final tracks");
  assert.equal(refreshed.committedEnsembleCoordination?.version, 2);
  assert.ok(Number.isFinite(refreshed.committedEnsembleCoordination?.score));
  assert.equal(
    refreshed.committedAuthorityValidation?.ensembleCoordination,
    refreshed.committedEnsembleCoordination.passed ? "coordinated" : "needs-attention",
  );
});


test("ensemble hardening exposes cloning, register crowding, and support-layer pressure", () => {
  const song = generateNew({
    genre: "hipHop", seed: "ensemble-hardening-metrics", bars: 16,
    candidateCount: 1, targetedRepair: false,
  });
  const before = structuredClone(song);
  const report = evaluateEnsembleCoordinationAuthority(song);

  assert.deepEqual(song, before, "hardened ensemble critic must remain read-only");
  for (const metric of [
    "kickBassCloneRatio", "bassIndependence", "melodyChordCrowding",
    "leadHarmonySeparation", "supportForegroundOverlap", "supportRestraint",
    "leadPhraseOverlap", "phraseSeparation", "callResponseTiming",
  ]) assert.ok(Number.isFinite(report.metrics[metric]), metric);
});

test("kick-bass cloning is penalized without requiring bass to ignore the groove", () => {
  const song = generateNew({
    genre: "hipHop", seed: "ensemble-clone-proof", bars: 16,
    candidateCount: 1, targetedRepair: false,
  });
  const cloned = structuredClone(song);
  const drums = cloned.tracks.find((track) => track.id === "drums")?.notes ?? [];
  const kicks = drums.filter((note) => [35, 36].includes(Math.round(Number(note.pitch))));
  const bass = cloned.tracks.find((track) => track.id === "bass");
  if (bass && kicks.length) {
    bass.notes = kicks.map((kick, index) => ({
      ...kick, pitch: 36 + (index % 3) * 2, duration: 0.45, velocity: 92,
    }));
  }
  const report = evaluateEnsembleCoordinationAuthority(cloned);
  assert.ok(report.metrics.kickBassCloneRatio >= 0.68, JSON.stringify(report.metrics));
  assert.ok(report.metrics.bassIndependence < 1, JSON.stringify(report.metrics));
});


test("ensemble critic publishes section-role evolution and breathing-room diagnostics", () => {
  const song = generateNew({
    genre: "pop", seed: "ensemble-role-evolution-proof", bars: 24,
    candidateCount: 1, targetedRepair: false,
  });
  const before = structuredClone(song);
  const report = evaluateEnsembleCoordinationAuthority(song);
  assert.deepEqual(song, before, "role-evolution analysis must remain read-only");
  assert.equal(report.roleEvolution.length, song.structure.length);
  assert.ok(Number.isFinite(report.metrics.sectionRoleEvolution));
  assert.ok(Number.isFinite(report.metrics.arrangementBreathingRoom));
  assert.equal(typeof report.metrics.allLayersAlwaysOn, "boolean");
});


test("lead dialogue rewards turn-taking over synchronized competing phrases", () => {
  const song = generateNew({
    genre: "pop",
    seed: "lead-counterline-dialogue-proof",
    bars: 20,
    candidateCount: 1,
    targetedRepair: false,
  });
  const healthy = evaluateEnsembleCoordinationAuthority(song);
  const competing = structuredClone(song);
  const melody = competing.tracks.find((track) => track.id === "melody")?.notes ?? [];
  const counterpoint = competing.tracks.find((track) => track.id === "counterpoint");
  if (counterpoint && melody.length) {
    counterpoint.notes = counterpoint.notes.map((answer, index) => {
      const call = melody[index % melody.length];
      return {
        ...answer,
        start: call.start,
        duration: Math.max(Number(answer.duration ?? 0.25), Number(call.duration ?? 0.25)),
      };
    });
  }

  const crowded = evaluateEnsembleCoordinationAuthority(competing);
  assert.ok(
    crowded.metrics.leadPhraseOverlap >= healthy.metrics.leadPhraseOverlap,
    JSON.stringify({ healthy: healthy.metrics, crowded: crowded.metrics }),
  );
  assert.ok(
    crowded.metrics.phraseSeparation <= healthy.metrics.phraseSeparation,
    JSON.stringify({ healthy: healthy.metrics, crowded: crowded.metrics }),
  );
  assert.ok(
    crowded.metrics.leadDialogue <= healthy.metrics.leadDialogue,
    JSON.stringify({ healthy: healthy.metrics, crowded: crowded.metrics }),
  );
});
