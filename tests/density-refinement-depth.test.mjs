import assert from "node:assert/strict";
import test from "node:test";

import {
  createDensityRefinementCandidates,
  MAX_DENSITY_REFINEMENT_CANDIDATES,
} from "../src/core/density-refinement.js";

function sourceSong() {
  return {
    id: "density-depth-proof",
    genre: "jazz",
    meta: { genre: "jazz", bars: 4, beatsPerBar: 4, totalBeats: 16 },
    structure: [{ id: "a", name: "verse", startBeat: 0, endBeat: 16 }],
    harmony: [],
    tracks: [
      { id: "drums", notes: [{ id: "k", start: 0, pitch: 36, duration: 0.1, velocity: 108 }] },
      { id: "bass", notes: [{ id: "b0", start: 0, pitch: 36, duration: 1, velocity: 88 }, { id: "b1", start: 8, pitch: 38, duration: 1, velocity: 90 }] },
      { id: "chords", notes: [0, 4, 8, 12].map((start, index) => ({ id: `c${index}`, start, pitch: 60 + index, duration: 4, velocity: 80 })) },
      { id: "counterpoint", notes: [{ id: "q0", start: 1, pitch: 74, duration: 2, velocity: 72 }, { id: "q1", start: 9, pitch: 76, duration: 2, velocity: 74 }] },
      { id: "pad", notes: [{ id: "p0", start: 0, pitch: 55, duration: 8, velocity: 62 }, { id: "p1", start: 8, pitch: 57, duration: 8, velocity: 64 }] },
      { id: "melody", notes: [{ id: "m0", start: 0.5, pitch: 79, duration: 0.5, velocity: 92 }, { id: "m1", start: 8.5, pitch: 81, duration: 0.5, velocity: 94 }] },
    ],
  };
}

function track(song, id) {
  return song.tracks.find((entry) => entry.id === id);
}

function durationTotals(song, trackId) {
  const totals = new Map();
  for (const note of track(song, trackId)?.notes ?? []) {
    totals.set(note.pitch, (totals.get(note.pitch) ?? 0) + note.duration);
  }
  return [...totals.entries()].map(([pitch, duration]) => [pitch, Number(duration.toFixed(4))]).sort((a, b) => a[0] - b[0]);
}

function pitchSet(song, trackId) {
  return [...new Set((track(song, trackId)?.notes ?? []).map(({ pitch }) => pitch))].sort((a, b) => a - b);
}

test("high-density targets deepen support articulation without broadening the candidate budget", () => {
  const source = sourceSong();
  const before = structuredClone(source);
  const candidates = createDensityRefinementCandidates(source, { densityTarget: 36 });

  assert.deepEqual(source, before);
  assert.equal(candidates.length, 3);
  assert.deepEqual(candidates.map(({ id }) => id), ["light-support", "balanced-support", "full-support"]);
  assert.deepEqual(candidates.map(({ afterNotesPerBar }) => afterNotesPerBar), [3.25, 4, 5]);
  assert.equal(candidates[2].afterNotesPerBar - candidates[2].beforeNotesPerBar, 2);
  assert.ok(candidates.every(({ changedNotes }) => changedNotes <= source.meta.bars));

  for (const candidate of candidates) {
    assert.deepEqual(track(candidate.song, "drums"), track(source, "drums"));
    assert.deepEqual(track(candidate.song, "bass"), track(source, "bass"));
    assert.deepEqual(track(candidate.song, "melody"), track(source, "melody"));
    for (const trackId of ["chords", "counterpoint", "pad"]) {
      assert.deepEqual(pitchSet(candidate.song, trackId), pitchSet(source, trackId));
      assert.deepEqual(durationTotals(candidate.song, trackId), durationTotals(source, trackId));
    }
  }
});

test("long severely sparse songs expose one deeper bounded support candidate", () => {
  const source = sourceSong();
  source.genre = "pop";
  source.meta.genre = "pop";
  source.meta.bars = 32;
  source.meta.totalBeats = 128;
  source.structure = [{ id: "a", name: "verse", startBeat: 0, endBeat: 128, bars: 32 }];
  source.tracks.find((track) => track.id === "chords").notes = Array.from({ length: 32 }, (_, bar) => ({
    id: `lc-${bar}`, start: bar * 4, pitch: 60 + (bar % 4), duration: 4, velocity: 80,
  }));
  source.tracks.find((track) => track.id === "counterpoint").notes = Array.from({ length: 32 }, (_, bar) => ({
    id: `lq-${bar}`, start: bar * 4 + 1, pitch: 72 + (bar % 3), duration: 2, velocity: 74,
  }));
  source.tracks.find((track) => track.id === "pad").notes = Array.from({ length: 32 }, (_, bar) => ({
    id: `lp-${bar}`, start: bar * 4, pitch: 55 + (bar % 2), duration: 4, velocity: 64,
  }));

  const candidates = createDensityRefinementCandidates(source, { densityTarget: 25 });
  const full = candidates.find(({ id }) => id === "full-support");
  const deep = candidates.find(({ id }) => id === "deep-support");

  assert.equal(candidates.length, MAX_DENSITY_REFINEMENT_CANDIDATES);
  assert.ok(full);
  assert.ok(deep);
  assert.ok(deep.changedNotes > full.changedNotes);
  assert.ok(deep.changedNotes <= source.meta.bars * 2);
  assert.ok(deep.afterNotesPerBar > full.afterNotesPerBar);
  assert.ok(deep.densityErrorDelta < full.densityErrorDelta);
});

test("lower density targets retain the original two-part articulation depth", () => {
  const source = sourceSong();
  const candidates = createDensityRefinementCandidates(source, { densityTarget: 8 });
  assert.equal(candidates.length, 3);
  assert.deepEqual(candidates.map(({ afterNotesPerBar }) => afterNotesPerBar), [3.25, 3.5, 4]);
});
