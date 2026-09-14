import {
  createSongFingerprint,
  evaluateSongCandidate,
  evaluateSongReleaseGate,
  GENRE_CRITIC_PROFILES,
} from "../music-engine.js";
import {
  createRegisterHealthCandidates,
  MAX_REGISTER_HEALTH_CANDIDATES,
} from "./register-health-refinement.js";
import {
  createRepetitionRefinementCandidates,
  MAX_REPETITION_REFINEMENT_CANDIDATES,
} from "./repetition-refinement.js";
import {
  applyResultOutputQualityPipeline as applyBaseResultOutputQualityPipeline,
  applySongOutputQualityPipeline as applyBaseSongOutputQualityPipeline,
} from "./output-quality-pipeline.js";

const REGISTER_HEALTH_ATTEMPT_CEILING = 82;
const REPETITION_ATTEMPT_CEILING = 90;
const REGISTER_PROTECTED_DIMENSIONS = Object.freeze([
  "phraseResolution",
  "repetition",
  "memory",
  "motif",
  "separation",
]);
const REPETITION_PROTECTED_DIMENSIONS = Object.freeze([
  "phraseResolution",
  "memory",
  "motif",
  "registerHealth",
  "groove",
  "performance",
  "separation",
]);

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function average(values, fallback = 0) {
  return values.length
    ? values.reduce((sum, value) => sum + finite(value), 0) / values.length
    : fallback;
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
  const genre = String(song?.genre ?? song?.meta?.genre ?? "pop");
  const profile = GENRE_CRITIC_PROFILES[genre] ?? GENRE_CRITIC_PROFILES.pop;
  return average([
    finite(song?.songBlueprint?.qualityTargets?.repetition, profile.repetition),
    finite(profile.repetition, 0.62),
  ], finite(profile.repetition, 0.62));
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
    release?.passed
    && scaleSafe
    && registerDelta >= 0.75
    && scoreDelta >= -0.25
    && floorDelta >= -0.75
    && candidate.localScoreDelta > 0
    && protectedSafe
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
    release?.passed
    && scaleSafe
    && repetitionDelta >= 0.75
    && scoreDelta >= -0.25
    && floorDelta >= -0.75
    && candidate.errorDelta < -1e-6
    && protectedSafe
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

function acceptedMetadata(song, evaluation, releaseGate, stageKey, diagnostics) {
  const scoreDetails = song?.meta?.scoreDetails ?? {};
  return {
    ...(song.meta ?? {}),
    ideaFingerprint: createSongFingerprint(song),
    scoreDetails: {
      ...scoreDetails,
      totalScore: round(evaluation.score),
      subscores: { ...(evaluation.subscores ?? {}) },
      releaseGate,
      outputQualityPostprocess: {
        ...(scoreDetails.outputQualityPostprocess ?? {}),
        [stageKey]: diagnostics,
      },
    },
  };
}

function applyRepetitionRefinement(song, config, evaluateCandidate, evaluateReleaseGate) {
  if (config.repetitionRefinement !== true) {
    return { song, diagnostics: disabledDiagnostics(MAX_REPETITION_REFINEMENT_CANDIDATES) };
  }
  const genre = String(song?.genre ?? song?.meta?.genre ?? "");
  if (genre !== "rnbSoul") {
    return {
      song,
      diagnostics: disabledDiagnostics(MAX_REPETITION_REFINEMENT_CANDIDATES, "calibrated-genre-only", { genre }),
    };
  }

  const before = evaluateCandidate(song);
  const beforeRepetition = finite(before?.subscores?.repetition);
  const target = repetitionTargetForSong(song);
  if (beforeRepetition >= REPETITION_ATTEMPT_CEILING) {
    return {
      song,
      diagnostics: disabledDiagnostics(MAX_REPETITION_REFINEMENT_CANDIDATES, "already-strong", {
        beforeRepetition: round(beforeRepetition),
        target: round(target, 4),
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
    candidate,
    before,
    beforeFloor,
    evaluateCandidate,
    evaluateReleaseGate,
  ));
  const candidateIds = assessments.map(({ id }) => id);
  const accepted = assessments.filter((assessment) => assessment.accepted).sort(compareRepetitionAssessments);
  const ranked = [...assessments].sort(compareRepetitionAssessments);
  const selected = accepted[0] ?? ranked[0];
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
  selected.song.meta = acceptedMetadata(
    selected.song,
    selected.after,
    selected.release,
    "repetitionRefinement",
    diagnostics,
  );
  return { song: selected.song, diagnostics };
}

function applyRegisterHealthRefinement(song, config, evaluateCandidate, evaluateReleaseGate) {
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
    candidate,
    before,
    beforeFloor,
    evaluateCandidate,
    evaluateReleaseGate,
  ));
  const candidateIds = assessments.map(({ id }) => id);
  const accepted = assessments.filter((assessment) => assessment.accepted).sort(compareRegisterAssessments);
  const ranked = [...assessments].sort(compareRegisterAssessments);
  const selected = accepted[0] ?? ranked[0];
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
  selected.song.meta = acceptedMetadata(
    selected.song,
    selected.after,
    selected.release,
    "registerHealthRefinement",
    diagnostics,
  );
  return { song: selected.song, diagnostics };
}

/**
 * Final Phase 6D wrapper. Existing arrangement, return, density and cadence
 * stages run first. Signed RnB repetition balance acts next, followed by
 * register health. Both stages are bounded and fail closed independently.
 */
export function applySongOutputQualityPipeline(song, config = {}, {
  evaluateCandidate = evaluateSongCandidate,
  evaluateReleaseGate = evaluateSongReleaseGate,
} = {}) {
  const base = applyBaseSongOutputQualityPipeline(song, config, {
    evaluateCandidate,
    evaluateReleaseGate,
  });
  const repetition = applyRepetitionRefinement(
    base.song,
    config,
    evaluateCandidate,
    evaluateReleaseGate,
  );
  const register = applyRegisterHealthRefinement(
    repetition.song,
    config,
    evaluateCandidate,
    evaluateReleaseGate,
  );
  return {
    ...base,
    song: register.song,
    repetitionDiagnostics: repetition.diagnostics,
    registerHealthDiagnostics: register.diagnostics,
  };
}

export function applyResultOutputQualityPipeline(result, config = {}, evaluators = {}) {
  if (!result?.song) return result;
  const baseResult = applyBaseResultOutputQualityPipeline(result, config, evaluators);
  const evaluateCandidate = evaluators.evaluateCandidate ?? evaluateSongCandidate;
  const evaluateReleaseGate = evaluators.evaluateReleaseGate ?? evaluateSongReleaseGate;
  const repetition = applyRepetitionRefinement(
    baseResult.song,
    config,
    evaluateCandidate,
    evaluateReleaseGate,
  );
  const register = applyRegisterHealthRefinement(
    repetition.song,
    config,
    evaluateCandidate,
    evaluateReleaseGate,
  );
  const repetitionAccepted = Boolean(repetition.diagnostics?.accepted && repetition.song !== baseResult.song);
  const registerAccepted = Boolean(register.diagnostics?.accepted && register.song !== repetition.song);
  if (!repetitionAccepted && !registerAccepted) return baseResult;

  const diagnostics = { ...(baseResult.outputQualityDiagnostics ?? {}) };
  if (repetitionAccepted) diagnostics.repetitionRefinement = repetition.diagnostics;
  if (registerAccepted) diagnostics.registerHealthRefinement = register.diagnostics;
  return {
    ...baseResult,
    song: register.song,
    outputQualityDiagnostics: diagnostics,
  };
}
