const FOCUS_ROUTES = Object.freeze(new Set([
  "harmony-first",
  "groove-first",
  "hook-first",
]));

const CRITICAL_FIRST_SCORE_GAP = 10;
const CRITICAL_FIRST_ABSOLUTE_FLOOR = 68;
const CRITICAL_REPAIR_FOCUS = Object.freeze({
  harmonic: Object.freeze({ route: "harmony-first", group: "harmony" }),
  voiceLeading: Object.freeze({ route: "harmony-first", group: "harmony" }),
  groove: Object.freeze({ route: "groove-first", group: "groove" }),
  separation: Object.freeze({ route: "hook-first", group: "motif" }),
  phraseResolution: Object.freeze({ route: "hook-first", group: "motif" }),
  registerHealth: Object.freeze({ route: "hook-first", group: "motif" }),
});

function finiteOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function scoreSummary(result) {
  const song = result?.song;
  const details = song?.meta?.scoreDetails;
  const releasePassed = details?.releaseGate?.passed
    ?? song?.meta?.releaseGate?.passed
    ?? null;
  return Object.freeze({
    totalScore: finiteOrNull(details?.totalScore ?? song?.meta?.qualityScore ?? song?.meta?.score),
    creativeFloor: finiteOrNull(details?.balance?.creativeFloor),
    criticalFloor: finiteOrNull(details?.balance?.criticalFloor),
    lowestCriticalDimension: details?.balance?.lowestCriticalDimension ?? null,
    releasePassed: typeof releasePassed === "boolean" ? releasePassed : null,
  });
}

function criticalFirstFocus(summary) {
  const dimension = String(summary?.lowestCriticalDimension ?? "");
  const mapped = CRITICAL_REPAIR_FOCUS[dimension];
  const criticalFloor = finiteOrNull(summary?.criticalFloor);
  const totalScore = finiteOrNull(summary?.totalScore);
  if (!mapped || criticalFloor == null) return null;

  const scoreGap = totalScore == null ? null : totalScore - criticalFloor;
  const absoluteRisk = criticalFloor < CRITICAL_FIRST_ABSOLUTE_FLOOR;
  const aggregateMasking = scoreGap != null && scoreGap >= CRITICAL_FIRST_SCORE_GAP;
  if (!absoluteRisk && !aggregateMasking) return null;

  return Object.freeze({
    route: mapped.route,
    group: mapped.group,
    dimension,
    score: criticalFloor,
    scoreGap,
    reason: absoluteRisk ? "critical-floor-low" : "critical-floor-masked",
  });
}

export function diagnoseGenerationOutcome(kind, result, config = {}) {
  const requestKind = String(kind);
  const details = result?.song?.meta?.scoreDetails;
  const search = details?.candidateSearch;
  const loop = config?.producerBrain?.adaptiveLoop;
  const summary = scoreSummary(result);
  const searchFocusRoute = FOCUS_ROUTES.has(String(search?.focusRoute)) ? String(search.focusRoute) : null;
  const criticalFocus = criticalFirstFocus(summary);
  const focusRoute = criticalFocus?.route ?? searchFocusRoute;
  const focusDimension = criticalFocus?.dimension ?? search?.focusDimension ?? null;
  const focusGroup = criticalFocus?.group ?? search?.focusGroup ?? null;
  const focusScore = criticalFocus?.score ?? finiteOrNull(search?.focusScore);
  const eligibleKind = requestKind === "new" || requestKind === "similar";
  const explicitRoute = config?.compositionRoute != null && String(config.compositionRoute).length > 0;
  const shouldRetry = Boolean(
    eligibleKind
    && loop?.enabled === true
    && config?.selfCorrection !== false
    && !explicitRoute
    && search
    && search.targetReached === false
    && focusRoute,
  );

  return Object.freeze({
    shouldRetry,
    reason: shouldRetry
      ? criticalFocus ? "critical-focus-retry" : "critic-focus-retry"
      : !eligibleKind
        ? requestKind === "songVariations" ? "variation-set-atomic" : "unsupported-kind"
        : explicitRoute
          ? "explicit-route-preserved"
          : !search
            ? "missing-candidate-search"
            : search.targetReached !== false
              ? "target-already-reached"
              : !focusRoute
                ? "missing-focus-route"
                : loop?.enabled !== true
                  ? "adaptive-loop-disabled"
                  : config?.selfCorrection === false
                    ? "self-correction-disabled"
                    : "not-eligible",
    focusRoute,
    focusDimension,
    focusGroup,
    focusScore,
    focusSource: criticalFocus ? "critical" : "search",
    criticalPriority: Boolean(criticalFocus),
    criticalFloorGap: criticalFocus?.scoreGap ?? null,
    searchFocusRoute,
    searchFocusDimension: search?.focusDimension ?? null,
    searchFocusGroup: search?.focusGroup ?? null,
    ...summary,
  });
}

export function createSelfCorrectionPayload(payload = {}, diagnosis = {}) {
  const config = payload?.config && typeof payload.config === "object" && !Array.isArray(payload.config)
    ? payload.config
    : {};
  if (!FOCUS_ROUTES.has(String(diagnosis?.focusRoute))) return { ...payload, config: { ...config } };
  return {
    ...payload,
    config: {
      ...config,
      compositionRoute: String(diagnosis.focusRoute),
      weaknessAwareSearch: false,
      producerCorrection: Object.freeze({
        version: 1,
        pass: 1,
        reason: "critic-focus",
        focusRoute: String(diagnosis.focusRoute),
        focusDimension: diagnosis.focusDimension ?? null,
        focusGroup: diagnosis.focusGroup ?? null,
      }),
    },
  };
}

export function selectSelfCorrectedResult(originalResult, correctedResult) {
  const original = scoreSummary(originalResult);
  const corrected = scoreSummary(correctedResult);
  const scoreDelta = original.totalScore != null && corrected.totalScore != null
    ? corrected.totalScore - original.totalScore
    : null;
  const floorDelta = original.creativeFloor != null && corrected.creativeFloor != null
    ? corrected.creativeFloor - original.creativeFloor
    : null;
  const criticalFloorDelta = original.criticalFloor != null && corrected.criticalFloor != null
    ? corrected.criticalFloor - original.criticalFloor
    : null;

  let useCorrected = false;
  let reason = "original-retained";
  if (original.releasePassed === true && corrected.releasePassed === false) {
    reason = "release-regression-rejected";
  } else if (original.releasePassed === false && corrected.releasePassed === true) {
    useCorrected = true;
    reason = "release-gate-improved";
  } else if (scoreDelta != null && scoreDelta >= 0.5) {
    useCorrected = true;
    reason = "score-improved";
  } else if (criticalFloorDelta != null && criticalFloorDelta >= 2 && (scoreDelta == null || scoreDelta >= -0.25)) {
    useCorrected = true;
    reason = "critical-floor-improved";
  } else if (floorDelta != null && floorDelta >= 2 && (scoreDelta == null || scoreDelta >= -0.25)) {
    useCorrected = true;
    reason = "creative-floor-improved";
  }

  return Object.freeze({
    result: useCorrected ? correctedResult : originalResult,
    selected: useCorrected ? "corrected" : "original",
    reason,
    scoreDelta,
    creativeFloorDelta: floorDelta,
    criticalFloorDelta,
    original: Object.freeze(original),
    corrected: Object.freeze(corrected),
  });
}
