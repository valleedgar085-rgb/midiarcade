import { cloneValue } from "./clone-value.js";
import { createPerformanceAuditionSong } from "./performance-audition.js";
import {
  createProfessionalGenerationGauntletSong,
  validateProfessionalGenerationGauntletSong,
} from "./professional-gauntlet-song.js";
import { checkSpecialistEnsemble } from "./specialist-ensemble-checker.js";

function trackId(track, index) {
  return String(track?.id ?? track?.trackId ?? track?.name ?? `track-${index}`);
}

function trackNotes(track) {
  return Array.isArray(track?.notes) ? track.notes : [];
}

function noteCount(song) {
  return (song?.tracks ?? []).reduce((sum, track) => sum + trackNotes(track).length, 0);
}

function pitchSequence(song) {
  return (song?.tracks ?? []).flatMap((track) => (
    trackNotes(track).map((note) => Math.round(Number(note?.pitch)))
  ));
}

function trackSignature(song) {
  return (song?.tracks ?? []).map((track, index) => Object.freeze({
    id: trackId(track, index),
    notes: trackNotes(track).length,
  }));
}

function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function clampHumanize(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0.65;
  return Math.max(0, Math.min(1, number));
}

function candidateHumanizeLevels(value) {
  const requested = clampHumanize(value);
  return [...new Set(
    [requested, requested * 0.75, requested * 0.5, requested * 0.25, requested * 0.125]
      .map((amount) => Math.round(amount * 1000) / 1000)
      .filter((amount) => amount > 0),
  )];
}

function candidateMetadata(song, audition, ensemble) {
  return Object.freeze({
    version: 1,
    id: "performance-candidate-v1",
    mode: "explicit-accept-only",
    engine: "performance-engine-v1",
    sourceSongId: song?.id ?? null,
    seed: audition.performanceSong?.performanceAudition?.seed ?? null,
    humanize: audition.performanceSong?.performanceAudition?.humanize ?? null,
    shadowReportId: audition.report?.id ?? null,
    promotionCandidate: audition.report?.promotionCandidate === true,
    ensembleCheckerId: ensemble?.id ?? null,
  });
}

export function validatePerformanceCandidate(transaction) {
  const issues = [];
  if (!transaction || typeof transaction !== "object") {
    return Object.freeze({
      valid: false,
      issues: Object.freeze(["performance:missing-transaction"]),
      checks: Object.freeze({}),
    });
  }

  const before = transaction.before;
  const after = transaction.after;
  const report = transaction.report;
  const gauntlet = transaction.gauntlet;
  const ensemble = transaction.ensemble;

  const checks = Object.freeze({
    hasSnapshots: Boolean(before && after),
    previewOnlyNotRetained: after?.performanceAudition == null,
    noteCountParity: noteCount(before) === noteCount(after),
    trackIdentityParity: sameJson(trackSignature(before), trackSignature(after)),
    pitchIdentityParity: sameJson(pitchSequence(before), pitchSequence(after)),
    shadowPromotionSafety: report?.promotionCandidate === true,
    meaningfulPerformance: Number(report?.metrics?.changedEvents ?? 0) > 0,
    gauntletAuthority: gauntlet?.passed === true,
    ensembleAuthority: ensemble?.passed === true,
    explicitCandidateMarker: after?.performanceCandidate?.id === "performance-candidate-v1",
  });

  for (const [check, passed] of Object.entries(checks)) {
    if (!passed) issues.push(`performance:${check}`);
  }

  return Object.freeze({
    valid: issues.length === 0,
    issues: Object.freeze(issues),
    checks,
  });
}

export function createPerformanceCandidate(song, {
  humanize = 0.65,
  seed = song?.seed ?? song?.id ?? "performance-candidate",
} = {}) {
  if (!song || !Array.isArray(song?.tracks)) {
    return Object.freeze({
      version: 1,
      id: "performance-candidate-transaction-v1",
      status: "rejected",
      validation: Object.freeze({
        valid: false,
        issues: Object.freeze(["performance:invalid-song"]),
        checks: Object.freeze({}),
      }),
    });
  }

  const before = cloneValue(song);
  const attempts = [];
  let lastRejected = null;

  for (const amount of candidateHumanizeLevels(humanize)) {
    let audition;
    try {
      audition = createPerformanceAuditionSong(song, {
        humanize: amount,
        seed: `${seed}:h${amount}`,
      });
    } catch (error) {
      attempts.push(Object.freeze({
        humanize: amount,
        valid: false,
        issues: Object.freeze(["performance:audition-safety-rejected"]),
        error: String(error?.message ?? error),
      }));
      continue;
    }

    const after = cloneValue(audition.performanceSong);
    delete after.performanceAudition;

    const candidateGauntlet = createProfessionalGenerationGauntletSong(after);
    const gauntlet = validateProfessionalGenerationGauntletSong(candidateGauntlet);
    const ensemble = checkSpecialistEnsemble(before, after);
    after.performanceCandidate = candidateMetadata(song, audition, ensemble);

    const draft = {
      version: 1,
      id: "performance-candidate-transaction-v1",
      status: "candidate",
      before: Object.freeze(before),
      after: Object.freeze(after),
      report: audition.report,
      gauntlet,
      ensemble,
      requestedHumanize: clampHumanize(humanize),
      selectedHumanize: amount,
    };
    const validation = validatePerformanceCandidate(draft);
    const attempt = Object.freeze({
      humanize: amount,
      valid: validation.valid,
      issues: validation.issues,
      ensembleHardIssues: ensemble.hardIssues,
    });
    attempts.push(attempt);

    const transaction = Object.freeze({
      ...draft,
      status: validation.valid ? "candidate" : "rejected",
      validation,
      attempts: Object.freeze([...attempts]),
    });

    if (validation.valid) return transaction;
    lastRejected = transaction;
  }

  return lastRejected ?? Object.freeze({
    version: 1,
    id: "performance-candidate-transaction-v1",
    status: "rejected",
    before: Object.freeze(before),
    attempts: Object.freeze(attempts),
    validation: Object.freeze({
      valid: false,
      issues: Object.freeze(["performance:no-promotable-intensity"]),
      checks: Object.freeze({}),
    }),
  });
}

export function acceptPerformanceCandidate(transaction) {
  const validation = validatePerformanceCandidate(transaction);
  if (!validation.valid) {
    throw new Error(`Cannot accept invalid performance candidate: ${validation.issues.join(", ")}`);
  }
  const accepted = cloneValue(transaction.after);
  accepted.performanceCandidate = {
    ...(accepted.performanceCandidate ?? {}),
    accepted: true,
  };
  return accepted;
}

export function rejectPerformanceCandidate(transaction) {
  if (!transaction?.before) {
    throw new Error("Cannot reject performance candidate without a source snapshot");
  }
  return cloneValue(transaction.before);
}
