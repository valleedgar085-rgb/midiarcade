import {
  evaluateSongCandidate,
  evaluateSongReleaseGate,
  generateNew,
  GENRE_PROFILES,
} from "./music-engine.js";
import { applyOutputQualityEvolution } from "./core/output-quality-evolution.js";
import { applySongOutputQualityPipeline } from "./core/output-quality-pipeline-register.js";

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value, places = 0) => Number(finite(value).toFixed(places));
const averageOf = (items, selector, places = 0) => round(mean(items.map(selector)), places);

export const QUALITY_DIMENSION_GROUPS = Object.freeze({
  harmony: Object.freeze(["harmonic", "voiceLeading", "separation", "cadence", "harmonicJourney"]),
  groove: Object.freeze(["groove", "density", "performance", "drumVariety"]),
  phrasing: Object.freeze(["motif", "repetition", "memory", "phraseResolution", "registerHealth"]),
  arrangement: Object.freeze(["storyArc", "transitions", "orchestration", "tensionFollow", "stageInterlock"]),
  production: Object.freeze(["production", "genreAuthenticity"]),
});

export const PHASE5_DIMENSION_FLOORS = Object.freeze({
  harmonic: 68,
  groove: 62,
  motif: 55,
  voiceLeading: 68,
  separation: 72,
  phraseResolution: 58,
  production: 68,
  stageInterlock: 68,
  genreAuthenticity: 58,
  storyArc: 58,
  transitions: 58,
  orchestration: 58,
  tensionFollow: 55,
  drumVariety: 55,
  registerHealth: 58,
  density: 52,
  performance: 55,
  memory: 50,
  repetition: 50,
});

function checkRatio(checks) {
  const values = Object.values(checks ?? {});
  return values.length ? values.filter(Boolean).length / values.length : 1;
}

function scoreGroup(subscores, dimensions) {
  const values = dimensions
    .filter((dimension) => Number.isFinite(Number(subscores?.[dimension])))
    .map((dimension) => finite(subscores[dimension]));
  return values.length ? round(mean(values), 1) : 0;
}

function groupScoresFor(subscores = {}) {
  return Object.fromEntries(
    Object.entries(QUALITY_DIMENSION_GROUPS)
      .map(([group, dimensions]) => [group, scoreGroup(subscores, dimensions)]),
  );
}

function weakestEntry(scores = {}) {
  const entries = Object.entries(scores).filter(([, score]) => Number.isFinite(Number(score)));
  if (!entries.length) return { id: "unknown", score: 0 };
  const [id, score] = entries.reduce((lowest, entry) => entry[1] < lowest[1] ? entry : lowest);
  return { id, score: round(score, 1) };
}

function dimensionAveragesFor(results) {
  const dimensions = new Set(results.flatMap(({ dimensionScores }) => Object.keys(dimensionScores ?? {})));
  return Object.fromEntries([...dimensions].sort().map((dimension) => [
    dimension,
    averageOf(results, ({ dimensionScores }) => finite(dimensionScores?.[dimension], 0), 1),
  ]));
}

function groupAveragesFor(results) {
  return Object.fromEntries(Object.keys(QUALITY_DIMENSION_GROUPS).map((group) => [
    group,
    averageOf(results, ({ groupScores }) => finite(groupScores?.[group], 0), 1),
  ]));
}

function healthBand(score) {
  if (score >= 94) return "excellent";
  if (score >= 90) return "strong";
  if (score >= 84) return "watch";
  return "priority";
}

function uniqueRatio(values = []) {
  const normalized = values.map((value) => String(value ?? ""));
  return round(new Set(normalized).size / Math.max(1, normalized.length), 3);
}

function onsetPhaseSignature(notes = [], beatsPerBar = 4, pitch = null, limit = 48) {
  const filtered = pitch == null ? notes : notes.filter((note) => note.pitch === pitch);
  return filtered
    .slice(0, limit)
    .map((note) => {
      const local = ((finite(note.start, 0) % beatsPerBar) + beatsPerBar) % beatsPerBar;
      return round(local * 4) / 4;
    })
    .join(",");
}

function melodyContourSignature(notes = [], limit = 24) {
  const ordered = [...notes].sort((a, b) => finite(a.start, 0) - finite(b.start, 0)).slice(0, limit);
  const directions = [];
  for (let index = 1; index < ordered.length; index += 1) {
    const delta = finite(ordered[index].pitch, 0) - finite(ordered[index - 1].pitch, 0);
    directions.push(delta > 0 ? "U" : delta < 0 ? "D" : "S");
  }
  return directions.join("");
}

function varietySignaturesFor(song = {}) {
  const tracks = new Map((song.tracks ?? []).map((track) => [track.id, track.notes ?? []]));
  const barBeats = Math.max(1, finite(song.meta?.beatsPerBar, 4));
  return {
    arrangement: (song.structure ?? []).map((section) => section.name).join(">"),
    featuredOrder: (song.orchestrationMatrix ?? []).map((entry) => entry.featuredTrack ?? "?").join(">"),
    compositionRoute: song.compositionRoute?.id ?? "unknown",
    kickRhythm: onsetPhaseSignature(tracks.get("drums") ?? [], barBeats, 36),
    bassRhythm: onsetPhaseSignature(tracks.get("bass") ?? [], barBeats),
    melodyContour: melodyContourSignature(tracks.get("melody") ?? []),
  };
}

function minimumDimensionScoresFor(results = []) {
  const dimensions = new Set(results.flatMap(({ dimensionScores }) => Object.keys(dimensionScores ?? {})));
  return Object.fromEntries([...dimensions].sort().map((dimension) => [
    dimension,
    Math.min(...results.map(({ dimensionScores }) => finite(dimensionScores?.[dimension], 100))),
  ]));
}

function phase5FloorBreaches(minimumDimensionScores = {}) {
  return Object.entries(PHASE5_DIMENSION_FLOORS)
    .map(([dimension, floor]) => ({
      dimension,
      floor,
      score: finite(minimumDimensionScores?.[dimension], 100),
    }))
    .filter(({ score, floor }) => score < floor)
    .sort((left, right) => (left.score - left.floor) - (right.score - right.floor));
}

function varietySummaryFor(results = []) {
  const axes = ["arrangement", "featuredOrder", "compositionRoute", "kickRhythm", "bassRhythm", "melodyContour"];
  const ratios = Object.fromEntries(axes.map((axis) => [
    axis,
    uniqueRatio(results.map((result) => result.varietySignatures?.[axis] ?? "")),
  ]));
  const [weakestAxis, weakestRatio] = Object.entries(ratios)
    .sort((left, right) => left[1] - right[1] || left[0].localeCompare(right[0]))[0] ?? ["unknown", 0];
  return { ratios, weakestAxis, weakestRatio };
}

function technicalHealth(song, evaluation, releaseGate) {
  const scaleFit = finite(evaluation?.diagnostics?.scaleFit, 0);
  const masterChecks = checkRatio(song.finalMaster?.checks);
  const assemblyChecks = checkRatio(song.finalAssembly?.checks);
  const exportChecks = checkRatio(releaseGate?.exportChecks);
  const releasePass = releaseGate?.passed ? 1 : 0;
  const score = round(mean([
    scaleFit * 100,
    masterChecks * 100,
    assemblyChecks * 100,
    exportChecks * 100,
  ]));
  return { score, scaleFit, masterChecks, assemblyChecks, exportChecks, releasePass };
}

function summarizeGenre(genre, results) {
  const genreResults = results.filter((result) => result.genre === genre);
  const fingerprints = new Set(genreResults.map(({ fingerprint }) => fingerprint));
  const dimensionAverages = dimensionAveragesFor(genreResults);
  const groupAverages = groupAveragesFor(genreResults);
  const weakestDimension = weakestEntry(dimensionAverages);
  const weakestGroup = weakestEntry(groupAverages);
  const averageOverallScore = averageOf(genreResults, ({ overallScore }) => overallScore, 1);
  const minimumDimensionScores = minimumDimensionScoresFor(genreResults);
  const floorBreaches = phase5FloorBreaches(minimumDimensionScores);
  const variety = varietySummaryFor(genreResults);
  return {
    genre,
    samples: genreResults.length,
    averageMusicalScore: averageOf(genreResults, ({ musicalScore }) => musicalScore, 1),
    minimumMusicalScore: Math.min(...genreResults.map(({ musicalScore }) => musicalScore)),
    averageTechnicalScore: averageOf(genreResults, ({ technicalScore }) => technicalScore, 1),
    averageOverallScore,
    averageCreativeFloor: averageOf(genreResults, ({ creativeFloor }) => creativeFloor, 1),
    releasePassRate: averageOf(genreResults, ({ releasePassed }) => releasePassed ? 1 : 0, 3),
    uniqueFingerprintRatio: round(fingerprints.size / Math.max(1, genreResults.length), 3),
    minimumDimensionScores,
    floorBreaches,
    floorBreachCount: floorBreaches.length,
    variety,
    arrangementAttemptRate: averageOf(genreResults, ({ arrangementAttempted }) => arrangementAttempted ? 1 : 0, 3),
    arrangementAcceptanceRate: averageOf(genreResults, ({ arrangementAccepted }) => arrangementAccepted ? 1 : 0, 3),
    returnDevelopmentAttemptRate: averageOf(genreResults, ({ returnDevelopmentAttempted }) => returnDevelopmentAttempted ? 1 : 0, 3),
    returnDevelopmentAcceptanceRate: averageOf(genreResults, ({ returnDevelopmentAccepted }) => returnDevelopmentAccepted ? 1 : 0, 3),
    densityRefinementAttemptRate: averageOf(genreResults, ({ densityRefinementAttempted }) => densityRefinementAttempted ? 1 : 0, 3),
    densityRefinementAcceptanceRate: averageOf(genreResults, ({ densityRefinementAccepted }) => densityRefinementAccepted ? 1 : 0, 3),
    averageDensityRefinementDelta: averageOf(genreResults, ({ densityRefinementDelta }) => densityRefinementDelta, 2),
    phraseResolutionRefinementAttemptRate: averageOf(genreResults, ({ phraseResolutionRefinementAttempted }) => phraseResolutionRefinementAttempted ? 1 : 0, 3),
    phraseResolutionRefinementAcceptanceRate: averageOf(genreResults, ({ phraseResolutionRefinementAccepted }) => phraseResolutionRefinementAccepted ? 1 : 0, 3),
    averagePhraseResolutionRefinementDelta: averageOf(genreResults, ({ phraseResolutionRefinementDelta }) => phraseResolutionRefinementDelta, 2),
    registerHealthRefinementAttemptRate: averageOf(genreResults, ({ registerHealthRefinementAttempted }) => registerHealthRefinementAttempted ? 1 : 0, 3),
    registerHealthRefinementAcceptanceRate: averageOf(genreResults, ({ registerHealthRefinementAccepted }) => registerHealthRefinementAccepted ? 1 : 0, 3),
    averageRegisterHealthRefinementDelta: averageOf(genreResults, ({ registerHealthRefinementDelta }) => registerHealthRefinementDelta, 2),
    groovePocketAttemptRate: averageOf(genreResults, ({ groovePocketAttempted }) => groovePocketAttempted ? 1 : 0, 3),
    groovePocketAcceptanceRate: averageOf(genreResults, ({ groovePocketAccepted }) => groovePocketAccepted ? 1 : 0, 3),
    averageGroovePocketDelta: averageOf(genreResults, ({ groovePocketDelta }) => groovePocketDelta, 2),
    averageNotesPerBar: averageOf(genreResults, ({ notesPerBar }) => notesPerBar, 1),
    averageDensityTarget: averageOf(genreResults, ({ densityTarget }) => densityTarget, 1),
    averageDensityDelta: averageOf(genreResults, ({ densityDelta }) => densityDelta, 1),
    weakestGroup,
    weakestDimension,
    groupAverages,
    dimensionAverages,
    healthBand: healthBand(averageOverallScore),
  };
}

function recommendationsFor({ perGenre, weakestGroup, weakestDimension, averageTechnicalScore, releasePassRate }) {
  const recommendations = [];
  const priorityGenre = perGenre[0];
  if (priorityGenre) {
    recommendations.push(`Prioritize ${priorityGenre.genre}: ${priorityGenre.weakestGroup.id} is its weakest subsystem at ${priorityGenre.weakestGroup.score}.`);
  }
  if (weakestGroup.id !== "unknown") recommendations.push(`Global producer-brain focus: ${weakestGroup.id} averages ${weakestGroup.score}.`);
  if (weakestDimension.id !== "unknown") recommendations.push(`Lowest individual critic dimension: ${weakestDimension.id} at ${weakestDimension.score}.`);
  if (averageTechnicalScore < 100) recommendations.push(`Technical readiness averages ${averageTechnicalScore}; fix safety/export/master failures before creative tuning.`);
  if (releasePassRate < 1) recommendations.push(`Raw candidate release-pass rate is ${Math.round(releasePassRate * 100)}%; target the lowest creative dimensions before increasing search cost.`);
  return recommendations;
}

export function runGenerationBenchmark({
  genres = Object.keys(GENRE_PROFILES),
  seeds = ["calibration-a", "calibration-b"],
  bars = 8,
  qualityEvolution = true,
} = {}) {
  const results = [];
  for (const genre of genres) {
    for (const seed of seeds) {
      const rawConfig = { genre, seed: `${seed}:${genre}`, bars, candidateCount: 1 };
      const generationConfig = qualityEvolution
        ? {
          ...applyOutputQualityEvolution(rawConfig, { kind: "new" }),
          phraseResolutionRefinement: true,
          registerHealthRefinement: true,
        }
        : rawConfig;
      const generatedSong = generateNew(generationConfig);
      const postprocessed = qualityEvolution
        ? applySongOutputQualityPipeline(generatedSong, generationConfig)
        : {
          song: generatedSong,
          diagnostics: null,
          returnDiagnostics: null,
          densityDiagnostics: null,
          phraseResolutionDiagnostics: null,
          registerHealthDiagnostics: null,
          grooveDiagnostics: null,
        };
      const song = postprocessed.song;
      const arrangementDiagnostics = postprocessed.diagnostics;
      const returnDiagnostics = postprocessed.returnDiagnostics;
      const densityDiagnostics = postprocessed.densityDiagnostics;
      const phraseResolutionDiagnostics = postprocessed.phraseResolutionDiagnostics;
      const registerHealthDiagnostics = postprocessed.registerHealthDiagnostics;
      const grooveDiagnostics = postprocessed.grooveDiagnostics;
      const evaluation = evaluateSongCandidate(song);
      const releaseGate = evaluateSongReleaseGate(song, evaluation);
      const dimensionScores = { ...(evaluation.subscores ?? {}) };
      const groupScores = groupScoresFor(dimensionScores);
      const weakestDimension = weakestEntry(dimensionScores);
      const weakestGroup = weakestEntry(groupScores);
      const technical = technicalHealth(song, evaluation, releaseGate);
      const musicalScore = finite(evaluation.score, 0);
      const technicalScore = technical.score;
      const overallScore = round(musicalScore * 0.82 + technicalScore * 0.18);
      const effectiveBars = Math.max(1, finite(song.meta?.bars, song.bars ?? bars));
      const pitchedNoteCount = (song.tracks ?? []).filter((track) => track.id !== "drums").reduce((sum, track) => sum + (track.notes ?? []).length, 0);
      const notesPerBar = pitchedNoteCount / effectiveBars;
      const densityTarget = finite(evaluation?.diagnostics?.densityTarget, notesPerBar);
      const densityDelta = notesPerBar - densityTarget;
      const chords = song.tracks.find((t) => t.id === "chords")?.notes ?? [];
      let totalStepDistance = 0;
      let transitionCount = 0;
      for (let i = 1; i < chords.length; i += 1) {
        if (chords[i].start !== chords[i - 1].start) {
          totalStepDistance += Math.abs(chords[i].pitch - chords[i - 1].pitch);
          transitionCount += 1;
        }
      }
      const voiceLeadingStep = transitionCount > 0 ? round(totalStepDistance / transitionCount, 2) : 0;
      results.push({
        genre,
        seed,
        score: musicalScore,
        musicalScore,
        technicalScore,
        overallScore,
        creativeFloor: Math.min(...Object.values(dimensionScores)),
        scaleFit: technical.scaleFit,
        finalChecks: technical.masterChecks === 1,
        finalAssemblyChecks: technical.assemblyChecks === 1,
        exportChecks: technical.exportChecks === 1,
        releasePassed: technical.releasePass === 1,
        releaseScore: releaseGate.totalScore,
        fingerprint: JSON.stringify(song.meta?.ideaFingerprint ?? {}),
        varietySignatures: varietySignaturesFor(song),
        vocalSpace: song.vocalSpace,
        voiceLeadingStep,
        maskingPairs: song.perceptualMix?.maskingPairs ?? 0,
        notesPerBar: round(notesPerBar, 2),
        densityTarget: round(densityTarget, 2),
        densityDelta: round(densityDelta, 2),
        outputQualitySignature: generationConfig.outputQuality?.seedSignature ?? null,
        arrangementAttempted: Boolean(arrangementDiagnostics?.attempted),
        arrangementAccepted: Boolean(arrangementDiagnostics?.accepted),
        arrangementFamily: arrangementDiagnostics?.family ?? null,
        arrangementScoreDelta: finite(arrangementDiagnostics?.scoreDelta, 0),
        arrangementSubsystemDelta: finite(arrangementDiagnostics?.arrangementDelta, 0),
        returnDevelopmentAttempted: Boolean(returnDiagnostics?.attempted),
        returnDevelopmentAccepted: Boolean(returnDiagnostics?.accepted),
        returnDevelopmentId: returnDiagnostics?.id ?? null,
        returnDevelopmentScoreDelta: finite(returnDiagnostics?.scoreDelta, 0),
        returnDevelopmentTargetDelta: finite(returnDiagnostics?.targetDelta, 0),
        densityRefinementAttempted: Boolean(densityDiagnostics?.attempted),
        densityRefinementAccepted: Boolean(densityDiagnostics?.accepted),
        densityRefinementId: densityDiagnostics?.id ?? null,
        densityRefinementDelta: finite(densityDiagnostics?.densityDelta, 0),
        densityRefinementErrorDelta: finite(densityDiagnostics?.densityErrorDelta, 0),
        phraseResolutionRefinementAttempted: Boolean(phraseResolutionDiagnostics?.attempted),
        phraseResolutionRefinementAccepted: Boolean(phraseResolutionDiagnostics?.accepted),
        phraseResolutionRefinementId: phraseResolutionDiagnostics?.id ?? null,
        phraseResolutionRefinementDelta: finite(phraseResolutionDiagnostics?.phraseResolutionDelta, 0),
        registerHealthRefinementAttempted: Boolean(registerHealthDiagnostics?.attempted),
        registerHealthRefinementAccepted: Boolean(registerHealthDiagnostics?.accepted),
        registerHealthRefinementId: registerHealthDiagnostics?.id ?? null,
        registerHealthRefinementDelta: finite(registerHealthDiagnostics?.registerHealthDelta, 0),
        groovePocketAttempted: Boolean(grooveDiagnostics?.attempted),
        groovePocketAccepted: Boolean(grooveDiagnostics?.accepted),
        groovePocketId: grooveDiagnostics?.id ?? null,
        groovePocketDelta: finite(grooveDiagnostics?.grooveDelta, 0),
        groovePocketLockDelta: finite(grooveDiagnostics?.lockDelta, 0),
        weakestDimension,
        weakestGroup,
        dimensionScores,
        groupScores,
      });
    }
  }

  const fingerprints = new Set(results.map(({ fingerprint }) => fingerprint));
  const failures = results.flatMap((result) => [
    ...(result.scaleFit < 1 ? [`${result.genre}/${result.seed}: scale fit ${result.scaleFit}`] : []),
    ...(!result.finalChecks ? [`${result.genre}/${result.seed}: final master check failed`] : []),
    ...(!result.finalAssemblyChecks ? [`${result.genre}/${result.seed}: final assembly check failed`] : []),
    ...(!result.exportChecks ? [`${result.genre}/${result.seed}: MIDI export preflight failed`] : []),
    ...(result.score < 58 ? [`${result.genre}/${result.seed}: critic score ${result.score}`] : []),
  ]);
  const perGenre = genres.map((genre) => summarizeGenre(genre, results))
    .sort((a, b) => a.averageOverallScore - b.averageOverallScore || a.genre.localeCompare(b.genre));
  const dimensionAverages = dimensionAveragesFor(results);
  const groupAverages = groupAveragesFor(results);
  const weakestDimension = weakestEntry(dimensionAverages);
  const weakestGroup = weakestEntry(groupAverages);
  const averageTechnicalScore = averageOf(results, ({ technicalScore }) => technicalScore);
  const releasePassRate = averageOf(results, ({ releasePassed }) => releasePassed ? 1 : 0, 3);
  const failureMap = perGenre
    .filter((entry) => entry.floorBreachCount > 0 || entry.releasePassRate < 1)
    .map((entry) => ({
      genre: entry.genre,
      releasePassRate: entry.releasePassRate,
      weakestGroup: entry.weakestGroup,
      weakestDimension: entry.weakestDimension,
      floorBreaches: entry.floorBreaches,
      weakestVarietyAxis: entry.variety.weakestAxis,
      weakestVarietyRatio: entry.variety.weakestRatio,
    }))
    .sort((left, right) => (
      right.floorBreaches.length - left.floorBreaches.length
      || left.releasePassRate - right.releasePassRate
      || left.weakestDimension.score - right.weakestDimension.score
      || left.genre.localeCompare(right.genre)
    ));

  const report = {
    phase: 50,
    version: 2,
    labVersion: 3,
    qualityEvolution,
    genres: genres.length,
    generations: results.length,
    averageScore: averageOf(results, ({ score }) => score),
    minimumScore: Math.min(...results.map(({ score }) => score)),
    averageMusicalScore: averageOf(results, ({ musicalScore }) => musicalScore),
    averageTechnicalScore,
    averageOverallScore: averageOf(results, ({ overallScore }) => overallScore),
    minimumOverallScore: Math.min(...results.map(({ overallScore }) => overallScore)),
    averageCreativeFloor: averageOf(results, ({ creativeFloor }) => creativeFloor),
    averageVoiceLeadingStep: averageOf(results, ({ voiceLeadingStep }) => voiceLeadingStep, 2),
    averageMaskingPairs: averageOf(results, ({ maskingPairs }) => maskingPairs),
    averageNotesPerBar: averageOf(results, ({ notesPerBar }) => notesPerBar, 1),
    averageDensityTarget: averageOf(results, ({ densityTarget }) => densityTarget, 1),
    averageDensityDelta: averageOf(results, ({ densityDelta }) => densityDelta, 1),
    releasePassRate,
    uniqueFingerprintRatio: round(fingerprints.size / Math.max(1, results.length), 3),
    arrangementAttemptRate: averageOf(results, ({ arrangementAttempted }) => arrangementAttempted ? 1 : 0, 3),
    arrangementAcceptanceRate: averageOf(results, ({ arrangementAccepted }) => arrangementAccepted ? 1 : 0, 3),
    returnDevelopmentAttemptRate: averageOf(results, ({ returnDevelopmentAttempted }) => returnDevelopmentAttempted ? 1 : 0, 3),
    returnDevelopmentAcceptanceRate: averageOf(results, ({ returnDevelopmentAccepted }) => returnDevelopmentAccepted ? 1 : 0, 3),
    densityRefinementAttemptRate: averageOf(results, ({ densityRefinementAttempted }) => densityRefinementAttempted ? 1 : 0, 3),
    densityRefinementAcceptanceRate: averageOf(results, ({ densityRefinementAccepted }) => densityRefinementAccepted ? 1 : 0, 3),
    averageDensityRefinementDelta: averageOf(results, ({ densityRefinementDelta }) => densityRefinementDelta, 2),
    phraseResolutionRefinementAttemptRate: averageOf(results, ({ phraseResolutionRefinementAttempted }) => phraseResolutionRefinementAttempted ? 1 : 0, 3),
    phraseResolutionRefinementAcceptanceRate: averageOf(results, ({ phraseResolutionRefinementAccepted }) => phraseResolutionRefinementAccepted ? 1 : 0, 3),
    averagePhraseResolutionRefinementDelta: averageOf(results, ({ phraseResolutionRefinementDelta }) => phraseResolutionRefinementDelta, 2),
    registerHealthRefinementAttemptRate: averageOf(results, ({ registerHealthRefinementAttempted }) => registerHealthRefinementAttempted ? 1 : 0, 3),
    registerHealthRefinementAcceptanceRate: averageOf(results, ({ registerHealthRefinementAccepted }) => registerHealthRefinementAccepted ? 1 : 0, 3),
    averageRegisterHealthRefinementDelta: averageOf(results, ({ registerHealthRefinementDelta }) => registerHealthRefinementDelta, 2),
    groovePocketAttemptRate: averageOf(results, ({ groovePocketAttempted }) => groovePocketAttempted ? 1 : 0, 3),
    groovePocketAcceptanceRate: averageOf(results, ({ groovePocketAccepted }) => groovePocketAccepted ? 1 : 0, 3),
    averageGroovePocketDelta: averageOf(results, ({ groovePocketDelta }) => groovePocketDelta, 2),
    weakestGenre: perGenre[0] ?? null,
    weakestGroup,
    weakestDimension,
    groupAverages,
    dimensionAverages,
    perGenre,
    failureMap,
    phase5Floors: PHASE5_DIMENSION_FLOORS,
    failures,
    results,
  };
  report.recommendations = recommendationsFor(report);
  return report;
}
