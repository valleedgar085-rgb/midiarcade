/**
 * Developer-only, read-only: find which compose() stage first weakens each
 * returning chorus hook. Uses the existing generator and recurrence critic.
 *
 * Usage:
 *   node scripts/audit-hook-stage-trace.mjs --seeds 2 --bars 32 --out /tmp/hook-stage-trace.json
 *   node scripts/audit-hook-stage-trace.mjs --genres funk,drill --seeds 2
 */
import fs from "node:fs/promises";
import path from "node:path";
import { GENRE_PROFILES, generateNew, setCompositionStageTap } from "../src/music-engine.js";
import { stagesForCommittedSong, summarizeStageTraces, traceHookStages } from "./lib/hook-stage-trace.mjs";

const flag = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const positive = (value, name, max) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max) throw Error(`${name} must be an integer from 1 to ${max}`);
  return number;
};
const seeds = positive(flag("--seeds", "2"), "--seeds", 12);
const bars = positive(flag("--bars", "32"), "--bars", 128);
const all = Object.keys(GENRE_PROFILES);
const genres = flag("--genres", null)?.split(",").map((name) => name.trim()).filter(Boolean) ?? all;
if (!genres.length || genres.some((genre) => !all.includes(genre))) throw Error("Unknown genre. Choices: " + all.join(", "));
const out = flag("--out", null);

const traces = [];
for (const genre of genres) {
  for (let index = 1; index <= seeds; index += 1) {
    const seed = `census-${String(index).padStart(2, "0")}-${genre}`;
    const bySeed = new Map();
    const previous = setCompositionStageTap((stage, notes, candidateSeed) => {
      if (!bySeed.has(candidateSeed)) bySeed.set(candidateSeed, []);
      bySeed.get(candidateSeed).push({ stage, notes });
    });
    let song;
    try {
      song = generateNew({
        genre, key: "E", scale: "minor", bars, seed, energy: 0.68, complexity: 0.62,
        variation: 0.62, evolution: 0.68, swing: 0.14, humanize: 0.12,
      });
    } finally {
      setCompositionStageTap(previous);
    }
    const { stages, finalStage } = stagesForCommittedSong(song, bySeed);
    const trace = stages.length ? traceHookStages(song, stages, { finalStage })
      : { status: "unavailable", reason: "no-stage-snapshots-for-committed-seed", returns: [] };
    traces.push({ genre, seed, ...trace });
    console.log("HOOK_STAGE_CASE " + JSON.stringify({
      genre, seed, status: trace.status,
      returns: trace.returns.map((entry) => ({
        section: entry.sectionId, diagnosis: entry.diagnosis, raw: entry.rawScore, final: entry.finalScore,
        firstWeak: entry.firstWeakStage, drop: entry.biggestDrop && { stage: entry.biggestDrop.stage, delta: entry.biggestDrop.delta, dim: entry.biggestDrop.worstDimension },
      })),
    }));
  }
}
const summary = summarizeStageTraces(traces);
console.log("HOOK_STAGE_SUMMARY " + JSON.stringify(summary));
if (out) {
  await fs.mkdir(path.dirname(path.resolve(out)), { recursive: true });
  await fs.writeFile(out, JSON.stringify({
    version: 1, scope: "read-only; scores are the existing recurrence critic, not listening results", genres, seeds, bars, summary, traces,
  }, null, 2) + "\n");
}
