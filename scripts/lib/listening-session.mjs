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

export function ratingsTemplate(plan) {
  return ["pair,preference,notes", ...plan.pairs.map((entry) => `${entry.pair},,`)].join("\n") + "\n";
}

export function parseRatings(csv) {
  const rows = String(csv).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const header = rows.shift()?.split(",").map((cell) => cell.trim().toLowerCase());
  if (!header || header[0] !== "pair" || header[1] !== "preference") throw new Error("ratings CSV must start with: pair,preference,notes");
  return rows.map((line) => {
    const [pair, preference = "", ...notes] = line.split(",");
    return { pair: pair.trim(), preference: preference.trim(), notes: notes.join(",").trim() };
  });
}

/**
 * Tally preferences by experiment kind. Blank answers are unanswered, not
 * "no preference". Invalid values and unknown pairs throw instead of being
 * silently skipped.
 */
export function scoreSession(key, ratings) {
  const byPair = new Map(key.pairs.map((entry) => [entry.pair, entry]));
  const answered = new Map();
  for (const rating of ratings) {
    const entry = byPair.get(rating.pair);
    if (!entry) throw new Error(`unknown pair ${rating.pair}`);
    if (rating.preference === "") continue;
    const value = rating.preference.toUpperCase() === "NONE" ? "none" : rating.preference.toUpperCase();
    if (!PREFERENCES.includes(value)) throw new Error(`${rating.pair}: preference must be A, B or none (got "${rating.preference}")`);
    if (answered.has(rating.pair)) throw new Error(`${rating.pair} rated twice`);
    answered.set(rating.pair, value);
  }
  const kinds = new Map();
  const rows = [];
  for (const entry of key.pairs) {
    const value = answered.get(entry.pair);
    const tally = kinds.get(entry.kind) ?? { kind: entry.kind, pairs: 0, answered: 0, experiment: 0, original: 0, none: 0 };
    tally.pairs += 1;
    if (value !== undefined) {
      tally.answered += 1;
      if (value === "none") tally.none += 1;
      else if (value === entry.treatmentSide) tally.experiment += 1;
      else tally.original += 1;
    }
    kinds.set(entry.kind, tally);
    rows.push({
      pair: entry.pair, kind: entry.kind, sourceId: entry.sourceId, meta: entry.meta,
      preference: value ?? null,
      chose: value === undefined ? null : value === "none" ? "no preference" : value === entry.treatmentSide ? "experiment" : "original",
    });
  }
  return {
    answered: answered.size, total: key.pairs.length, complete: answered.size === key.pairs.length,
    byKind: [...kinds.values()], rows,
    caveat: "One listener, MIDI through your own sounds. A directional signal for choosing what to study next, never proof that an experiment is better.",
  };
}
