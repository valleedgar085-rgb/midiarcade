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

const ARRANGEMENT_DIMENSIONS = Object.freeze([
  "storyArc",
  "transitions",
  "orchestration",
  "tensionFollow",
  "stageInterlock",
]);

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function average(values) {
  return values.reduce((sum, value) => sum + finite(value), 0) / Math.max(1, values.length);
}

function arrangementScore(evaluation) {
  return average(ARRANGEMENT_DIMENSIONS.map((key) => evaluation?.subscores?.[key]));
}

function creativeFloor(evaluation) {
  const values = Object.values(evaluation?.subscores ?? {}).filter((value) => Number.isFinite(Number(value)));
  return values.length ? Math.min(...values.map(Number)) : 0;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function acceptedSongMetadata(song, evaluation, releaseGate, diagnostics) {
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
        arrangement: diagnostics,
      },
    },
  };
}

function candidateAssessment(candidate, before, beforeArrangement, beforeFloor, evaluateCandidate, evaluateReleaseGate) {
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

function compareAssessments(left, right) {
  const scoreDelta = finite(right.after?.score) - finite(left.after?.score);
  if (Math.abs(scoreDelta) > 1e-9) return scoreDelta;
  const arrangementDelta = right.afterArrangement - left.afterArrangement;
  if (Math.abs(arrangementDelta) > 1e-9) return arrangementDelta;
  const floorDelta = right.afterFloor - left.afterFloor;
  if (Math.abs(floorDelta) > 1e-9) return floorDelta;
  return left.candidateIndex - right.candidateIndex;
}

function diagnosticsFor(assessment, {
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

/**
 * Phase 6B is candidate-first: structural evolution is never committed merely
 * because it is different. Up to three deterministic whole-section candidates
 * are auditioned, every one must clear the unchanged release/scale contracts,
 * and only the strongest measurable critic win may replace the source song.
 */
export function applySongOutputQualityPostprocess(song, config = {}, {
  evaluateCandidate = evaluateSongCandidate,
  evaluateReleaseGate = evaluateSongReleaseGate,
} = {}) {
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
  const assessments = candidates.map((candidate) => candidateAssessment(
    candidate,
    before,
    beforeArrangement,
    beforeFloor,
    evaluateCandidate,
    evaluateReleaseGate,
  ));
  const candidateFamilies = assessments.map(({ evolution: candidateEvolution }) => candidateEvolution.family);
  const accepted = assessments.filter((assessment) => assessment.accepted).sort(compareAssessments);
  const ranked = [...assessments].sort(compareAssessments);
  const selected = accepted[0] ?? ranked[0];
  const diagnostics = diagnosticsFor(selected, {
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
  selected.song.meta = acceptedSongMetadata(selected.song, selected.after, selected.release, diagnostics);
  return { song: selected.song, diagnostics };
}

/**
 * Keep the executor's public result contract reference-stable unless Phase 6B
 * actually commits a quality-gated arrangement candidate. Rejected/no-op
 * diagnostics remain available to direct benchmark callers without leaking a
 * new result shape into worker/fallback/self-correction contracts.
 */
export function applyResultOutputQualityPostprocess(result, config = {}, evaluators = {}) {
  if (!result?.song || config.arrangementEvolution !== true) return result;
  const processed = applySongOutputQualityPostprocess(result.song, config, evaluators);
  if (!processed.diagnostics?.accepted || processed.song === result.song) return result;
  return {
    ...result,
    song: processed.song,
    outputQualityDiagnostics: {
      ...(result.outputQualityDiagnostics ?? {}),
      arrangement: processed.diagnostics,
    },
  };
}
