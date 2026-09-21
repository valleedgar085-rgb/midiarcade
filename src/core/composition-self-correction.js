import { createCompositionCandidate } from "./blueprint-composer.js";

export const MAX_COMPOSITION_CORRECTION_ATTEMPTS = 3;

const FOCUS_ROUTES = Object.freeze({
  harmony: "harmony-first",
  groove: "groove-first",
  phrase: "harmony-first",
  separation: "groove-first",
});

const PRIORITY = Object.freeze([
  "safety",
  "harmony",
  "register",
  "separation",
  "groove",
  "phrase",
  "blueprint",
]);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, Number.isFinite(Number(value)) ? Number(value) : min));
}

function selectionKey(selection = {}) {
  return [
    selection.target ?? "song",
    selection.sectionId ?? "*",
    selection.trackId ?? "*",
  ].join(":");
}

function issueGroup(issue) {
  const value = String(issue ?? "");
  if (
    value.startsWith("scope-escape:")
    || value.startsWith("authority-changed:")
    || value.startsWith("boundary-or-outside-changed:")
    || value.startsWith("track-metadata-changed:")
    || value.startsWith("track-missing:")
    || value === "invalid-transaction"
  ) return "safety";
  if (value.startsWith("out-of-scale:") || value.startsWith("harmony:")) return "harmony";
  if (value.startsWith("register:")) return "register";
  if (value.startsWith("collision:")) return "separation";
  if (value.startsWith("groove:")) return "groove";
  if (value.startsWith("phrase:")) return "phrase";
  if (value.startsWith("blueprint:")) return "blueprint";
  return "unknown";
}

function unique(values) {
  return [...new Set(values)];
}

export function diagnoseCompositionCandidate(transaction) {
  const issues = Array.isArray(transaction?.validation?.issues)
    ? transaction.validation.issues.map(String)
    : [];
  if (transaction?.validation?.valid === true) {
    return Object.freeze({
      shouldRetry: false,
      reason: "candidate-valid",
      focusGroup: null,
      focusRoute: null,
      issues: Object.freeze([]),
      groups: Object.freeze([]),
    });
  }

  const groups = unique(issues.map(issueGroup));
  const safetyBlocked = groups.includes("safety");
  const focusGroup = PRIORITY.find((group) => groups.includes(group)) ?? null;
  const focusRoute = focusGroup ? FOCUS_ROUTES[focusGroup] ?? null : null;
  const retryable = Boolean(
    issues.length
    && !safetyBlocked
    && focusGroup
    && focusGroup !== "safety"
  );

  return Object.freeze({
    shouldRetry: retryable,
    reason: retryable
      ? "judge-focused-retry"
      : safetyBlocked
        ? "safety-contract-failure"
        : issues.length
          ? "unmapped-candidate-failure"
          : "missing-validation-issues",
    focusGroup,
    focusRoute,
    issues: Object.freeze([...issues]),
    groups: Object.freeze(groups),
  });
}

function repairSeed(baseSeed, selection, pass, diagnosis) {
  const focus = diagnosis?.focusGroup ?? "general";
  return `${baseSeed}:scope:${selectionKey(selection)}:repair:${focus}:${pass}`;
}

export function createCompositionCorrectionInput(
  sourceSong,
  selection,
  input = {},
  diagnosis = {},
  pass = 1,
) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const baseSeed = String(source.seed ?? sourceSong?.seed ?? sourceSong?.id ?? "composition");
  const explicitRoute = source.compositionRoute != null && String(source.compositionRoute).length > 0;
  const focusRoute = diagnosis?.focusRoute;
  const next = {
    ...source,
    seed: repairSeed(baseSeed, selection, pass, diagnosis),
    candidateCount: 1,
    adaptiveCandidates: false,
    weaknessAwareSearch: false,
    targetedRepair: false,
    selfCorrection: false,
    producerCorrection: Object.freeze({
      version: 1,
      pass,
      reason: "composition-judge",
      focusGroup: diagnosis?.focusGroup ?? null,
      focusRoute: focusRoute ?? null,
      issues: Object.freeze([...(diagnosis?.issues ?? [])]),
      selection: Object.freeze({ ...selection }),
    }),
  };

  if (!explicitRoute && focusRoute) next.compositionRoute = focusRoute;
  if (diagnosis?.focusGroup === "register") next.professionalUpgrade = true;
  return next;
}

function attemptSummary(transaction, index, input, diagnosis) {
  const judge = transaction?.validation?.judge;
  return Object.freeze({
    attempt: index,
    valid: transaction?.validation?.valid === true,
    seed: input?.seed ?? null,
    focusGroup: diagnosis?.focusGroup ?? null,
    focusRoute: diagnosis?.focusRoute ?? null,
    issues: Object.freeze([...(transaction?.validation?.issues ?? [])]),
    hardIssueCount: transaction?.validation?.issues?.length ?? 0,
    overallScore: Number.isFinite(Number(judge?.candidate?.scores?.overall))
      ? Number(judge.candidate.scores.overall)
      : null,
    deltas: judge?.deltas ? Object.freeze({ ...judge.deltas }) : null,
  });
}

function compareInvalidAttempts(left, right) {
  const leftIssueCount = left.summary.hardIssueCount;
  const rightIssueCount = right.summary.hardIssueCount;
  if (leftIssueCount !== rightIssueCount) return leftIssueCount - rightIssueCount;

  const leftScore = Number.isFinite(left.summary.overallScore) ? left.summary.overallScore : -Infinity;
  const rightScore = Number.isFinite(right.summary.overallScore) ? right.summary.overallScore : -Infinity;
  if (leftScore !== rightScore) return rightScore - leftScore;

  const leftDelta = Number.isFinite(left.summary.deltas?.overall) ? left.summary.deltas.overall : -Infinity;
  const rightDelta = Number.isFinite(right.summary.deltas?.overall) ? right.summary.deltas.overall : -Infinity;
  if (leftDelta !== rightDelta) return rightDelta - leftDelta;

  return left.index - right.index;
}

function firstAttemptInput(sourceSong, selection, input = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const baseSeed = String(source.seed ?? sourceSong?.seed ?? sourceSong?.id ?? "composition");
  return {
    ...source,
    seed: `${baseSeed}:scope:${selectionKey(selection)}:attempt:0`,
    candidateCount: 1,
    adaptiveCandidates: false,
    weaknessAwareSearch: false,
    targetedRepair: false,
    selfCorrection: false,
  };
}

/**
 * Compose inside one protected selection, diagnose failures, and retry only the
 * diagnosed musical focus. Every pass starts from the same canonical source
 * song; failed candidates never become input to a later pass.
 */
export function createSelfCorrectingCompositionCandidate(
  sourceSong,
  selection = {},
  input = {},
  {
    composer,
    maxAttempts = MAX_COMPOSITION_CORRECTION_ATTEMPTS,
  } = {},
) {
  const ceiling = clamp(Math.round(Number(maxAttempts)), 1, MAX_COMPOSITION_CORRECTION_ATTEMPTS);
  const attempts = [];
  let currentInput = firstAttemptInput(sourceSong, selection, input);
  let selected = null;
  let diagnosis = null;

  for (let index = 0; index < ceiling; index += 1) {
    const transaction = createCompositionCandidate(
      sourceSong,
      selection,
      currentInput,
      composer ? { composer } : undefined,
    );
    diagnosis = diagnoseCompositionCandidate(transaction);
    const summary = attemptSummary(transaction, index, currentInput, diagnosis);
    attempts.push({ index, transaction, summary });

    if (transaction.validation.valid) {
      selected = attempts.at(-1);
      break;
    }
    if (!diagnosis.shouldRetry || index + 1 >= ceiling) break;
    currentInput = createCompositionCorrectionInput(
      sourceSong,
      transaction.selection,
      input,
      diagnosis,
      index + 1,
    );
  }

  if (!selected) {
    selected = [...attempts].sort(compareInvalidAttempts)[0] ?? null;
  }
  if (!selected) throw new Error("Self-correction produced no composition candidate");

  const history = Object.freeze(attempts.map(({ summary }) => summary));
  selected.transaction.selfCorrection = Object.freeze({
    version: 1,
    maxAttempts: ceiling,
    attempts: history,
    attemptCount: history.length,
    selectedAttempt: selected.index,
    passed: selected.transaction.validation.valid === true,
    exhausted: selected.transaction.validation.valid !== true
      && history.length >= ceiling
      && diagnoseCompositionCandidate(selected.transaction).shouldRetry,
    stoppedReason: selected.transaction.validation.valid
      ? "candidate-valid"
      : diagnosis?.reason ?? "candidate-invalid",
  });
  return selected.transaction;
}
