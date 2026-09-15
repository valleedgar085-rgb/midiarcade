import assert from "node:assert/strict";
import test from "node:test";

import {
  createDensityRefinementCandidates,
  MAX_DENSITY_REFINEMENT_CANDIDATES,
} from "../src/core/density-refinement.js";

function sourceSong() {
  return {
    id: "density-deficit-depth",
    meta: { bars: 4, beatsPerBar: 4, totalBeats: 16 },
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

function totalDuration(song, trackId) {
  return (track(song, trackId)?.notes ?? []).reduce((sum, note) => sum + note.duration, 0);
}

test("large under-density unlocks deeper support articulation without widening candidate search", () => {
  const source = sourceSong();
  const before = structuredClone(source);
  const candidates = createDensityRefinementCandidates(source, { densityTarget: 10 });

  assert.deepEqual(source, before);
  assert.equal(candidates.length, MAX_DENSITY_REFINEMENT_CANDIDATES);
  assert.deepEqual(candidates.map(({ id }) => id), ["light-support", "balanced-support", "full-support"]);
  assert.deepEqual(candidates.map(({ articulationParts }) => articulationParts), [2, 3, 3]);
  assert.deepEqual(candidates.map(({ afterNotesPerBar }) => afterNotesPerBar), [3.25, 4, 5]);
  assert.ok(candidates.every(({ changedNotes }) => changedNotes <= source.meta.bars));

  for (const candidate of candidates) {
    assert.deepEqual(track(candidate.song, "drums"), track(source, "drums"));
    assert.deepEqual(track(candidate.song, "bass"), track(source, "bass"));
    assert.deepEqual(track(candidate.song, "melody"), track(source, "melody"));
    for (const trackId of ["chords", "counterpoint", "pad"]) {
      assert.equal(totalDuration(candidate.song, trackId), totalDuration(source, trackId));
    }
  }
});

test("moderate deficits retain the shallower two-part articulation profile", () => {
  const candidates = createDensityRefinementCandidates(sourceSong(), { densityTarget: 8 });
  assert.deepEqual(candidates.map(({ articulationParts }) => articulationParts), [2, 2, 2]);
  assert.deepEqual(candidates.map(({ afterNotesPerBar }) => afterNotesPerBar), [3.25, 3.5, 4]);
});

test("fusion songs keep the proven shallow profile for deficit-driven density repair", () => {
  const source = sourceSong();
  source.meta.isFusion = true;
  source.meta.primaryGenre = "pop";
  source.meta.secondaryGenre = "hipHop";

  const candidates = createDensityRefinementCandidates(source, { densityTarget: 10 });

  assert.deepEqual(candidates.map(({ articulationParts }) => articulationParts), [2, 2, 2]);
  assert.deepEqual(candidates.map(({ afterNotesPerBar }) => afterNotesPerBar), [3.25, 3.5, 4]);
});
