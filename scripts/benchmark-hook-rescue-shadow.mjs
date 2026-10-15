/**
 * Read-only Melody Hook Rescue audition: 21-genre census + historic rap seeds.
 * Never commits a changed song to MIDI Arcade generation.
 * node scripts/benchmark-hook-rescue-shadow.mjs --seeds 2 --bars 32 --out /tmp/hook-shadow
 */
import fs from "node:fs/promises";
import path from "node:path";
import {
  GENRE_PROFILES, generateNew, evaluateSongCandidate, evaluateSongReleaseGate,
  encodeMidiVerified,
} from "../src/music-engine.js";
import { evaluateChorusHookRecurrence } from "../src/core/chorus-hook-recurrence.js";
import {
  createChorusHookDevelopmentCandidates, createChorusHookRhythmCandidates,
} from "../src/core/chorus-hook-development.js";
import { inspectHookMutation, inspectHookExport, blindVariant } from "./lib/hook-rescue-shadow.mjs";
import {
  GENRE_HOOK_RETURN_V2,
  createGenreAwareHookReturnCandidates,
} from "../src/core/genre-aware-hook-return-v2.js";

const flag = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
};
const positive = (value, name, max) => {
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > max)
    throw Error(name + " must be 1..." + max);
  return number;
};
const seeds = positive(flag("--seeds", "2"), "--seeds", 5);
const bars = positive(flag("--bars", "32"), "--bars", 128);
const out = path.resolve(flag("--out", "tmp/hook-rescue-shadow"));
const genreArg = flag("--genres", null);
const genres = genreArg ? genreArg.split(",").map(s => s.trim()).filter(Boolean)
  : Object.keys(GENRE_PROFILES);
if (!genres.length || genres.some(genre => !(genre in GENRE_PROFILES))) {
  throw Error("Invalid genres. Choose from: " + Object.keys(GENRE_PROFILES).join(", "));
}
const includeGenreV2 = flag("--genre-v2", "false") === "true";
const referenceTempo = flag("--reference-96", "false") === "true";
const referenceGenres = new Set(["hipHop", "rap", "popRadio", "neoSoul", "rnbSoul"]);
const candidateSupportedGenres = new Set([
  "pop", "hipHop", "rap", ...(includeGenreV2 ? GENRE_HOOK_RETURN_V2 : []),
]);
const round = value => Number(Number(value).toFixed(3));
const choices = [];
for (const genre of genres) {
  for (let index = 0; index < seeds; index++) {
    choices.push({
      genre, seed: "census-" + String(index + 1).padStart(2, "0") + "-" + genre,
      config: {
        genre, key: "E", scale: "minor", bars,
        ...(includeGenreV2 && referenceTempo && referenceGenres.has(genre) ? { bpm: 96 } : {}),
        energy: 0.68,
        complexity: 0.62, variation: 0.62, evolution: 0.68,
        swing: 0.14, humanize: 0.12,
      },
    });
  }
}
if (genres.includes("rap") && bars === 32 && flag("--no-historical", "false") !== "true") {
  for (let i = 0; i < 3; i++) {
    choices.push({
      genre: "rap",
      seed: "phase4-hook-audit-rap-32" + (i ? "-v" + i : ""),
      historical: true,
      config: {
        genre: "rap", key: "E", scale: "minor", bars: 32,
        energy: 0.64, complexity: 0.58, variation: 0.62,
        swing: 0.14, humanize: 0.10,
      },
    });
  }
}
await fs.mkdir(out, { recursive: true });
const report = {
  version: 1,
  baseline: "existing generated melody",
  scope: "read-only candidate audition, never invoked by default generation",
  referenceListeningProfile: includeGenreV2 ? {
    sourceArchive: "previously provided 28-track reference.zip (not shipped)",
    guide: "E minor, 96 BPM reference-guided working example and restrained verse-to-hook lift",
    strictTempo96: referenceTempo,
    warning: "This is a compositional comparison profile, not copyrighted MIDI transcription or proof of improved catchiness.",
  } : null,
  genreV2Enabled: includeGenreV2,
  genres, seedsPerGenre: seeds, historicalRapCases: choices.filter(c => c.historical).length,
  cases: [], totals: {}, blindMidiPairs: [],
  limitations: [
    "Generated songs and MIDI export are not Android PreviewPlayer audio.",
    "Only pop/hipHop/rap are supported by the existing optional hook proposal helpers.",
    "Unscored single-chorus forms are unknown, not weak.",
    "An improved hook recurrence metric does not prove a catchier melody.",
    "Listen to each full transition with identical DAW sounds and levels before enabling a candidate.",
  ],
};
let weak = 0, unknown = 0, proposals = 0, qualified = 0, exportCount = 0;
const answerKey = [];

for (const item of choices) {
  const config = { ...item.config, seed: item.seed };
  const song = generateNew(config);
  const original = JSON.stringify((song.tracks ?? []).map(track => [track.id, track.notes]));
  const initial = evaluateChorusHookRecurrence(song);
  const baselineEvaluation = evaluateSongCandidate(song);
  const baselineRelease = evaluateSongReleaseGate(song, baselineEvaluation);
  const row = {
    genre: item.genre, seed: item.seed, historical: item.historical === true,
    baselineHook: initial.score, hookStatus: initial.status, hookPassed: initial.passed,
    baselineCritic: baselineEvaluation.score, baselineRelease: baselineRelease.passed,
    candidateSupport: candidateSupportedGenres.has(item.genre),
    pitchProposals: 0, rhythmProposals: 0, v2Proposals: 0, auditions: [],
    reason: initial.status !== "evaluated" ? initial.reason
      : initial.passed ? "hook-score-passed"
        : candidateSupportedGenres.has(item.genre) ? "requires-candidate-audition"
          : "unsupported-genre-proposal",
  };
  if (initial.status !== "evaluated") unknown++;
  if (initial.status === "evaluated" && initial.passed === false) weak++;
  let best = null;
  if (initial.status === "evaluated" && initial.passed === false
      && candidateSupportedGenres.has(item.genre)) {
    const pitch = createChorusHookDevelopmentCandidates(song, { maxCandidates: 3 });
    const rhythm = createChorusHookRhythmCandidates(song, { maxCandidates: 3 });
    const v2 = includeGenreV2
      ? createGenreAwareHookReturnCandidates(song, { maxCandidates: 3 }) : [];
    row.pitchProposals = pitch.length;
    row.rhythmProposals = rhythm.length;
    row.v2Proposals = v2.length;
    proposals += pitch.length + rhythm.length + v2.length;
    for (const { kind, candidates } of [
      { kind: "pitch", candidates: pitch }, { kind: "rhythm", candidates: rhythm },
      { kind: "pitch", candidates: v2 },
    ]) {
      for (const candidate of candidates) {
        const proof = inspectHookMutation(song, candidate.song, kind);
        const afterHook = evaluateChorusHookRecurrence(candidate.song);
        const afterEvaluation = evaluateSongCandidate(candidate.song);
        const afterRelease = evaluateSongReleaseGate(candidate.song, afterEvaluation);
        const scoreDelta = round(afterEvaluation.score - baselineEvaluation.score);
        const floor = scores => Math.min(...Object.values(scores?.subscores ?? {}).filter(Number.isFinite));
        const floorDelta = round(floor(afterEvaluation) - floor(baselineEvaluation));
        // Optional helper never writes notes by itself. Require existing gate,
        // unchanged or better score floor, and genuine hook identity improvement.
        const preliminarySafe = Boolean(
          baselineRelease.passed && afterRelease.passed
          && afterEvaluation?.diagnostics?.scaleFit >= 0.999999
          && afterHook.status === "evaluated"
          && afterHook.score > initial.score && scoreDelta >= 0 && floorDelta >= 0
        );
        let exported = null;
        if (preliminarySafe) {
          const b = encodeMidiVerified(song);
          const a = encodeMidiVerified(candidate.song);
          exported = inspectHookExport(b, a, kind);
        }
        const audit = {
          id: candidate.id, kind,
          origin: candidate.id.startsWith("genre-hook-v2-") ? "genre-v2" : "legacy",
          changedNotes: proof.changedNotes,
          beforeHook: initial.score, afterHook: afterHook.score,
          hookDelta: round(afterHook.score - initial.score),
          criticDelta: scoreDelta, floorDelta,
          releasePassed: afterRelease.passed,
          preliminarySafe, exportProven: Boolean(exported),
        };
        row.auditions.push(audit);
        if (exported) {
          qualified++;
          if (!best || audit.hookDelta > best.audit.hookDelta
              || audit.hookDelta === best.audit.hookDelta && audit.criticDelta > best.audit.criticDelta) {
            best = { audit, candidate, kind };
          }
        }
      }
    }
    if (!pitch.length && !rhythm.length && !v2.length) row.reason = "weak-hook-no-safe-proposal";
    else if (!best) row.reason = "proposals-did-not-pass-strict-critic-and-export-guards";
    else row.reason = "qualified-shadow-proposal";
  }
  if (JSON.stringify((song.tracks ?? []).map(track => [track.id, track.notes])) !== original) {
    throw Error("Hook shadow audition mutated committed song: " + item.seed);
  }
  if (best && exportCount < 8) {
    const baseline = encodeMidiVerified(song);
    const proposed = encodeMidiVerified(best.candidate.song);
    inspectHookExport(baseline, proposed, best.kind);
    const caseId = "hook-" + String(exportCount + 1).padStart(2, "0");
    const variant = blindVariant(item.seed);
    const control = variant === "A" ? "B" : "A";
    await fs.writeFile(path.join(out, caseId + "-" + control + ".mid"), baseline.bytes);
    await fs.writeFile(path.join(out, caseId + "-" + variant + ".mid"), proposed.bytes);
    answerKey.push({
      caseId, genre: item.genre, seed: item.seed,
      proposal: best.audit.id, type: best.kind, treatment: variant, control,
    });
    row.listeningCase = caseId;
    exportCount++;
    report.blindMidiPairs.push({ caseId, genre: item.genre, seed: item.seed });
  }
  report.cases.push(row);
  console.log("HOOK_SHADOW_CASE", JSON.stringify({
    genre: row.genre, seed: row.seed, status: row.hookStatus,
    hook: row.baselineHook, reason: row.reason, options: row.auditions.length,
    exportedPair: row.listeningCase ?? null,
  }));
}
report.totals = { songs: choices.length, weakHooks: weak, unavailableHooks: unknown,
  proposals, qualifiedProposals: qualified, exportedPairs: exportCount };
await fs.writeFile(path.join(out, "report.json"), JSON.stringify(report, null, 2) + "\n");
await fs.writeFile(path.join(out, "answer-key.json"), JSON.stringify(answerKey, null, 2) + "\n");
await fs.writeFile(path.join(out, "READ_FIRST.txt"), [
  "MIDI ARCADE: Hook Rescue (developer shadow A/B)",
  "",
  "Case pairs contain the same generated song and one proposed hook change.",
  "A/B letters are blinded; do NOT open answer-key.json before deciding.",
  "Use identical FL Studio presets, tempo, velocities, mixer levels and effects.",
  "Listen for recognizable chorus identity, hook recall and room for vocals.",
  "Score each pair A, B, or no preference before revealing the key.",
  "The pack is MIDI, not Android preview audio or a proof of catchiness.",
  "No MIDI Arcade runtime song generation has been modified by this audition.",
].join("\n") + "\n");
console.log("HOOK_SHADOW_SUMMARY", JSON.stringify(report.totals));
