import { evaluateSongCandidate, generateNew } from "../src/music-engine.js";

const genres = ["techno", "drumBass", "jazz", "hipHop", "house", "trap"];
const seeds = ["global-search-01", "global-search-02", "global-search-03"];
const dimensions = [
  "repetition",
  "memory",
  "drumVariety",
  "stageInterlock",
  "groove",
  "density",
  "phraseResolution",
  "genreAuthenticity",
];
const profiles = [
  { id: "balanced", energy: 0.55, complexity: 0.55 },
  { id: "dense", energy: 0.86, complexity: 0.82 },
];
const finite = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const round = (value, places = 1) => Number(value.toFixed(places));

const rows = [];
for (const genre of genres) {
  for (const profile of profiles) {
    for (const seed of seeds) {
      const input = {
        genre,
        seed: `${seed}:${genre}:${profile.id}`,
        bars: 8,
        energy: profile.energy,
        complexity: profile.complexity,
        targetedRepair: false,
      };
      const raw = generateNew({ ...input, candidateCount: 1 });
      const adaptive = generateNew(input);
      const rawEval = evaluateSongCandidate(raw);
      const adaptiveEval = evaluateSongCandidate(adaptive);
      const search = adaptive.meta?.scoreDetails?.candidateSearch ?? {};
      rows.push({
        genre,
        profile: profile.id,
        seed,
        rawScore: finite(rawEval.score),
        adaptiveScore: finite(adaptiveEval.score),
        scoreDelta: finite(adaptiveEval.score) - finite(rawEval.score),
        candidates: finite(adaptive.meta?.scoreDetails?.candidatesEvaluated),
        expandedBy: finite(search.expandedBy),
        focusDimension: search.focusDimension ?? null,
        focusRoute: search.focusRoute ?? null,
        raw: Object.fromEntries(dimensions.map((id) => [id, finite(rawEval.subscores?.[id])])),
        adaptive: Object.fromEntries(dimensions.map((id) => [id, finite(adaptiveEval.subscores?.[id])])),
      });
    }
  }
}

const summary = [];
for (const genre of genres) {
  const group = rows.filter((row) => row.genre === genre);
  const dimensionDeltas = Object.fromEntries(dimensions.map((id) => [
    id,
    round(mean(group.map((row) => row.adaptive[id] - row.raw[id])), 2),
  ]));
  const adaptiveAverages = Object.fromEntries(dimensions.map((id) => [
    id,
    round(mean(group.map((row) => row.adaptive[id])), 1),
  ]));
  summary.push({
    genre,
    rawScore: round(mean(group.map((row) => row.rawScore)), 1),
    adaptiveScore: round(mean(group.map((row) => row.adaptiveScore)), 1),
    scoreDelta: round(mean(group.map((row) => row.scoreDelta)), 2),
    candidates: round(mean(group.map((row) => row.candidates)), 2),
    expansionRate: round(group.filter((row) => row.expandedBy > 0).length / group.length, 2),
    repetition: adaptiveAverages.repetition,
    repetitionDelta: dimensionDeltas.repetition,
    groove: adaptiveAverages.groove,
    grooveDelta: dimensionDeltas.groove,
    density: adaptiveAverages.density,
    densityDelta: dimensionDeltas.density,
    stageInterlock: adaptiveAverages.stageInterlock,
    stageInterlockDelta: dimensionDeltas.stageInterlock,
    phraseResolution: adaptiveAverages.phraseResolution,
    phraseResolutionDelta: dimensionDeltas.phraseResolution,
    genreAuthenticity: adaptiveAverages.genreAuthenticity,
    genreAuthenticityDelta: dimensionDeltas.genreAuthenticity,
  });
}

console.log("\nAdaptive global-search diagnostic");
console.log(`${rows.length} deterministic comparisons · targeted repair disabled`);
console.table(summary);

const focusCounts = new Map();
for (const row of rows) {
  const key = `${row.focusDimension ?? "none"} → ${row.focusRoute ?? "none"}`;
  focusCounts.set(key, (focusCounts.get(key) ?? 0) + 1);
}
console.log("\nFinal focus distribution");
console.table([...focusCounts.entries()].sort((a, b) => b[1] - a[1]).map(([focus, count]) => ({ focus, count })));

const worst = [...rows]
  .sort((a, b) => (
    a.adaptive.repetition - b.adaptive.repetition
    || a.adaptive.groove - b.adaptive.groove
    || a.adaptive.density - b.adaptive.density
  ))
  .slice(0, 14)
  .map((row) => ({
    genre: row.genre,
    profile: row.profile,
    seed: row.seed,
    scoreDelta: round(row.scoreDelta, 1),
    repetition: round(row.adaptive.repetition, 1),
    groove: round(row.adaptive.groove, 1),
    density: round(row.adaptive.density, 1),
    focus: `${row.focusDimension ?? "none"}→${row.focusRoute ?? "none"}`,
    candidates: row.candidates,
  }));
console.log("\nLowest adaptive global dimensions");
console.table(worst);
