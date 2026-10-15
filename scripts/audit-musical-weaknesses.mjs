/**
 * Development-only, read-only musical weakness census.
 *
 * Exercise existing generator and existing critics. Never adjust musical notes
 * or modify MIDI Arcade's generation, preview, quality thresholds, or build.
 *
 * Usage:
 *   node scripts/audit-musical-weaknesses.mjs --seeds 2 --bars 32 --json /tmp/music-audit.json
 *   node scripts/audit-musical-weaknesses.mjs --genres pop,hipHop,trap --seeds 2 --bars 32
 */
import fs from "node:fs/promises";
import path from "node:path";
import {
  GENRE_PROFILES, evaluateSongCandidate, evaluateSongReleaseGate, generateNew,
} from "../src/music-engine.js";
import { PHASE5_DIMENSION_FLOORS } from "../src/generation-benchmark.js";
import { evaluateChorusHookRecurrence } from "../src/core/chorus-hook-recurrence.js";
import { evaluateMelodyPhraseIntelligence } from "../src/core/melody-phrase-intelligence.js";
import { evaluateMelodySectionMemory } from "../src/core/melody-section-memory.js";
import { evaluateEnsembleCoordinationAuthority } from "../src/core/ensemble-coordination-authority.js";
import { analyzeTonalIntegrity } from "../src/core/tonal-integrity.js";

const allGenres = Object.keys(GENRE_PROFILES);
function flag(name, fallback) {
  const index = process.argv.indexOf(name);
  return index < 0 ? fallback : process.argv[index + 1];
}
function positiveInteger(input, name, max) {
  const value = Number(input);
  if (!Number.isSafeInteger(value) || value <= 0 || value > max) {
    throw Error(name + " must be a positive integer no larger than " + max);
  }
  return value;
}
const seedCount = positiveInteger(flag("--seeds", "2"), "--seeds", 12);
const bars = positiveInteger(flag("--bars", "32"), "--bars", 128);
const genreFilter = flag("--genres", null);
const genres = genreFilter ? genreFilter.split(",").map((name) => name.trim()).filter(Boolean) : allGenres;
if (!genres.length || genres.some((genre) => !allGenres.includes(genre))) {
  throw Error("Unknown genre in --genres. Choices: " + allGenres.join(", "));
}
const jsonPath = flag("--json", null);

const round = (value, digits = 3) => Number(Number(value).toFixed(digits));
const rows = [];
const issues = [];
const add = (genre, seed, family, code, status, value, context = {}) => {
  issues.push({ genre, seed, family, code, status, value, ...context });
};

for (const genre of genres) {
  for (let index = 0; index < seedCount; index += 1) {
    const seed = "census-" + String(index + 1).padStart(2, "0") + "-" + genre;
    // generateNew is the same seedable engine function used by existing
    // observation tests; this is NOT a substitute for UI/executor/device tests.
    const song = generateNew({
      genre, seed, key: "E", scale: "minor", bars,
      energy: 0.68, complexity: 0.62, variation: 0.62,
      evolution: 0.68, swing: 0.14, humanize: 0.12,
    });
    const originalNotes = JSON.stringify((song.tracks ?? []).map((track) => [track.id, track.notes]));
    const hook = evaluateChorusHookRecurrence(song);
    const phrase = evaluateMelodyPhraseIntelligence(song);
    const memory = evaluateMelodySectionMemory(song);
    const ensemble = evaluateEnsembleCoordinationAuthority(song);
    const tonal = analyzeTonalIntegrity(
      song.tracks ?? [], song.harmony ?? [], song.meta ?? {}, song.structure ?? [],
    );
    const candidate = evaluateSongCandidate(song);
    const gate = evaluateSongReleaseGate(song, candidate);
    const notesAfter = JSON.stringify((song.tracks ?? []).map((track) => [track.id, track.notes]));
    if (notesAfter !== originalNotes) {
      throw Error("Read-only audit unexpectedly modified note events for " + genre + "/" + seed);
    }
    const dimensions = Object.entries(candidate.subscores ?? {})
      .filter(([, value]) => Number.isFinite(Number(value)))
      .map(([name, score]) => ({ name, score: round(score, 1) }))
      .sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
    const floorBreaches = dimensions
      .filter(({ name, score }) => PHASE5_DIMENSION_FLOORS[name] != null
        && score < PHASE5_DIMENSION_FLOORS[name])
      .map(({ name, score }) => ({ name, score, floor: PHASE5_DIMENSION_FLOORS[name] }));

    const result = {
      genre, seed, bars: song.meta?.bars ?? bars,
      musicalScore: round(candidate.score ?? 0, 1),
      releasePassed: Boolean(gate.passed),
      releaseFailures: gate.failures ?? [],
      weakestDimensions: dimensions.slice(0, 5),
      floorBreaches,
      hook: {
        status: hook.status, passed: hook.passed, score: hook.score,
        reason: hook.reason,
        comparisons: (hook.comparisons ?? []).map((item) => ({
          sectionId: item.sectionId, windowBars: item.windowBars,
          available: item.available, score: item.score ?? null,
          rhythm: item.rhythm ?? null, contour: item.contour ?? null,
          onsetDiagnosis: item.onsetDiagnosis ?? item.reason ?? null,
          literalRepeat: item.literalRepeat ?? null,
        })),
        verses: hook.verses ?? [],
      },
      phrase: {
        passed: phrase.passed, score: phrase.score, reason: phrase.reason,
        weakestSection: phrase.weakestSection, sections: phrase.sections,
      },
      sectionMemory: {
        status: memory.status, passed: memory.passed, score: memory.score,
        reason: memory.reason, weakestSection: memory.weakestSection,
      },
      ensemble: {
        passed: ensemble.passed, score: ensemble.score, reason: ensemble.reason,
        metrics: ensemble.metrics, weakestSection: ensemble.weakestSection?.sectionId ?? null,
      },
      tonal: {
        scaleFit: tonal.scaleFit, strongChordFit: tonal.strongChordFit,
        harshStrongNotes: tonal.harshStrongNotes,
        selectedTonicAlignment: tonal.selectedTonicAlignment,
      },
    };
    rows.push(result);
    if (!gate.passed) add(genre, seed, "technical", "release-gate", "contract", gate.failures);
    if (tonal.scaleFit < 1) add(genre, seed, "harmony", "scale-fit", "contract", tonal.scaleFit);
    if (tonal.harshStrongNotes > 0) add(genre, seed, "harmony", "harsh-strong-notes", "review", tonal.harshStrongNotes);
    for (const breach of floorBreaches) {
      add(genre, seed, "critic", "dimension-below-floor", "heuristic", breach.score,
        { dimension: breach.name, floor: breach.floor });
    }
    if (hook.status === "evaluated" && hook.passed === false) {
      add(genre, seed, "hooks", "weak-chorus-return", "heuristic", hook.score);
    } else if (hook.status !== "evaluated") {
      add(genre, seed, "coverage", "hook-not-fully-evaluable", "unknown", hook.reason);
    }
    if (phrase.reason === "melody-phrase-weak") {
      add(genre, seed, "phrasing", "weak-melody-phrase", "heuristic", phrase.score,
        { section: phrase.weakestSection?.sectionId ?? null });
    } else if (phrase.reason === "melody-inactive") {
      add(genre, seed, "coverage", "melody-inactive", "unknown", phrase.reason);
    }
    if (memory.status === "evaluated" && memory.passed === false) {
      add(genre, seed, "development", "weak-section-memory", "heuristic", memory.score,
        { reason: memory.reason, section: memory.weakestSection?.sectionId ?? null });
    } else if (memory.status !== "evaluated") {
      add(genre, seed, "coverage", "section-memory-unavailable", "unknown", memory.reason);
    }
    if (!ensemble.passed) {
      add(genre, seed, "ensemble", "ensemble-critic-failed", "heuristic", ensemble.score,
        { section: ensemble.weakestSection?.sectionId ?? null });
    }
    if (ensemble.metrics?.allLayersAlwaysOn) {
      add(genre, seed, "arrangement", "all-layers-always-on", "heuristic", true);
    }
    // These are investigation thresholds, never release blockers.
    const positiveSignals = ["rhythmFoundation", "leadDialogue", "callResponseTiming",
      "phraseSeparation", "leadHarmonySeparation", "supportRestraint",
      "sectionRoleEvolution", "arrangementBreathingRoom", "bassIndependence"];
    const negativeSignals = ["kickBassCloneRatio", "melodyChordCrowding",
      "leadPhraseOverlap", "supportForegroundOverlap"];
    for (const signal of positiveSignals) {
      const value = ensemble.metrics?.[signal];
      if (typeof value === "number" && value < 0.58) {
        add(genre, seed, "ensemble", "weak-" + signal, "heuristic", value);
      }
    }
    for (const signal of negativeSignals) {
      const value = ensemble.metrics?.[signal];
      if (typeof value === "number" && value > 0.42) {
        add(genre, seed, "ensemble", "excess-" + signal, "heuristic", value);
      }
    }
  }
}
const sortIssues = (a, b) => a.genre.localeCompare(b.genre)
  || a.family.localeCompare(b.family) || a.code.localeCompare(b.code)
  || a.seed.localeCompare(b.seed);
issues.sort(sortIssues);
const genresSummary = genres.map((genre) => {
  const sampleRows = rows.filter((item) => item.genre === genre);
  const genreIssues = issues.filter((item) => item.genre === genre);
  const byIssue = Object.entries(genreIssues.reduce((counts, item) => {
    const id = item.family + "/" + item.code;
    counts[id] = (counts[id] ?? 0) + 1;
    return counts;
  }, {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return {
    genre, samples: sampleRows.length,
    lowestMusicalScore: Math.min(...sampleRows.map((item) => item.musicalScore)),
    averageMusicalScore: round(sampleRows.reduce((n, item) => n + item.musicalScore, 0) / sampleRows.length, 1),
    releaseGateFailures: sampleRows.filter((item) => !item.releasePassed).length,
    weakHookReturns: sampleRows.filter((item) => item.hook.status === "evaluated" && item.hook.passed === false).length,
    hookUnavailableOrIncomplete: sampleRows.filter((item) => item.hook.status !== "evaluated").length,
    phraseFailures: sampleRows.filter((item) => item.phrase.reason === "melody-phrase-weak").length,
    memoryFailures: sampleRows.filter((item) => item.sectionMemory.status === "evaluated" && !item.sectionMemory.passed).length,
    ensembleFailures: sampleRows.filter((item) => !item.ensemble.passed).length,
    findingsByCategory: byIssue,
  };
});
const result = {
  schema: "midi-arcade-developer-musical-weakness-census-v1",
  mode: "read-only",
  source: "generateNew + existing project critics, not physical-device listening",
  genres: [...genres], seedCount, requestedBars: bars, sampleCount: rows.length,
  caveats: [
    "Heuristic critic failures do not by themselves prove a song sounds bad.",
    "A missing/short chorus makes hook-return measurement unavailable, not failed.",
    "Unmeasured vocal tracks mean verse lead-rest metrics only approximate possible rap space.",
    "Samples are generated with fixed energy/complexity/variation; other knob settings can behave differently.",
    "This tests generateNew, not the entire Android UI/executor/candidate selection path.",
    "No audio was rendered or listened to; synthesis and device performance need a separate audit.",
  ],
  summary: genresSummary,
  issues,
  results: rows,
};
for (const item of genresSummary) {
  console.log("MUSIC_CENSUS_GENRE", JSON.stringify({
    genre: item.genre, samples: item.samples,
    averageMusicalScore: item.averageMusicalScore,
    releaseGateFailures: item.releaseGateFailures,
    weakHookReturns: item.weakHookReturns,
    hookUnavailableOrIncomplete: item.hookUnavailableOrIncomplete,
    phraseFailures: item.phraseFailures,
    memoryFailures: item.memoryFailures,
    ensembleFailures: item.ensembleFailures,
    topFindings: item.findingsByCategory.slice(0, 12),
  }));
}
console.log("MUSIC_CENSUS_SUMMARY", JSON.stringify({
  genres: genres.length, sampleCount: rows.length, totalFindings: issues.length,
  contractFindings: issues.filter((item) => item.status === "contract").length,
  heuristicFindings: issues.filter((item) => item.status === "heuristic").length,
  unknownCoverage: issues.filter((item) => item.status === "unknown").length,
}));
if (jsonPath) {
  const target = path.resolve(jsonPath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, JSON.stringify(result, null, 2) + "\n", "utf8");
  console.log("MUSIC_CENSUS_REPORT", target);
}
