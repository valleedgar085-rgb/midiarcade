import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateSongCandidate,
  evaluateSongReleaseGate,
  generateNew,
} from "../src/music-engine.js";
import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import { applySongOutputQualityPipeline } from "../src/core/output-quality-pipeline-register.js";

const SEEDS = ["quality-lab-01", "quality-lab-02", "quality-lab-03"];
const REQUESTED_SPLITS = [4, 8, 16];
const IDS = ["light-kick-response", "balanced-kick-response", "full-kick-response"];
const RESPONSE_OFFSETS = [0, 0.5];
const MIN_FRAGMENT = 0.18;

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function round(value, digits = 4) {
  return Number(finite(value).toFixed(digits));
}

function barsFor(song) {
  return Math.max(1, Math.round(finite(song?.meta?.bars, song?.bars ?? 1)));
}

function track(song, id) {
  return song.tracks.find((entry) => entry.id === id);
}

function pitchedNotesPerBar(song) {
  const count = song.tracks
    .filter((entry) => entry.id !== "drums")
    .reduce((sum, entry) => sum + (entry.notes?.length ?? 0), 0);
  return count / barsFor(song);
}

function protectedBassNote(note) {
  return Boolean(
    note?.resolutionRole
    || note?.memoryRole
    || note?.transitionRole
    || note?.cadenceRole
    || note?.hookRole
    || note?.rhythmTurnaroundRole
    || note?.phraseRole === "landing"
    || note?.preserveTiming
    || note?.motifHandoffRole
  );
}

function kickStarts(song) {
  return (track(song, "drums")?.notes ?? [])
    .filter((note) => note.pitch === 35 || note.pitch === 36)
    .map((note) => finite(note.start));
}

function responseTargets(song) {
  return [...new Set(kickStarts(song)
    .flatMap((start) => RESPONSE_OFFSETS.map((delay) => round(start + delay)))
    .map((value) => value.toFixed(4)))]
    .map(Number)
    .sort((a, b) => a - b);
}

function splitPlan(song) {
  const bass = track(song, "bass")?.notes ?? [];
  const existingOnsets = bass.map((note) => finite(note.start));
  const targets = responseTargets(song);
  return bass
    .map((note, noteIndex) => {
      if (protectedBassNote(note) || finite(note.duration) < MIN_FRAGMENT * 2) return null;
      const start = finite(note.start);
      const end = start + finite(note.duration);
      const target = targets.find((candidate) => (
        candidate >= start + MIN_FRAGMENT
        && candidate <= end - MIN_FRAGMENT
        && !existingOnsets.some((onset) => Math.abs(onset - candidate) <= 0.075)
      ));
      return target == null ? null : { noteIndex, note, target };
    })
    .filter(Boolean)
    .sort((left, right) => (
      finite(right.note.duration) - finite(left.note.duration)
      || left.target - right.target
      || left.noteIndex - right.noteIndex
    ));
}

function splitAtResponse(note, target, index) {
  const start = finite(note.start);
  const end = start + finite(note.duration);
  const sourceDuration = round(end - start);
  const firstDuration = round(target - start);
  const secondDuration = round(sourceDuration - firstDuration);
  const sourceId = String(note.id ?? `bass-${start}-${finite(note.pitch)}`);
  return [
    {
      ...note,
      id: `${sourceId}:dnb-response-a-${index}`,
      duration: firstDuration,
      densityRefinementRole: "dnb-kick-response",
    },
    {
      ...note,
      id: `${sourceId}:dnb-response-b-${index}`,
      start: round(target),
      duration: secondDuration,
      densityRefinementRole: "dnb-kick-response",
    },
  ];
}

function articulate(song, requestedCount) {
  const candidate = structuredClone(song);
  const selectedPlans = splitPlan(candidate).slice(0, requestedCount);
  const replacements = new Map(selectedPlans.map((plan, index) => [
    plan.noteIndex,
    splitAtResponse(plan.note, plan.target, index),
  ]));
  const bass = track(candidate, "bass");
  bass.notes = bass.notes.flatMap((note, noteIndex) => replacements.get(noteIndex) ?? [note]);
  bass.notes.sort((a, b) => finite(a.start) - finite(b.start) || finite(a.pitch) - finite(b.pitch));
  return { song: candidate, changedNotes: selectedPlans.length, targets: selectedPlans.map((plan) => plan.target) };
}

function durationByPitch(song) {
  const totals = new Map();
  for (const note of track(song, "bass")?.notes ?? []) {
    totals.set(note.pitch, round((totals.get(note.pitch) ?? 0) + finite(note.duration)));
  }
  return [...totals.entries()].sort((a, b) => a[0] - b[0]);
}

function pitchSet(song) {
  return [...new Set((track(song, "bass")?.notes ?? []).map((note) => note.pitch))].sort((a, b) => a - b);
}

function creativeFloor(evaluation) {
  return Math.min(...Object.values(evaluation.subscores ?? {}).map((value) => finite(value)));
}

function evalSummary(song) {
  const evaluation = evaluateSongCandidate(song);
  const release = evaluateSongReleaseGate(song, evaluation);
  return {
    score: evaluation.score,
    floor: creativeFloor(evaluation),
    density: evaluation.subscores.density,
    groove: evaluation.subscores.groove,
    performance: evaluation.subscores.performance,
    repetition: evaluation.subscores.repetition,
    authenticity: evaluation.subscores.genreAuthenticity,
    notesPerBar: round(pitchedNotesPerBar(song), 3),
    bassNotesPerBar: round((track(song, "bass")?.notes.length ?? 0) / barsFor(song), 3),
    bassKickLock: round(evaluation.diagnostics?.bassKickLock, 3),
    measuredSyncopation: round(evaluation.diagnostics?.measuredSyncopation, 3),
    syncopationTarget: round(evaluation.diagnostics?.syncopationTarget, 3),
    bassLockTarget: round(evaluation.diagnostics?.bassLockTarget, 3),
    scaleFit: round(evaluation.diagnostics?.scaleFit, 3),
    releasePassed: Boolean(release.passed),
  };
}

test("DnB kick-response splits measure density without sacrificing the critic's pocket contract", () => {
  const rows = [];

  for (const seed of SEEDS) {
    const config = {
      ...applyOutputQualityEvolution({
        genre: "drumBass",
        seed: `${seed}:drumBass`,
        bars: 16,
        candidateCount: 1,
      }, { kind: "new" }),
      phraseResolutionRefinement: true,
      registerHealthRefinement: true,
    };
    const generated = generateNew(config);
    const before = applySongOutputQualityPipeline(generated, {
      ...config,
      densityRefinement: false,
      phraseResolutionRefinement: false,
      registerHealthRefinement: false,
    }).song;
    const beforeSummary = evalSummary(before);
    const beforeDurations = durationByPitch(before);
    const beforePitches = pitchSet(before);
    const plans = splitPlan(before);

    const candidates = REQUESTED_SPLITS.map((requestedCount, index) => {
      const articulated = articulate(before, requestedCount);
      assert.deepEqual(pitchSet(articulated.song), beforePitches);
      assert.deepEqual(durationByPitch(articulated.song), beforeDurations);
      for (const sourceTrack of before.tracks) {
        if (sourceTrack.id === "bass") continue;
        assert.deepEqual(track(articulated.song, sourceTrack.id), sourceTrack, `${sourceTrack.id} must remain exact`);
      }
      assert.ok(articulated.targets.every((target) => responseTargets(before).some((response) => Math.abs(response - target) < 1e-6)));
      const summary = evalSummary(articulated.song);
      return {
        id: IDS[index],
        requestedCount,
        changedNotes: articulated.changedNotes,
        ...summary,
        scoreDelta: round(summary.score - beforeSummary.score, 2),
        floorDelta: round(summary.floor - beforeSummary.floor, 2),
        densityDelta: round(summary.density - beforeSummary.density, 2),
        grooveDelta: round(summary.groove - beforeSummary.groove, 2),
        bassKickLockDelta: round(summary.bassKickLock - beforeSummary.bassKickLock, 3),
        authenticityDelta: round(summary.authenticity - beforeSummary.authenticity, 2),
      };
    });

    rows.push({
      seed,
      eligibleResponseSplits: plans.length,
      before: beforeSummary,
      candidates,
    });
  }

  console.log("DNB_KICK_RESPONSE_ARTICULATION_CALIBRATION", JSON.stringify(rows));
  assert.equal(rows.length, 3);
  assert.ok(rows.every((row) => row.before.releasePassed && row.before.scaleFit === 1));
  assert.ok(rows.every((row) => row.candidates.every((candidate) => candidate.releasePassed && candidate.scaleFit === 1)));
});
