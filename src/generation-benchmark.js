import { evaluateSongCandidate, generateNew, GENRE_PROFILES } from "./music-engine.js";

const mean = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);

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
      const chords = song.tracks.find((t) => t.id === "chords")?.notes ?? [];
      let totalStepDistance = 0;
      let transitionCount = 0;
      for (let i = 1; i < chords.length; i += 1) {
        if (chords[i].start !== chords[i - 1].start) {
          totalStepDistance += Math.abs(chords[i].pitch - chords[i - 1].pitch);
          transitionCount += 1;
        }
      }
      const voiceLeadingStep = transitionCount > 0 ? Number((totalStepDistance / transitionCount).toFixed(2)) : 0;
      results.push({
        genre,
        seed,
        score: evaluation.score,
        creativeFloor: Math.min(...Object.values(evaluation.subscores)),
        scaleFit: evaluation.diagnostics.scaleFit,
        finalChecks: Object.values(song.finalMaster?.checks ?? {}).every(Boolean),
        fingerprint: JSON.stringify(song.meta?.ideaFingerprint ?? {}),
        vocalSpace: song.vocalSpace,
        voiceLeadingStep,
        maskingPairs: song.perceptualMix?.maskingPairs ?? 0,
      });
    }
  }
  const fingerprints = new Set(results.map(({ fingerprint }) => fingerprint));
  const failures = results.flatMap((result) => [
    ...(result.scaleFit < 1 ? [`${result.genre}/${result.seed}: scale fit ${result.scaleFit}`] : []),
    ...(!result.finalChecks ? [`${result.genre}/${result.seed}: final master check failed`] : []),
    ...(result.score < 58 ? [`${result.genre}/${result.seed}: critic score ${result.score}`] : []),
  ]);
  return {
    phase: 50,
    version: 1,
    genres: genres.length,
    generations: results.length,
    averageScore: Math.round(mean(results.map(({ score }) => score))),
    minimumScore: Math.min(...results.map(({ score }) => score)),
    averageCreativeFloor: Math.round(mean(results.map(({ creativeFloor }) => creativeFloor))),
    averageVoiceLeadingStep: Number(mean(results.map(({ voiceLeadingStep }) => voiceLeadingStep)).toFixed(2)),
    averageMaskingPairs: Math.round(mean(results.map(({ maskingPairs }) => maskingPairs))),
    uniqueFingerprintRatio: Number((fingerprints.size / Math.max(1, results.length)).toFixed(3)),
    failures,
    results,
  };
}
