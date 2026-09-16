import {
  evaluateSongCandidate,
  evaluateSongReleaseGate,
  generateNew,
  GENRE_PROFILES,
} from "../src/music-engine.js";
import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import { applySongOutputQualityPostprocess } from "../src/core/output-quality-postprocess.js";
import { createReturnDevelopmentCandidates } from "../src/core/return-development.js";

const RETURN_DIMENSIONS = Object.freeze({
  "return-payoff": ["phraseResolution", "repetition", "motif"],
  "rhythmic-recall": ["repetition", "motif"],
  "groove-lock": ["groove"],
});
const seeds = ["quality-lab-01", "quality-lab-02", "quality-lab-03"];
const bars = 16;
const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const mean = (values) => values.reduce((sum, value) => sum + finite(value), 0) / Math.max(1, values.length);
const round = (value, digits = 2) => Number(finite(value).toFixed(digits));
const creativeFloor = (evaluation) => {
  const values = Object.values(evaluation?.subscores ?? {}).filter((value) => Number.isFinite(Number(value)));
  return values.length ? Math.min(...values.map(Number)) : 0;
};
const targetScore = (evaluation, id) => mean((RETURN_DIMENSIONS[id] ?? []).map((key) => evaluation?.subscores?.[key]));

const rows = [];
for (const genre of Object.keys(GENRE_PROFILES)) {
  for (const seed of seeds) {
    const rawConfig = { genre, seed: `${seed}:${genre}`, bars, candidateCount: 1 };
    const config = {
      ...applyOutputQualityEvolution(rawConfig, { kind: "new" }),
      phraseResolutionRefinement: true,
      registerHealthRefinement: true,
    };
    const generated = generateNew(config);
    const arrangementOnly = applySongOutputQualityPostprocess(generated, {
      ...config,
      returnDevelopment: false,
      groovePocketRefinement: false,
    });
    const source = arrangementOnly.song;
    const before = evaluateSongCandidate(source);
    const beforeFloor = creativeFloor(before);
    const candidates = createReturnDevelopmentCandidates(source, config);

    for (const candidate of candidates) {
      const after = evaluateSongCandidate(candidate.song);
      const release = evaluateSongReleaseGate(candidate.song, after);
      const beforeTarget = targetScore(before, candidate.id);
      const afterTarget = targetScore(after, candidate.id);
      const scoreDelta = finite(after.score) - finite(before.score);
      const targetDelta = afterTarget - beforeTarget;
      const floorDelta = creativeFloor(after) - beforeFloor;
      const scaleSafe = finite(after?.diagnostics?.scaleFit, 0) >= 0.999999;
      const qualityImproved = scoreDelta >= 0.05 && targetDelta >= -0.1 && floorDelta >= -0.5;
      const targetImproved = targetDelta >= 0.75 && scoreDelta >= -0.25 && floorDelta >= -0.75;
      const accepted = Boolean(release?.passed && scaleSafe && (qualityImproved || targetImproved));
      const dimensionDeltas = Object.fromEntries((RETURN_DIMENSIONS[candidate.id] ?? []).map((key) => [
        key,
        round(finite(after?.subscores?.[key]) - finite(before?.subscores?.[key])),
      ]));
      const spotlightEdits = candidate.song.tracks.flatMap((track) => track.notes ?? [])
        .filter((note) => note.returnDevelopmentSpotlightRole).length;
      const cadenceEdits = candidate.song.tracks.flatMap((track) => track.notes ?? [])
        .filter((note) => note.returnDevelopmentRole === "cadence-payoff").length;
      const recallEdits = candidate.song.tracks.flatMap((track) => track.notes ?? [])
        .filter((note) => ["return-payoff-recall", "rhythmic-recall", "techno-grid-recall"].includes(note.returnDevelopmentRole)).length;
      rows.push({
        genre,
        seed,
        id: candidate.id,
        accepted,
        release: Boolean(release?.passed),
        scaleSafe,
        qualityImproved,
        targetImproved,
        scoreDelta: round(scoreDelta),
        targetDelta: round(targetDelta),
        floorDelta: round(floorDelta),
        changedNotes: candidate.changedNotes,
        spotlightEdits,
        cadenceEdits,
        recallEdits,
        ...dimensionDeltas,
      });
    }
  }
}

console.log("\n=== PHASE 9D RETURN CANDIDATE DIAGNOSTICS ===");
for (const id of Object.keys(RETURN_DIMENSIONS)) {
  const subset = rows.filter((row) => row.id === id);
  const accepted = subset.filter((row) => row.accepted);
  const releaseFailures = subset.filter((row) => !row.release);
  const scaleFailures = subset.filter((row) => !row.scaleSafe);
  const qWins = subset.filter((row) => row.qualityImproved);
  const tWins = subset.filter((row) => row.targetImproved);
  const dimensions = RETURN_DIMENSIONS[id];
  console.log(`\n${id}`);
  console.log(JSON.stringify({
    available: subset.length,
    accepted: accepted.length,
    acceptanceRate: round(accepted.length / Math.max(1, subset.length) * 100, 1),
    qualityWinCount: qWins.length,
    targetWinCount: tWins.length,
    releaseFailures: releaseFailures.length,
    scaleFailures: scaleFailures.length,
    averageScoreDelta: round(mean(subset.map((row) => row.scoreDelta)), 3),
    averageTargetDelta: round(mean(subset.map((row) => row.targetDelta)), 3),
    averageFloorDelta: round(mean(subset.map((row) => row.floorDelta)), 3),
    averageChangedNotes: round(mean(subset.map((row) => row.changedNotes)), 2),
    averageSpotlightEdits: round(mean(subset.map((row) => row.spotlightEdits)), 2),
    averageCadenceEdits: round(mean(subset.map((row) => row.cadenceEdits)), 2),
    averageRecallEdits: round(mean(subset.map((row) => row.recallEdits)), 2),
    averageDimensionDeltas: Object.fromEntries(dimensions.map((dimension) => [
      dimension,
      round(mean(subset.map((row) => finite(row[dimension]))), 3),
    ])),
  }, null, 2));
}

console.log("\n=== RETURN-PAYOFF PER-GENRE ===");
console.table(Object.keys(GENRE_PROFILES).map((genre) => {
  const subset = rows.filter((row) => row.id === "return-payoff" && row.genre === genre);
  return {
    genre,
    available: subset.length,
    accepted: subset.filter((row) => row.accepted).length,
    scoreDelta: round(mean(subset.map((row) => row.scoreDelta)), 2),
    targetDelta: round(mean(subset.map((row) => row.targetDelta)), 2),
    phrase: round(mean(subset.map((row) => row.phraseResolution)), 2),
    repetition: round(mean(subset.map((row) => row.repetition)), 2),
    motif: round(mean(subset.map((row) => row.motif)), 2),
    spotlight: round(mean(subset.map((row) => row.spotlightEdits)), 1),
    cadence: round(mean(subset.map((row) => row.cadenceEdits)), 1),
    recall: round(mean(subset.map((row) => row.recallEdits)), 1),
  };
}));

console.log("\n=== ACCEPTED CANDIDATES ===");
console.table(rows.filter((row) => row.accepted).map((row) => ({
  genre: row.genre,
  seed: row.seed,
  id: row.id,
  scoreDelta: row.scoreDelta,
  targetDelta: row.targetDelta,
  floorDelta: row.floorDelta,
  changedNotes: row.changedNotes,
})));

console.log("\n=== NEAR-MISS RETURN-PAYOFFS (best target delta first) ===");
console.table(rows.filter((row) => row.id === "return-payoff" && !row.accepted)
  .sort((left, right) => right.targetDelta - left.targetDelta || right.scoreDelta - left.scoreDelta)
  .slice(0, 20)
  .map((row) => ({
    genre: row.genre,
    seed: row.seed,
    scoreDelta: row.scoreDelta,
    targetDelta: row.targetDelta,
    floorDelta: row.floorDelta,
    phrase: row.phraseResolution,
    repetition: row.repetition,
    motif: row.motif,
    spotlight: row.spotlightEdits,
    cadence: row.cadenceEdits,
    recall: row.recallEdits,
  })));
