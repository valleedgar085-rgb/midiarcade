import { createGenerationFlightRecorder } from "./generation-flight-recorder.js";
import { evaluateSongReleaseGate, refreshCommittedGenerationDiagnostics } from "../music-engine.js";
import { applyResultOutputQualityPipeline } from "./output-quality-pipeline-register.js";
import { resolveGenerationRequest } from "./resolved-generation-intent.js";
import {
  attachGenerationRepairAuthority,
  decideGenerationRepairAuthority,
} from "./generation-repair-router.js";
import {
  createSelfCorrectionPayload,
  diagnoseGenerationOutcome,
  selectSelfCorrectedResult,
} from "./generation-self-correction.js";


function supportsCommittedAuthorityRefresh(song) {
  return Boolean(
    song?.schema === "midi-arcade/song@1"
    && Array.isArray(song?.tracks)
    && Array.isArray(song?.structure)
    && Array.isArray(song?.harmony)
    && song?.finalMaster?.checks
    && song?.finalAssembly?.checks
    && song?.songBlueprint?.producerIntent
  );
}

function committedAuthorityRegression(beforeSong, afterSong) {
  if (!beforeSong || !afterSong) return Object.freeze({ passed: false, reasons: Object.freeze(["missing-song"]) });
  const reasons = [];
  const beforeAssembly = beforeSong.finalAssembly?.checks ?? {};
  const afterAssembly = afterSong.finalAssembly?.checks ?? {};
  for (const [check, passed] of Object.entries(beforeAssembly)) {
    if (passed === true && afterAssembly[check] !== true) reasons.push(`final-assembly:${check}`);
  }
  const beforeGroove = beforeSong.finalRhythmLock ?? {};
  const afterGroove = afterSong.finalRhythmLock ?? {};
  if (Number(afterGroove.timingViolations ?? 0) > Number(beforeGroove.timingViolations ?? 0)) {
    reasons.push("groove-timing-regression");
  }
  if (Number(afterGroove.protectedSpaceViolations ?? 0) > Number(beforeGroove.protectedSpaceViolations ?? 0)) {
    reasons.push("groove-negative-space-regression");
  }
  if (beforeSong.producerIntentReport?.status === "complete" && afterSong.producerIntentReport?.status !== "complete") {
    reasons.push("producer-intent-regression");
  }
  const beforeTonal = beforeSong.tonalIntegrity?.finalValidation ?? beforeSong.tonalIntegrity?.after ?? {};
  const afterTonal = afterSong.tonalIntegrity?.finalValidation ?? afterSong.tonalIntegrity?.after ?? {};
  if (Number(afterTonal.scaleFit ?? 0) + 1e-9 < Number(beforeTonal.scaleFit ?? 0)) {
    reasons.push("tonal-scale-regression");
  }
  if (Number(afterTonal.harshStrongNotes ?? 0) > Number(beforeTonal.harshStrongNotes ?? 0)) {
    reasons.push("tonal-context-regression");
  }
  return Object.freeze({
    passed: reasons.length === 0,
    reasons: Object.freeze(reasons),
  });
}

export function createGenerationExecutor({
  fallback,
  workerFactory = null,
  timeoutMs = 60000,
  recorder = null,
  persistGeneration = null,
  onPersistenceError = null,
  now = () => Date.now(),
  workerRetryBaseMs = 1000,
  workerRetryMaxMs = 30000,
} = {}) {
  if (typeof fallback !== "function") throw new TypeError("generation executor requires a fallback");

  const flightRecorder = recorder ?? createGenerationFlightRecorder();
  let worker = null;
  let workerUnavailable = typeof workerFactory !== "function";
  let workerFailures = 0;
  let workerRetryAt = 0;
  let requestId = 0;
  let lifecycle = 0;
  const pending = new Map();

  function requireCurrentLifecycle(expected) {
    if (expected !== lifecycle) throw new Error("Background generation was canceled.");
  }

  function markWorkerFailure() {
    workerFailures += 1;
    const base = Math.max(100, Number(workerRetryBaseMs) || 1000);
    const max = Math.max(base, Number(workerRetryMaxMs) || 30000);
    const delay = Math.min(max, base * (2 ** Math.min(8, workerFailures - 1)));
    workerRetryAt = Number(now()) + delay;
    workerUnavailable = true;
  }

  function runFallback(request) {
    Promise.resolve()
      .then(() => {
        requireCurrentLifecycle(request.lifecycle);
        return fallback(request.kind, request.payload);
      })
      .then(request.resolve, request.reject);
  }

  function takePending(id) {
    const request = pending.get(id);
    if (!request) return null;
    pending.delete(id);
    clearTimeout(request.timer);
    return request;
  }

  function rejectPending(error) {
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    pending.clear();
  }

  function recoverPendingWithFallback() {
    const interrupted = [...pending.values()];
    pending.clear();
    for (const request of interrupted) {
      clearTimeout(request.timer);
      runFallback(request);
    }
  }

  function disposeWorker(error = null) {
    if (worker) {
      try { worker.terminate?.(); } catch { /* already terminated */ }
    }
    worker = null;
    if (error) rejectPending(error);
  }

  function ensureWorker() {
    if (typeof workerFactory !== "function") return null;
    if (workerUnavailable && Number(now()) < workerRetryAt) return null;
    if (workerUnavailable) workerUnavailable = false;
    if (worker) return worker;
    try {
      worker = workerFactory();
      if (!worker?.postMessage) throw new Error("Background generation is unavailable.");
      const createdWorker = worker;
      worker.addEventListener("message", (event) => {
        if (worker !== createdWorker) return;
        const request = takePending(event.data?.requestId);
        if (!request) return;
        if (event.data?.ok) {
          workerFailures = 0;
          workerRetryAt = 0;
          request.resolve(event.data.result);
        } else {
          markWorkerFailure();
          disposeWorker();
          runFallback(request);
        }
      });
      worker.addEventListener("error", () => {
        if (worker !== createdWorker) return;
        markWorkerFailure();
        disposeWorker();
        recoverPendingWithFallback();
      });
      return worker;
    } catch {
      markWorkerFailure();
      disposeWorker();
      return null;
    }
  }

  function executeAdapted(kind, adaptedPayload, expectedLifecycle) {
    requireCurrentLifecycle(expectedLifecycle);
    const activeWorker = ensureWorker();
    if (!activeWorker) return Promise.resolve().then(() => {
      requireCurrentLifecycle(expectedLifecycle);
      return fallback(kind, adaptedPayload);
    });
    const id = ++requestId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const request = takePending(id);
        if (!request) return;
        markWorkerFailure();
        disposeWorker();
        runFallback(request);
      }, Math.max(1000, Number(timeoutMs) || 60000));
      pending.set(id, { resolve, reject, timer, kind, payload: adaptedPayload, lifecycle: expectedLifecycle });
      try {
        activeWorker.postMessage({ requestId: id, kind, payload: adaptedPayload });
      } catch {
        const request = takePending(id);
        markWorkerFailure();
        disposeWorker();
        if (request) runFallback(request);
      }
    });
  }

  async function run(kind, payload = {}) {
    const expectedLifecycle = lifecycle;
    const databaseStartedAt = typeof persistGeneration === "function"
      ? new Date(Number(now())).toISOString()
      : null;
    const adaptedPayload = resolveGenerationRequest(kind, payload);
    const config = adaptedPayload?.config ?? adaptedPayload?.input ?? {};
    const flightId = flightRecorder.begin(kind, {
      sourceSong: adaptedPayload?.sourceSong,
      config,
    });
    flightRecorder.mark(flightId, "plan", {
      producerBrain: config?.producerBrain?.id ?? null,
      blueprint: config?.producerBrain?.blueprint?.id ?? null,
      outputQuality: config?.outputQuality?.seedSignature ?? null,
      resolvedIntent: config?.resolvedGenerationIntent?.id ?? null,
    });

    try {
      flightRecorder.mark(flightId, "compose", { pass: 0 });
      const originalResult = await executeAdapted(kind, adaptedPayload, expectedLifecycle);
      requireCurrentLifecycle(expectedLifecycle);

      if (kind === "compositionCandidate") {
        const transaction = originalResult?.transaction;
        const correction = transaction?.selfCorrection;
        flightRecorder.mark(flightId, "diagnose", {
          valid: transaction?.validation?.valid === true,
          issues: transaction?.validation?.issues ?? [],
          attempts: correction?.attemptCount ?? 1,
          selectedAttempt: correction?.selectedAttempt ?? 0,
        });
        flightRecorder.mark(flightId, "compare", {
          selected: transaction?.validation?.valid ? "candidate" : "rejected",
          reason: correction?.stoppedReason ?? "composition-candidate",
        });
        flightRecorder.mark(flightId, "finalize", {
          compositionCandidate: true,
          passed: transaction?.validation?.valid === true,
        });
        flightRecorder.complete(flightId, originalResult);
        return originalResult;
      }

      const diagnosis = diagnoseGenerationOutcome(kind, originalResult, config);
      const repairAuthority = decideGenerationRepairAuthority(kind, diagnosis, config);
      flightRecorder.mark(flightId, "diagnose", {
        shouldRetry: repairAuthority.mode === "composition-reroute",
        reason: diagnosis.reason,
        focusRoute: diagnosis.focusRoute,
        focusDimension: diagnosis.focusDimension,
        focusGroup: diagnosis.focusGroup,
        totalScore: diagnosis.totalScore,
        creativeFloor: diagnosis.creativeFloor,
        criticalFloor: diagnosis.criticalFloor,
        lowestCriticalDimension: diagnosis.lowestCriticalDimension,
        repairAuthority: repairAuthority.mode,
      });

      let selectedResult = originalResult;
      if (repairAuthority.mode === "composition-reroute") {
        const correctionPayload = createSelfCorrectionPayload(adaptedPayload, diagnosis);
        flightRecorder.mark(flightId, "repair", {
          pass: 1,
          focusRoute: diagnosis.focusRoute,
          focusDimension: diagnosis.focusDimension,
          focusGroup: diagnosis.focusGroup,
        });
        const correctedResult = await executeAdapted(kind, correctionPayload, expectedLifecycle);
        requireCurrentLifecycle(expectedLifecycle);
        const comparison = selectSelfCorrectedResult(originalResult, correctedResult);
        selectedResult = comparison.result;
        flightRecorder.mark(flightId, "compare", {
          selected: comparison.selected,
          reason: comparison.reason,
          scoreDelta: comparison.scoreDelta,
          creativeFloorDelta: comparison.creativeFloorDelta,
          criticalFloorDelta: comparison.criticalFloorDelta,
        });
      } else {
        flightRecorder.mark(flightId, "compare", {
          selected: "original",
          reason: diagnosis.reason,
          skipped: true,
        });
      }

      const qualityConfig = attachGenerationRepairAuthority(config, repairAuthority);
      const preQualityResult = selectedResult;
      const refreshCommittedAuthorities = supportsCommittedAuthorityRefresh(preQualityResult?.song);
      const preQualitySong = refreshCommittedAuthorities
        ? refreshCommittedGenerationDiagnostics(preQualityResult.song, qualityConfig)
        : preQualityResult?.song ?? null;
      let stageDiagnostics = {};
      const qualityResult = applyResultOutputQualityPipeline(preQualityResult, qualityConfig, {
        onStageDiagnostics(diagnostics) {
          stageDiagnostics = diagnostics ?? {};
        },
      });
      let committedQuality = Object.freeze({
        accepted: qualityResult === preQualityResult,
        reason: qualityResult === preQualityResult ? "unchanged" : "pending-validation",
        authorityRegression: Object.freeze({ passed: true, reasons: Object.freeze([]) }),
        releasePassed: preQualitySong ? evaluateSongReleaseGate(preQualitySong).passed : null,
      });
      if (qualityResult?.song && qualityResult !== preQualityResult && refreshCommittedAuthorities) {
        const refreshedQualitySong = refreshCommittedGenerationDiagnostics(qualityResult.song, qualityConfig);
        const authorityRegression = committedAuthorityRegression(preQualitySong, refreshedQualitySong);
        const committedRelease = evaluateSongReleaseGate(refreshedQualitySong);
        const accepted = authorityRegression.passed && committedRelease.passed;
        committedQuality = Object.freeze({
          accepted,
          reason: accepted
            ? "committed-authorities-preserved"
            : !authorityRegression.passed
              ? "committed-authority-regression"
              : "committed-release-gate-failed",
          authorityRegression,
          releasePassed: committedRelease.passed,
          releaseFailures: Object.freeze([...(committedRelease.failures ?? [])]),
        });
        selectedResult = accepted
          ? { ...qualityResult, song: refreshedQualitySong }
          : {
            ...preQualityResult,
            outputQualityRejected: committedQuality,
          };
      } else if (qualityResult?.song && qualityResult !== preQualityResult) {
        selectedResult = qualityResult;
      } else if (refreshCommittedAuthorities && preQualitySong && preQualityResult?.song !== preQualitySong) {
        selectedResult = { ...preQualityResult, song: preQualitySong };
      }
      const acceptedDiagnostics = selectedResult?.outputQualityDiagnostics ?? {};
      flightRecorder.mark(flightId, "finalize", {
        repairAuthority,
        committedQuality,
        resolvedGenerationIntent: config?.resolvedGenerationIntent ?? null,
        arrangementEvolution: stageDiagnostics.arrangement ?? acceptedDiagnostics.arrangement ?? null,
        returnDevelopment: stageDiagnostics.returnDevelopment ?? acceptedDiagnostics.returnDevelopment ?? null,
        densityRefinement: stageDiagnostics.densityRefinement ?? acceptedDiagnostics.densityRefinement ?? null,
        phraseResolutionRefinement: stageDiagnostics.phraseResolutionRefinement ?? acceptedDiagnostics.phraseResolutionRefinement ?? null,
        registerHealthRefinement: stageDiagnostics.registerHealthRefinement ?? acceptedDiagnostics.registerHealthRefinement ?? null,
        melodyContinuityRefinement: stageDiagnostics.melodyContinuityRefinement ?? acceptedDiagnostics.melodyContinuityRefinement ?? null,
        bassContinuityRefinement: stageDiagnostics.bassContinuityRefinement ?? acceptedDiagnostics.bassContinuityRefinement ?? null,
        ensembleContinuityRefinement: stageDiagnostics.ensembleContinuityRefinement ?? acceptedDiagnostics.ensembleContinuityRefinement ?? null,
      });

      const shouldPersist = typeof persistGeneration === "function"
        && ["new", "similar"].includes(kind)
        && Boolean(selectedResult?.song);
      if (shouldPersist) {
        flightRecorder.mark(flightId, "persist", { enabled: true });
      }
      flightRecorder.complete(flightId, selectedResult);

      if (shouldPersist) {
        try {
          const { createGenerationDatabaseRecord } = await import("./generation-database-record.js");
          const completedRun = flightRecorder.snapshot().find((entry) => entry.id === flightId) ?? null;
          const databaseRecord = createGenerationDatabaseRecord({
            kind,
            config,
            sourceSong: adaptedPayload?.sourceSong ?? null,
            result: selectedResult,
            song: selectedResult.song,
            runId: flightId,
            startedAt: databaseStartedAt,
            completedAt: new Date(Number(now())).toISOString(),
            durationMs: completedRun?.durationMs ?? null,
            stages: completedRun?.stages ?? [],
            outcome: completedRun?.status ?? selectedResult?.status ?? "committed",
            engineVersion: selectedResult?.song?.schema ?? null,
          });
          await Promise.resolve(persistGeneration(databaseRecord));
        } catch (error) {
          if (typeof onPersistenceError === "function") {
            try { onPersistenceError(error); } catch { /* error reporting cannot invalidate accepted music */ }
          }
        }
      }

      return selectedResult;
    } catch (error) {
      flightRecorder.fail(flightId, error);
      throw error;
    }
  }

  return Object.freeze({
    run,
    diagnosticsSnapshot() {
      return flightRecorder.snapshot();
    },
    clearDiagnostics() {
      flightRecorder.clear();
    },
    dispose() {
      lifecycle += 1;
      disposeWorker(new Error("Background generation was canceled."));
    },
    get usingWorker() {
      return Boolean(worker);
    },
    get activeRequests() {
      return pending.size;
    },
  });
}
