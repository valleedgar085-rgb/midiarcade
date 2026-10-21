/**
 * Developer-only: merge the repo's blind MIDI A/B packs into ONE listening
 * session and score the listener's answers afterwards.
 *
 * Pure functions, deterministic, no randomness: presentation order comes from
 * a hash, so rebuilding the same packs reproduces the same session. The key
 * (which side is the experiment) never appears in the listener's folder.
 */
import { createHash } from "node:crypto";

export const PREFERENCES = Object.freeze(["A", "B", "none"]);
const orderKey = (pair) => createHash("sha256").update(`${pair.kind}:${pair.sourceId}`).digest("hex");

/**
 * Place the experiment on A for half the pairs and on B for the other half
 * (exactly balanced, +/-1), chosen by hash so rebuilding reproduces it. The
 * input order and any treatmentSide the generators picked are ignored.
 */
export function assignBalancedSides(pairs) {
  const bySide = [...pairs].sort((a, b) =>
    createHash("sha256").update(`side:${a.kind}:${a.sourceId}`).digest("hex")
      .localeCompare(createHash("sha256").update(`side:${b.kind}:${b.sourceId}`).digest("hex")));
  const half = Math.ceil(bySide.length / 2);
  const sides = new Map(bySide.map((pair, index) => [`${pair.kind}:${pair.sourceId}`, index < half ? "A" : "B"]));
  return pairs.map((pair) => ({ ...pair, treatmentSide: sides.get(`${pair.kind}:${pair.sourceId}`) }));
}

/**
 * @param {{kind:string, sourceId:string, treatmentSide:"A"|"B", meta?:object}[]} pairs
 * @returns {{pairs:{pair:string, kind:string, sourceId:string, treatmentSide:string, meta:object}[]}}
 */
export function planSession(pairs) {
  const seen = new Set();
  for (const pair of pairs) {
    if (!["A", "B"].includes(pair.treatmentSide)) throw new Error(`pair ${pair.sourceId}: treatmentSide must be A or B`);
    const id = `${pair.kind}:${pair.sourceId}`;
    if (seen.has(id)) throw new Error(`duplicate pair ${id}`);
    seen.add(id);
  }
  const ordered = [...pairs].sort((a, b) => orderKey(a).localeCompare(orderKey(b)));
  return {
    pairs: ordered.map((pair, index) => ({
      pair: `pair-${String(index + 1).padStart(2, "0")}`,
      kind: pair.kind,
      sourceId: pair.sourceId,
      treatmentSide: pair.treatmentSide,
      meta: pair.meta ?? {},
    })),
  };
}

export function ratingsTemplate(plan, { twoListens = false } = {}) {
  return twoListens
    ? ["pair,first,second,notes", ...plan.pairs.map((entry) => `${entry.pair},,,`)].join("\n") + "\n"
    : ["pair,preference,notes", ...plan.pairs.map((entry) => `${entry.pair},,`)].join("\n") + "\n";
}

export function parseRatings(csv) {
  const rows = String(csv).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const header = rows.shift()?.split(",").map((cell) => cell.trim().toLowerCase());
  const twoListens = header?.[0] === "pair" && header[1] === "first" && header[2] === "second";
  if (!header || header[0] !== "pair" || (!twoListens && header[1] !== "preference")) {
    throw new Error("ratings CSV must start with: pair,preference,notes or pair,first,second,notes");
  }
  return rows.map((line) => {
    const cells = line.split(",");
    return twoListens
      ? { pair: cells[0].trim(), first: (cells[1] ?? "").trim(), second: (cells[2] ?? "").trim(), notes: cells.slice(3).join(",").trim() }
      : { pair: cells[0].trim(), preference: (cells[1] ?? "").trim(), notes: cells.slice(2).join(",").trim() };
  });
}

const normalize = (pair, raw) => {
  if (raw === "") return null;
  const value = raw.toUpperCase() === "NONE" ? "none" : raw.toUpperCase();
  if (!PREFERENCES.includes(value)) throw new Error(`${pair}: preference must be A, B or none (got "${raw}")`);
  return value;
};

/** Exact two-sided sign test: chance of a split at least this lopsided if both sides were equally likely. */
export function signTestP(wins, losses) {
  const n = wins + losses;
  if (n === 0) return null;
  const k = Math.min(wins, losses);
  let tail = 0;
  let term = 0.5 ** n;
  for (let i = 0; i <= k; i += 1) {
    tail += term;
    term = term * (n - i) / (i + 1);
  }
  return Math.min(1, Math.round(2 * tail * 10000) / 10000);
}

/**
 * Tally preferences by experiment kind. Blank answers are unanswered, not
 * "no preference". Invalid values and unknown pairs throw instead of being
 * silently skipped.
 */
export function scoreSession(key, ratings) {
  const byPair = new Map(key.pairs.map((entry) => [entry.pair, entry]));
  const answered = new Map();
  const unstable = new Set();
  for (const rating of ratings) {
    const entry = byPair.get(rating.pair);
    if (!entry) throw new Error(`unknown pair ${rating.pair}`);
    if (answered.has(rating.pair) || unstable.has(rating.pair)) throw new Error(`${rating.pair} rated twice`);
    let value;
    if ("first" in rating || "second" in rating) {
      const first = normalize(rating.pair, rating.first ?? "");
      const second = normalize(rating.pair, rating.second ?? "");
      if (first === null || second === null) continue; // both listens are needed to count
      if (first === second) value = first;
      else { unstable.add(rating.pair); value = "none"; }
    } else {
      value = normalize(rating.pair, rating.preference ?? "");
      if (value === null) continue;
    }
    answered.set(rating.pair, value);
  }
  const kinds = new Map();
  const rows = [];
  for (const entry of key.pairs) {
    const value = answered.get(entry.pair);
    const tally = kinds.get(entry.kind) ?? { kind: entry.kind, pairs: 0, answered: 0, experiment: 0, original: 0, none: 0, unstable: 0 };
    tally.pairs += 1;
    if (value !== undefined) {
      tally.answered += 1;
      if (unstable.has(entry.pair)) tally.unstable += 1;
      if (value === "none") tally.none += 1;
      else if (value === entry.treatmentSide) tally.experiment += 1;
      else tally.original += 1;
    }
    kinds.set(entry.kind, tally);
    rows.push({
      pair: entry.pair, kind: entry.kind, sourceId: entry.sourceId, meta: entry.meta,
      preference: value ?? null,
      chose: value === undefined ? null : unstable.has(entry.pair) ? "unstable (flipped with order)"
        : value === "none" ? "no preference" : value === entry.treatmentSide ? "experiment" : "original",
    });
  }
  const byKind = [...kinds.values()].map((row) => ({ ...row, signTestP: signTestP(row.experiment, row.original) }));
  const experiment = byKind.reduce((sum, row) => sum + row.experiment, 0);
  const original = byKind.reduce((sum, row) => sum + row.original, 0);
  return {
    answered: answered.size, total: key.pairs.length, complete: answered.size === key.pairs.length,
    byKind, overall: { experiment, original, signTestP: signTestP(experiment, original) }, rows,
    caveat: "One listener, MIDI through your own sounds. A directional signal for choosing what to study next, never proof that an experiment is better.",
  };
}
