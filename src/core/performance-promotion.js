import { cloneValue } from "./clone-value.js";
import {
  acceptPerformanceCandidate,
  createPerformanceCandidate,
  validatePerformanceCandidate,
} from "./performance-candidate.js";

function freezeCopy(value) {
  return Object.freeze(cloneValue(value));
}

function promotionMetadata(song, candidate) {
  return Object.freeze({
    version: 1,
    id: "validated-performance-promotion-v1",
    mode: "explicit-opt-in",
    engine: candidate?.after?.performanceCandidate?.engine ?? "performance-engine-v1",
    sourceSongId: song?.id ?? null,
    sourceSeed: song?.seed ?? null,
    candidateId: candidate?.after?.performanceCandidate?.id ?? null,
    shadowReportId: candidate?.report?.id ?? null,
    requestedHumanize: candidate?.requestedHumanize ?? null,
    selectedHumanize: candidate?.selectedHumanize ?? null,
    promotionCandidate: candidate?.report?.promotionCandidate === true,
    gauntletPassed: candidate?.gauntlet?.passed === true,
    ensemblePassed: candidate?.ensemble?.passed === true,
  });
}

export function createPerformancePromotion(song, {
  humanize = 0.65,
  seed = song?.seed ?? song?.id ?? "performance-promotion",
} = {}) {
  if (!song || !Array.isArray(song?.tracks)) {
    return Object.freeze({
      version: 1,
      id: "performance-promotion-transaction-v1",
      status: "rejected",
      before: song ? freezeCopy(song) : null,
      candidate: null,
      after: null,
      validation: Object.freeze({
        valid: false,
        issues: Object.freeze(["performance-promotion:invalid-song"]),
      }),
    });
  }

  const before = freezeCopy(song);
  const candidate = createPerformanceCandidate(song, { humanize, seed });
  const candidateValidation = validatePerformanceCandidate(candidate);

  if (candidate?.status !== "candidate" || !candidateValidation.valid) {
    return Object.freeze({
      version: 1,
      id: "performance-promotion-transaction-v1",
      status: "rejected",
      before,
      candidate,
      after: null,
      validation: Object.freeze({
        valid: false,
        issues: Object.freeze([
          "performance-promotion:candidate-rejected",
          ...(candidateValidation.issues ?? []),
        ]),
      }),
    });
  }

  const accepted = acceptPerformanceCandidate(candidate);
  accepted.performancePromotion = promotionMetadata(song, candidate);

  return Object.freeze({
    version: 1,
    id: "performance-promotion-transaction-v1",
    status: "promoted",
    before,
    candidate,
    after: freezeCopy(accepted),
    validation: Object.freeze({
      valid: true,
      issues: Object.freeze([]),
      candidate: candidateValidation,
    }),
  });
}

export function rejectPerformancePromotion(transaction) {
  if (!transaction?.before) {
    throw new Error("Cannot reject performance promotion without a source snapshot");
  }
  return cloneValue(transaction.before);
}
