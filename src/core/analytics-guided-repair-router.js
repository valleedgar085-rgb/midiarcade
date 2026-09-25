function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalized(value) {
  return String(value ?? "").trim().toLowerCase();
}

function metricDelta(group, dimension) {
  const entries = Object.entries(group?.averageDeltas ?? {});
  const exact = entries.find(([metric]) => normalized(metric) === normalized(dimension));
  if (exact) return finite(exact[1]);
  const loose = entries.find(([metric]) => (
    normalized(metric).includes(normalized(dimension))
    || normalized(dimension).includes(normalized(metric))
  ));
  return loose ? finite(loose[1]) : 0;
}

function evidenceScore(group, dimension) {
  const attempts = Math.max(0, finite(group?.attempts));
  const acceptanceRate = Math.max(0, Math.min(1, finite(group?.acceptanceRate)));
  const delta = metricDelta(group, dimension);
  if (attempts < 3 || acceptanceRate < 0.35 || delta <= 0) return 0;
  const confidence = Math.min(1, attempts / 12);
  return delta * (0.55 + acceptanceRate * 0.45) * confidence;
}

export function rankRepairEvidence({
  diagnosis = null,
  analytics = null,
  genre = null,
} = {}) {
  if (!diagnosis?.weakestDimension) {
    return Object.freeze({
      recommendedRepairType: null,
      evidenceScore: 0,
      evidence: Object.freeze([]),
    });
  }

  const wantedGenre = normalized(genre);
  const groups = Array.isArray(analytics?.groups) ? analytics.groups : [];
  const evidence = groups
    .filter((group) => !wantedGenre || normalized(group?.genre) === wantedGenre)
    .map((group) => ({
      genre: group?.genre ?? null,
      repairType: group?.repairType ?? null,
      attempts: Math.max(0, finite(group?.attempts)),
      acceptanceRate: Math.max(0, Math.min(1, finite(group?.acceptanceRate))),
      averageDelta: metricDelta(group, diagnosis.weakestDimension),
      score: evidenceScore(group, diagnosis.weakestDimension),
    }))
    .filter((row) => row.score > 0)
    .sort((left, right) => (
      right.score - left.score
      || right.acceptanceRate - left.acceptanceRate
      || right.attempts - left.attempts
      || String(left.repairType).localeCompare(String(right.repairType))
    ));

  return Object.freeze({
    recommendedRepairType: evidence[0]?.repairType ?? null,
    evidenceScore: evidence[0]?.score ?? 0,
    evidence: Object.freeze(evidence.map((row) => Object.freeze(row))),
  });
}

export function createAnalyticsGuidedRepairHint({
  diagnosis = null,
  analytics = null,
  genre = null,
} = {}) {
  if (!diagnosis) return null;
  const ranked = rankRepairEvidence({ diagnosis, analytics, genre });
  return Object.freeze({
    version: 1,
    genre: genre ?? null,
    group: diagnosis.group ?? null,
    route: diagnosis.route ?? null,
    weakestDimension: diagnosis.weakestDimension ?? null,
    weakestScore: finite(diagnosis.weakestScore, null),
    historicalRepairType: ranked.recommendedRepairType,
    historicalEvidenceScore: ranked.evidenceScore,
    evidence: ranked.evidence,
  });
}
