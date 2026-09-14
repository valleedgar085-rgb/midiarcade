import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateSongCandidate,
  evaluateSongReleaseGate,
  generateNew,
} from "../src/music-engine.js";
import { createDensityRefinementCandidates } from "../src/core/density-refinement.js";
import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import { applySongOutputQualityPipeline } from "../src/core/output-quality-pipeline-register.js";

const SEEDS = ["quality-lab-01", "quality-lab-02", "quality-lab-03"];

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function round(value, digits = 3) {
  return Number(finite(value).toFixed(digits));
}

function creativeFloor(evaluation) {
  return Math.min(...Object.values(evaluation?.subscores ?? {}).map((value) => finite(value)));
}

function generationConfig(genre, seed) {
  return {
    ...applyOutputQualityEvolution({
      genre,
      seed: `${seed}:${genre}`,
      bars: 16,
      candidateCount: 1,
    }, { kind: "new" }),
    phraseResolutionRefinement: true,
    registerHealthRefinement: true,
    genreIdentityRefinement: false,
  };
}

function baseBeforeDensity(genre, seed) {
  const config = generationConfig(genre, seed);
  const generated = generateNew(config);
  const processed = applySongOutputQualityPipeline(generated, {
    ...config,
    densityRefinement: false,
    phraseResolutionRefinement: false,
    registerHealthRefinement: false,
  });
  return { config, generated, song: processed.song };
}

function signatureSummary(signatures) {
  const populated = signatures.filter(Boolean);
  const uniqueRatio = new Set(populated).size / Math.max(1, populated.length);
  const adjacentCopies = populated.slice(1)
    .filter((signature, index) => signature === populated[index]).length / Math.max(1, populated.length - 1);
  const duplicateGroups = Object.entries(signatures.reduce((groups, signature, bar) => {
    if (!signature) return groups;
    (groups[signature] ??= []).push(bar);
    return groups;
  }, {}))
    .filter(([, barIndexes]) => barIndexes.length > 1)
    .map(([, barIndexes]) => barIndexes);
  return {
    uniqueRatio: round(uniqueRatio),
    adjacentCopies: round(adjacentCopies),
    uniqueBars: new Set(populated).size,
    populatedBars: populated.length,
    duplicateGroups,
  };
}

function drumBarMetrics(song) {
  const drums = song.tracks.find((track) => track.id === "drums")?.notes ?? [];
  const barBeats = finite(song.meta?.beatsPerBar, 4);
  const bars = Math.max(1, Math.round(finite(song.meta?.bars, song.bars ?? 1)));
  const signatures = Array.from({ length: bars }, (_, bar) => drums
    .filter((note) => Math.floor(finite(note.start) / barBeats) === bar)
    .map((note) => `${note.pitch}:${round(((finite(note.start) % barBeats) + barBeats) % barBeats, 4)}`)
    .join("|"));
  const counts = Array.from({ length: bars }, (_, bar) => drums.filter((note) => Math.floor(finite(note.start) / barBeats) === bar).length);
  return {
    ...signatureSummary(signatures),
    avgHitsPerBar: round(counts.reduce((sum, count) => sum + count, 0) / bars),
    minHits: Math.min(...counts),
    maxHits: Math.max(...counts),
  };
}

function drumSkeletonMetrics(song, step) {
  const drums = song.tracks.find((track) => track.id === "drums")?.notes ?? [];
  const barBeats = finite(song.meta?.beatsPerBar, 4);
  const bars = Math.max(1, Math.round(finite(song.meta?.bars, song.bars ?? 1)));
  const signatures = Array.from({ length: bars }, (_, bar) => drums
    .filter((note) => Math.floor(finite(note.start) / barBeats) === bar)
    .map((note) => {
      const local = ((finite(note.start) % barBeats) + barBeats) % barBeats;
      const quantized = Math.round(local / step) * step;
      return `${note.pitch}:${round(quantized, 4)}`;
    })
    .sort()
    .join("|"));
  return { step: round(step, 5), ...signatureSummary(signatures) };
}

function evaluationSummary(song) {
  const evaluation = evaluateSongCandidate(song);
  const release = evaluateSongReleaseGate(song, evaluation);
  return {
    score: evaluation.score,
    floor: creativeFloor(evaluation),
    density: evaluation.subscores.density,
    groove: evaluation.subscores.groove,
    drumVariety: evaluation.subscores.drumVariety,
    performance: evaluation.subscores.performance,
    repetition: evaluation.subscores.repetition,
    motif: evaluation.subscores.motif,
    memory: evaluation.subscores.memory,
    separation: evaluation.subscores.separation,
    production: evaluation.subscores.production,
    genreAuthenticity: evaluation.subscores.genreAuthenticity,
    scaleFit: round(evaluation.diagnostics?.scaleFit),
    releasePassed: Boolean(release.passed),
  };
}

function clone(value) {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

function sectionsOf(song) {
  return Array.isArray(song?.structure) ? song.structure : Array.isArray(song?.sections) ? song.sections : [];
}

function sectionStart(section) {
  return finite(section?.startBeat, finite(section?.start, 0));
}

function sectionEnd(section) {
  return finite(section?.endBeat, sectionStart(section) + finite(section?.bars, 0) * 4);
}

function sectionName(section) {
  return String(section?.name ?? section?.type ?? "idea").toLowerCase().replace(/[^a-z]+/g, "");
}

function sectionPairs(song) {
  const sections = sectionsOf(song);
  const byId = new Map(sections.map((section) => [String(section.id), section]));
  const pairs = (Array.isArray(song?.memoryMap) ? song.memoryMap : [])
    .filter((entry) => ["recall", "return"].includes(String(entry?.relationship)))
    .map((entry) => ({ origin: byId.get(String(entry.originSectionId)), target: byId.get(String(entry.sectionId)) }))
    .filter(({ origin, target }) => origin && target && origin !== target);
  if (pairs.length) return pairs;
  const first = new Map();
  const fallback = [];
  for (const section of sections) {
    const name = sectionName(section);
    if (!first.has(name)) first.set(name, section);
    else fallback.push({ origin: first.get(name), target: section });
  }
  return fallback;
}

function protectedDrumNote(note) {
  return Boolean(
    note?.drumFillId
    || note?.transitionFeature
    || note?.transitionHandoffRole
    || note?.transitionHandoffId
    || String(note?.rhythmicFeature ?? "").includes("fill")
    || String(note?.rhythmicFeature ?? "").includes("roll")
  );
}

function drumNotesForBar(song, bar) {
  const barBeats = finite(song?.meta?.beatsPerBar, 4);
  return (song.tracks.find((track) => track.id === "drums")?.notes ?? [])
    .filter((note) => Math.floor(finite(note.start) / barBeats) === bar);
}

function protectedDrumBar(song, bar) {
  const barBeats = finite(song?.meta?.beatsPerBar, 4);
  const bars = Math.max(1, Math.round(finite(song?.meta?.bars, song?.bars ?? 1)));
  if (bar <= 0 || bar >= bars - 1) return true;
  if (drumNotesForBar(song, bar).some(protectedDrumNote)) return true;
  return sectionsOf(song).some((section) => {
    const first = Math.floor(sectionStart(section) / barBeats + 1e-6);
    const last = Math.max(first, Math.ceil(sectionEnd(section) / barBeats - 1e-6) - 1);
    return bar === first || bar === last;
  });
}

function copyDrumBar(song, sourceBar, targetBar) {
  if (Math.abs(sourceBar - targetBar) <= 1 || protectedDrumBar(song, sourceBar) || protectedDrumBar(song, targetBar)) return false;
  const drums = song.tracks.find((track) => track.id === "drums");
  const barBeats = finite(song.meta?.beatsPerBar, 4);
  const sourceNotes = drumNotesForBar(song, sourceBar);
  if (sourceNotes.length < 4) return false;
  const targetNotes = drumNotesForBar(song, targetBar);
  const targetSet = new Set(targetNotes);
  const delta = (targetBar - sourceBar) * barBeats;
  drums.notes = drums.notes.filter((note) => !targetSet.has(note));
  drums.notes.push(...sourceNotes.map((note) => ({
    ...clone(note),
    start: round(finite(note.start) + delta, 6),
    genreMemoryRole: "jazz-groove-recall",
  })));
  drums.notes.sort((left, right) => finite(left.start) - finite(right.start) || finite(left.pitch) - finite(right.pitch));
  return true;
}

function jazzRecallCandidate(sourceSong, barLimit) {
  const song = clone(sourceSong);
  const barBeats = finite(song?.meta?.beatsPerBar, 4);
  let changedBars = 0;
  for (const { origin, target } of sectionPairs(song)) {
    const originStart = Math.floor(sectionStart(origin) / barBeats + 1e-6);
    const targetStart = Math.floor(sectionStart(target) / barBeats + 1e-6);
    const span = Math.min(
      Math.max(0, Math.ceil((sectionEnd(origin) - sectionStart(origin)) / barBeats)),
      Math.max(0, Math.ceil((sectionEnd(target) - sectionStart(target)) / barBeats)),
    );
    for (let offset = 0; offset < span && changedBars < barLimit; offset += 1) {
      if (copyDrumBar(song, originStart + offset, targetStart + offset)) changedBars += 1;
    }
    if (changedBars >= barLimit) break;
  }
  return { song, changedBars };
}

test("Jazz fixed seeds separate literal drum-variety score from structural groove memory", () => {
  const rows = [];
  for (const seed of SEEDS) {
    const config = generationConfig("jazz", seed);
    const generated = generateNew(config);
    const processed = applySongOutputQualityPipeline(generated, config);
    const song = processed.song;
    rows.push({
      seed,
      evaluation: evaluationSummary(song),
      drums: drumBarMetrics(song),
      skeleton12: drumSkeletonMetrics(song, 1 / 12),
      skeleton8: drumSkeletonMetrics(song, 1 / 8),
      skeleton4: drumSkeletonMetrics(song, 1 / 4),
    });
  }
  console.log("JAZZ_DRUM_MEMORY_CALIBRATION", JSON.stringify(rows));
  assert.equal(rows.length, 3);
  assert.ok(rows.every((row) => row.evaluation.releasePassed && row.evaluation.scaleFit === 1));
  assert.ok(rows.every((row) => row.drums.uniqueRatio === 1));
});

test("Jazz bounded non-adjacent return-groove recall improves memory-shaped drum variety without touching other tracks", () => {
  const rows = [];
  for (const seed of SEEDS) {
    const config = generationConfig("jazz", seed);
    const generated = generateNew(config);
    const before = applySongOutputQualityPipeline(generated, config).song;
    const beforeEval = evaluationSummary(before);
    const beforeNonDrums = before.tracks.filter((track) => track.id !== "drums");
    const candidates = [1, 2, 4].map((barLimit) => {
      const candidate = jazzRecallCandidate(before, barLimit);
      const afterEval = evaluationSummary(candidate.song);
      const drums = drumBarMetrics(candidate.song);
      assert.deepEqual(candidate.song.tracks.filter((track) => track.id !== "drums"), beforeNonDrums);
      assert.equal(drums.adjacentCopies, 0);
      return {
        barLimit,
        changedBars: candidate.changedBars,
        ...afterEval,
        uniqueRatio: drums.uniqueRatio,
        duplicateGroups: drums.duplicateGroups,
        scoreDelta: round(afterEval.score - beforeEval.score, 2),
        floorDelta: round(afterEval.floor - beforeEval.floor, 2),
        drumVarietyDelta: round(afterEval.drumVariety - beforeEval.drumVariety, 2),
        grooveDelta: round(afterEval.groove - beforeEval.groove, 2),
        performanceDelta: round(afterEval.performance - beforeEval.performance, 2),
        authenticityDelta: round(afterEval.genreAuthenticity - beforeEval.genreAuthenticity, 2),
      };
    });
    rows.push({ seed, before: beforeEval, candidates });
  }
  console.log("JAZZ_DRUM_RECALL_CANDIDATES", JSON.stringify(rows));
  assert.ok(rows.every((row) => row.candidates.some((candidate) => candidate.changedBars > 0 && candidate.drumVarietyDelta > 0)));
  assert.ok(rows.every((row) => row.candidates.every((candidate) => candidate.releasePassed && candidate.scaleFit === 1)));
});

test("Funk fixed seeds expose the protected dimension behind rejected deep density candidates", () => {
  const rows = [];
  for (const seed of SEEDS) {
    const { config, generated, song: before } = baseBeforeDensity("funk", seed);
    const beforeEval = evaluateSongCandidate(before);
    const candidates = createDensityRefinementCandidates(before, {
      densityTarget: beforeEval.diagnostics?.densityTarget,
    });
    const pipeline = applySongOutputQualityPipeline(generated, {
      ...config,
      phraseResolutionRefinement: false,
      registerHealthRefinement: false,
    });
    const beforeSummary = evaluationSummary(before);
    rows.push({
      seed,
      pipeline: {
        accepted: Boolean(pipeline.densityDiagnostics?.accepted),
        id: pipeline.densityDiagnostics?.id ?? null,
        reason: pipeline.densityDiagnostics?.reason ?? null,
      },
      before: beforeSummary,
      candidates: candidates.map((candidate) => {
        const after = evaluationSummary(candidate.song);
        return {
          id: candidate.id,
          changedNotes: candidate.changedNotes,
          beforeNotesPerBar: candidate.beforeNotesPerBar,
          afterNotesPerBar: candidate.afterNotesPerBar,
          densityErrorDelta: candidate.densityErrorDelta,
          ...after,
          scoreDelta: round(after.score - beforeSummary.score, 2),
          floorDelta: round(after.floor - beforeSummary.floor, 2),
          densityDelta: round(after.density - beforeSummary.density, 2),
          grooveDelta: round(after.groove - beforeSummary.groove, 2),
          drumVarietyDelta: round(after.drumVariety - beforeSummary.drumVariety, 2),
          performanceDelta: round(after.performance - beforeSummary.performance, 2),
          repetitionDelta: round(after.repetition - beforeSummary.repetition, 2),
          motifDelta: round(after.motif - beforeSummary.motif, 2),
          memoryDelta: round(after.memory - beforeSummary.memory, 2),
          separationDelta: round(after.separation - beforeSummary.separation, 2),
          productionDelta: round(after.production - beforeSummary.production, 2),
          authenticityDelta: round(after.genreAuthenticity - beforeSummary.genreAuthenticity, 2),
        };
      }),
    });
  }
  console.log("FUNK_DENSITY_REJECTION_CALIBRATION", JSON.stringify(rows));
  assert.equal(rows.length, 3);
  assert.ok(rows.every((row) => row.before.releasePassed && row.before.scaleFit === 1));
  assert.ok(rows.every((row) => row.candidates.every((candidate) => candidate.releasePassed && candidate.scaleFit === 1)));
});