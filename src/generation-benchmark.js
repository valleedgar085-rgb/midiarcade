import {
  evaluateSongCandidate,
  evaluateSongReleaseGate,
  generateNew,
  GENRE_PROFILES,
} from "./music-engine.js";

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value, places = 0) => Number(finite(value).toFixed(places));

/**
 * Human-readable quality families used by the Music Quality Lab.
 * The engine remains the source of truth for individual critic dimensions;
 * this layer only groups them so regressions point to an actionable subsystem.
 */
export const QUALITY_DIMENSION_GROUPS = Object.freeze({
  harmony: Object.freeze(["harmonic", "voiceLeading", "separation", "cadence", "harmonicJourney"]),
  groove: Object.freeze(["groove", "density", "performance", "drumVariety"]),
  phrasing: Object.freeze(["motif", "repetition", "memory", "phraseResolution", "registerHealth"]),
  arrangement: Object.freeze(["storyArc", "transitions", "orchestration", "tensionFollow", "stageInterlock"]),
  production: Object.freeze(["production", "genreAuthenticity"]),
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
  const entries = Object.entries(scores)
    .filter(([, score]) => Number.isFinite(Number(score)));
  if (!entries.length) return { id: "unknown", score: 0 };
  const [id, score] = entries.reduce((lowest, entry) => entry[1] < lowest[1] ? entry : lowest);
  return { id, score: round(score, 1) };
}

function dimensionAveragesFor(results) {
  const dimensions = new Set(results.flatMap(({ dimensionScores }) => Object.keys(dimensionScores ?? {})));
  return Object.fromEntries([...dimensions].sort().map((dimension) => [
    dimension,
    round(mean(results.map(({ dimensionScores }) => finite(dimensionScores?.[dimension], 0))), 1),
  ]));
}

function groupAveragesFor(results) {
  return Object.fromEntries(Object.keys(QUALITY_DIMENSION_GROUPS).map((group) => [
    group,
    round(mean(results.map(({ groupScores }) => finite(groupScores?.[group], 0))), 1),
  ]));
}

function healthBand(score) {
  if (score >= 94) return "excellent";
  if (score >= 90) return "strong";
  if (score >= 84) return "watch";
  return "priority";
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
  return {
    score,
    scaleFit,
    masterChecks,
    assemblyChecks,
    exportChecks,
    releasePass,
  };
}

function summarizeGenre(genre, results) {
  const genreResults = results.filter((result) => result.genre === genre);
  const fingerprints = new Set(genreResults.map(({ fingerprint }) => fingerprint));
  const dimensionAverages = dimensionAveragesFor(genreResults);
  const groupAverages = groupAveragesFor(genreResults);
  const weakestDimension = weakestEntry(dimensionAverages);
  const weakestGroup = weakestEntry(groupAverages);
  const averageOverallScore = round(mean(genreResults.map(({ overallScore }) => overallScore)), 1);
  return {
    genre,
    samples: genreResults.length,
    averageMusicalScore: round(mean(genreResults.map(({ musicalScore }) => musicalScore)), 1),
    minimumMusicalScore: Math.min(...genreResults.map(({ musicalScore }) => musicalScore)),
    averageTechnicalScore: round(mean(genreResults.map(({ technicalScore }) => technicalScore)),
    averageOverallScore,
    averageCreativeFloor: round(mean(genreResults.map(({ creativeFloor }) => creativeFloor))),
    releasePassRate: round(mean(genreResults.map(({ releasePassed }) => releasePassed ? 1 : 0)), 3),
    uniqueFingerprintRatio: round(fingerprints.size / Math.max(1, genreResults.length), 3),
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
    recommendations.push(
      `Prioritize ${priorityGenre.genre}: ${priorityGenre.weakestGroup.id} is its weakest subsystem at ${priorityGenre.weakestGroup.score}.`,
    );
  }
  if (weakestGroup.id !== "unknown") {
    recommendations.push(`Global producer-brain focus: ${weakestGroup.id} averages ${weakestGroup.score}.`);
  }
  if (weakestDimension.id !== "unknown") {
    recommendations.push(`Lowest individual critic dimension: ${weakestDimension.id} at ${weakestDimension.score}.`);
  }
  if (averageTechnicalScore < 100) {
    recommendations.push(`Technical readiness averages ${averageTechnicalScore}; fix safety/export/master failures before creative tuning.`);
  }
  if (releasePassRate < 1) {
    recommendations.push(`Raw candidate release-pass rate is ${Math.round(releasePassRate * 100)}%; target the lowest creative dimensions before increasing search cost.`);
  }
  return recommendations;
}

export function runGenerationBenchmark({
  genres = Object.keys(GENRE_PROFILES),
  seeds = ["calibration-a", "calibration-b"],
  bars = 8,
} = {}) {
  const results = [];
  for (const genre of genres) {
    for (const seed of seeds) {
      const song = generateNew({ genre, seed: `${seed}:${genre}`, bars, candidateCount: 1 });
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
        vocalSpace: song.vocalSpace,
        voiceLeadingStep,
        maskingPairs: song.perceptualMix?.maskingPairs ?? 0,
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
  const averageTechnicalScore = round(mean(results.map(({ technicalScore }) => technicalScore));
  const releasePassRate = round(mean(results.map(({ releasePassed }) => releasePassed ? 1 : 0)), 3);

  const report = {
    phase: 50,
    version: 2,
    labVersion: 1,
    genres: genres.length,
    generations: results.length,
    averageScore: Math.round(mean(results.map(({ score }) => score))),
    minimumScore: Math.min(...results.map(({ score }) => score)),
    averageMusicalScore: round(mean(results.map(({ musicalScore }) => musicalScore)),
    averageTechnicalScore,
    averageOverallScore: round(mean(results.map(({ overallScore }) => overallScore)),
    minimumOverallScore: Math.min(...results.map(({ overallScore }) => overallScore)),
    averageCreativeFloor: Math.round(mean(results.map(({ creativeFloor }) => creativeFloor)),
    averageVoiceLeadingStep: round(mean(results.map(({ voiceLeadingStep }) => voiceLeadingStep)), 2),
    averageMaskingPairs: Math.round(mean(results.map(({ maskingPairs }) => maskingPairs))),
    releasePassRate,
    uniqueFingerprintRatio: round(fingerprints.size / Math.max(1, results.length), 3),
    weakestGenre: perGenre[0] ?? null,
    weakestGroup,
    weakestDimension,
    groupAverages,
    dimensionAverages,
    perGenre,
    failures,
    results,
  };
  report.recommendations = recommendationsFor(report);
  return report;
}
