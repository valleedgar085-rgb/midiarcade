/**
 * Merge the blind A/B packs into a single listening session.
 *
 *   node scripts/build-listening-session.mjs --raw <dir> --out <dir> [--balanced] [--max-per-kind N]
 *
 * <raw> holds the outputs of the existing pack generators:
 *   section/ (benchmark-section-contrast-ab), hook/ (benchmark-hook-rescue-shadow),
 *   bass-midi/ + bass-key.json (benchmark-bass-head-preference-selector).
 * Writes <out>/session/ (what you listen to: pair-NN-A/B.mid, READ_FIRST.txt,
 * ratings.csv) and <out>/KEY.json (open only after rating).
 *
 * --balanced       put the experiment on A for half the pairs and B for half, and ask for
 *                  two listens per pair (A then B, then B then A); a flip counts as unstable.
 * --max-per-kind   cap each experiment kind, spread evenly across genres.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { assignBalancedSides, planSession, ratingsTemplate } from "./lib/listening-session.mjs";

const flag = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1]; };
const raw = flag("--raw");
const out = flag("--out");
if (!raw || !out) throw new Error("usage: --raw <dir> --out <dir> [--balanced] [--max-per-kind N]");
const balanced = process.argv.includes("--balanced");
const maxPerKind = flag("--max-per-kind") === null ? Infinity : Number(flag("--max-per-kind"));
if (!(maxPerKind >= 1)) throw new Error("--max-per-kind must be a positive number");
const readJson = async (file) => JSON.parse(await fs.readFile(path.join(raw, file), "utf8"));
const exists = (file) => fs.access(path.join(raw, file)).then(() => true, () => false);

const sources = [];
const add = (kind, sourceId, treatmentSide, dir, meta) => sources.push({
  kind, sourceId, treatmentSide, meta,
  files: { A: `${dir}/${sourceId}-A.mid`, B: `${dir}/${sourceId}-B.mid` },
});
if (await exists("section/answer-key.json")) {
  for (const row of await readJson("section/answer-key.json")) add("section-contrast", row.caseId, row.treatmentSide, "section", { genre: row.genre, seed: row.seed });
}
if (await exists("hook/answer-key.json")) {
  for (const row of await readJson("hook/answer-key.json")) add("hook-rescue", row.caseId, row.treatment, "hook", { genre: row.genre, seed: row.seed, proposal: row.proposal });
}
if (await exists("bass-key.json")) {
  for (const row of (await readJson("bass-key.json")).key) add("bass-answer", row.blindId, row.experimentalVersion, "bass-midi", { genre: row.genre, seed: row.seed, proposal: row.proposal });
}
if (!sources.length) throw new Error("no packs found under " + raw);

function capKind(kind, limit) {
  const mine = sources.filter((pair) => pair.kind === kind);
  if (mine.length <= limit) return mine;
  const groups = new Map();
  for (const pair of mine) groups.set(pair.meta.genre, [...(groups.get(pair.meta.genre) ?? []), pair]);
  const picked = [];
  while (picked.length < limit && [...groups.values()].some((list) => list.length)) {
    for (const list of groups.values()) if (list.length && picked.length < limit) picked.push(list.shift());
  }
  return picked;
}
let chosen = [...new Set(sources.map((pair) => pair.kind))].flatMap((kind) => capKind(kind, maxPerKind));
if (balanced) chosen = assignBalancedSides(chosen);

const plan = planSession(chosen);
const sessionDir = path.join(out, "session");
await fs.rm(sessionDir, { recursive: true, force: true });
await fs.mkdir(sessionDir, { recursive: true });
for (const entry of plan.pairs) {
  const source = sources.find((pair) => pair.kind === entry.kind && pair.sourceId === entry.sourceId);
  // The generator's own treatmentSide says which FILE is the experiment; seat it on the planned side.
  const experimentFile = source.files[source.treatmentSide];
  const originalFile = source.files[source.treatmentSide === "A" ? "B" : "A"];
  const originalSide = entry.treatmentSide === "A" ? "B" : "A";
  await fs.copyFile(path.join(raw, experimentFile), path.join(sessionDir, `${entry.pair}-${entry.treatmentSide}.mid`));
  await fs.copyFile(path.join(raw, originalFile), path.join(sessionDir, `${entry.pair}-${originalSide}.mid`));
}
await fs.writeFile(path.join(sessionDir, "ratings.csv"), ratingsTemplate(plan, { twoListens: balanced }));
const answerSteps = balanced ? [
  "3. Listen to each pair TWICE. First listen: play A then B. Second listen: play B then A.",
  "   In ratings.csv write A, B or none in the 'first' column after the first listen and in the 'second'",
  "   column after the second. If your two answers differ, the pair counts as no preference. That is intended.",
  "   Use the notes column for clicks, strange dynamics or why you chose. Leave a row blank to skip it.",
] : [
  "3. In ratings.csv write A, B or none in the preference column (none = cannot tell or no preference).",
  "   Use the notes column for clicks, strange dynamics or why you chose. Leave a row blank to skip it.",
];
await fs.writeFile(path.join(sessionDir, "READ_FIRST.txt"), [
  "MIDI ARCADE - BLIND LISTENING SESSION",
  "",
  `${plan.pairs.length} pairs. In each pair the two files are the same generated song; one side carries one`,
  "small experimental change and the other is the unchanged original. Which side is which is hidden.",
  "",
  "1. Load every file into the SAME DAW instruments, tempo and master level. Do not normalise files separately.",
  "2. Decide before looking at anything else.",
  ...answerSteps,
  "4. Do NOT open KEY.json until you have rated every pair you are going to rate.",
  "",
  "This is MIDI through your own sounds, not Android preview audio. One listener's preference is a",
  "directional signal for what to study next, not proof that a change is better.",
  "",
].join("\n"));
await fs.writeFile(path.join(out, "KEY.json"), JSON.stringify({
  version: 1, balanced, note: "Open only after rating. treatmentSide = the side that carries the experiment.", pairs: plan.pairs,
}, null, 2) + "\n");
const count = (kind) => plan.pairs.filter((pair) => pair.kind === kind).length;
console.log("LISTENING_SESSION " + JSON.stringify({
  pairs: plan.pairs.length, balanced,
  byKind: Object.fromEntries([...new Set(plan.pairs.map((pair) => pair.kind))].map((kind) => [kind, count(kind)])),
  experimentOnA: plan.pairs.filter((pair) => pair.treatmentSide === "A").length,
}));
