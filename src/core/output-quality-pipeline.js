import {
  createSongFingerprint,
  evaluateSongCandidate,
  evaluateSongReleaseGate,
} from "../music-engine.js";
import {
  createDensityRefinementCandidates,
  MAX_DENSITY_REFINEMENT_CANDIDATES,
} from "./density-refinement.js";
import {
  createPhraseResolutionCandidates,
  MAX_PHRASE_RESOLUTION_CANDIDATES,
} from "./phrase-resolution-refinement.js";
import {
  applyResultOutputQualityPostprocess,
  applySongOutputQualityPostprocess,
} from "./output-quality-postprocess.js";

const DENSITY_ATTEMPT_CEILING = 86;
const PHRASE_RESOLUTION_ATTEMPT_CEILING = 86;
const PHRASE_PROTECTED_DIMENSIONS = Object.freeze(["motif", "repetition", "memory", "registerHealth"]);

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((finite(value) + Number.EPSILON) * factor) / factor;
}

function creativeFloor(evaluation) {
  const values = Object.values(evaluation?.subscores ?? {}).filter((value) => Number.isFinite(Number(value)));
  return values.length ? Math.min(...values.map(Number)) : 0;
}

function acceptedSongMetadata(song, evaluation, releaseGate, stageKey, diagnostics) {
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
        [stageKey]: diagnostics,
      },
    },
  };
}

function densityAssessment(candidate, before, beforeFloor, evaluateCandidate, evaluateReleaseGate) {
  const after = evaluateCandidate(candidate.song);
  const release = evaluateReleaseGate(candidate.song, after);
  const beforeDensity = finite(before?.subscores?.density);
  const afterDensity = finite(after?.subscores?.density);
  const afterFloor = creativeFloor(after);
  const densityDelta = afterDensity - beforeDensity;
  const scoreDelta = finite(after?.score) - finite(before?.score);
  const floorDelta = afterFloor - beforeFloor;
  const scaleSafe = finite(after?.diagnostics?.scaleFit, 0) >= 0.999999;
  const accepted = Boolean(
    release?.passed
    && scaleSafe
    && densityDelta >= 0.75
    && scoreDelta >= -0.25
    && floorDelta >= -0.75
    && candidate.densityErrorDelta < -1e-6
  );

  return {
    ...candidate,
    after,
    release,
    beforeDensity,
    afterDensity,
    afterFloor,
    densityDelta,
    scoreDelta,
    floorDelta,
    accepted,
    reason: !release?.passed ? "release-gate"
      : !scaleSafe ? "scale-safety"
        : candidate.densityErrorDelta >= -1e-6 ? "density-direction"
          : accepted ? "density-win" : "critic-regression",
  };
}

function compareDensityAssessments(left, right) {
  const densityDelta = right.densityDelta - left.densityDelta;
  if (Math.abs(densityDelta) > 1e-9) return densityDelta;
  const scoreDelta = finite(right.after?.score) - finite(left.after?.score);
  if (Math.abs(scoreDelta) > 1e-9) return scoreDelta;
  const floorDelta = right.afterFloor - left.afterFloor;
  if (Math.abs(floorDelta) > 1e-9) return floorDelta;
  return left.candidateIndex - right.candidateIndex;
}

function disabledDensityDiagnostics(reason = "disabled", patch = {}) {
  return Object.freeze({
    attempted: false,
    accepted: false,
    changed: false,
    reason,
    candidatesEvaluated: 0,
    candidateLimit: MAX_DENSITY_REFINEMENT_CANDIDATES,
    candidateIds: [],
    ...patch,
  });
}

function densityDiagnosticsFor(assessment, before, candidatesEvaluated, candidateIds) {
  return Object.freeze({
    attempted: true,
    accepted: Boolean(assessment?.accepted),
    changed: Boolean(assessment?.changedNotes),
    reason: assessment?.reason ?? "critic-regression",
    id: assessment?.id ?? null,
    changedNotes: finite(assessment?.changedNotes),
    candidatesEvaluated,
    candidateLimit: MAX_DENSITY_REFINEMENT_CANDIDATES,
    candidateIds,
    beforeScore: round(before?.score),
    afterScore: round(assessment?.after?.score),
    scoreDelta: round(assessment?.scoreDelta),
    beforeDensity: round(assessment?.beforeDensity),
    afterDensity: round(assessment?.afterDensity),
    densityDelta: round(assessment?.densityDelta),
    beforeNotesPerBar: round(assessment?.beforeNotesPerBar, 3),
    afterNotesPerBar: round(assessment?.afterNotesPerBar, 3),
    densityTarget: round(assessment?.densityTarget, 3),
    densityErrorDelta: round(assessment?.densityErrorDelta, 3),
    floorDelta: round(assessment?.floorDelta),
  });
}

export function applyDensityRefinement(song, config, evaluateCandidate, evaluateReleaseGate) {
  if (config.densityRefinement !== true) {
    return { song, diagnostics: disabledDensityDiagnostics() };
  }

  const before = evaluateCandidate(song);
  const beforeDensity = finite(before?.subscores?.density);
  const densityTarget = finite(before?.diagnostics?.densityTarget, 0);
  if (beforeDensity >= DENSITY_ATTEMPT_CEILING) {
    return {
      song,
      diagnostics: disabledDensityDiagnostics("already-strong", {
        beforeDensity: round(beforeDensity),
        densityTarget: round(densityTarget, 3),
      }),
    };
  }
  if (!(densityTarget > 0)) {
    return {
      song,
      diagnostics: disabledDensityDiagnostics("missing-target", {
        beforeDensity: round(beforeDensity),
      }),
    };
  }

  const candidates = createDensityRefinementCandidates(song, { densityTarget });
  if (!candidates.length) {
    return {
      song,
      diagnostics: Object.freeze({
        attempted: true,
        accepted: false,
        changed: false,
        reason: "no-support-opportunity",
        beforeDensity: round(beforeDensity),
        densityTarget: round(densityTarget, 3),
        candidatesEvaluated: 0,
        candidateLimit: MAX_DENSITY_REFINEMENT_CANDIDATES,
        candidateIds: [],
      }),
    };
  }

  const beforeFloor = creativeFloor(before);
  const assessments = candidates.map((candidate) => densityAssessment(
    candidate,
    before,
    beforeFloor,
    evaluateCandidate,
    evaluateReleaseGate,
  ));
  const candidateIds = assessments.map(({ id }) => id);
  const accepted = assessments.filter((assessment) => assessment.accepted).sort(compareDensityAssessments);
  const ranked = [...assessments].sort(compareDensityAssessments);
  const selected = accepted[0] ?? ranked[0];
  const diagnostics = densityDiagnosticsFor(selected, before, assessments.length, candidateIds);

  if (!accepted.length) return { song, diagnostics };

  selected.song.outputQualityEvolution = {
    ...(selected.song.outputQualityEvolution ?? {}),
    densityRefinement: {
      accepted: true,
      scoreDelta: diagnostics.scoreDelta,
      densityDelta: diagnostics.densityDelta,
      densityErrorDelta: diagnostics.densityErrorDelta,
      candidatesEvaluated: diagnostics.candidatesEvaluated,
    },
  };
  selected.song.meta = acceptedSongMetadata(
    selected.song,
    selected.after,
    selected.release,
    "densityRefinement",
    diagnostics,
  );
  return { song: selected.song, diagnostics };
}

function phraseProtectedDeltas(before, after) {
  return Object.fromEntries(PHRASE_PROTECTED_DIMENSIONS.map((dimension) => [
    dimension,
    finite(after?.subscores?.[dimension]) - finite(before?.subscores?.[dimension]),
  ]));
}

function phraseAssessment(candidate, before, beforeFloor, evaluateCandidate, evaluateReleaseGate) {
  const after = evaluateCandidate(candidate.song);
  const release = evaluateReleaseGate(candidate.song, after);
  const beforePhrase = finite(before?.subscores?.phraseResolution);
  const afterPhrase = finite(after?.subscores?.phraseResolution);
  const afterFloor = creativeFloor(after);
  const phraseDelta = afterPhrase - beforePhrase;
  const scoreDelta = finite(after?.score) - finite(before?.score);
  const floorDelta = afterFloor - beforeFloor;
  const protectedDeltas = phraseProtectedDeltas(before, after);
  const protectedSafe = Object.values(protectedDeltas).every((delta) => delta >= -1);
  const scaleSafe = finite(after?.diagnostics?.scaleFit, 0) >= 0.999999;
  const accepted = Boolean(
    release?.passed
    && scaleSafe
    && phraseDelta >= 0.75
    && scoreDelta >= -0.25
    && floorDelta >= -0.75
    && candidate.localScoreDelta > 0
    && protectedSafe
  );

  return {
    ...candidate,
    after,
    release,
    beforePhrase,
    afterPhrase,
    afterFloor,
    phraseDelta,
    scoreDelta,
    floorDelta,
    protectedDeltas,
    protectedSafe,
    accepted,
    reason: !release?.passed ? "release-gate"
      : !scaleSafe ? "scale-safety"
        : candidate.localScoreDelta <= 0 ? "phrase-direction"
          : !protectedSafe ? "protected-phrasing-regression"
            : accepted ? "phrase-win" : "critic-regression",
  };
}

function comparePhraseAssessments(left, right) {
  const phraseDelta = right.phraseDelta - left.phraseDelta;
  if (Math.abs(phraseDelta) > 1e-9) return phraseDelta;
  const scoreDelta = finite(right.after?.score) - finite(left.after?.score);
  if (Math.abs(scoreDelta) > 1e-9) return scoreDelta;
  const floorDelta = right.afterFloor - left.afterFloor;
  if (Math.abs(floorDelta) > 1e-9) return floorDelta;
  return left.candidateIndex - right.candidateIndex;
}

function disabledPhraseDiagnostics(reason = "disabled", patch = {}) {
  return Object.freeze({
    attempted: false,
    accepted: false,
    changed: false,
    reason,
    candidatesEvaluated: 0,
    candidateLimit: MAX_PHRASE_RESOLUTION_CANDIDATES,
    candidateIds: [],
    ...patch,
  });
}

function phraseDiagnosticsFor(assessment, before, candidatesEvaluated, candidateIds) {
  return Object.freeze({
    attempted: true,
    accepted: Boolean(assessment?.accepted),
    changed: Boolean(assessment?.changedNotes),
    reason: assessment?.reason ?? "critic-regression",
    id: assessment?.id ?? null,
    changedNotes: finite(assessment?.changedNotes),
    pitchEdits: finite(assessment?.pitchEdits),
    durationEdits: finite(assessment?.durationEdits),
    candidatesEvaluated,
    candidateLimit: MAX_PHRASE_RESOLUTION_CANDIDATES,
    candidateIds,
    beforeScore: round(before?.score),
    afterScore: round(assessment?.after?.score),
    scoreDelta: round(assessment?.scoreDelta),
    beforePhraseResolution: round(assessment?.beforePhrase),
    afterPhraseResolution: round(assessment?.afterPhrase),
    phraseResolutionDelta: round(assessment?.phraseDelta),
    beforeLocalScore: round(assessment?.beforeLocalScore),
    afterLocalScore: round(assessment?.afterLocalScore),
    localScoreDelta: round(assessment?.localScoreDelta),
    floorDelta: round(assessment?.floorDelta),
    protectedDeltas: Object.fromEntries(
      Object.entries(assessment?.protectedDeltas ?? {}).map(([dimension, delta]) => [dimension, round(delta)]),
    ),
  });
}

export function applyPhraseResolutionRefinement(song, config, evaluateCandidate, evaluateReleaseGate) {
  if (config.phraseResolutionRefinement !== true) {
    return { song, diagnostics: disabledPhraseDiagnostics() };
  }

  const before = evaluateCandidate(song);
  const beforePhrase = finite(before?.subscores?.phraseResolution);
  if (beforePhrase >= PHRASE_RESOLUTION_ATTEMPT_CEILING) {
    return {
      song,
      diagnostics: disabledPhraseDiagnostics("already-strong", {
        beforePhraseResolution: round(beforePhrase),
      }),
    };
  }

  const candidates = createPhraseResolutionCandidates(song);
  if (!candidates.length) {
    return {
      song,
      diagnostics: Object.freeze({
        attempted: true,
        accepted: false,
        changed: false,
        reason: "no-cadence-opportunity",
        beforePhraseResolution: round(beforePhrase),
        candidatesEvaluated: 0,
        candidateLimit: MAX_PHRASE_RESOLUTION_CANDIDATES,
        candidateIds: [],
      }),
    };
  }

  const beforeFloor = creativeFloor(before);
  const assessments = candidates.map((candidate) => phraseAssessment(
    candidate,
    before,
    beforeFloor,
    evaluateCandidate,
    evaluateReleaseGate,
  ));
  const candidateIds = assessments.map(({ id }) => id);
  const accepted = assessments.filter((assessment) => assessment.accepted).sort(comparePhraseAssessments);
  const ranked = [...assessments].sort(comparePhraseAssessments);
  const selected = accepted[0] ?? ranked[0];
  const diagnostics = phraseDiagnosticsFor(selected, before, assessments.length, candidateIds);

  if (!accepted.length) return { song, diagnostics };

  selected.song.outputQualityEvolution = {
    ...(selected.song.outputQualityEvolution ?? {}),
    phraseResolutionRefinement: {
      accepted: true,
      scoreDelta: diagnostics.scoreDelta,
      phraseResolutionDelta: diagnostics.phraseResolutionDelta,
      localScoreDelta: diagnostics.localScoreDelta,
      candidatesEvaluated: diagnostics.candidatesEvaluated,
    },
  };
  selected.song.meta = acceptedSongMetadata(
    selected.song,
    selected.after,
    selected.release,
    "phraseResolutionRefinement",
    diagnostics,
  );
  return { song: selected.song, diagnostics };
}

/**
 * Phase 6D wrapper: preserve the existing arrangement/return/pocket pipeline,
 * then audition bounded support articulation and section-ending melody cadence
 * candidates. Each stage fails closed and rejected work preserves its incoming
 * song object exactly.
 */
export function applySongOutputQualityPipeline(song, config = {}, {
  evaluateCandidate = evaluateSongCandidate,
  evaluateReleaseGate = evaluateSongReleaseGate,
} = {}) {
  const base = applySongOutputQualityPostprocess(song, config, {
    evaluateCandidate,
    evaluateReleaseGate,
  });
  const density = applyDensityRefinement(
    base.song,
    config,
    evaluateCandidate,
    evaluateReleaseGate,
  );
  const phrase = applyPhraseResolutionRefinement(
    density.song,
    config,
    evaluateCandidate,
    evaluateReleaseGate,
  );
  return {
    ...base,
    song: phrase.song,
    densityDiagnostics: density.diagnostics,
    phraseResolutionDiagnostics: phrase.diagnostics,
  };
}

export function applyResultOutputQualityPipeline(result, config = {}, evaluators = {}) {
  if (!result?.song) return result;
  const baseResult = applyResultOutputQualityPostprocess(result, config, evaluators);
  const evaluateCandidate = evaluators.evaluateCandidate ?? evaluateSongCandidate;
  const evaluateReleaseGate = evaluators.evaluateReleaseGate ?? evaluateSongReleaseGate;

  const density = applyDensityRefinement(
    baseResult.song,
    config,
    evaluateCandidate,
    evaluateReleaseGate,
  );
  const phrase = applyPhraseResolutionRefinement(
    density.song,
    config,
    evaluateCandidate,
    evaluateReleaseGate,
  );
  const densityAccepted = Boolean(density.diagnostics?.accepted && density.song !== baseResult.song);
  const phraseAccepted = Boolean(phrase.diagnostics?.accepted && phrase.song !== density.song);
  if (!densityAccepted && !phraseAccepted) return baseResult;

  const diagnostics = { ...(baseResult.outputQualityDiagnostics ?? {}) };
  if (densityAccepted) diagnostics.densityRefinement = density.diagnostics;
  if (phraseAccepted) diagnostics.phraseResolutionRefinement = phrase.diagnostics;
  return {
    ...baseResult,
    song: phrase.song,
    outputQualityDiagnostics: diagnostics,
  };
}
