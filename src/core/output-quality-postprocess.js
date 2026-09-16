import {
  createSongFingerprint,
  evaluateSongCandidate,
  evaluateSongReleaseGate,
} from "../music-engine.js";
import {
  createArrangementCandidates,
  MAX_ARRANGEMENT_CANDIDATES,
} from "./arrangement-candidates.js";
import { createArrangementEvolution } from "./arrangement-evolution.js";
import {
  createGroovePocketCandidates,
  MAX_GROOVE_POCKET_CANDIDATES,
} from "./groove-pocket-refinement.js";
import {
  createReturnDevelopmentCandidates,
  MAX_RETURN_DEVELOPMENT_CANDIDATES,
} from "./return-development.js";

const ARRANGEMENT_DIMENSIONS = Object.freeze([
  "storyArc",
  "transitions",
  "orchestration",
  "tensionFollow",
  "stageInterlock",
]);

const RETURN_DIMENSIONS = Object.freeze({
  "cadence-payoff": Object.freeze(["phraseResolution"]),
  "return-evolution": Object.freeze(["repetition"]),
  "rhythmic-recall": Object.freeze(["repetition", "motif"]),
});

const GROOVE_ATTEMPT_CEILING = 89;

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function average(values) {
  return values.reduce((sum, value) => sum + finite(value), 0) / Math.max(1, values.length);
}

function arrangementScore(evaluation) {
  return average(ARRANGEMENT_DIMENSIONS.map((key) => evaluation?.subscores?.[key]));
}

function returnTargetScore(evaluation, id) {
  const dimensions = RETURN_DIMENSIONS[id] ?? [];
  return dimensions.length
    ? average(dimensions.map((key) => evaluation?.subscores?.[key]))
    : finite(evaluation?.score);
}

function creativeFloor(evaluation) {
  const values = Object.values(evaluation?.subscores ?? {}).filter((value) => Number.isFinite(Number(value)));
  return values.length ? Math.min(...values.map(Number)) : 0;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function acceptedSongMetadata(song, evaluation, releaseGate, diagnosticsPatch = {}) {
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
        ...diagnosticsPatch,
      },
    },
  };
}

function arrangementCandidateAssessment(candidate, before, beforeArrangement, beforeFloor, evaluateCandidate, evaluateReleaseGate) {
  const after = evaluateCandidate(candidate.song);
  const release = evaluateReleaseGate(candidate.song, after);
  const afterArrangement = arrangementScore(after);
  const afterFloor = creativeFloor(after);
  const scoreDelta = finite(after.score) - finite(before.score);
  const arrangementDelta = afterArrangement - beforeArrangement;
  const floorDelta = afterFloor - beforeFloor;
  const scaleSafe = finite(after?.diagnostics?.scaleFit, 0) >= 0.999999;
  const qualityImproved = scoreDelta >= 0.05 && arrangementDelta >= -0.25 && floorDelta >= -0.5;
  const arrangementImproved = arrangementDelta >= 0.75 && scoreDelta >= -0.25 && floorDelta >= -0.75;
  const accepted = Boolean(release?.passed && scaleSafe && (qualityImproved || arrangementImproved));

  return {
    ...candidate,
    after,
    release,
    afterArrangement,
    afterFloor,
    scoreDelta,
    arrangementDelta,
    floorDelta,
    accepted,
    reason: !release?.passed ? "release-gate"
      : !scaleSafe ? "scale-safety"
        : accepted ? "quality-win" : "critic-regression",
  };
}

function returnCandidateAssessment(candidate, before, beforeFloor, evaluateCandidate, evaluateReleaseGate) {
  const after = evaluateCandidate(candidate.song);
  const release = evaluateReleaseGate(candidate.song, after);
  const beforeTarget = returnTargetScore(before, candidate.id);
  const afterTarget = returnTargetScore(after, candidate.id);
  const afterFloor = creativeFloor(after);
  const scoreDelta = finite(after.score) - finite(before.score);
  const targetDelta = afterTarget - beforeTarget;
  const floorDelta = afterFloor - beforeFloor;
  const scaleSafe = finite(after?.diagnostics?.scaleFit, 0) >= 0.999999;
  const qualityImproved = scoreDelta >= 0.05 && targetDelta >= -0.1 && floorDelta >= -0.5;
  const targetImproved = targetDelta >= 0.75 && scoreDelta >= -0.25 && floorDelta >= -0.75;
  const accepted = Boolean(release?.passed && scaleSafe && (qualityImproved || targetImproved));

  return {
    ...candidate,
    after,
    release,
    beforeTarget,
    afterTarget,
    afterFloor,
    scoreDelta,
    targetDelta,
    floorDelta,
    accepted,
    reason: !release?.passed ? "release-gate"
      : !scaleSafe ? "scale-safety"
        : accepted ? "quality-win" : "critic-regression",
  };
}

function grooveCandidateAssessment(candidate, before, beforeFloor, evaluateCandidate, evaluateReleaseGate) {
  const after = evaluateCandidate(candidate.song);
  const release = evaluateReleaseGate(candidate.song, after);
  const beforeGroove = finite(before?.subscores?.groove);
  const afterGroove = finite(after?.subscores?.groove);
  const afterFloor = creativeFloor(after);
  const scoreDelta = finite(after.score) - finite(before.score);
  const grooveDelta = afterGroove - beforeGroove;
  const floorDelta = afterFloor - beforeFloor;
  const scaleSafe = finite(after?.diagnostics?.scaleFit, 0) >= 0.999999;
  const accepted = Boolean(
    release?.passed
    && scaleSafe
    && grooveDelta >= 0.75
    && scoreDelta >= -0.25
    && floorDelta >= -0.75
  );

  return {
    ...candidate,
    after,
    release,
    beforeGroove,
    afterGroove,
    afterFloor,
    scoreDelta,
    grooveDelta,
    floorDelta,
    accepted,
    reason: !release?.passed ? "release-gate"
      : !scaleSafe ? "scale-safety"
        : accepted ? "groove-win" : "critic-regression",
  };
}

function compareArrangementAssessments(left, right) {
  const scoreDelta = finite(right.after?.score) - finite(left.after?.score);
  if (Math.abs(scoreDelta) > 1e-9) return scoreDelta;
  const arrangementDelta = right.afterArrangement - left.afterArrangement;
  if (Math.abs(arrangementDelta) > 1e-9) return arrangementDelta;
  const floorDelta = right.afterFloor - left.afterFloor;
  if (Math.abs(floorDelta) > 1e-9) return floorDelta;
  return left.candidateIndex - right.candidateIndex;
}

function compareReturnAssessments(left, right) {
  const scoreDelta = finite(right.after?.score) - finite(left.after?.score);
  if (Math.abs(scoreDelta) > 1e-9) return scoreDelta;
  const targetDelta = right.targetDelta - left.targetDelta;
  if (Math.abs(targetDelta) > 1e-9) return targetDelta;
  const floorDelta = right.afterFloor - left.afterFloor;
  if (Math.abs(floorDelta) > 1e-9) return floorDelta;
  return String(left.id).localeCompare(String(right.id));
}

function compareGrooveAssessments(left, right) {
  const grooveDelta = right.grooveDelta - left.grooveDelta;
  if (Math.abs(grooveDelta) > 1e-9) return grooveDelta;
  const scoreDelta = finite(right.after?.score) - finite(left.after?.score);
  if (Math.abs(scoreDelta) > 1e-9) return scoreDelta;
  const floorDelta = right.afterFloor - left.afterFloor;
  if (Math.abs(floorDelta) > 1e-9) return floorDelta;
  return left.maxShift - right.maxShift;
}

function arrangementDiagnosticsFor(assessment, {
  before,
  beforeArrangement,
  candidatesEvaluated,
  candidateFamilies,
} = {}) {
  return Object.freeze({
    attempted: true,
    accepted: Boolean(assessment?.accepted),
    changed: true,
    reason: assessment?.reason ?? "critic-regression",
    family: assessment?.evolution?.family ?? null,
    label: assessment?.evolution?.label ?? null,
    signature: assessment?.evolution?.signature ?? null,
    candidateIndex: assessment?.candidateIndex ?? null,
    attemptIndex: assessment?.attemptIndex ?? null,
    candidatesEvaluated,
    candidateLimit: MAX_ARRANGEMENT_CANDIDATES,
    candidateFamilies,
    beforeScore: round(before?.score),
    afterScore: round(assessment?.after?.score),
    scoreDelta: round(assessment?.scoreDelta),
    beforeArrangement: round(beforeArrangement),
    afterArrangement: round(assessment?.afterArrangement),
    arrangementDelta: round(assessment?.arrangementDelta),
    floorDelta: round(assessment?.floorDelta),
  });
}

function returnDiagnosticsFor(assessment, {
  before,
  candidatesEvaluated,
  candidateIds,
} = {}) {
  return Object.freeze({
    attempted: true,
    accepted: Boolean(assessment?.accepted),
    changed: true,
    reason: assessment?.reason ?? "critic-regression",
    id: assessment?.id ?? null,
    changedNotes: finite(assessment?.changedNotes),
    returnSections: finite(assessment?.returnSections),
    candidatesEvaluated,
    candidateLimit: MAX_RETURN_DEVELOPMENT_CANDIDATES,
    candidateIds,
    targetDimensions: [...(RETURN_DIMENSIONS[assessment?.id] ?? [])],
    beforeScore: round(before?.score),
    afterScore: round(assessment?.after?.score),
    scoreDelta: round(assessment?.scoreDelta),
    beforeTarget: round(assessment?.beforeTarget),
    afterTarget: round(assessment?.afterTarget),
    targetDelta: round(assessment?.targetDelta),
    floorDelta: round(assessment?.floorDelta),
  });
}

function grooveDiagnosticsFor(assessment, {
  before,
  candidatesEvaluated,
  candidateIds,
} = {}) {
  return Object.freeze({
    attempted: true,
    accepted: Boolean(assessment?.accepted),
    changed: true,
    reason: assessment?.reason ?? "critic-regression",
    id: assessment?.id ?? null,
    changedNotes: finite(assessment?.changedNotes),
    maxShift: round(assessment?.maxShift, 4),
    beforeLock: round(assessment?.beforeLock, 4),
    afterLock: round(assessment?.afterLock, 4),
    lockDelta: round(assessment?.lockDelta, 4),
    candidatesEvaluated,
    candidateLimit: MAX_GROOVE_POCKET_CANDIDATES,
    candidateIds,
    beforeScore: round(before?.score),
    afterScore: round(assessment?.after?.score),
    scoreDelta: round(assessment?.scoreDelta),
    beforeGroove: round(assessment?.beforeGroove),
    afterGroove: round(assessment?.afterGroove),
    grooveDelta: round(assessment?.grooveDelta),
    floorDelta: round(assessment?.floorDelta),
  });
}

function applyArrangementPostprocess(song, config, evaluateCandidate, evaluateReleaseGate) {
  const evolution = createArrangementEvolution(config);
  if (!evolution.enabled) {
    return {
      song,
      diagnostics: Object.freeze({
        attempted: false,
        accepted: false,
        changed: false,
        reason: "disabled",
        family: evolution.family,
        signature: evolution.signature,
        candidatesEvaluated: 0,
        candidateLimit: MAX_ARRANGEMENT_CANDIDATES,
        candidateFamilies: [],
      }),
    };
  }

  const candidates = createArrangementCandidates(song, config, {
    maxCandidates: MAX_ARRANGEMENT_CANDIDATES,
  });
  if (!candidates.length) {
    return {
      song,
      diagnostics: Object.freeze({
        attempted: true,
        accepted: false,
        changed: false,
        reason: "no-safe-reorder",
        family: evolution.family,
        signature: evolution.signature,
        candidatesEvaluated: 0,
        candidateLimit: MAX_ARRANGEMENT_CANDIDATES,
        candidateFamilies: [],
      }),
    };
  }

  const before = evaluateCandidate(song);
  const beforeArrangement = arrangementScore(before);
  const beforeFloor = creativeFloor(before);
  const assessments = candidates.map((candidate) => arrangementCandidateAssessment(
    candidate,
    before,
    beforeArrangement,
    beforeFloor,
    evaluateCandidate,
    evaluateReleaseGate,
  ));
  const candidateFamilies = assessments.map(({ evolution: candidateEvolution }) => candidateEvolution.family);
  const accepted = assessments.filter((assessment) => assessment.accepted).sort(compareArrangementAssessments);
  const ranked = [...assessments].sort(compareArrangementAssessments);
  const selected = accepted[0] ?? ranked[0];
  const diagnostics = arrangementDiagnosticsFor(selected, {
    before,
    beforeArrangement,
    candidatesEvaluated: assessments.length,
    candidateFamilies,
  });

  if (!accepted.length) return { song, diagnostics };

  selected.song.outputQualityEvolution = {
    ...(selected.song.outputQualityEvolution ?? {}),
    arrangement: {
      ...(selected.song.outputQualityEvolution?.arrangement ?? {}),
      accepted: true,
      scoreDelta: diagnostics.scoreDelta,
      arrangementDelta: diagnostics.arrangementDelta,
      candidatesEvaluated: diagnostics.candidatesEvaluated,
    },
  };
  selected.song.meta = acceptedSongMetadata(selected.song, selected.after, selected.release, {
    arrangement: diagnostics,
  });
  return { song: selected.song, diagnostics };
}

function applyReturnDevelopmentPostprocess(song, config, evaluateCandidate, evaluateReleaseGate) {
  if (config.returnDevelopment !== true) {
    return {
      song,
      diagnostics: Object.freeze({
        attempted: false,
        accepted: false,
        changed: false,
        reason: "disabled",
        candidatesEvaluated: 0,
        candidateLimit: MAX_RETURN_DEVELOPMENT_CANDIDATES,
        candidateIds: [],
      }),
    };
  }

  const candidates = createReturnDevelopmentCandidates(song, config);
  if (!candidates.length) {
    return {
      song,
      diagnostics: Object.freeze({
        attempted: true,
        accepted: false,
        changed: false,
        reason: "no-return-development",
        candidatesEvaluated: 0,
        candidateLimit: MAX_RETURN_DEVELOPMENT_CANDIDATES,
        candidateIds: [],
      }),
    };
  }

  const before = evaluateCandidate(song);
  const beforeFloor = creativeFloor(before);
  const assessments = candidates.map((candidate) => returnCandidateAssessment(
    candidate,
    before,
    beforeFloor,
    evaluateCandidate,
    evaluateReleaseGate,
  ));
  const candidateIds = assessments.map(({ id }) => id);
  const accepted = assessments.filter((assessment) => assessment.accepted).sort(compareReturnAssessments);
  const ranked = [...assessments].sort(compareReturnAssessments);
  const selected = accepted[0] ?? ranked[0];
  const diagnostics = returnDiagnosticsFor(selected, {
    before,
    candidatesEvaluated: assessments.length,
    candidateIds,
  });

  if (!accepted.length) return { song, diagnostics };

  selected.song.outputQualityEvolution = {
    ...(selected.song.outputQualityEvolution ?? {}),
    returnDevelopment: {
      ...(selected.song.outputQualityEvolution?.returnDevelopment ?? {}),
      accepted: true,
      scoreDelta: diagnostics.scoreDelta,
      targetDelta: diagnostics.targetDelta,
      candidatesEvaluated: diagnostics.candidatesEvaluated,
    },
  };
  selected.song.meta = acceptedSongMetadata(selected.song, selected.after, selected.release, {
    returnDevelopment: diagnostics,
  });
  return { song: selected.song, diagnostics };
}

function applyGroovePocketPostprocess(song, config, evaluateCandidate, evaluateReleaseGate) {
  if (config.groovePocketRefinement !== true) {
    return {
      song,
      diagnostics: Object.freeze({
        attempted: false,
        accepted: false,
        changed: false,
        reason: "disabled",
        candidatesEvaluated: 0,
        candidateLimit: MAX_GROOVE_POCKET_CANDIDATES,
        candidateIds: [],
      }),
    };
  }

  const before = evaluateCandidate(song);
  const beforeGroove = finite(before?.subscores?.groove);
  if (beforeGroove >= GROOVE_ATTEMPT_CEILING) {
    return {
      song,
      diagnostics: Object.freeze({
        attempted: false,
        accepted: false,
        changed: false,
        reason: "already-strong",
        beforeGroove: round(beforeGroove),
        candidatesEvaluated: 0,
        candidateLimit: MAX_GROOVE_POCKET_CANDIDATES,
        candidateIds: [],
      }),
    };
  }

  const candidates = createGroovePocketCandidates(song, config);
  if (!candidates.length) {
    return {
      song,
      diagnostics: Object.freeze({
        attempted: true,
        accepted: false,
        changed: false,
        reason: "no-pocket-opportunity",
        beforeGroove: round(beforeGroove),
        candidatesEvaluated: 0,
        candidateLimit: MAX_GROOVE_POCKET_CANDIDATES,
        candidateIds: [],
      }),
    };
  }

  const beforeFloor = creativeFloor(before);
  const assessments = candidates.map((candidate) => grooveCandidateAssessment(
    candidate,
    before,
    beforeFloor,
    evaluateCandidate,
    evaluateReleaseGate,
  ));
  const candidateIds = assessments.map(({ id }) => id);
  const accepted = assessments.filter((assessment) => assessment.accepted).sort(compareGrooveAssessments);
  const ranked = [...assessments].sort(compareGrooveAssessments);
  const selected = accepted[0] ?? ranked[0];
  const diagnostics = grooveDiagnosticsFor(selected, {
    before,
    candidatesEvaluated: assessments.length,
    candidateIds,
  });

  if (!accepted.length) return { song, diagnostics };

  selected.song.outputQualityEvolution = {
    ...(selected.song.outputQualityEvolution ?? {}),
    groovePocket: {
      ...(selected.song.outputQualityEvolution?.groovePocket ?? {}),
      accepted: true,
      scoreDelta: diagnostics.scoreDelta,
      grooveDelta: diagnostics.grooveDelta,
      candidatesEvaluated: diagnostics.candidatesEvaluated,
    },
  };
  selected.song.meta = acceptedSongMetadata(selected.song, selected.after, selected.release, {
    groovePocket: diagnostics,
  });
  return { song: selected.song, diagnostics };
}

/**
 * Phase 6 remains candidate-first at every structural level. Macro-arrangement
 * candidates are auditioned first, followed by focused return development and
 * finally bass-only pocket refinement for genuinely weak groove scores. Every
 * candidate must clear the unchanged release and scale contracts.
 */
export function applySongOutputQualityPostprocess(song, config = {}, {
  evaluateCandidate = evaluateSongCandidate,
  evaluateReleaseGate = evaluateSongReleaseGate,
} = {}) {
  const arrangement = applyArrangementPostprocess(song, config, evaluateCandidate, evaluateReleaseGate);
  const returnDevelopment = applyReturnDevelopmentPostprocess(
    arrangement.song,
    config,
    evaluateCandidate,
    evaluateReleaseGate,
  );
  const groovePocket = applyGroovePocketPostprocess(
    returnDevelopment.song,
    config,
    evaluateCandidate,
    evaluateReleaseGate,
  );
  return {
    song: groovePocket.song,
    diagnostics: arrangement.diagnostics,
    returnDiagnostics: returnDevelopment.diagnostics,
    grooveDiagnostics: groovePocket.diagnostics,
  };
}

/**
 * Keep the executor's public result contract reference-stable unless Phase 6
 * actually commits a quality-gated postprocess candidate. Rejected/no-op
 * diagnostics remain available to direct benchmark callers without leaking a
 * new result shape into worker/fallback/self-correction contracts.
 */
export function applyResultOutputQualityPostprocess(result, config = {}, evaluators = {}) {
  if (!result?.song || (
    config.arrangementEvolution !== true
    && config.returnDevelopment !== true
    && config.groovePocketRefinement !== true
  )) return result;
  const processed = applySongOutputQualityPostprocess(result.song, config, evaluators);
  const arrangementAccepted = Boolean(processed.diagnostics?.accepted);
  const returnAccepted = Boolean(processed.returnDiagnostics?.accepted);
  const grooveAccepted = Boolean(processed.grooveDiagnostics?.accepted);
  if ((!arrangementAccepted && !returnAccepted && !grooveAccepted) || processed.song === result.song) return result;
  return {
    ...result,
    song: processed.song,
    outputQualityDiagnostics: {
      ...(result.outputQualityDiagnostics ?? {}),
      arrangement: processed.diagnostics,
      returnDevelopment: processed.returnDiagnostics,
      groovePocket: processed.grooveDiagnostics,
    },
  };
}
