import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { matrixCases, runMatrixCase } from "./lib/generation-request-matrix.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
function flag(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new TypeError(`${name} requires a value`);
  return value;
}

async function sourceHash(directory, hash = createHash("sha256")) {
  for (const entry of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) await sourceHash(target, hash);
    else if (entry.name.endsWith(".js")) hash.update(path.relative(root, target)).update("\0").update(await fs.readFile(target)).update("\0");
  }
  return hash;
}

const profile = flag("--profile", "smoke");
const only = flag("--case");
const replayPath = flag("--replay");
const out = path.resolve(flag("--out", "artifacts/request-matrix"));
const replay = replayPath ? JSON.parse(await fs.readFile(path.resolve(replayPath), "utf8")) : null;
const rows = replay ? [replay.row] : matrixCases(profile).filter((row) => !only || row.id === only);
if (!rows.length) throw new RangeError(`No matrix case matched ${only}`);
const pkg = JSON.parse(await fs.readFile(path.join(root, "package.json"), "utf8"));
const manifest = {
  engineVersion: pkg.version,
  samplerVersion: "mulberry32+forked-hashSeed@1",
  sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
  engineSourceHash: `sha256:${(await sourceHash(path.join(root, "src"))).digest("hex")}`,
  node: process.version,
};
await fs.mkdir(out, { recursive: true });
const results = [];
for (const row of rows) {
  try {
    const result = await runMatrixCase(row, { replay: replay?.payload });
    results.push(result);
    console.log(`PASS ${row.id}: ${result.outcome}, ${result.songs.length} songs, ${result.songs.reduce((sum, song) => sum + song.exportsChecked, 0)} exports`);
  } catch (error) {
    const replayName = `${row.id}.replay.json`;
    await fs.writeFile(path.join(out, replayName), JSON.stringify({ manifest, ...(error.replay ?? { row }) }, null, 2) + "\n");
    results.push({ id: row.id, passed: false, message: error.message, replay: replayName });
    console.error(`FAIL ${row.id}: ${error.message}`);
  }
}
const report = { schema: "midi-arcade/request-matrix@1", manifest, profile,
  cases: rows.length, passed: results.filter((row) => row.passed).length,
  rejectedCandidates: results.filter((row) => row.passed && row.outcome === "rejected").length,
  refusedRequests: results.filter((row) => row.passed && row.outcome === "refused").length, results };
await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
console.log(`${report.passed}/${report.cases} contracts passed; ${report.rejectedCandidates} scoped candidates rejected; ${report.refusedRequests} requests safely refused. Report: ${path.join(out, "report.json")}`);
if (report.passed !== report.cases) process.exitCode = 1;
