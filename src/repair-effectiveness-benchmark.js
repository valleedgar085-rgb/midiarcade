import { generateNew, GENRE_PROFILES } from "./music-engine.js";

const finite = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const round = (value, places = 1) => Number(finite(value).toFixed(places));
const mean = (values = []) => values.length
  ? values.reduce((sum, value) => sum + finite(value), 0) / values.length
  : 0;

export const DEFAULT_REPAIR_BENCHMARK_GENRES = Object.freeze([
  "techno",
  "drumBass",
  "jazz",
  "hipHop",
  "trap",
  "popRadio",
  "house",
  "afrobeats",
]);

export const DEFAULT_REPAIR_BENCHMARK_PROFILES = Object.freeze([
  Object.freeze({ id: "sparse", energy: 0.12, complexity: 0.18 }),
  Object.freeze({ id: "balanced", energy: 0.55, complexity: 0.55 }),
  Object.freeze({ id: "dense", energy: 0.88, complexity: 0.82 }),
]);

function normalizedGenres(genres = DEFAULT_REPAIR_BENCHMARK_GENRES) {
  const supported = new Set(Object.keys(GENRE_PROFILES));
  const normalized = [...new Set((genres ?? []).map((genre) => String(genre)).filter((genre) => supported.has(genre)))];
  return normalized.length ? normalized : [...DEFAULT_REPAIR_BENCHMARK_GENRES];
}

function normalizedProfiles(profiles = DEFAULT_REPAIR_BENCHMARK_PROFILES) {
  const normalized = (profiles ?? []).map((profile, index) => ({
    id: String(profile?.id ?? `profile-${index + 1}`),
    energy: Math.max(0, Math.min(1, finite(profile?.energy, 0.5))),
    complexity: Math.max(0, Math.min(1, finite(profile?.complexity, 0.5))),
  }));
  return normalized.length ? normalized : DEFAULT_REPAIR_BENCHMARK_PROFILES.map((profile) => ({ ...profile }));
}

function countReasons(attempts = []) {
  const counts = {};
  for (const attempt of attempts) {
    for (const reason of attempt.reasons ?? []) counts[reason] = (counts[reason] ?? 0) + 1;
  }
  return Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}

function aggregateAttempts(attempts, key) {
  const groups = new Map();
  for (const attempt of attempts) {
    const id = String(attempt?.[key] ?? "unknown");
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(attempt);
  }
  return [...groups.entries()].map(([id, rows]) => {
    const accepted = rows.filter((row) => row.accepted);
    const surgical = rows.filter((row) => row.surgicalAttempted);
    const selectedWins = rows.filter((row) => row.selected).length;
    return {
      id,
      attempts: rows.length,
      accepted: accepted.length,
      rejected: rows.length - accepted.length,
      acceptanceRate: round(accepted.length / Math.max(1, rows.length), 3),
      averageWeaknessGain: round(mean(rows.map((row) => row.weaknessGain)), 2),
      acceptedWeaknessGain: round(mean(accepted.map((row) => row.weaknessGain)), 2),
      averageTotalDelta: round(mean(rows.map((row) => row.totalDelta)), 2),
      averageCriticalRegression: round(mean(rows.map((row) => row.maxCriticalRegression)), 2),
      surgicalAttempts: surgical.length,
      surgicalAcceptanceRate: round(
        surgical.filter((row) => row.surgicalAccepted === true).length / Math.max(1, surgical.length),
        3,
      ),
      wholeFallbacks: rows.filter((row) => row.wholeFallbackUsed).length,
      fallbackRate: round(rows.filter((row) => row.wholeFallbackUsed).length / Math.max(1, rows.length), 3),
      selectedWins,
      selectionRate: round(selectedWins / Math.max(1, rows.length), 3),
      rejectionReasons: countReasons(rows.filter((row) => !row.accepted)),
    };
  }).sort((a, b) => (
    b.attempts - a.attempts
    || a.acceptanceRate - b.acceptanceRate
    || a.id.localeCompare(b.id)
  ));
}

function summarizeSkips(songs = []) {
  const skips = songs.flatMap((song) => (song.skippedGlobalDimensions ?? []).map((skip) => ({
    genre: song.genre,
    profile: song.profile,
    dimension: String(skip?.dimension ?? "unknown"),
    group: String(skip?.group ?? "unknown"),
    score: round(skip?.score, 1),
    reason: String(skip?.reason ?? "song-level-search-owned"),
  })));
  const counts = new Map();
  for (const skip of skips) counts.set(skip.dimension, (counts.get(skip.dimension) ?? 0) + 1);
  return {
    globalRepairSkips: skips.length,
    songsWithGlobalRepairSkips: songs.filter((song) => (song.skippedGlobalDimensions ?? []).length > 0).length,
    skippedByDimension: [...counts.entries()]
      .map(([dimension, count]) => ({ dimension, count }))
      .sort((left, right) => right.count - left.count || left.dimension.localeCompare(right.dimension)),
    skippedGlobalDimensions: skips,
  };
}

function summarizeSongs(songs = []) {
  const candidates = songs.map((song) => finite(song.candidatesEvaluated, 0));
  return {
    totalSongs: songs.length,
    songsWithRepair: songs.filter((song) => song.repairAttempts > 0).length,
    songsWithAcceptedRepair: songs.filter((song) => song.acceptedRepairs > 0).length,
    songsSelectedFromRepair: songs.filter((song) => song.selectedFromRepair).length,
    averageCandidatesEvaluated: round(mean(candidates), 2),
    maxCandidatesEvaluated: candidates.length ? Math.max(...candidates) : 0,
  };
}

function recommendationsFor({ byStrategy, byDimension, attempts }) {
  const recommendations = [];
  for (const strategy of byStrategy) {
    if (strategy.attempts < 3) continue;
    if (strategy.acceptanceRate < 0.34) {
      const topReason = Object.keys(strategy.rejectionReasons)[0] ?? "low acceptance";
      recommendations.push(
        `Recalibrate ${strategy.id}: ${Math.round(strategy.acceptanceRate * 100)}% acceptance across ${strategy.attempts} attempts; leading rejection is ${topReason}.`,
      );
    } else if (strategy.fallbackRate >= 0.35) {
      recommendations.push(
        `Inspect ${strategy.id} localization: whole-song fallback was needed in ${Math.round(strategy.fallbackRate * 100)}% of attempts.`,
      );
    }
  }
  for (const dimension of byDimension) {
    if (dimension.attempts < 3 || dimension.acceptanceRate >= 0.4) continue;
    recommendations.push(
      `Prioritize ${dimension.id}: repair acceptance is ${Math.round(dimension.acceptanceRate * 100)}% with ${dimension.acceptedWeaknessGain} average accepted gain.`,
    );
  }
  if (!attempts.length) recommendations.push("No repair attempts were observed; expand the calibration seed/profile matrix before tuning strategies.");
  return recommendations.slice(0, 8);
}

export function summarizeRepairEffectiveness({ attempts = [], songs = [] } = {}) {
  const normalizedAttempts = attempts.map((attempt) => ({
    ...attempt,
    strategyId: String(attempt.strategyId ?? "unknown"),
    dimension: String(attempt.dimension ?? "unknown"),
    genre: String(attempt.genre ?? "unknown"),
    accepted: Boolean(attempt.accepted),
    selected: Boolean(attempt.selected),
    weaknessGain: round(attempt.weaknessGain, 2),
    totalDelta: round(attempt.totalDelta, 2),
    maxCriticalRegression: round(attempt.maxCriticalRegression, 2),
    surgicalAttempted: Boolean(attempt.surgicalAttempted),
    surgicalAccepted: attempt.surgicalAccepted == null ? null : Boolean(attempt.surgicalAccepted),
    wholeFallbackUsed: Boolean(attempt.wholeFallbackUsed),
    reasons: [...(attempt.reasons ?? [])].map(String),
  }));
  const byStrategy = aggregateAttempts(normalizedAttempts, "strategyId");
  const byDimension = aggregateAttempts(normalizedAttempts, "dimension");
  const byGenre = aggregateAttempts(normalizedAttempts, "genre");
  const songSummary = summarizeSongs(songs);
  const skipSummary = summarizeSkips(songs);
  const report = {
    phase: 20,
    version: 1,
    labVersion: 2,
    ...songSummary,
    ...skipSummary,
    repairAttempts: normalizedAttempts.length,
    acceptedRepairs: normalizedAttempts.filter((attempt) => attempt.accepted).length,
    rejectedRepairs: normalizedAttempts.filter((attempt) => !attempt.accepted).length,
    acceptanceRate: round(
      normalizedAttempts.filter((attempt) => attempt.accepted).length / Math.max(1, normalizedAttempts.length),
      3,
    ),
    byStrategy,
    byDimension,
    byGenre,
    rejectionReasons: countReasons(normalizedAttempts.filter((attempt) => !attempt.accepted)),
    attempts: normalizedAttempts,
    songs,
  };
  report.recommendations = recommendationsFor(report);
  return report;
}

export function runRepairEffectivenessBenchmark({
  genres = DEFAULT_REPAIR_BENCHMARK_GENRES,
  seeds = ["repair-lab-a", "repair-lab-b"],
  profiles = DEFAULT_REPAIR_BENCHMARK_PROFILES,
  bars = 8,
  thinkingDepth = "standard",
} = {}) {
  const attempts = [];
  const songs = [];
  const benchmarkGenres = normalizedGenres(genres);
  const benchmarkProfiles = normalizedProfiles(profiles);
  const normalizedSeeds = (seeds ?? []).length ? seeds.map(String) : ["repair-lab-a"];
  const normalizedBars = Math.max(4, Math.min(32, Math.round(finite(bars, 8))));
  const depth = thinkingDepth === "deep" ? "deep" : "standard";

  for (const genre of benchmarkGenres) {
    for (const profile of benchmarkProfiles) {
      for (const seed of normalizedSeeds) {
        const generatedSeed = `${seed}:${genre}:${profile.id}`;
        const song = generateNew({
          genre,
          seed: generatedSeed,
          bars: normalizedBars,
          energy: profile.energy,
          complexity: profile.complexity,
          thinkingDepth: depth,
        });
        const details = song.meta?.scoreDetails ?? {};
        const repair = details.criticRepair ?? {};
        const selectedCandidate = (details.candidateScores ?? []).find((candidate) => (
          candidate.index === details.selectedCandidate
        ));
        const selectedStrategyId = selectedCandidate?.repairAccepted
          ? selectedCandidate.repairStrategyId ?? null
          : null;
        songs.push({
          genre,
          seed,
          profile: profile.id,
          generatedSeed,
          candidatesEvaluated: finite(details.candidatesEvaluated, 0),
          repairAttempts: finite(repair.attempts, 0),
          acceptedRepairs: finite(repair.accepted, 0),
          rejectedRepairs: finite(repair.rejected, 0),
          selectedFromRepair: Boolean(repair.selectedFromRepair),
          selectedStrategyId,
          focusDimension: details.candidateSearch?.focusDimension ?? null,
          focusGroup: details.candidateSearch?.focusGroup ?? null,
          skippedGlobalDimensions: (repair.skippedGlobalDimensions ?? []).map((entry) => ({
            group: entry.group ?? null,
            dimension: entry.dimension ?? null,
            score: round(entry.score, 1),
            reason: entry.reason ?? "song-level-search-owned",
          })),
        });
        for (const entry of repair.acceptanceHistory ?? []) {
          attempts.push({
            genre,
            seed,
            profile: profile.id,
            generatedSeed,
            strategyId: entry.repairStrategyId ?? "unknown",
            dimension: entry.dimension ?? "unknown",
            group: entry.group ?? null,
            accepted: Boolean(entry.accepted),
            selected: Boolean(entry.accepted && selectedStrategyId && entry.repairStrategyId === selectedStrategyId),
            weaknessGain: entry.weaknessGain,
            totalDelta: entry.totalDelta,
            maxCriticalRegression: entry.maxCriticalRegression,
            repairMode: entry.repairMode ?? null,
            surgicalAttempted: Boolean(entry.surgicalAttempted),
            surgicalAccepted: entry.surgicalAccepted ?? null,
            wholeFallbackUsed: Boolean(entry.wholeFallbackUsed),
            surgicalBars: entry.surgicalWindow?.bars ?? null,
            reasons: [...(entry.reasons ?? [])],
          });
        }
      }
    }
  }

  return summarizeRepairEffectiveness({ attempts, songs });
}
