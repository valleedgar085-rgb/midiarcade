import {
  createSongFingerprint,
  evaluateSongCandidate,
  evaluateSongReleaseGate,
} from "../music-engine.js";
import { evolveSongArrangement } from "./arrangement-evolution.js";

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

/**
 * Phase 6B is candidate-first: a structural evolution is never committed just
 * because it is different. It must remain release-safe and either improve the
 * critic overall or provide a measurable arrangement gain without meaningful
 * collateral loss.
 */
export function applySongOutputQualityPostprocess(song, config = {}, {
  evaluateCandidate = evaluateSongCandidate,
  evaluateReleaseGate = evaluateSongReleaseGate,
} = {}) {
  const attempted = evolveSongArrangement(song, config);
  if (!attempted.changed) {
    return {
      song,
      diagnostics: Object.freeze({
        attempted: attempted.evolution.enabled,
        accepted: false,
        changed: false,
        reason: attempted.evolution.enabled ? "no-safe-reorder" : "disabled",
        family: attempted.evolution.family,
        signature: attempted.evolution.signature,
      }),
    };
  }

  const before = evaluateCandidate(song);
  const after = evaluateCandidate(attempted.song);
  const release = evaluateReleaseGate(attempted.song, after);
  const beforeArrangement = arrangementScore(before);
  const afterArrangement = arrangementScore(after);
  const scoreDelta = finite(after.score) - finite(before.score);
  const arrangementDelta = afterArrangement - beforeArrangement;
  const floorDelta = creativeFloor(after) - creativeFloor(before);
  const scaleSafe = finite(after?.diagnostics?.scaleFit, 0) >= 0.999999;
  const qualityImproved = scoreDelta >= 0.05 && arrangementDelta >= -0.25 && floorDelta >= -0.5;
  const arrangementImproved = arrangementDelta >= 0.75 && scoreDelta >= -0.25 && floorDelta >= -0.75;
  const accepted = Boolean(release?.passed && scaleSafe && (qualityImproved || arrangementImproved));

  const diagnostics = Object.freeze({
    attempted: true,
    accepted,
    changed: true,
    reason: !release?.passed ? "release-gate"
      : !scaleSafe ? "scale-safety"
        : accepted ? "quality-win" : "critic-regression",
    family: attempted.evolution.family,
    label: attempted.evolution.label,
    signature: attempted.evolution.signature,
    beforeScore: round(before.score),
    afterScore: round(after.score),
    scoreDelta: round(scoreDelta),
    beforeArrangement: round(beforeArrangement),
    afterArrangement: round(afterArrangement),
    arrangementDelta: round(arrangementDelta),
    floorDelta: round(floorDelta),
  });

  if (!accepted) return { song, diagnostics };
  attempted.song.outputQualityEvolution = {
    ...(attempted.song.outputQualityEvolution ?? {}),
    arrangement: {
      ...(attempted.song.outputQualityEvolution?.arrangement ?? {}),
      accepted: true,
      scoreDelta: diagnostics.scoreDelta,
      arrangementDelta: diagnostics.arrangementDelta,
    },
  };
  attempted.song.meta = acceptedSongMetadata(attempted.song, after, release, diagnostics);
  return { song: attempted.song, diagnostics };
}

export function applyResultOutputQualityPostprocess(result, config = {}, evaluators = {}) {
  if (!result?.song || config.arrangementEvolution !== true) return result;
  const processed = applySongOutputQualityPostprocess(result.song, config, evaluators);
  return {
    ...result,
    song: processed.song,
    outputQualityDiagnostics: {
      ...(result.outputQualityDiagnostics ?? {}),
      arrangement: processed.diagnostics,
    },
  };
}
