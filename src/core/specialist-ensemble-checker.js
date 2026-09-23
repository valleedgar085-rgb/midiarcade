import { createDirectorDirective } from "./blueprint-composer.js";
import { judgeCompositionCandidate } from "./composition-candidate-judge.js";
import { analyzeEnsembleContinuity } from "./ensemble-continuity-refinement.js";
import {
  createProfessionalGenerationGauntletSong,
  validateProfessionalGenerationGauntletSong,
} from "./professional-gauntlet-song.js";

const REQUIRED_PHYSICAL_TRACKS = Object.freeze([
  "drums",
  "bass",
  "chords",
  "melody",
  "counterpoint",
  "pad",
]);

function trackIds(song) {
  return new Set((song?.tracks ?? []).map((track) => String(track?.id ?? "")));
}

function eventsPastSongEnd(gauntletSong) {
  const end = Number(gauntletSong?.totalBeats ?? 0);
  return (gauntletSong?.musicalEvents ?? []).filter((event) => (
    Number(event?.time) < -1e-6
    || Number(event?.time) + Number(event?.duration) > end + 1e-6
  ));
}

function outOfScaleEvents(gauntletSong) {
  return (gauntletSong?.musicalEvents ?? []).filter((event) => (
    event?.roleId !== "drums"
    && event?.semanticPitch?.type === "pitched"
    && event?.semanticPitch?.inScale === false
  ));
}

function rejectedPerformerStages(stages = []) {
  return stages.filter((stage) => stage?.kind === "performer" && stage?.status === "rejected");
}

export function checkSpecialistEnsemble(sourceSong, candidateSong, {
  plan = null,
  stages = [],
} = {}) {
  if (!sourceSong || !candidateSong) {
    return Object.freeze({
      passed: false,
      hardIssues: Object.freeze(["ensemble:missing-song"]),
      warnings: Object.freeze([]),
      checks: Object.freeze({}),
    });
  }

  const gauntletSong = createProfessionalGenerationGauntletSong(candidateSong);
  const gauntletValidation = validateProfessionalGenerationGauntletSong(gauntletSong);
  const directive = createDirectorDirective(sourceSong, { target: "song" });
  const judge = judgeCompositionCandidate(sourceSong, candidateSong, { target: "song" }, directive);
  const continuity = analyzeEnsembleContinuity(candidateSong);
  const present = trackIds(candidateSong);
  const missingPhysicalTracks = REQUIRED_PHYSICAL_TRACKS.filter((id) => !present.has(id));
  const outOfScale = outOfScaleEvents(gauntletSong);
  const overflow = eventsPastSongEnd(gauntletSong);
  const rejectedStages = rejectedPerformerStages(stages);

  const hardIssues = [
    ...gauntletValidation.issues.map((issue) => `gauntlet:${issue}`),
    ...judge.hardIssues,
    ...missingPhysicalTracks.map((id) => `ensemble:missing-track:${id}`),
    ...(outOfScale.length ? ["harmony:semantic-out-of-scale"] : []),
    ...(overflow.length ? ["arrangement:event-outside-song"] : []),
  ];

  const warnings = [
    ...judge.warnings,
    ...(continuity.deficit > 0
      ? [`ensemble:continuity-deficit:${continuity.deficit}`]
      : []),
    ...rejectedStages.map((stage) => `specialist:rejected:${stage.specialistId}`),
  ];

  const checks = Object.freeze({
    gauntletAuthority: gauntletValidation.passed,
    calibratedEnsembleJudge: judge.passed,
    physicalTrackContract: missingPhysicalTracks.length === 0,
    scaleSafety: outOfScale.length === 0,
    songBoundarySafety: overflow.length === 0,
    specialistPlanComplete: plan == null
      || Array.isArray(plan?.specialists) && plan.specialists.length === 9,
  });

  if (!checks.specialistPlanComplete) hardIssues.push("specialist:plan-incomplete");

  return Object.freeze({
    version: 1,
    id: "specialist-ensemble-checker-v1",
    passed: hardIssues.length === 0,
    hardIssues: Object.freeze([...new Set(hardIssues)]),
    warnings: Object.freeze([...new Set(warnings)]),
    checks,
    judge,
    continuity,
    gauntlet: gauntletValidation,
    diagnostics: Object.freeze({
      missingPhysicalTracks: Object.freeze(missingPhysicalTracks),
      outOfScaleEvents: outOfScale.length,
      outOfBoundsEvents: overflow.length,
      rejectedPerformerStages: rejectedStages.length,
    }),
  });
}
