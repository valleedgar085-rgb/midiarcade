import assert from "node:assert/strict";
import test from "node:test";

import {
  createPhraseResolutionCandidates,
  MAX_PHRASE_RESOLUTION_CANDIDATES,
} from "../src/core/phrase-resolution-refinement.js";

function sourceSong() {
  return {
    id: "actionable-hold-proof",
    genre: "trap",
    meta: { genre: "trap", keyPc: 0, beatsPerBar: 4, bars: 2, totalBeats: 8 },
    structure: [{ id: "chorus-1", name: "chorus", startBeat: 0, endBeat: 8 }],
    harmony: [{ start: 0, duration: 8, root: 0, tones: [0, 4, 7] }],
    tracks: [
      { id: "drums", notes: [{ id: "k", start: 0, pitch: 36, duration: 0.1, velocity: 108 }] },
      { id: "bass", notes: [{ id: "b", start: 0, pitch: 36, duration: 1, velocity: 88 }] },
      { id: "chords", notes: [{ id: "c", start: 0, pitch: 60, duration: 8, velocity: 78 }] },
      { id: "counterpoint", notes: [{ id: "q", start: 3, pitch: 76, duration: 0.5, velocity: 72 }] },
      { id: "pad", notes: [{ id: "p", start: 0, pitch: 55, duration: 8, velocity: 62 }] },
      { id: "melody", notes: [{ id: "m", start: 6, pitch: 72, duration: 1.2, velocity: 96 }] },
    ],
  };
}

function track(song, id) {
  return song.tracks.find((entry) => entry.id === id);
}

test("held cadence targets an 88-point tonic ending when enough section room exists", () => {
  const source = sourceSong();
  const before = structuredClone(source);
  const candidates = createPhraseResolutionCandidates(source);
  const held = candidates.find((candidate) => candidate.id === "held-cadence");

  assert.deepEqual(source, before, "candidate generation must remain immutable");
  assert.ok(candidates.length <= MAX_PHRASE_RESOLUTION_CANDIDATES);
  assert.ok(held, "the hold recipe must see a short chord+tonic ending as actionable");
  assert.equal(held.pitchEdits, 0, "a clean tonic landing must not be repitched");
  assert.equal(held.durationEdits, 1);
  assert.equal(held.changedNotes, 1);
  assert.ok(held.localScoreDelta > 0);

  const sourceMelody = track(source, "melody").notes;
  const refinedMelody = track(held.song, "melody").notes;
  assert.equal(refinedMelody.length, sourceMelody.length);
  assert.deepEqual(refinedMelody.map(({ id }) => id), sourceMelody.map(({ id }) => id));
  assert.deepEqual(refinedMelody.map(({ start }) => start), sourceMelody.map(({ start }) => start));
  assert.deepEqual(refinedMelody.map(({ pitch }) => pitch), sourceMelody.map(({ pitch }) => pitch));
  assert.equal(refinedMelody[0].duration, 1.4);
  assert.ok(refinedMelody[0].start + refinedMelody[0].duration <= 7.98 + 1e-6);

  for (const id of ["drums", "bass", "chords", "counterpoint", "pad"]) {
    assert.deepEqual(track(held.song, id), track(source, id), `${id} must remain exact`);
  }
});
