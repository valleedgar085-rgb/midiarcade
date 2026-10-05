import {
  createSongFingerprint,
  evaluateCandidateBalance,
  evaluateSongCandidate,
  evaluateSongReleaseGate,
  GENRE_CRITIC_PROFILES,
} from "../music-engine.js";
import { normalizeGenreId } from "./genre-contract.js";
import { createFusionPerformanceRebalanceCandidate } from "./fusion-performance-refinement.js";
import {
  createEnsembleContinuityCandidates,
  MAX_ENSEMBLE_CONTINUITY_CANDIDATES,
} from "./ensemble-continuity-refinement.js";
import {
  createBassContinuityCandidates,
  MAX_BASS_CONTINUITY_CANDIDATES,
} from "./bass-continuity-refinement.js";
import { createJazzDrumMemoryCandidate } from "./jazz-drum-memory-refinement.js";
import {
  createMelodyContinuityCandidates,
  MAX_MELODY_CONTINUITY_CANDIDATES,
} from "./melody-continuity-refinement.js";
import {
  createMelodyPhraseCandidates,
  MAX_MELODY_PHRASE_CANDIDATES,
  MIN_PHRASE_CONVERSATION_SCORE,
  MIN_MELODIC_ARC_PAYOFF_SCORE,
  MIN_PHRASE_PLACEMENT_SCORE,
} from "./melody-phrase-refinement.js";
import { evaluateMelodyPhraseIntelligence } from "./melody-phrase-intelligence.js";
import { evaluateMelodySectionMemory } from "./melody-section-memory.js";
import {
  createMelodySectionDevelopmentCandidates,
  MAX_MELODY_SECTION_DEVELOPMENT_CANDIDATES,
} from "./melody-section-development-refinement.js";
import {
  createRegisterHealthCandidates,
  MAX_REGISTER_HEALTH_CANDIDATES,
} from "./register-health-refinement.js";
import {
  createRepetitionRefinementCandidates,
  MAX_REPETITION_REFINEMENT_CANDIDATES,
  repetitionRefinementFamily,
} from "./repetition-refinement.js";
import { createBaseOutputQualityStages } from "./output-quality-pipeline.js";
import {
  createQualityEvaluationContext,
  runQualityStageSequence,
} from "./output-quality-stage-runner.js";
import { applyTransitionFxRefinement } from "./transition-fx-refinement.js";

const REGISTER_HEALTH_ATTEMPT_CEILING = 82;
const REPETITION_ATTEMPT_CEILING = 90;
const MELODY_PHRASE_ATTEMPT_CEILING = 78;
const FUSION_PERFORMANCE_FLOOR = 84;
const REGISTER_PROTECTED_DIMENSIONS = Object.freeze([
  "phraseResolution", "repetition", "memory", "motif", "separation",
]);
const REPETITION_PROTECTED_DIMENSIONS = Object.freeze([
  "phraseResolution", "memory", "motif", "registerHealth", "groove", "performance", "separation",
]);
const FUSION_PERFORMANCE_FAMILY = new Set(["pop", "hipHop", "rap"]);
const GENRE_IDENTITY_CANDIDATE_LIMIT = 1;
const FUSION_PERFORMANCE_CANDIDATE_LIMIT = 1;
const MELODY_SECTION_DEVELOPMENT_PROTECTED_DIMENSIONS = Object.freeze([
  "groove", "density", "separation", "cadence", "repetition", "transitions",
  "performance", "orchestration", "production", "drumVariety", "registerHealth",
  "stageInterlock", "genreAuthenticity",
]);

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function average(values, fallback = 0) {
  return values.length ? values.reduce((sum, value) => sum + finite(value), 0) / values.length : fallback;
}

function creativeFloor(evaluation) {
  const values = Object.values(evaluation?.subscores ?? {}).filter((value) => Number.isFinite(Number(value)));
  return values.length ? Math.min(...values.map(Number)) : 0;
}

function protectedDeltas(before, after, dimensions) {
  return Object.fromEntries(dimensions.map((dimension) => [
    dimension,
    finite(after?.subscores?.[dimension]) - finite(before?.subscores?.[dimension]),
  ]));
}

function disabledDiagnostics(candidateLimit, reason = "disabled", patch = {}) {
  return Object.freeze({
    attempted: false,
    accepted: false,
    changed: false,
    reason,
    candidatesEvaluated: 0,
    candidateLimit,
    candidateIds: [],
    ...patch,
  });
}

function repetitionTargetForSong(song) {
  const genre = normalizeGenreId(song?.genre ?? song?.meta?.genre ?? "pop");
  const profile = GENRE_CRITIC_PROFILES[genre] ?? GENRE_CRITIC_PROFILES.pop;
  return average([
    finite(song?.songBlueprint?.qualityTargets?.repetition, profile.repetition),
    finite(profile.repetition, 0.62),
  ], finite(profile.repetition, 0.62));
}

function acceptedMetadata(song, evaluation, releaseGate, stageKey, diagnostics) {
  const scoreDetails = song?.meta?.scoreDetails ?? {};
  return {
    ...(song.meta ?? {}),
    ideaFingerprint: createSongFingerprint(song),
    scoreDetails: {
      ...scoreDetails,
      totalScore: round(evaluation.score),
      subscores: { ...(evaluation.subscores ?? {}) },
      diagnostics: { ...(evaluation.diagnostics ?? {}) },
      balance: evaluateCandidateBalance(evaluation),
      releaseGate,
      outputQualityPostprocess: {
        ...(scoreDetails.outputQualityPostprocess ?? {}),
        [stageKey]: diagnostics,
      },
    },
  };
}

function assessRegisterCandidate(candidate, before, beforeFloor, evaluateCandidate, evaluateReleaseGate) {
  const after = evaluateCandidate(candidate.song);
  const release = evaluateReleaseGate(candidate.song, after);
  const beforeRegister = finite(before?.subscores?.registerHealth);
  const afterRegister = finite(after?.subscores?.registerHealth);
  const registerDelta = afterRegister - beforeRegister;
  const scoreDelta = finite(after?.score) - finite(before?.score);
  const afterFloor = creativeFloor(after);
  const floorDelta = afterFloor - beforeFloor;
  const dimensionDeltas = protectedDeltas(before, after, REGISTER_PROTECTED_DIMENSIONS);
  const protectedSafe = Object.values(dimensionDeltas).every((delta) => delta >= -1);
  const scaleSafe = finite(after?.diagnostics?.scaleFit, 0) >= 0.999999;
  const accepted = Boolean(
    release?.passed && scaleSafe && registerDelta >= 0.75 && scoreDelta >= -0.25
    && floorDelta >= -0.75 && candidate.localScoreDelta > 0 && protectedSafe
  );
  return {
    ...candidate,
    after,
    release,
    beforeRegister,
    afterRegister,
    registerDelta,
    scoreDelta,
    afterFloor,
    floorDelta,
    protectedDeltas: dimensionDeltas,
    protectedSafe,
    accepted,
    reason: !release?.passed ? "release-gate"
      : !scaleSafe ? "scale-safety"
        : candidate.localScoreDelta <= 0 ? "register-direction"
          : !protectedSafe ? "protected-melody-regression"
            : accepted ? "register-win" : "critic-regression",
  };
}

function assessRepetitionCandidate(candidate, before, beforeFloor, evaluateCandidate, evaluateReleaseGate) {
  const after = evaluateCandidate(candidate.song);
  const release = evaluateReleaseGate(candidate.song, after);
  const beforeRepetition = finite(before?.subscores?.repetition);
  const afterRepetition = finite(after?.subscores?.repetition);
  const repetitionDelta = afterRepetition - beforeRepetition;
  const scoreDelta = finite(after?.score) - finite(before?.score);
  const afterFloor = creativeFloor(after);
  const floorDelta = afterFloor - beforeFloor;
  const dimensionDeltas = protectedDeltas(before, after, REPETITION_PROTECTED_DIMENSIONS);
  const protectedSafe = Object.values(dimensionDeltas).every((delta) => delta >= -1);
  const scaleSafe = finite(after?.diagnostics?.scaleFit, 0) >= 0.999999;
  const accepted = Boolean(
    release?.passed && scaleSafe && repetitionDelta >= 0.75 && scoreDelta >= -0.25
    && floorDelta >= -0.75 && candidate.errorDelta < -1e-6 && protectedSafe
  );
  return {
    ...candidate,
    after,
    release,
    beforeRepetition,
    afterRepetition,
    repetitionDelta,
    scoreDelta,
    afterFloor,
    floorDelta,
    protectedDeltas: dimensionDeltas,
    protectedSafe,
    accepted,
    reason: !release?.passed ? "release-gate"
      : !scaleSafe ? "scale-safety"
        : candidate.errorDelta >= -1e-6 ? "repetition-direction"
          : !protectedSafe ? "protected-phrasing-regression"
            : accepted ? "repetition-win" : "critic-regression",
  };
}

function compareRegisterAssessments(left, right) {
  const registerDelta = right.registerDelta - left.registerDelta;
  if (Math.abs(registerDelta) > 1e-9) return registerDelta;
  const scoreDelta = finite(right.after?.score) - finite(left.after?.score);
  if (Math.abs(scoreDelta) > 1e-9) return scoreDelta;
  const floorDelta = right.afterFloor - left.afterFloor;
  if (Math.abs(floorDelta) > 1e-9) return floorDelta;
  return left.candidateIndex - right.candidateIndex;
}

function compareRepetitionAssessments(left, right) {
  const repetitionDelta = right.repetitionDelta - left.repetitionDelta;
  if (Math.abs(repetitionDelta) > 1e-9) return repetitionDelta;
  const scoreDelta = finite(right.after?.score) - finite(left.after?.score);
  if (Math.abs(scoreDelta) > 1e-9) return scoreDelta;
  const errorDelta = left.errorDelta - right.errorDelta;
  if (Math.abs(errorDelta) > 1e-9) return errorDelta;
  const floorDelta = right.afterFloor - left.afterFloor;
  if (Math.abs(floorDelta) > 1e-9) return floorDelta;
  return left.candidateIndex - right.candidateIndex;
}

function registerDiagnosticsFor(assessment, before, candidatesEvaluated, candidateIds) {
  return Object.freeze({
    attempted: true,
    accepted: Boolean(assessment?.accepted),
    changed: Boolean(assessment?.changedNotes),
    reason: assessment?.reason ?? "critic-regression",
    id: assessment?.id ?? null,
    changedNotes: finite(assessment?.changedNotes),
    semitones: finite(assessment?.semitones),
    candidatesEvaluated,
    candidateLimit: MAX_REGISTER_HEALTH_CANDIDATES,
    candidateIds,
    beforeScore: round(before?.score),
    afterScore: round(assessment?.after?.score),
    scoreDelta: round(assessment?.scoreDelta),
    beforeRegisterHealth: round(assessment?.beforeRegister),
    afterRegisterHealth: round(assessment?.afterRegister),
    registerHealthDelta: round(assessment?.registerDelta),
    beforeLocalScore: round(assessment?.beforeLocalScore),
    afterLocalScore: round(assessment?.afterLocalScore),
    localScoreDelta: round(assessment?.localScoreDelta),
    floorDelta: round(assessment?.floorDelta),
    protectedDeltas: Object.fromEntries(
      Object.entries(assessment?.protectedDeltas ?? {}).map(([dimension, delta]) => [dimension, round(delta)]),
    ),
  });
}

function repetitionDiagnosticsFor(assessment, before, candidatesEvaluated, candidateIds, target) {
  return Object.freeze({
    attempted: true,
    accepted: Boolean(assessment?.accepted),
    changed: Boolean(assessment?.changedNotes),
    reason: assessment?.reason ?? "critic-regression",
    id: assessment?.id ?? null,
    direction: assessment?.direction ?? null,
    changedNotes: finite(assessment?.changedNotes),
    maxShift: round(assessment?.maxShift, 4),
    candidatesEvaluated,
    candidateLimit: MAX_REPETITION_REFINEMENT_CANDIDATES,
    candidateIds,
    beforeScore: round(before?.score),
    afterScore: round(assessment?.after?.score),
    scoreDelta: round(assessment?.scoreDelta),
    beforeRepetition: round(assessment?.beforeRepetition),
    afterRepetition: round(assessment?.afterRepetition),
    repetitionDelta: round(assessment?.repetitionDelta),
    beforeActual: round(assessment?.beforeActual, 4),
    afterActual: round(assessment?.afterActual, 4),
    target: round(assessment?.target ?? target, 4),
    beforeError: round(assessment?.beforeError, 4),
    afterError: round(assessment?.afterError, 4),
    errorDelta: round(assessment?.errorDelta, 4),
    floorDelta: round(assessment?.floorDelta),
    protectedDeltas: Object.fromEntries(
      Object.entries(assessment?.protectedDeltas ?? {}).map(([dimension, delta]) => [dimension, round(delta)]),
    ),
  });
}

export function applyRepetitionRefinement(song, config, evaluateCandidate, evaluateReleaseGate) {
  if (config.repetitionRefinement !== true) {
    return { song, diagnostics: disabledDiagnostics(MAX_REPETITION_REFINEMENT_CANDIDATES) };
  }
  const genre = normalizeGenreId(song?.genre ?? song?.meta?.genre);
  const family = repetitionRefinementFamily(song);
  if (!family) {
    return { song, diagnostics: disabledDiagnostics(MAX_REPETITION_REFINEMENT_CANDIDATES, "calibrated-genre-only", { genre }) };
  }
  const before = evaluateCandidate(song);
  const beforeRepetition = finite(before?.subscores?.repetition);
  const target = repetitionTargetForSong(song);
  const popRapCalibration = family === "pop-rap-fusion";
  if (beforeRepetition >= REPETITION_ATTEMPT_CEILING && !popRapCalibration) {
    return {
      song,
      diagnostics: disabledDiagnostics(MAX_REPETITION_REFINEMENT_CANDIDATES, "already-strong", {
        beforeRepetition: round(beforeRepetition), target: round(target, 4),
      }),
    };
  }
  const candidates = createRepetitionRefinementCandidates(song, { target });
  if (!candidates.length) {
    return {
      song,
      diagnostics: Object.freeze({
        attempted: true,
        accepted: false,
        changed: false,
        reason: "no-safe-repetition-move",
        beforeRepetition: round(beforeRepetition),
        target: round(target, 4),
        candidatesEvaluated: 0,
        candidateLimit: MAX_REPETITION_REFINEMENT_CANDIDATES,
        candidateIds: [],
      }),
    };
  }
  const beforeFloor = creativeFloor(before);
  const assessments = candidates.map((candidate) => assessRepetitionCandidate(
    candidate, before, beforeFloor, evaluateCandidate, evaluateReleaseGate,
  ));
  const candidateIds = assessments.map(({ id }) => id);
  const accepted = assessments.filter(({ accepted }) => accepted).sort(compareRepetitionAssessments);
  const selected = accepted[0] ?? [...assessments].sort(compareRepetitionAssessments)[0];
  const diagnostics = repetitionDiagnosticsFor(selected, before, assessments.length, candidateIds, target);
  if (!accepted.length) return { song, diagnostics };
  selected.song.outputQualityEvolution = {
    ...(selected.song.outputQualityEvolution ?? {}),
    repetitionRefinement: {
      accepted: true,
      direction: diagnostics.direction,
      repetitionDelta: diagnostics.repetitionDelta,
      errorDelta: diagnostics.errorDelta,
      scoreDelta: diagnostics.scoreDelta,
      candidatesEvaluated: diagnostics.candidatesEvaluated,
    },
  };
  selected.song.meta = acceptedMetadata(selected.song, selected.after, selected.release, "repetitionRefinement", diagnostics);
  return { song: selected.song, diagnostics };
}

export function applyRegisterHealthRefinement(song, config, evaluateCandidate, evaluateReleaseGate) {
  if (config.registerHealthRefinement !== true) {
    return { song, diagnostics: disabledDiagnostics(MAX_REGISTER_HEALTH_CANDIDATES) };
  }
  const before = evaluateCandidate(song);
  const beforeRegister = finite(before?.subscores?.registerHealth);
  if (beforeRegister >= REGISTER_HEALTH_ATTEMPT_CEILING) {
    return {
      song,
      diagnostics: disabledDiagnostics(MAX_REGISTER_HEALTH_CANDIDATES, "already-strong", {
        beforeRegisterHealth: round(beforeRegister),
      }),
    };
  }
  const candidates = createRegisterHealthCandidates(song);
  if (!candidates.length) {
    return {
      song,
      diagnostics: Object.freeze({
        attempted: true,
        accepted: false,
        changed: false,
        reason: "no-register-opportunity",
        beforeRegisterHealth: round(beforeRegister),
        candidatesEvaluated: 0,
        candidateLimit: MAX_REGISTER_HEALTH_CANDIDATES,
        candidateIds: [],
      }),
    };
  }
  const beforeFloor = creativeFloor(before);
  const assessments = candidates.map((candidate) => assessRegisterCandidate(
    candidate, before, beforeFloor, evaluateCandidate, evaluateReleaseGate,
  ));
  const candidateIds = assessments.map(({ id }) => id);
  const accepted = assessments.filter(({ accepted }) => accepted).sort(compareRegisterAssessments);
  const selected = accepted[0] ?? [...assessments].sort(compareRegisterAssessments)[0];
  const diagnostics = registerDiagnosticsFor(selected, before, assessments.length, candidateIds);
  if (!accepted.length) return { song, diagnostics };
  selected.song.outputQualityEvolution = {
    ...(selected.song.outputQualityEvolution ?? {}),
    registerHealthRefinement: {
      accepted: true,
      scoreDelta: diagnostics.scoreDelta,
      registerHealthDelta: diagnostics.registerHealthDelta,
      localScoreDelta: diagnostics.localScoreDelta,
      candidatesEvaluated: diagnostics.candidatesEvaluated,
    },
  };
  selected.song.meta = acceptedMetadata(selected.song, selected.after, selected.release, "registerHealthRefinement", diagnostics);
  return { song: selected.song, diagnostics };
}

export function applyGenreIdentityRefinement(song, config, evaluateCandidate, evaluateReleaseGate) {
  const enabled = config.genreIdentityRefinement === true
    || (config.genreIdentityRefinement !== false && config.outputQuality?.kind === "new");
  if (!enabled) return { song, diagnostics: disabledDiagnostics(GENRE_IDENTITY_CANDIDATE_LIMIT) };
  const genre = normalizeGenreId(song?.genre ?? song?.meta?.genre);
  if (genre !== "jazz") {
    return { song, diagnostics: disabledDiagnostics(GENRE_IDENTITY_CANDIDATE_LIMIT, "calibrated-genre-only", { genre }) };
  }
  const candidate = createJazzDrumMemoryCandidate(song);
  if (!candidate) {
    return {
      song,
      diagnostics: Object.freeze({
        attempted: true,
        accepted: false,
        changed: false,
        reason: "no-safe-genre-identity-move",
        candidatesEvaluated: 0,
        candidateLimit: GENRE_IDENTITY_CANDIDATE_LIMIT,
        candidateIds: [],
      }),
    };
  }
  const before = evaluateCandidate(song);
  const after = evaluateCandidate(candidate.song);
  const release = evaluateReleaseGate(candidate.song, after);
  const scoreDelta = finite(after?.score) - finite(before?.score);
  const floorDelta = creativeFloor(after) - creativeFloor(before);
  const drumVarietyDelta = finite(after?.subscores?.drumVariety) - finite(before?.subscores?.drumVariety);
  const grooveDelta = finite(after?.subscores?.groove) - finite(before?.subscores?.groove);
  const performanceDelta = finite(after?.subscores?.performance) - finite(before?.subscores?.performance);
  const authenticityDelta = finite(after?.subscores?.genreAuthenticity) - finite(before?.subscores?.genreAuthenticity);
  const scaleSafe = finite(after?.diagnostics?.scaleFit, 0) >= 0.999999;
  const cloneSafe = candidate.adjacentDuplicatesAfter <= candidate.adjacentDuplicatesBefore;
  const accepted = Boolean(
    release?.passed && scaleSafe && cloneSafe && drumVarietyDelta >= 2
    && grooveDelta >= 0 && performanceDelta >= 0 && authenticityDelta >= 0
    && scoreDelta >= -0.25 && floorDelta >= -0.5
  );
  const diagnostics = Object.freeze({
    attempted: true,
    accepted,
    changed: accepted,
    reason: !release?.passed ? "release-gate"
      : !scaleSafe ? "scale-safety"
        : !cloneSafe ? "adjacent-clone-regression"
          : drumVarietyDelta < 2 ? "identity-direction"
            : grooveDelta < 0 || performanceDelta < 0 || authenticityDelta < 0 ? "genre-authenticity-regression"
              : scoreDelta < -0.25 || floorDelta < -0.5 ? "critic-regression"
                : "genre-identity-win",
    id: candidate.id,
    changedBars: candidate.changedBars,
    sourceBar: candidate.sourceBar,
    targetBar: candidate.targetBar,
    candidatesEvaluated: 1,
    candidateLimit: GENRE_IDENTITY_CANDIDATE_LIMIT,
    candidateIds: [candidate.id],
    beforeScore: round(before?.score),
    afterScore: round(after?.score),
    scoreDelta: round(scoreDelta),
    floorDelta: round(floorDelta),
    drumVarietyDelta: round(drumVarietyDelta),
    grooveDelta: round(grooveDelta),
    performanceDelta: round(performanceDelta),
    authenticityDelta: round(authenticityDelta),
    adjacentDuplicatesBefore: candidate.adjacentDuplicatesBefore,
    adjacentDuplicatesAfter: candidate.adjacentDuplicatesAfter,
  });
  if (!accepted) return { song, diagnostics };
  candidate.song.outputQualityEvolution = {
    ...(candidate.song.outputQualityEvolution ?? {}),
    genreIdentityRefinement: {
      accepted: true,
      id: candidate.id,
      drumVarietyDelta: diagnostics.drumVarietyDelta,
      grooveDelta: diagnostics.grooveDelta,
      scoreDelta: diagnostics.scoreDelta,
    },
  };
  candidate.song.meta = acceptedMetadata(candidate.song, after, release, "genreIdentityRefinement", diagnostics);
  return { song: candidate.song, diagnostics };
}

function noteTopologySignature(song) {
  return JSON.stringify((song?.tracks ?? []).map((track) => ({
    id: track.id,
    notes: (track.notes ?? []).map((note) => [
      finite(note.pitch), finite(note.start), finite(note.duration),
    ]),
  })));
}

export function applyFusionPerformanceRefinement(song, config, evaluateCandidate, evaluateReleaseGate) {
  const primaryGenre = normalizeGenreId(config.genre ?? song?.genre ?? song?.meta?.genre);
  const secondaryGenre = normalizeGenreId(config.secondaryGenre ?? song?.meta?.secondaryGenre);
  const calibratedFusion = config.outputQuality?.kind === "new"
    && song?.meta?.isFusion === true
    && FUSION_PERFORMANCE_FAMILY.has(primaryGenre)
    && FUSION_PERFORMANCE_FAMILY.has(secondaryGenre)
    && primaryGenre !== secondaryGenre;
  if (!calibratedFusion) {
    return {
      song,
      diagnostics: disabledDiagnostics(FUSION_PERFORMANCE_CANDIDATE_LIMIT, "calibrated-fusion-only", {
        primaryGenre,
        secondaryGenre,
      }),
    };
  }

  const before = evaluateCandidate(song);
  const beforePerformance = finite(before?.subscores?.performance);
  if (beforePerformance >= FUSION_PERFORMANCE_FLOOR) {
    return {
      song,
      diagnostics: disabledDiagnostics(FUSION_PERFORMANCE_CANDIDATE_LIMIT, "already-strong", {
        beforePerformance: round(beforePerformance),
      }),
    };
  }

  const candidate = createFusionPerformanceRebalanceCandidate(song);
  if (!candidate || candidate.changedNotes < 1) {
    return {
      song,
      diagnostics: Object.freeze({
        attempted: true,
        accepted: false,
        changed: false,
        reason: "no-dynamic-rebalance-opportunity",
        beforePerformance: round(beforePerformance),
        candidatesEvaluated: candidate ? 1 : 0,
        candidateLimit: FUSION_PERFORMANCE_CANDIDATE_LIMIT,
        candidateIds: candidate ? [candidate.id] : [],
      }),
    };
  }

  const beforeFloor = creativeFloor(before);
  const after = evaluateCandidate(candidate.song);
  const release = evaluateReleaseGate(candidate.song, after);
  const afterPerformance = finite(after?.subscores?.performance);
  const performanceDelta = afterPerformance - beforePerformance;
  const scoreDelta = finite(after?.score) - finite(before?.score);
  const floorDelta = creativeFloor(after) - beforeFloor;
  const dimensions = Object.keys(before?.subscores ?? {}).filter((dimension) => dimension !== "performance");
  const dimensionDeltas = protectedDeltas(before, after, dimensions);
  const protectedSafe = Object.values(dimensionDeltas).every((delta) => delta >= -1);
  const scaleSafe = finite(after?.diagnostics?.scaleFit, 0) >= 0.999999;
  const topologySafe = noteTopologySignature(candidate.song) === noteTopologySignature(song);
  const spreadImproved = candidate.spreadErrorAfter + 1e-6 < candidate.spreadErrorBefore;
  const accepted = Boolean(
    release?.passed && scaleSafe && topologySafe && spreadImproved && protectedSafe
    && afterPerformance >= FUSION_PERFORMANCE_FLOOR && performanceDelta >= 0.75
    && scoreDelta >= -0.25 && floorDelta >= -0.5
  );
  const diagnostics = Object.freeze({
    attempted: true,
    accepted,
    changed: accepted,
    reason: !release?.passed ? "release-gate"
      : !scaleSafe ? "scale-safety"
        : !topologySafe ? "note-topology-regression"
          : !spreadImproved ? "dynamic-spread-direction"
            : !protectedSafe ? "protected-dimension-regression"
              : afterPerformance < FUSION_PERFORMANCE_FLOOR || performanceDelta < 0.75 ? "performance-floor-not-repaired"
                : scoreDelta < -0.25 || floorDelta < -0.5 ? "critic-regression"
                  : "fusion-performance-win",
    id: candidate.id,
    primaryGenre,
    secondaryGenre,
    changedNotes: candidate.changedNotes,
    maxVelocityDelta: candidate.maxVelocityDelta,
    candidatesEvaluated: 1,
    candidateLimit: FUSION_PERFORMANCE_CANDIDATE_LIMIT,
    candidateIds: [candidate.id],
    beforeScore: round(before?.score),
    afterScore: round(after?.score),
    scoreDelta: round(scoreDelta),
    beforePerformance: round(beforePerformance),
    afterPerformance: round(afterPerformance),
    performanceDelta: round(performanceDelta),
    floorDelta: round(floorDelta),
    spreadBefore: candidate.spreadBefore,
    spreadAfter: candidate.spreadAfter,
    targetSpread: candidate.targetSpread,
    spreadErrorBefore: candidate.spreadErrorBefore,
    spreadErrorAfter: candidate.spreadErrorAfter,
    meanVelocityBefore: candidate.meanVelocityBefore,
    meanVelocityAfter: candidate.meanVelocityAfter,
    topologySafe,
    protectedDeltas: Object.fromEntries(
      Object.entries(dimensionDeltas).map(([dimension, delta]) => [dimension, round(delta)]),
    ),
  });
  if (!accepted) return { song, diagnostics };

  candidate.song.outputQualityEvolution = {
    ...(candidate.song.outputQualityEvolution ?? {}),
    fusionPerformanceRefinement: {
      accepted: true,
      performanceDelta: diagnostics.performanceDelta,
      scoreDelta: diagnostics.scoreDelta,
      changedNotes: diagnostics.changedNotes,
      spreadBefore: diagnostics.spreadBefore,
      spreadAfter: diagnostics.spreadAfter,
      targetSpread: diagnostics.targetSpread,
    },
  };
  candidate.song.meta = acceptedMetadata(
    candidate.song,
    after,
    release,
    "fusionPerformanceRefinement",
    diagnostics,
  );
  return { song: candidate.song, diagnostics };
}

function compareEnsembleContinuityAssessments(left, right) {
  const continuityDelta = left.continuityErrorDelta - right.continuityErrorDelta;
  if (Math.abs(continuityDelta) > 1e-9) return continuityDelta;
  const scoreDelta = right.scoreDelta - left.scoreDelta;
  if (Math.abs(scoreDelta) > 1e-9) return scoreDelta;
  return left.candidateIndex - right.candidateIndex;
}

function assessEnsembleContinuityCandidate(candidate, before, beforeFloor, evaluateCandidate, evaluateReleaseGate) {
  const after = evaluateCandidate(candidate.song);
  const release = evaluateReleaseGate(candidate.song, after);
  const scoreDelta = finite(after?.score) - finite(before?.score);
  const floorDelta = creativeFloor(after) - beforeFloor;
  const dimensions = Object.keys(before?.subscores ?? {});
  const dimensionDeltas = protectedDeltas(before, after, dimensions);
  const protectedSafe = Object.values(dimensionDeltas).every((delta) => delta >= -1e-9);
  const scaleSafe = finite(after?.diagnostics?.scaleFit, 0) >= 0.999999;
  const accepted = Boolean(
    release?.passed
    && scaleSafe
    && candidate.continuityErrorDelta < -1e-6
    && scoreDelta >= -1e-9
    && floorDelta >= -1e-9
    && protectedSafe
  );
  return {
    ...candidate,
    after,
    release,
    scoreDelta,
    floorDelta,
    protectedDeltas: dimensionDeltas,
    protectedSafe,
    accepted,
    reason: !release?.passed ? "release-gate"
      : !scaleSafe ? "scale-safety"
        : candidate.continuityErrorDelta >= -1e-6 ? "continuity-direction"
          : !protectedSafe ? "protected-dimension-regression"
            : scoreDelta < -1e-9 || floorDelta < -1e-9 ? "critic-regression"
              : accepted ? "continuity-win" : "critic-regression",
  };
}

export function applyEnsembleContinuityRefinement(song, config, evaluateCandidate, evaluateReleaseGate) {
  if (config.ensembleContinuityRefinement !== true) {
    return { song, diagnostics: disabledDiagnostics(MAX_ENSEMBLE_CONTINUITY_CANDIDATES) };
  }

  const candidates = createEnsembleContinuityCandidates(song);
  if (!candidates.length) {
    return {
      song,
      diagnostics: Object.freeze({
        attempted: true,
        accepted: false,
        changed: false,
        reason: "no-ensemble-dropout",
        candidatesEvaluated: 0,
        candidateLimit: MAX_ENSEMBLE_CONTINUITY_CANDIDATES,
        candidateIds: [],
      }),
    };
  }

  const before = evaluateCandidate(song);
  const beforeFloor = creativeFloor(before);
  const assessments = candidates.map((candidate) => assessEnsembleContinuityCandidate(
    candidate, before, beforeFloor, evaluateCandidate, evaluateReleaseGate,
  ));
  const candidateIds = assessments.map(({ id }) => id);
  const accepted = assessments.filter(({ accepted: isAccepted }) => isAccepted)
    .sort(compareEnsembleContinuityAssessments);
  const selected = accepted[0] ?? [...assessments].sort(compareEnsembleContinuityAssessments)[0];
  const diagnostics = Object.freeze({
    attempted: true,
    accepted: Boolean(selected?.accepted),
    changed: Boolean(selected?.accepted && selected?.changedNotes),
    reason: selected?.reason ?? "critic-regression",
    id: selected?.id ?? null,
    changedNotes: finite(selected?.changedNotes),
    weakestTrackId: selected?.weakestTrackId ?? null,
    weakestSectionId: selected?.weakestSectionId ?? null,
    candidatesEvaluated: assessments.length,
    candidateLimit: MAX_ENSEMBLE_CONTINUITY_CANDIDATES,
    candidateIds,
    candidateSummaries: assessments.map((assessment) => ({
      id: assessment.id,
      accepted: Boolean(assessment.accepted),
      reason: assessment.reason,
      changedNotes: finite(assessment.changedNotes),
      afterContinuityDeficit: round(assessment.afterContinuityDeficit, 4),
      continuityErrorDelta: round(assessment.continuityErrorDelta, 4),
      scoreDelta: round(assessment.scoreDelta),
      floorDelta: round(assessment.floorDelta),
    })),
    beforeScore: round(before?.score),
    afterScore: round(selected?.after?.score),
    scoreDelta: round(selected?.scoreDelta),
    beforeContinuityDeficit: round(selected?.beforeContinuityDeficit, 4),
    afterContinuityDeficit: round(selected?.afterContinuityDeficit, 4),
    continuityErrorDelta: round(selected?.continuityErrorDelta, 4),
    floorDelta: round(selected?.floorDelta),
    protectedDeltas: Object.fromEntries(
      Object.entries(selected?.protectedDeltas ?? {}).map(([dimension, delta]) => [dimension, round(delta)]),
    ),
  });
  if (!accepted.length) return { song, diagnostics };

  selected.song.outputQualityEvolution = {
    ...(selected.song.outputQualityEvolution ?? {}),
    ensembleContinuityRefinement: {
      accepted: true,
      changedNotes: diagnostics.changedNotes,
      continuityErrorDelta: diagnostics.continuityErrorDelta,
      scoreDelta: diagnostics.scoreDelta,
      candidatesEvaluated: diagnostics.candidatesEvaluated,
    },
  };
  selected.song.meta = acceptedMetadata(
    selected.song,
    selected.after,
    selected.release,
    "ensembleContinuityRefinement",
    diagnostics,
  );
  return { song: selected.song, diagnostics };
}

function compareBassContinuityAssessments(left, right) {
  const continuityDelta = left.continuityErrorDelta - right.continuityErrorDelta;
  if (Math.abs(continuityDelta) > 1e-9) return continuityDelta;
  const scoreDelta = right.scoreDelta - left.scoreDelta;
  if (Math.abs(scoreDelta) > 1e-9) return scoreDelta;
  return left.candidateIndex - right.candidateIndex;
}

function assessBassContinuityCandidate(candidate, before, beforeFloor, evaluateCandidate, evaluateReleaseGate) {
  const after = evaluateCandidate(candidate.song);
  const release = evaluateReleaseGate(candidate.song, after);
  const scoreDelta = finite(after?.score) - finite(before?.score);
  const floorDelta = creativeFloor(after) - beforeFloor;
  const dimensions = Object.keys(before?.subscores ?? {});
  const dimensionDeltas = protectedDeltas(before, after, dimensions);
  const protectedSafe = Object.values(dimensionDeltas).every((delta) => delta >= -1e-9);
  const scaleSafe = finite(after?.diagnostics?.scaleFit, 0) >= 0.999999;
  const accepted = Boolean(
    release?.passed
    && scaleSafe
    && candidate.continuityErrorDelta < -1e-6
    && scoreDelta >= -1e-9
    && floorDelta >= -1e-9
    && protectedSafe
  );
  return {
    ...candidate,
    after,
    release,
    scoreDelta,
    floorDelta,
    protectedDeltas: dimensionDeltas,
    protectedSafe,
    accepted,
    reason: !release?.passed ? "release-gate"
      : !scaleSafe ? "scale-safety"
        : candidate.continuityErrorDelta >= -1e-6 ? "continuity-direction"
          : !protectedSafe ? "protected-dimension-regression"
            : scoreDelta < -1e-9 || floorDelta < -1e-9 ? "critic-regression"
              : accepted ? "continuity-win" : "critic-regression",
  };
}

export function applyBassContinuityRefinement(song, config, evaluateCandidate, evaluateReleaseGate) {
  if (config.bassContinuityRefinement !== true) {
    return { song, diagnostics: disabledDiagnostics(MAX_BASS_CONTINUITY_CANDIDATES) };
  }

  const candidates = createBassContinuityCandidates(song);
  if (!candidates.length) {
    return {
      song,
      diagnostics: Object.freeze({
        attempted: true,
        accepted: false,
        changed: false,
        reason: "no-bass-foundation-dropout",
        candidatesEvaluated: 0,
        candidateLimit: MAX_BASS_CONTINUITY_CANDIDATES,
        candidateIds: [],
      }),
    };
  }

  const before = evaluateCandidate(song);
  const beforeFloor = creativeFloor(before);
  const assessments = candidates.map((candidate) => assessBassContinuityCandidate(
    candidate, before, beforeFloor, evaluateCandidate, evaluateReleaseGate,
  ));
  const candidateIds = assessments.map(({ id }) => id);
  const accepted = assessments.filter(({ accepted: isAccepted }) => isAccepted)
    .sort(compareBassContinuityAssessments);
  const selected = accepted[0] ?? [...assessments].sort(compareBassContinuityAssessments)[0];
  const diagnostics = Object.freeze({
    attempted: true,
    accepted: Boolean(selected?.accepted),
    changed: Boolean(selected?.accepted && selected?.changedNotes),
    reason: selected?.reason ?? "critic-regression",
    id: selected?.id ?? null,
    changedNotes: finite(selected?.changedNotes),
    weakestSectionId: selected?.weakestSectionId ?? null,
    candidatesEvaluated: assessments.length,
    candidateLimit: MAX_BASS_CONTINUITY_CANDIDATES,
    candidateIds,
    beforeScore: round(before?.score),
    afterScore: round(selected?.after?.score),
    scoreDelta: round(selected?.scoreDelta),
    beforeContinuityDeficit: round(selected?.beforeContinuityDeficit, 4),
    afterContinuityDeficit: round(selected?.afterContinuityDeficit, 4),
    continuityErrorDelta: round(selected?.continuityErrorDelta, 4),
    floorDelta: round(selected?.floorDelta),
    protectedDeltas: Object.fromEntries(
      Object.entries(selected?.protectedDeltas ?? {}).map(([dimension, delta]) => [dimension, round(delta)]),
    ),
  });
  if (!accepted.length) return { song, diagnostics };

  selected.song.outputQualityEvolution = {
    ...(selected.song.outputQualityEvolution ?? {}),
    bassContinuityRefinement: {
      accepted: true,
      changedNotes: diagnostics.changedNotes,
      continuityErrorDelta: diagnostics.continuityErrorDelta,
      scoreDelta: diagnostics.scoreDelta,
      candidatesEvaluated: diagnostics.candidatesEvaluated,
    },
  };
  selected.song.meta = acceptedMetadata(
    selected.song,
    selected.after,
    selected.release,
    "bassContinuityRefinement",
    diagnostics,
  );
  return { song: selected.song, diagnostics };
}

function compareMelodyContinuityAssessments(left, right) {
  const continuityDelta = left.continuityErrorDelta - right.continuityErrorDelta;
  if (Math.abs(continuityDelta) > 1e-9) return continuityDelta;
  const scoreDelta = right.scoreDelta - left.scoreDelta;
  if (Math.abs(scoreDelta) > 1e-9) return scoreDelta;
  return left.candidateIndex - right.candidateIndex;
}

function melodyContinuityCriticSong(song) {
  return {
    ...song,
    tracks: (song?.tracks ?? []).map((track) => track?.id === "melody"
      ? {
        ...track,
        notes: (track.notes ?? []).filter((note) => note?.continuityRole !== "phrase-link"),
      }
      : track),
  };
}

function assessMelodyContinuityCandidate(candidate, before, beforeFloor, evaluateCandidate, evaluateReleaseGate) {
  const criticAfter = evaluateCandidate(melodyContinuityCriticSong(candidate.song));
  const actualAfter = evaluateCandidate(candidate.song);
  const release = evaluateReleaseGate(candidate.song, actualAfter);
  const scoreDelta = finite(actualAfter?.score) - finite(before?.score);
  const actualFloorDelta = creativeFloor(actualAfter) - beforeFloor;
  const criticFloorDelta = creativeFloor(criticAfter) - beforeFloor;
  const floorDelta = criticFloorDelta;
  const dimensions = Object.keys(before?.subscores ?? {});
  const dimensionDeltas = protectedDeltas(before, criticAfter, dimensions);
  const protectedSafe = Object.values(dimensionDeltas).every((delta) => delta >= -1e-9);
  const scaleSafe = finite(actualAfter?.diagnostics?.scaleFit, 0) >= 0.999999;
  const changedNotes = Math.max(1, Math.round(finite(candidate.changedNotes, 1)));
  const maxScoreCost = changedNotes <= 1
    ? 1
    : Math.min(4, 1 + Math.ceil(changedNotes / 8));
  const maxFloorCost = changedNotes >= 16 ? 2 : 1;
  const accepted = Boolean(
    release?.passed
    && scaleSafe
    && candidate.continuityErrorDelta < -1e-6
    && scoreDelta >= -maxScoreCost
    && floorDelta >= -maxFloorCost
    && protectedSafe
  );
  return {
    ...candidate,
    after: actualAfter,
    criticAfter,
    release,
    scoreDelta,
    floorDelta,
    actualFloorDelta,
    criticFloorDelta,
    maxScoreCost,
    maxFloorCost,
    protectedDeltas: dimensionDeltas,
    protectedSafe,
    accepted,
    reason: !release?.passed ? "release-gate"
      : !scaleSafe ? "scale-safety"
        : candidate.continuityErrorDelta >= -1e-6 ? "continuity-direction"
          : !protectedSafe ? "protected-dimension-regression"
            : scoreDelta < -maxScoreCost || floorDelta < -maxFloorCost ? "full-song-regression"
              : accepted ? "continuity-win" : "critic-regression",
  };
}

export function applyMelodyContinuityRefinement(song, config, evaluateCandidate, evaluateReleaseGate) {
  if (config.melodyContinuityRefinement !== true || config.isFusion === true || Boolean(config.secondaryGenre)) {
    return { song, diagnostics: disabledDiagnostics(MAX_MELODY_CONTINUITY_CANDIDATES) };
  }

  const candidates = createMelodyContinuityCandidates(song);
  if (!candidates.length) {
    return {
      song,
      diagnostics: Object.freeze({
        attempted: true,
        accepted: false,
        changed: false,
        reason: "no-starved-melody-gap",
        candidatesEvaluated: 0,
        candidateLimit: MAX_MELODY_CONTINUITY_CANDIDATES,
        candidateIds: [],
      }),
    };
  }

  const before = evaluateCandidate(song);
  const beforeFloor = creativeFloor(before);
  const assessments = candidates.map((candidate) => assessMelodyContinuityCandidate(
    candidate, before, beforeFloor, evaluateCandidate, evaluateReleaseGate,
  ));
  const candidateIds = assessments.map(({ id }) => id);
  const accepted = assessments.filter(({ accepted: isAccepted }) => isAccepted)
    .sort(compareMelodyContinuityAssessments);
  const selected = accepted[0] ?? [...assessments].sort(compareMelodyContinuityAssessments)[0];
  const diagnostics = Object.freeze({
    attempted: true,
    accepted: Boolean(selected?.accepted),
    changed: Boolean(selected?.accepted && selected?.changedNotes),
    reason: selected?.reason ?? "critic-regression",
    id: selected?.id ?? null,
    changedNotes: finite(selected?.changedNotes),
    weakestSectionId: selected?.weakestSectionId ?? null,
    candidatesEvaluated: assessments.length,
    candidateLimit: MAX_MELODY_CONTINUITY_CANDIDATES,
    candidateIds,
    candidateSummaries: assessments.map((assessment) => ({
      id: assessment.id,
      accepted: Boolean(assessment.accepted),
      reason: assessment.reason,
      changedNotes: finite(assessment.changedNotes),
      afterContinuityDeficit: round(assessment.afterContinuityDeficit, 4),
      continuityErrorDelta: round(assessment.continuityErrorDelta, 4),
      actualScore: round(assessment.after?.score),
      criticViewScore: round(assessment.criticAfter?.score),
      scoreDelta: round(assessment.scoreDelta),
      maxScoreCost: finite(assessment.maxScoreCost),
      floorDelta: round(assessment.floorDelta),
      actualFloorDelta: round(assessment.actualFloorDelta),
      criticFloorDelta: round(assessment.criticFloorDelta),
      maxFloorCost: finite(assessment.maxFloorCost),
      releaseFailures: [...(assessment.release?.failures ?? [])],
    })),
    beforeScore: round(before?.score),
    afterScore: round(selected?.after?.score),
    scoreDelta: round(selected?.scoreDelta),
    beforeContinuityDeficit: round(selected?.beforeContinuityDeficit, 4),
    afterContinuityDeficit: round(selected?.afterContinuityDeficit, 4),
    continuityErrorDelta: round(selected?.continuityErrorDelta, 4),
    floorDelta: round(selected?.floorDelta),
    actualFloorDelta: round(selected?.actualFloorDelta),
    criticFloorDelta: round(selected?.criticFloorDelta),
    criticViewScore: round(selected?.criticAfter?.score),
    maxScoreCost: finite(selected?.maxScoreCost),
    maxFloorCost: finite(selected?.maxFloorCost),
    releaseFailures: [...(selected?.release?.failures ?? [])],
    protectedDeltas: Object.fromEntries(
      Object.entries(selected?.protectedDeltas ?? {}).map(([dimension, delta]) => [dimension, round(delta)]),
    ),
  });
  if (!accepted.length) return { song, diagnostics };

  selected.song.outputQualityEvolution = {
    ...(selected.song.outputQualityEvolution ?? {}),
    melodyContinuityRefinement: {
      accepted: true,
      changedNotes: diagnostics.changedNotes,
      continuityErrorDelta: diagnostics.continuityErrorDelta,
      scoreDelta: diagnostics.scoreDelta,
      candidatesEvaluated: diagnostics.candidatesEvaluated,
    },
  };
  selected.song.meta = acceptedMetadata(
    selected.song,
    selected.after,
    selected.release,
    "melodyContinuityRefinement",
    diagnostics,
  );
  return { song: selected.song, diagnostics };
}

function compareMelodyPhraseAssessments(left, right) {
  const placementNeeded = Math.min(
    finite(left?.beforePlacementScore, 1),
    finite(right?.beforePlacementScore, 1),
  ) < MIN_PHRASE_PLACEMENT_SCORE;
  if (placementNeeded) {
    const placementDelta = finite(right?.placementDelta) - finite(left?.placementDelta);
    if (Math.abs(placementDelta) > 1e-9) return placementDelta;
  }
  const conversationNeeded = Math.min(
    finite(left?.beforeConversationScore, 1),
    finite(right?.beforeConversationScore, 1),
  ) < MIN_PHRASE_CONVERSATION_SCORE;
  if (conversationNeeded) {
    const conversationDelta = finite(right?.conversationDelta) - finite(left?.conversationDelta);
    if (Math.abs(conversationDelta) > 1e-9) return conversationDelta;
  }
  const arcNeeded = Math.min(
    finite(left?.beforeArcScore, 1),
    finite(right?.beforeArcScore, 1),
  ) < MIN_MELODIC_ARC_PAYOFF_SCORE;
  if (arcNeeded) {
    const arcDelta = finite(right?.arcDelta) - finite(left?.arcDelta);
    if (Math.abs(arcDelta) > 1e-9) return arcDelta;
  }
    const phraseDelta = right.phraseScoreDelta - left.phraseScoreDelta;
  if (Math.abs(phraseDelta) > 1e-9) return phraseDelta;
  const scoreDelta = right.scoreDelta - left.scoreDelta;
  if (Math.abs(scoreDelta) > 1e-9) return scoreDelta;
  return left.candidateIndex - right.candidateIndex;
}

function assessMelodyPhraseCandidate(candidate, before, beforeFloor, evaluateCandidate, evaluateReleaseGate) {
  const after = evaluateCandidate(candidate.song);
  const release = evaluateReleaseGate(candidate.song, after);
  const scoreDelta = finite(after?.score) - finite(before?.score);
  const floorDelta = creativeFloor(after) - beforeFloor;
  const dimensions = Object.keys(before?.subscores ?? {});
  const dimensionDeltas = protectedDeltas(before, after, dimensions);
  const protectedSafe = Object.values(dimensionDeltas).every((delta) => delta >= -1e-9);
  const scaleSafe = finite(after?.diagnostics?.scaleFit, 0) >= 0.999999;
  const placementGain = finite(candidate?.placementDelta, 0);
  const conversationGain = finite(candidate?.conversationDelta, 0);
  const arcGain = finite(candidate?.arcDelta, 0);
  const intentGain = candidate.phraseScoreDelta >= 3
    || (
      placementGain >= 0.08
      && candidate.phraseScoreDelta >= -1
    )
    || (
      conversationGain >= 0.08
      && candidate.phraseScoreDelta >= -1
    )
    || (
      arcGain >= 0.08
      && candidate.phraseScoreDelta >= -1
    );
  const accepted = Boolean(
    release?.passed
    && scaleSafe
    && intentGain
    && scoreDelta >= -0.5
    && floorDelta >= -0.5
    && protectedSafe
  );
  return {
    ...candidate,
    after,
    release,
    scoreDelta,
    floorDelta,
    protectedDeltas: dimensionDeltas,
    protectedSafe,
    accepted,
    reason: !release?.passed ? "release-gate"
      : !scaleSafe ? "scale-safety"
        : !intentGain ? "phrase-gain-too-small"
          : !protectedSafe ? "protected-dimension-regression"
            : scoreDelta < -0.5 || floorDelta < -0.5 ? "full-song-regression"
              : accepted ? "melody-phrase-win" : "critic-regression",
  };
}

export function applyMelodyPhraseRefinement(song, config, evaluateCandidate, evaluateReleaseGate) {
  if (config.melodyPhraseRefinement !== true || config.isFusion === true || Boolean(config.secondaryGenre)) {
    return { song, diagnostics: disabledDiagnostics(MAX_MELODY_PHRASE_CANDIDATES) };
  }

  const phraseBefore = evaluateMelodyPhraseIntelligence(song);
  const leapDiscipline = finite(phraseBefore?.weakestSection?.metrics?.leapDiscipline, 1);
  const phrasePlacement = finite(
    phraseBefore?.weakestPlacementSection?.metrics?.phrasePlacement,
    1,
  );
  const phraseConversation = finite(
    phraseBefore?.weakestConversationSection?.metrics?.phraseConversation,
    1,
  );
  const melodicArcPayoff = finite(
    phraseBefore?.weakestArcSection?.metrics?.melodicArcPayoff,
    1,
  );
  if (
    phraseBefore.passed
    && phraseBefore.score >= MELODY_PHRASE_ATTEMPT_CEILING
    && leapDiscipline >= 0.72
    && phrasePlacement >= MIN_PHRASE_PLACEMENT_SCORE
    && phraseConversation >= MIN_PHRASE_CONVERSATION_SCORE
    && melodicArcPayoff >= MIN_MELODIC_ARC_PAYOFF_SCORE
  ) {
    return {
      song,
      diagnostics: disabledDiagnostics(MAX_MELODY_PHRASE_CANDIDATES, "already-strong", {
        beforePhraseScore: phraseBefore.score,
        leapDiscipline: round(leapDiscipline, 3),
        phrasePlacement: round(phrasePlacement, 3),
        phraseConversation: round(phraseConversation, 3),
        melodicArcPayoff: round(melodicArcPayoff, 3),
      }),
    };
  }

  const candidates = createMelodyPhraseCandidates(song);
  if (!candidates.length) {
    return {
      song,
      diagnostics: Object.freeze({
        attempted: true,
        accepted: false,
        changed: false,
        reason: "no-improving-melody-phrase-candidate",
        candidatesEvaluated: 0,
        candidateLimit: MAX_MELODY_PHRASE_CANDIDATES,
        candidateIds: [],
      }),
    };
  }

  const before = evaluateCandidate(song);
  const beforeFloor = creativeFloor(before);
  const assessments = candidates.map((candidate) => assessMelodyPhraseCandidate(
    candidate, before, beforeFloor, evaluateCandidate, evaluateReleaseGate,
  ));
  const candidateIds = assessments.map(({ id }) => id);
  const accepted = assessments.filter(({ accepted: isAccepted }) => isAccepted)
    .sort(compareMelodyPhraseAssessments);
  const selected = accepted[0] ?? [...assessments].sort(compareMelodyPhraseAssessments)[0];
  const diagnostics = Object.freeze({
    attempted: true,
    accepted: Boolean(selected?.accepted),
    changed: Boolean(selected?.accepted && selected?.changedNotes),
    reason: selected?.reason ?? "critic-regression",
    id: selected?.id ?? null,
    changedNotes: finite(selected?.changedNotes),
    weakestSectionId: selected?.weakestSectionId ?? null,
    candidatesEvaluated: assessments.length,
    candidateLimit: MAX_MELODY_PHRASE_CANDIDATES,
    candidateIds,
    authorityId: selected?.authorityId ?? null,
    authorityPhase: selected?.authorityPhase ?? null,
    beforePhraseScore: finite(selected?.beforePhraseScore),
    afterPhraseScore: finite(selected?.afterPhraseScore),
    phraseScoreDelta: finite(selected?.phraseScoreDelta),
    beforePlacementScore: round(selected?.beforePlacementScore, 3),
    afterPlacementScore: round(selected?.afterPlacementScore, 3),
    placementDelta: round(selected?.placementDelta, 3),
    beforeConversationScore: round(selected?.beforeConversationScore, 3),
    afterConversationScore: round(selected?.afterConversationScore, 3),
    conversationDelta: round(selected?.conversationDelta, 3),
    beforeArcScore: round(selected?.beforeArcScore, 3),
    afterArcScore: round(selected?.afterArcScore, 3),
    arcDelta: round(selected?.arcDelta, 3),
    beforeScore: round(before?.score),
    afterScore: round(selected?.after?.score),
    scoreDelta: round(selected?.scoreDelta),
    floorDelta: round(selected?.floorDelta),
    protectedDeltas: Object.fromEntries(
      Object.entries(selected?.protectedDeltas ?? {}).map(([dimension, delta]) => [dimension, round(delta)]),
    ),
  });
  if (!accepted.length) return { song, diagnostics };

  selected.song.outputQualityEvolution = {
    ...(selected.song.outputQualityEvolution ?? {}),
    melodyPhraseRefinement: {
      accepted: true,
      changedNotes: diagnostics.changedNotes,
      authorityId: diagnostics.authorityId,
      authorityPhase: diagnostics.authorityPhase,
      phraseScoreDelta: diagnostics.phraseScoreDelta,
      placementDelta: diagnostics.placementDelta,
      conversationDelta: diagnostics.conversationDelta,
      arcDelta: diagnostics.arcDelta,
      scoreDelta: diagnostics.scoreDelta,
      candidatesEvaluated: diagnostics.candidatesEvaluated,
    },
  };
  selected.song.meta = acceptedMetadata(
    selected.song,
    selected.after,
    selected.release,
    "melodyPhraseRefinement",
    diagnostics,
  );
  return { song: selected.song, diagnostics };
}

function compareMelodySectionDevelopmentAssessments(left, right) {
  const passedDelta = Number(right.afterReport?.passed === true) - Number(left.afterReport?.passed === true);
  if (passedDelta) return passedDelta;
  const sectionDelta = right.sectionScoreDelta - left.sectionScoreDelta;
  if (Math.abs(sectionDelta) > 1e-9) return sectionDelta;
  const memoryDelta = right.memoryScoreDelta - left.memoryScoreDelta;
  if (Math.abs(memoryDelta) > 1e-9) return memoryDelta;
  const scoreDelta = right.scoreDelta - left.scoreDelta;
  if (Math.abs(scoreDelta) > 1e-9) return scoreDelta;
  return left.candidateIndex - right.candidateIndex;
}

function assessMelodySectionDevelopmentCandidate(candidate, before, beforeFloor, evaluateCandidate, evaluateReleaseGate) {
  const after = evaluateCandidate(candidate.song);
  const release = evaluateReleaseGate(candidate.song, after);
  const scoreDelta = finite(after?.score) - finite(before?.score);
  const floorDelta = creativeFloor(after) - beforeFloor;
  const dimensions = MELODY_SECTION_DEVELOPMENT_PROTECTED_DIMENSIONS.filter((dimension) => (
    Object.hasOwn(before?.subscores ?? {}, dimension)
  ));
  const dimensionDeltas = protectedDeltas(before, after, dimensions);
  const protectedSafe = Object.values(dimensionDeltas).every((delta) => delta >= -1);
  const scaleSafe = finite(after?.diagnostics?.scaleFit, 0) >= 0.999999;
  const localImprovement = candidate.sectionScoreDelta >= 4 || candidate.afterReport?.passed === true;
  const accepted = Boolean(
    release?.passed
    && scaleSafe
    && localImprovement
    && candidate.memoryScoreDelta > 0
    && scoreDelta >= -1
    && floorDelta >= -1
    && protectedSafe
  );
  return {
    ...candidate,
    after,
    release,
    scoreDelta,
    floorDelta,
    protectedDeltas: dimensionDeltas,
    protectedSafe,
    accepted,
    reason: !release?.passed ? "release-gate"
      : !scaleSafe ? "scale-safety"
        : !localImprovement ? "memory-gain-too-small"
          : !protectedSafe ? "protected-dimension-regression"
            : scoreDelta < -1 || floorDelta < -1 ? "full-song-regression"
              : accepted ? "melody-section-development-win" : "critic-regression",
  };
}

export function applyMelodySectionDevelopmentRefinement(song, config, evaluateCandidate, evaluateReleaseGate) {
  if (config.melodySectionDevelopmentRefinement !== true) {
    return { song, diagnostics: disabledDiagnostics(MAX_MELODY_SECTION_DEVELOPMENT_CANDIDATES) };
  }
  const initialMemory = evaluateMelodySectionMemory(song);
  if (initialMemory.status !== "evaluated") {
    return {
      song,
      diagnostics: disabledDiagnostics(MAX_MELODY_SECTION_DEVELOPMENT_CANDIDATES, initialMemory.reason, {
        beforeMemoryScore: initialMemory.score,
        memoryStatus: initialMemory.status,
      }),
    };
  }
  if (initialMemory.passed) {
    return {
      song,
      diagnostics: disabledDiagnostics(MAX_MELODY_SECTION_DEVELOPMENT_CANDIDATES, "already-strong", {
        beforeMemoryScore: initialMemory.score,
        memoryStatus: initialMemory.status,
      }),
    };
  }

  const maxPasses = 3;
  let currentSong = song;
  let currentMemory = initialMemory;
  let currentEvaluation = evaluateCandidate(song);
  let currentFloor = creativeFloor(currentEvaluation);
  const passes = [];
  const candidateIds = [];
  let totalChangedNotes = 0;
  let lastAccepted = null;

  for (let passIndex = 0; passIndex < maxPasses && !currentMemory.passed; passIndex += 1) {
    const candidates = createMelodySectionDevelopmentCandidates(currentSong);
    if (!candidates.length) {
      passes.push(Object.freeze({
        pass: passIndex + 1,
        attempted: true,
        accepted: false,
        reason: "no-improving-section-development-candidate",
        beforeMemoryScore: currentMemory.score,
        weakestSectionId: currentMemory.weakestSection?.sectionId ?? null,
        candidateIds: Object.freeze([]),
      }));
      break;
    }

    const assessments = candidates.map((candidate) => assessMelodySectionDevelopmentCandidate(
      candidate,
      currentEvaluation,
      currentFloor,
      evaluateCandidate,
      evaluateReleaseGate,
    ));
    candidateIds.push(...assessments.map(({ id }) => id));
    const accepted = assessments.filter((entry) => entry.accepted)
      .sort(compareMelodySectionDevelopmentAssessments);
    const selected = accepted[0] ?? [...assessments].sort(compareMelodySectionDevelopmentAssessments)[0];
    passes.push(Object.freeze({
      pass: passIndex + 1,
      attempted: true,
      accepted: Boolean(selected?.accepted),
      reason: selected?.reason ?? "critic-regression",
      id: selected?.id ?? null,
      sectionId: selected?.sectionId ?? null,
      sourceSectionId: selected?.sourceSectionId ?? null,
      relationship: selected?.relationship ?? null,
      changedNotes: finite(selected?.changedNotes),
      beforeMemoryScore: finite(selected?.beforeMemoryScore),
      afterMemoryScore: finite(selected?.afterMemoryScore),
      memoryScoreDelta: finite(selected?.memoryScoreDelta),
      beforeSectionScore: finite(selected?.beforeSectionScore),
      afterSectionScore: finite(selected?.afterSectionScore),
      sectionScoreDelta: finite(selected?.sectionScoreDelta),
      scoreDelta: round(selected?.scoreDelta),
      floorDelta: round(selected?.floorDelta),
      candidateIds: Object.freeze(assessments.map(({ id }) => id)),
      protectedDeltas: Object.freeze(Object.fromEntries(
        Object.entries(selected?.protectedDeltas ?? {}).map(([dimension, delta]) => [dimension, round(delta)]),
      )),
    }));
    if (!accepted.length) break;

    lastAccepted = selected;
    currentSong = selected.song;
    currentMemory = evaluateMelodySectionMemory(currentSong);
    currentEvaluation = selected.after;
    currentFloor = creativeFloor(currentEvaluation);
    totalChangedNotes += Math.max(0, Math.round(finite(selected.changedNotes)));
  }

  const acceptedPasses = passes.filter((entry) => entry.accepted);
  const finalMemory = evaluateMelodySectionMemory(currentSong);
  const finalEvaluation = acceptedPasses.length ? evaluateCandidate(currentSong) : currentEvaluation;
  const finalRelease = acceptedPasses.length
    ? evaluateReleaseGate(currentSong, finalEvaluation)
    : null;
  const diagnostics = Object.freeze({
    attempted: true,
    accepted: acceptedPasses.length > 0,
    changed: acceptedPasses.length > 0 && totalChangedNotes > 0,
    reason: finalMemory.passed
      ? "melody-section-development-win"
      : acceptedPasses.length
        ? "partial-melody-section-development"
        : passes.at(-1)?.reason ?? "no-improving-section-development-candidate",
    changedNotes: totalChangedNotes,
    passesAttempted: passes.length,
    passesAccepted: acceptedPasses.length,
    passLimit: maxPasses,
    candidatesEvaluated: candidateIds.length,
    candidateLimit: MAX_MELODY_SECTION_DEVELOPMENT_CANDIDATES,
    candidateIds: Object.freeze(candidateIds),
    beforeMemoryScore: initialMemory.score,
    afterMemoryScore: finalMemory.score,
    memoryScoreDelta: finalMemory.score - initialMemory.score,
    finalMemoryPassed: finalMemory.passed,
    finalMemoryReason: finalMemory.reason,
    weakestSectionId: finalMemory.weakestSection?.sectionId ?? null,
    beforeScore: round(evaluateCandidate(song)?.score),
    afterScore: round(finalEvaluation?.score),
    scoreDelta: round(finite(finalEvaluation?.score) - finite(evaluateCandidate(song)?.score)),
    passes: Object.freeze(passes),
  });
  if (!acceptedPasses.length) return { song, diagnostics };

  currentSong.outputQualityEvolution = {
    ...(currentSong.outputQualityEvolution ?? {}),
    melodySectionDevelopmentRefinement: {
      accepted: true,
      changedNotes: diagnostics.changedNotes,
      passesAccepted: diagnostics.passesAccepted,
      memoryScoreDelta: diagnostics.memoryScoreDelta,
      finalMemoryPassed: diagnostics.finalMemoryPassed,
      candidatesEvaluated: diagnostics.candidatesEvaluated,
    },
  };
  currentSong.meta = acceptedMetadata(
    currentSong,
    finalEvaluation,
    finalRelease ?? lastAccepted?.release,
    "melodySectionDevelopmentRefinement",
    diagnostics,
  );
  return { song: currentSong, diagnostics };
}

export function applyMelodySectionMemoryAudit(song) {
  const report = evaluateMelodySectionMemory(song);
  return {
    song,
    diagnostics: Object.freeze({
      attempted: true,
      accepted: false,
      changed: false,
      finalAudit: true,
      ...report,
    }),
  };
}

export function applySongOutputQualityPipeline(song, config = {}, {
  evaluateCandidate = evaluateSongCandidate,
  evaluateReleaseGate = evaluateSongReleaseGate,
} = {}) {
  const evaluators = createQualityEvaluationContext({ evaluateCandidate, evaluateReleaseGate });
  const evaluate = evaluators.evaluateCandidate;
  const release = evaluators.evaluateReleaseGate;
  const fusionRequest = config.isFusion === true || Boolean(config.secondaryGenre);
  const phraseConfig = config.phraseResolutionRefinement == null && fusionRequest
    ? { ...config, phraseResolutionRefinement: true }
    : config;
  const registerConfig = config.registerHealthRefinement == null && fusionRequest
    ? { ...config, registerHealthRefinement: true }
    : config;
  const sequence = runQualityStageSequence(song, [
    ...createBaseOutputQualityStages(config, evaluate, release, { phraseConfig }),
    { id: "repetitionRefinement", run: (current) => applyRepetitionRefinement(current, config, evaluate, release) },
    { id: "registerHealthRefinement", run: (current) => applyRegisterHealthRefinement(current, registerConfig, evaluate, release) },
    { id: "fusionPerformanceRefinement", run: (current) => applyFusionPerformanceRefinement(current, config, evaluate, release) },
    { id: "melodyContinuityRefinement", run: (current) => applyMelodyContinuityRefinement(current, config, evaluate, release) },
    { id: "melodyPhraseRefinement", run: (current) => applyMelodyPhraseRefinement(current, config, evaluate, release) },
    { id: "melodySectionDevelopmentRefinement", run: (current) => applyMelodySectionDevelopmentRefinement(current, config, evaluate, release) },
    { id: "bassContinuityRefinement", run: (current) => applyBassContinuityRefinement(current, config, evaluate, release) },
    { id: "ensembleContinuityRefinement", run: (current) => applyEnsembleContinuityRefinement(current, config, evaluate, release) },
    // Genre identity is the final note-writing stage. Transition FX runs after it
    // because it is automation-only and cannot rewrite pitch, rhythm, or phrasing.
    { id: "genreIdentityRefinement", run: (current) => applyGenreIdentityRefinement(current, config, evaluate, release) },
    { id: "transitionFxRefinement", run: (current) => applyTransitionFxRefinement(current, config, evaluate, release) },
    { id: "melodySectionMemoryAudit", run: (current) => applyMelodySectionMemoryAudit(current) },
  ], {
    repairAuthority: config?.generationRepairAuthority ?? null,
  });
  const diagnostics = sequence.diagnostics;
  return {
    song: sequence.song,
    diagnostics: diagnostics.arrangement,
    returnDiagnostics: diagnostics.returnDevelopment,
    grooveDiagnostics: diagnostics.groovePocket,
    densityDiagnostics: diagnostics.densityRefinement,
    phraseResolutionDiagnostics: diagnostics.phraseResolutionRefinement,
    repetitionDiagnostics: diagnostics.repetitionRefinement,
    registerHealthDiagnostics: diagnostics.registerHealthRefinement,
    genreIdentityDiagnostics: diagnostics.genreIdentityRefinement,
    fusionPerformanceDiagnostics: diagnostics.fusionPerformanceRefinement,
    melodyContinuityDiagnostics: diagnostics.melodyContinuityRefinement,
    melodyPhraseDiagnostics: diagnostics.melodyPhraseRefinement,
    melodySectionDevelopmentDiagnostics: diagnostics.melodySectionDevelopmentRefinement,
    melodySectionMemoryDiagnostics: diagnostics.melodySectionMemoryAudit,
    bassContinuityDiagnostics: diagnostics.bassContinuityRefinement,
    ensembleContinuityDiagnostics: diagnostics.ensembleContinuityRefinement,
    transitionFxDiagnostics: diagnostics.transitionFxRefinement,
  };
}

export function applyResultOutputQualityPipeline(result, config = {}, evaluators = {}) {
  if (!result?.song) return result;
  const processed = applySongOutputQualityPipeline(result.song, config, {
    evaluateCandidate: evaluators.evaluateCandidate ?? evaluateSongCandidate,
    evaluateReleaseGate: evaluators.evaluateReleaseGate ?? evaluateSongReleaseGate,
  });
  const stageEntries = [
    ["arrangement", processed.diagnostics],
    ["returnDevelopment", processed.returnDiagnostics],
    ["groovePocket", processed.grooveDiagnostics],
    ["densityRefinement", processed.densityDiagnostics],
    ["phraseResolutionRefinement", processed.phraseResolutionDiagnostics],
    ["repetitionRefinement", processed.repetitionDiagnostics],
    ["registerHealthRefinement", processed.registerHealthDiagnostics],
    ["genreIdentityRefinement", processed.genreIdentityDiagnostics],
    ["fusionPerformanceRefinement", processed.fusionPerformanceDiagnostics],
    ["melodyContinuityRefinement", processed.melodyContinuityDiagnostics],
    ["melodyPhraseRefinement", processed.melodyPhraseDiagnostics],
    ["melodySectionDevelopmentRefinement", processed.melodySectionDevelopmentDiagnostics],
    ["melodySectionMemoryAudit", processed.melodySectionMemoryDiagnostics],
    ["bassContinuityRefinement", processed.bassContinuityDiagnostics],
    ["ensembleContinuityRefinement", processed.ensembleContinuityDiagnostics],
    ["transitionFxRefinement", processed.transitionFxDiagnostics],
  ];
  const stageDiagnostics = Object.fromEntries(stageEntries.filter(([, diagnostics]) => diagnostics != null));
  if (typeof evaluators.onStageDiagnostics === "function") {
    try { evaluators.onStageDiagnostics(stageDiagnostics); } catch { /* diagnostics must never change generation */ }
  }

  if (processed.song === result.song) return result;

  const outputQualityDiagnostics = { ...(result.outputQualityDiagnostics ?? {}) };
  for (const [key, diagnostics] of stageEntries) {
    if (diagnostics?.accepted) outputQualityDiagnostics[key] = diagnostics;
  }
  return {
    ...result,
    song: processed.song,
    outputQualityDiagnostics,
  };
}