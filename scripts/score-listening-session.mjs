/**
 * Score a filled-in ratings.csv against KEY.json.
 *   node scripts/score-listening-session.mjs --key KEY.json --ratings ratings.csv [--json out.json]
 */
import fs from "node:fs/promises";
import { parseRatings, scoreSession } from "./lib/listening-session.mjs";

const flag = (name) => { const index = process.argv.indexOf(name); return index < 0 ? null : process.argv[index + 1]; };
const keyPath = flag("--key");
const ratingsPath = flag("--ratings");
if (!keyPath || !ratingsPath) throw new Error("usage: --key <KEY.json> --ratings <ratings.csv> [--json <out>]");
const result = scoreSession(JSON.parse(await fs.readFile(keyPath, "utf8")), parseRatings(await fs.readFile(ratingsPath, "utf8")));
console.log(`Rated ${result.answered} of ${result.total} pairs${result.complete ? "" : " (incomplete)"}`);
for (const row of result.byKind) {
  console.log(`${row.kind.padEnd(18)} experiment ${row.experiment}  original ${row.original}  no preference ${row.none}  (answered ${row.answered}/${row.pairs})`);
}
for (const row of result.rows) console.log(`  ${row.pair}  ${row.kind.padEnd(16)} ${String(row.meta.genre ?? "").padEnd(10)} ${row.chose ?? "-"}`);
console.log(result.caveat);
const jsonPath = flag("--json");
if (jsonPath) await fs.writeFile(jsonPath, JSON.stringify(result, null, 2) + "\n");
