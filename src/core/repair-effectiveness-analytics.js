function parseMetrics(value) {
  if (!value) return {};
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function numericPairs(before, after) {
  const pairs = [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    const left = Number(before[key]);
    const right = Number(after[key]);
    if (!Number.isFinite(left) || !Number.isFinite(right)) continue;
    pairs.push(Object.freeze({
      metric: key,
      before: left,
      after: right,
      delta: right - left,
    }));
  }
  return pairs;
}

export function summarizeRepairEffectiveness(rows = []) {
  const repairs = [];
  for (const row of rows ?? []) {
    const before = parseMetrics(row?.before_metrics_json);
    const after = parseMetrics(row?.after_metrics_json);
    const metrics = numericPairs(before, after);
    repairs.push(Object.freeze({
      id: row?.id ?? null,
      generationRunId: row?.generation_run_id ?? null,
      genre: row?.genre ?? null,
      repairType: row?.repair_type ?? "unknown",
      targetScope: row?.target_scope ?? "song",
      targetId: row?.target_id ?? null,
      accepted: Boolean(Number(row?.accepted)),
      metrics: Object.freeze(metrics),
    }));
  }

  const grouped = new Map();
  for (const repair of repairs) {
    const key = `${repair.genre ?? "unknown"}|${repair.repairType}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        genre: repair.genre ?? "unknown",
        repairType: repair.repairType,
        attempts: 0,
        accepted: 0,
        metricTotals: new Map(),
      });
    }
    const group = grouped.get(key);
    group.attempts += 1;
    if (repair.accepted) group.accepted += 1;
    for (const metric of repair.metrics) {
      const aggregate = group.metricTotals.get(metric.metric) ?? { count: 0, delta: 0 };
      aggregate.count += 1;
      aggregate.delta += metric.delta;
      group.metricTotals.set(metric.metric, aggregate);
    }
  }

  const groups = [...grouped.values()].map((group) => Object.freeze({
    genre: group.genre,
    repairType: group.repairType,
    attempts: group.attempts,
    accepted: group.accepted,
    acceptanceRate: group.attempts ? group.accepted / group.attempts : 0,
    averageDeltas: Object.freeze(Object.fromEntries(
      [...group.metricTotals.entries()].map(([metric, aggregate]) => [
        metric,
        aggregate.count ? aggregate.delta / aggregate.count : 0,
      ]),
    )),
  }));

  return Object.freeze({
    repairCount: repairs.length,
    repairs: Object.freeze(repairs),
    groups: Object.freeze(groups),
  });
}
