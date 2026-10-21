/**
 * Merge the blind A/B packs into a single listening session.
 *
 *   node scripts/build-listening-session.mjs --raw <dir> --out <dir>
 *
 * <raw> holds the outputs of the existing pack generators:
 *   section/ (benchmark-section-contrast-ab), hook/ (benchmark-hook-rescue-shadow),
 *   bass-midi/ + bass-key.json (benchmark-bass-head-preference-selector).
 * Writes <out>/session/ (what you listen to: pair-NN-A/B.mid, READ_FIRST.txt,
 * ratings.csv) and <out>/KEY.json (open only after rating).
 */
import fs from "node:fs/promises";
import path from "node:path";
import { planSession, ratingsTemplate } from "./lib/listening-session.mjs";

const flag = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1]; };
const raw = flag("--raw");
const out = flag("--out");
if (!raw || !out) throw new Error("usage: --raw <dir> --out <dir>");
const readJson = async (file) => JSON.parse(await fs.readFile(path.join(raw, file), "utf8"));
const exists = (file) => fs.access(path.join(raw, file)).then(() => true, () => false);

const pairs = [];
if (await exists("section/answer-key.json")) {
  for (const row of await readJson("section/answer-key.json")) {
    pairs.push({ kind: "section-contrast", sourceId: row.caseId, treatmentSide: row.treatmentSide,
      files: { A: `section/${row.caseId}-A.mid`, B: `section/${row.caseId}-B.mid` }, meta: { genre: row.genre, seed: row.seed } });
  }
}
if (await exists("hook/answer-key.json")) {
  for (const row of await readJson("hook/answer-key.json")) {
    pairs.push({ kind: "hook-rescue", sourceId: row.caseId, treatmentSide: row.treatment,
      files: { A: `hook/${row.caseId}-A.mid`, B: `hook/${row.caseId}-B.mid` }, meta: { genre: row.genre, seed: row.seed, proposal: row.proposal } });
  }
}
if (await exists("bass-key.json")) {
  for (const row of (await readJson("bass-key.json")).key) {
    pairs.push({ kind: "bass-answer", sourceId: row.blindId, treatmentSide: row.experimentalVersion,
      files: { A: `bass-midi/${row.blindId}-A.mid`, B: `bass-midi/${row.blindId}-B.mid` }, meta: { genre: row.genre, seed: row.seed, proposal: row.proposal } });
  }
}
if (!pairs.length) throw new Error("no packs found under " + raw);

const plan = planSession(pairs);
const sessionDir = path.join(out, "session");
await fs.rm(sessionDir, { recursive: true, force: true });
await fs.mkdir(sessionDir, { recursive: true });
for (const entry of plan.pairs) {
  const source = pairs.find((pair) => pair.kind === entry.kind && pair.sourceId === entry.sourceId);
  for (const side of ["A", "B"]) await fs.copyFile(path.join(raw, source.files[side]), path.join(sessionDir, `${entry.pair}-${side}.mid`));
}
await fs.writeFile(path.join(sessionDir, "ratings.csv"), ratingsTemplate(plan));
await fs.writeFile(path.join(sessionDir, "READ_FIRST.txt"), [
  "MIDI ARCADE - BLIND LISTENING SESSION",
  "",
  `${plan.pairs.length} pairs. In each pair the two files are the same generated song; one side carries one`,
  "small experimental change and the other is the unchanged original. Which side is which is hidden.",
  "",
  "1. Load every file into the SAME DAW instruments, tempo and master level. Do not normalise files separately.",
  "2. Listen to each pair in a different order each time you replay it, and decide before looking at anything else.",
  "3. In ratings.csv write A, B or none in the preference column (none = cannot tell or no preference).",
  "   Use the notes column for clicks, strange dynamics or why you chose. Leave a row blank to skip it.",
  "4. Do NOT open KEY.json until you have rated every pair you are going to rate.",
  "",
  "This is MIDI through your own sounds, not Android preview audio. One listener's preference is a",
  "directional signal for what to study next, not proof that a change is better.",
  "",
].join("\n"));
await fs.writeFile(path.join(out, "KEY.json"), JSON.stringify({
  version: 1, note: "Open only after rating. treatmentSide = the side that carries the experiment.", pairs: plan.pairs,
}, null, 2) + "\n");
console.log("LISTENING_SESSION " + JSON.stringify({ pairs: plan.pairs.length,
  byKind: Object.fromEntries([...new Set(plan.pairs.map((p) => p.kind))].map((kind) => [kind, plan.pairs.filter((p) => p.kind === kind).length])) }));
