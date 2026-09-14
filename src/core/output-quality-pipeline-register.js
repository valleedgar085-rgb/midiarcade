import {
  createSongFingerprint,
  evaluateSongCandidate,
  evaluateSongReleaseGate,
} from "../music-engine.js";
import {
  createRegisterHealthCandidates,
  MAX_REGISTER_HEALTH_CANDIDATES,
} from "./register-health-refinement.js";
import {
  applyResultOutputQualityPipeline as applyBaseResultOutputQualityPipeline,
  applySongOutputQualityPipeline as applyBaseSongOutputQualityPipeline,
} from "./output-quality-pipeline.js";

const REGISTER_HEALTH_ATTEMPT_CEILING = 82;
const REGISTER_PROTECTED_DIMENSIONS = Object.freeze([
  "phraseResolution",
  "repetition",
  "memory",
  "motif",
  "separation",
]);

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function creativeFloor(evaluation) {
  const values = Object.values(evaluation?.subscores ?? {}).filter((value) => Number.isFinite(Number(value)));
  return values.length ? Math.min(...values.map(Number)) : 0;
}

function protectedDeltas(before, after) {
  return Object.fromEntries(REGISTER_PROTECTED_DIMENSIONS.map((dimension) => [
    dimension,
    finite(after?.subscores?.[dimension]) - finite(before?.subscores?.[dimension]),
  ]));
}

function disabledDiagnostics(reason = "disabled", patch = {}) {
  return Object.freeze({
    attempted: false,
    accepted: false,
    changed: false,
    reason,
    candidatesEvaluated: 0,
    candidateLimit: MAX_REGISTER_HEALTH_CANDIDATES,
    candidateIds: [],
    ...patch,
  });
}

function assessCandidate(candidate, before, beforeFloor, evaluateCandidate, evaluateReleaseGate) {
  const after = evaluateCandidate(candidate.song);
  const release = evaluateReleaseGate(candidate.song, after);
  const beforeRegister = finite(before?.subscores?.registerHealth);
  const afterRegister = finite(after?.subscores?.registerHealth);
  const registerDelta = afterRegister - beforeRegister;
  const scoreDelta = finite(after?.score) - finite(before?.score);
  const afterFloor = creativeFloor(after);
  const floorDelta = afterFloor - beforeFloor;
  const dimensionDeltas = protectedDeltas(before, after);
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

function compareAssessments(left, right) {
  const registerDelta = right.registerDelta - left.registerDelta;
  if (Math.abs(registerDelta) > 1e-9) return registerDelta;
  const scoreDelta = finite(right.after?.score) - finite(left.after?.score);
  if (Math.abs(scoreDelta) > 1e-9) return scoreDelta;
  const floorDelta = right.afterFloor - left.afterFloor;
  if (Math.abs(floorDelta) > 1e-9) return floorDelta;
  return left.candidateIndex - right.candidateIndex;
}

function diagnosticsFor(assessment, before, candidatesEvaluated, candidateIds) {
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

function acceptedMetadata(song, evaluation, releaseGate, diagnostics) {
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
        registerHealthRefinement: diagnostics,
      },
    },
  };
}

function applyRegisterHealthRefinement(song, config, evaluateCandidate, evaluateReleaseGate) {
  if (config.registerHealthRefinement !== true) {
    return { song, diagnostics: disabledDiagnostics() };
  }

  const before = evaluateCandidate(song);
  const beforeRegister = finite(before?.subscores?.registerHealth);
  if (beforeRegister >= REGISTER_HEALTH_ATTEMPT_CEILING) {
    return {
      song,
      diagnostics: disabledDiagnostics("already-strong", {
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
  const assessments = candidates.map((candidate) => assessCandidate(
    candidate,
    before,
    beforeFloor,
    evaluateCandidate,
    evaluateReleaseGate,
  ));
  const candidateIds = assessments.map(({ id }) => id);
  const accepted = assessments.filter((assessment) => assessment.accepted).sort(compareAssessments);
  const ranked = [...assessments].sort(compareAssessments);
  const selected = accepted[0] ?? ranked[0];
  const diagnostics = diagnosticsFor(selected, before, assessments.length, candidateIds);
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
  selected.song.meta = acceptedMetadata(selected.song, selected.after, selected.release, diagnostics);
  return { song: selected.song, diagnostics };
}

/**
 * Final Phase 6D wrapper. Existing arrangement, return, density and cadence
 * stages run first. Register health is allowed to act only on a still-weak
 * melody and fails closed independently.
 */
export function applySongOutputQualityPipeline(song, config = {}, {
  evaluateCandidate = evaluateSongCandidate,
  evaluateReleaseGate = evaluateSongReleaseGate,
} = {}) {
  const base = applyBaseSongOutputQualityPipeline(song, config, {
    evaluateCandidate,
    evaluateReleaseGate,
  });
  const register = applyRegisterHealthRefinement(
    base.song,
    config,
    evaluateCandidate,
    evaluateReleaseGate,
  );
  return {
    ...base,
    song: register.song,
    registerHealthDiagnostics: register.diagnostics,
  };
}

export function applyResultOutputQualityPipeline(result, config = {}, evaluators = {}) {
  if (!result?.song) return result;
  const baseResult = applyBaseResultOutputQualityPipeline(result, config, evaluators);
  const evaluateCandidate = evaluators.evaluateCandidate ?? evaluateSongCandidate;
  const evaluateReleaseGate = evaluators.evaluateReleaseGate ?? evaluateSongReleaseGate;
  const register = applyRegisterHealthRefinement(
    baseResult.song,
    config,
    evaluateCandidate,
    evaluateReleaseGate,
  );
  const accepted = Boolean(register.diagnostics?.accepted && register.song !== baseResult.song);
  if (!accepted) return baseResult;

  return {
    ...baseResult,
    song: register.song,
    outputQualityDiagnostics: {
      ...(baseResult.outputQualityDiagnostics ?? {}),
      registerHealthRefinement: register.diagnostics,
    },
  };
}
