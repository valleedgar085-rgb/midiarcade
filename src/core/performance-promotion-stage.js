import { createPerformancePromotion } from "./performance-promotion.js";

export function runPerformancePromotionStage(selectedResult, {
  performanceRequest,
  qualityConfig,
  supportsCommittedAuthorityRefresh,
  refreshCommittedGenerationDiagnostics,
  committedAuthorityRegression,
  evaluateSongReleaseGate,
} = {}) {
  const sourceSong = selectedResult?.song;
  if (!sourceSong) {
    return {
      selectedResult,
      performancePromotion: null,
    };
  }

  const promotionSeed = String(
    performanceRequest?.seed
    ?? `${sourceSong?.seed ?? sourceSong?.id ?? "performance"}:validated-performance`,
  );
  const promotion = createPerformancePromotion(sourceSong, {
    humanize: performanceRequest?.humanize ?? 0.65,
    seed: promotionSeed,
  });

  if (promotion.status !== "promoted" || !promotion.after) {
    const performancePromotion = Object.freeze({
      requested: true,
      accepted: false,
      status: "candidate-rejected",
      selectedHumanize: promotion.candidate?.selectedHumanize ?? null,
      requestedHumanize: promotion.candidate?.requestedHumanize ?? null,
      candidateValidation: promotion.validation,
      authorityRegression: null,
      releasePassed: null,
      releaseFailures: Object.freeze([]),
    });
    return {
      selectedResult: { ...selectedResult, performancePromotion },
      performancePromotion,
    };
  }

  const promotedSong = supportsCommittedAuthorityRefresh(promotion.after)
    ? refreshCommittedGenerationDiagnostics(promotion.after, qualityConfig)
    : promotion.after;
  const authorityRegression = supportsCommittedAuthorityRefresh(sourceSong)
    ? committedAuthorityRegression(sourceSong, promotedSong)
    : Object.freeze({ passed: true, reasons: Object.freeze([]) });
  const release = evaluateSongReleaseGate(promotedSong);
  const accepted = authorityRegression.passed && release.passed;
  const performancePromotion = Object.freeze({
    requested: true,
    accepted,
    status: accepted ? "promoted" : "rejected-after-refresh",
    selectedHumanize: promotion.candidate?.selectedHumanize ?? null,
    requestedHumanize: promotion.candidate?.requestedHumanize ?? null,
    candidateValidation: promotion.validation,
    authorityRegression,
    releasePassed: release.passed,
    releaseFailures: Object.freeze([...(release.failures ?? [])]),
  });

  return {
    selectedResult: accepted
      ? { ...selectedResult, song: promotedSong, performancePromotion }
      : { ...selectedResult, performancePromotion },
    performancePromotion,
  };
}
