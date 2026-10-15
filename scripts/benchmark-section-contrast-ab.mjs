/**
 * Fixed-seed opt-in arrangement A/B. Writes a blind pair of standard MIDI files
 * for each eligible case, plus an answer key and a fully inspectable JSON audit.
 *
 * Usage:
 *  node scripts/benchmark-section-contrast-ab.mjs --genres hipHop,pop,rap,popRadio --seeds 2 --bars 32 --out "$RUNNER_TEMP/section-ab"
 */
import fs from "node:fs/promises";
import path from "node:path";
import {
  generateNew, encodeMidiVerified, evaluateSongCandidate, evaluateSongReleaseGate,
} from "../src/music-engine.js";
import { createArrangementCandidates } from "../src/core/arrangement-candidates.js";
import { evaluateArrangementActivityContrast } from "./lib/arrangement-activity.mjs";
import {
  inspectArrangementPair, inspectExportProjectionPair, blindSideFor,
} from "./lib/section-contrast-ab.mjs";

function option(name, fallback) {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
}
function positiveInt(value, label, max) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1 || n > max) throw Error(label + " must be 1.." + max);
  return n;
}
const allowed = new Set(["hipHop", "pop", "rap", "popRadio", "neoSoul", "funk", "synthwave", "house"]);
const genres = option("--genres", "hipHop,pop,rap,popRadio,funk,synthwave")
  .split(",").map(s => s.trim()).filter(Boolean);
if (!genres.length || genres.some(g => !allowed.has(g))) {
  throw Error("Invalid genres; allowed: " + [...allowed].join(","));
}
const seeds = positiveInt(option("--seeds", "2"), "--seeds", 6);
const bars = positiveInt(option("--bars", "32"), "--bars", 128);
const outDir = path.resolve(option("--out", "tmp/section-contrast-ab"));
await fs.mkdir(outDir, { recursive: true });

const report = {
  version: 1, purpose: "blind fixed-seed section support dynamics A/B",
  genres, seedsPerGenre: seeds, bars, totalCases: genres.length * seeds,
  baseline: "existing arrangement audition", experiment: "sectionContrastDynamics=true",
  results: [], exportedPairs: 0, candidateComparisons: 0, actualVelocityChanges: 0,
  regressionFlags: [],
  limitations: [
    "MIDI files are note instructions, not rendered audio. Assign the same sounds and levels in a DAW.",
    "This evaluates arrangement audition proposals, not a committed Android executor-selected song.",
    "Choose A/B listening preferences before opening answer-key.json.",
    "Matching MIDI output proves export authority, not perceptual superiority or device playback quality.",
    "Cases without adjacent verse-to-payoff sections may have zero eligible staging changes.",
  ],
};
const answerKey = [];
const summaryRows = [];

for (const genre of genres) {
  for (let i = 0; i < seeds; i++) {
    const seed = "section-ab-v1-" + genre + "-" + String(i + 1).padStart(2, "0");
    const config = {
      genre, seed, bars, key: "E", scale: "minor", candidateCount: 1,
      energy: 0.68, complexity: 0.62, variation: 0.62, evolution: 0.68,
      swing: 0.14, humanize: 0.12,
    };
    const song = generateNew(config);
    const afterGeneration = JSON.stringify((song.tracks ?? []).map(t => [t.id, t.notes]));
    const audition = { ...config, arrangementEvolution: true };
    const controls = createArrangementCandidates(song, {
      ...audition, sectionContrastDynamics: false,
    }, { maxCandidates: 3 });
    const treatments = createArrangementCandidates(song, {
      ...audition, sectionContrastDynamics: true,
    }, { maxCandidates: 3 });
    if (controls.length !== treatments.length || controls.length > 3) {
      throw Error("Three-candidate budget or audition count changed: " + seed);
    }
    const candidateRows = [];
    let selected = null;
    for (let index = 0; index < controls.length; index++) {
      const base = controls[index], treat = treatments[index];
      if (base.orderKey !== treat.orderKey || base.attemptIndex !== treat.attemptIndex) {
        throw Error("Opt-in changed arrangement identity or candidate order: " + seed);
      }
      const structural = inspectArrangementPair(base.song, treat.song);
      const exported = inspectExportProjectionPair(base.song, treat.song);
      const baselineCritic = evaluateSongCandidate(base.song);
      const experimentCritic = evaluateSongCandidate(treat.song);
      const baselineRelease = evaluateSongReleaseGate(base.song, baselineCritic);
      const experimentRelease = evaluateSongReleaseGate(treat.song, experimentCritic);
      const activityA = evaluateArrangementActivityContrast(base.song);
      const activityB = evaluateArrangementActivityContrast(treat.song);
      const result = {
        candidateIndex: index, attemptIndex: base.attemptIndex,
        arrangementFamily: base.evolution.family, sectionOrder: base.orderKey,
        noteCount: structural.noteCount,
        changedAuthoredVelocities: structural.changedNotes,
        changedExportedVelocities: exported.changedVelocities,
        baselineCriticScore: baselineCritic.score, experimentCriticScore: experimentCritic.score,
        criticDelta: Number((experimentCritic.score - baselineCritic.score).toFixed(3)),
        baselineRelease: baselineRelease.passed, experimentRelease: experimentRelease.passed,
        baselineActivityContrast: activityA.meanActivityContrast,
        experimentActivityContrast: activityB.meanActivityContrast,
        changes: structural.modified,
      };
      if (baselineRelease.passed && !experimentRelease.passed) {
        report.regressionFlags.push({ genre, seed, candidateIndex: index, code: "release-regression" });
      }
      if (structural.changedNotes > 0 && exported.changedVelocities === 0) {
        report.regressionFlags.push({ genre, seed, candidateIndex: index, code: "inaudible-midi-velocity" });
      }
      candidateRows.push(result);
      report.candidateComparisons += 1;
      report.actualVelocityChanges += exported.changedVelocities;
      // Stable unbiased selection: first existing candidate with an actual
      // MIDI change and both variants meeting release requirements.
      if (!selected && exported.changedVelocities > 0
          && baselineRelease.passed && experimentRelease.passed) {
        selected = { base, treat, result };
      }
    }
    if (JSON.stringify((song.tracks ?? []).map(t => [t.id, t.notes])) !== afterGeneration) {
      throw Error("Audition must not mutate the original generated song: " + seed);
    }
    const entry = { genre, seed, candidates: candidateRows, selection: selected?.result.candidateIndex ?? null };
    if (selected) {
      const caseId = "case-" + String(report.exportedPairs + 1).padStart(2, "0");
      const controlOutput = encodeMidiVerified(selected.base.song);
      const treatmentOutput = encodeMidiVerified(selected.treat.song);
      if (!controlOutput.audit?.passed || !treatmentOutput.audit?.passed) {
        throw Error("MIDI preview/export parity failed for " + seed);
      }
      const treatedSide = blindSideFor(seed);
      const controlSide = treatedSide === "A" ? "B" : "A";
      await fs.writeFile(path.join(outDir, caseId + "-" + controlSide + ".mid"), controlOutput.bytes);
      await fs.writeFile(path.join(outDir, caseId + "-" + treatedSide + ".mid"), treatmentOutput.bytes);
      answerKey.push({
        caseId, genre, seed, candidateIndex: selected.result.candidateIndex,
        treatmentSide: treatedSide, controlSide,
      });
      entry.listeningCase = caseId;
      entry.notesEdited = selected.result.changedAuthoredVelocities;
      entry.exportedVelocityEdits = selected.result.changedExportedVelocities;
      report.exportedPairs += 1;
    }
    report.results.push(entry);
    summaryRows.push({
      genre, seed, auditionCandidates: candidateRows.length,
      pairs: selected ? 1 : 0, MIDIChanged: selected?.result.changedExportedVelocities ?? 0,
    });
    console.log("SECTION_AB_CASE", JSON.stringify(summaryRows.at(-1)));
  }
}
await fs.writeFile(path.join(outDir, "report.json"), JSON.stringify(report, null, 2) + "\n");
await fs.writeFile(path.join(outDir, "answer-key.json"), JSON.stringify(answerKey, null, 2) + "\n");
await fs.writeFile(path.join(outDir, "READ_FIRST.txt"), [
  "MIDI ARCADE - BLIND SECTION CONTRAST LISTENING CASES",
  "",
  "Each case-NN-A.mid and case-NN-B.mid is a matched original/experiment MIDI pair.",
  "Do not open answer-key.json before recording your listening preference.",
  "Import each pair into the same DAW/instruments, use the same tempo, soundfont",
  "and identical master levels. Do not normalize variants separately.",
  "Listen to full verse -> chorus flow, support-vocal room, and perceived impact.",
  "Record A, B, or no preference for each case and note clicks/strange dynamics.",
  "MIDI contains no WAV audio; sound depends on your MIDI instrument setup.",
  "The script only exported cases where both audition candidates passed the",
  "existing release check and actual exported MIDI note velocities differed.",
  "Open report.json for full per-seed diagnostics; reveal answer-key.json last.",
  "",
].join("\n"));

console.log("SECTION_AB_SUMMARY", JSON.stringify({
  genres: genres.length, cases: report.totalCases, auditions: report.candidateComparisons,
  exportedPairs: report.exportedPairs, modifiedExportedVelocities: report.actualVelocityChanges,
  regressionFlags: report.regressionFlags, outDir,
}));
if (report.regressionFlags.length) {
  process.exitCode = 1; // Detect unsafe experiments without auto-changing release acceptance.
}
