const CREATIVE_RANGE_VALUES = Object.freeze(["familiar", "fresh", "wild"]);
const CREATIVE_RANGE_SET = new Set(CREATIVE_RANGE_VALUES);

export { CREATIVE_RANGE_VALUES };

export function normalizeCreativeRange(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  return CREATIVE_RANGE_SET.has(normalized) ? normalized : null;
}
