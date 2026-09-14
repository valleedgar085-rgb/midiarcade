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
const SPLIT_COUNTS = [4, 8, 16];
const IDS = ["light-bass-articulation", "balanced-bass-articulation", "full-bass-articulation"];

function finite(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function round(value, digits = 3) {
  return Number(finite(value).toFixed(digits));
}

function clone(value) {
  return structuredClone(value);
}

function bassTrack(song) {
  return song.tracks.find((track) => track.id === "bass");
}

function barsFor(song) {
  return Math.max(1, Math.round(finite(song?.meta?.bars, song?.bars ?? 1)));
}

function pitchedNotesPerBar(song) {
  const count = song.tracks
    .filter((track) => track.id !== "drums")
    .reduce((sum, track) => sum + (track.notes?.length ?? 0), 0);
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
  );
}

function eligibleBassNotes(song) {
  return (bassTrack(song)?.notes ?? [])
    .map((note, noteIndex) => ({ note, noteIndex }))
    .filter(({ note }) => finite(note.duration) >= 0.75 && !protectedBassNote(note))
    .sort((left, right) => (
      finite(right.note.duration) - finite(left.note.duration)
      || finite(left.note.start) - finite(right.note.start)
      || finite(left.note.pitch) - finite(right.note.pitch)
      || left.noteIndex - right.noteIndex
    ));
}

function splitBassNote(note, splitIndex) {
  const duration = finite(note.duration);
  const firstDuration = round(duration / 2, 4);
  const secondDuration = round(duration - firstDuration, 4);
  const start = finite(note.start);
  const id = String(note.id ?? `bass-${start}-${finite(note.pitch)}`);
  return [
    {
      ...note,
      id: `${id}:dnb-density-a-${splitIndex}`,
      duration: firstDuration,
      densityRefinementRole: "dnb-bass-articulation",
    },
    {
      ...note,
      id: `${id}:dnb-density-b-${splitIndex}`,
      start: round(start + firstDuration, 4),
      duration: secondDuration,
      densityRefinementRole: "dnb-bass-articulation",
    },
  ];
}

function articulateBass(song, requestedCount) {
  const candidate = clone(song);
  const eligible = eligibleBassNotes(candidate).slice(0, requestedCount);
  const selected = new Map(eligible.map((entry, index) => [entry.noteIndex, splitBassNote(entry.note, index)]));
  const bass = bassTrack(candidate);
  bass.notes = bass.notes.flatMap((note, noteIndex) => selected.get(noteIndex) ?? [note]);
  bass.notes.sort((a, b) => finite(a.start) - finite(b.start) || finite(a.pitch) - finite(b.pitch));
  return { song: candidate, changedNotes: eligible.length };
}

function totalDurationByPitch(song) {
  const totals = new Map();
  for (const note of bassTrack(song)?.notes ?? []) {
    totals.set(note.pitch, round((totals.get(note.pitch) ?? 0) + finite(note.duration), 4));
  }
  return [...totals.entries()].sort((a, b) => a[0] - b[0]);
}

function pitchSet(song) {
  return [...new Set((bassTrack(song)?.notes ?? []).map((note) => note.pitch))].sort((a, b) => a - b);
}

function creativeFloor(evaluation) {
  return Math.min(...Object.values(evaluation.subscores ?? {}).map((value) => finite(value)));
}

function summary(id, beforeSong, candidateSong, changedNotes) {
  const evaluation = evaluateSongCandidate(candidateSong);
  const release = evaluateSongReleaseGate(candidateSong, evaluation);
  return {
    id,
    changedNotes,
    notesPerBar: round(pitchedNotesPerBar(candidateSong)),
    bassNotesPerBar: round((bassTrack(candidateSong)?.notes.length ?? 0) / barsFor(candidateSong)),
    score: evaluation.score,
    creativeFloor: creativeFloor(evaluation),
    density: evaluation.subscores.density,
    groove: evaluation.subscores.groove,
    performance: evaluation.subscores.performance,
    repetition: evaluation.subscores.repetition,
    separation: evaluation.subscores.separation,
    genreAuthenticity: evaluation.subscores.genreAuthenticity,
    bassLock: round(evaluation.diagnostics?.bassLock),
    scaleFit: round(evaluation.diagnostics?.scaleFit),
    releasePassed: Boolean(release.passed),
    scoreDelta: round(evaluation.score - evaluateSongCandidate(beforeSong).score),
  };
}

test("DnB fixed seeds measure bass-only same-pitch articulation against the full critic", () => {
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
    const beforeProcessed = applySongOutputQualityPipeline(generated, {
      ...config,
      densityRefinement: false,
      phraseResolutionRefinement: false,
      registerHealthRefinement: false,
    });
    const before = beforeProcessed.song;
    const beforeEval = evaluateSongCandidate(before);
    const beforeRelease = evaluateSongReleaseGate(before, beforeEval);
    const beforeBass = clone(bassTrack(before));
    const beforeDurations = totalDurationByPitch(before);
    const beforePitches = pitchSet(before);
    const eligible = eligibleBassNotes(before);

    const candidates = SPLIT_COUNTS.map((splitCount, index) => {
      const articulated = articulateBass(before, splitCount);
      assert.deepEqual(pitchSet(articulated.song), beforePitches);
      assert.deepEqual(totalDurationByPitch(articulated.song), beforeDurations);
      for (const track of before.tracks) {
        if (track.id === "bass") continue;
        assert.deepEqual(
          articulated.song.tracks.find((entry) => entry.id === track.id),
          track,
          `${track.id} must remain exact`,
        );
      }
      return summary(IDS[index], before, articulated.song, articulated.changedNotes);
    });

    rows.push({
      seed,
      target: beforeEval.diagnostics.densityTarget,
      eligibleBassNotes: eligible.length,
      before: {
        notesPerBar: round(pitchedNotesPerBar(before)),
        bassNotesPerBar: round((beforeBass?.notes.length ?? 0) / barsFor(before)),
        score: beforeEval.score,
        creativeFloor: creativeFloor(beforeEval),
        density: beforeEval.subscores.density,
        groove: beforeEval.subscores.groove,
        performance: beforeEval.subscores.performance,
        repetition: beforeEval.subscores.repetition,
        separation: beforeEval.subscores.separation,
        genreAuthenticity: beforeEval.subscores.genreAuthenticity,
        bassLock: round(beforeEval.diagnostics?.bassLock),
        scaleFit: round(beforeEval.diagnostics?.scaleFit),
        releasePassed: Boolean(beforeRelease.passed),
      },
      candidates,
    });
  }

  console.log("DNB_BASS_ARTICULATION_CALIBRATION", JSON.stringify(rows));
  assert.equal(rows.length, 3);
  assert.ok(rows.every((row) => row.before.releasePassed && row.before.scaleFit === 1));
  assert.ok(rows.every((row) => row.candidates.every((candidate) => candidate.releasePassed && candidate.scaleFit === 1)));
});
