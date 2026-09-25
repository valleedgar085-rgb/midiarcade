import { authorizeQualityStage } from "./generation-repair-router.js";
import { auditStageMutationAuthority } from "./mutation-authority.js";

export function createQualityEvaluationContext({
  evaluateCandidate,
  evaluateReleaseGate,
} = {}) {
  if (typeof evaluateCandidate !== "function" || typeof evaluateReleaseGate !== "function") {
    throw new TypeError("quality evaluation context requires candidate and release evaluators");
  }

  const evaluationCache = new WeakMap();
  const releaseCache = new WeakMap();

  function evaluate(song) {
    if (!song || typeof song !== "object") return evaluateCandidate(song);
    if (evaluationCache.has(song)) return evaluationCache.get(song);
    const value = evaluateCandidate(song);
    evaluationCache.set(song, value);
    return value;
  }

  function release(song, evaluation = evaluate(song)) {
    if (!song || typeof song !== "object") return evaluateReleaseGate(song, evaluation);
    const cached = releaseCache.get(song);
    if (cached?.evaluation === evaluation) return cached.value;
    const value = evaluateReleaseGate(song, evaluation);
    releaseCache.set(song, { evaluation, value });
    return value;
  }

  return Object.freeze({
    evaluateCandidate: evaluate,
    evaluateReleaseGate: release,
  });
}

export function runQualityStageSequence(song, stages = [], { repairAuthority = null } = {}) {
  let current = song;
  const diagnostics = {};
  for (const stage of stages) {
    if (!stage || typeof stage.run !== "function") continue;
    const admission = authorizeQualityStage(stage.id, repairAuthority);
    if (!admission.allowed) {
      diagnostics[stage.id] = Object.freeze({
        accepted: false,
        skipped: true,
        reason: admission.reason,
        repairAuthority: admission,
      });
      continue;
    }
    const before = current;
    const result = stage.run(current);
    const after = result?.song ?? current;
    const mutationAuthority = auditStageMutationAuthority(before, after, stage.id);
    const stageDiagnostics = result?.diagnostics ?? null;
    diagnostics[stage.id] = stageDiagnostics && typeof stageDiagnostics === "object"
      ? Object.freeze({ ...stageDiagnostics, repairAuthority: admission, mutationAuthority })
      : stageDiagnostics;
    if (result?.song) current = result.song;
  }
  return Object.freeze({ song: current, diagnostics: Object.freeze(diagnostics) });
}
