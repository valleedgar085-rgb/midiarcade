import test from "node:test";
import assert from "node:assert/strict";
import { proposeMelodyCommitment } from "../src/core/melody-commitment.js";

test("does not modify input or invent notes for an unavailable hook", () => {
  const song = { meta: { genre: "hipHop" }, tracks: [{ id: "melody", notes: [
    { start: 0, pitch: 60, duration: 0.5, velocity: 80 },
  ] }], structure: [{ id: "verse1", name: "Verse", startBeat: 0, bars: 4 }] };
  const before = structuredClone(song);
  assert.deepEqual(proposeMelodyCommitment(song), []);
  assert.deepEqual(song, before);
});

test("unsupported genres do not receive hook repair candidates", () => {
  const song = { meta: { genre: "jazz" }, tracks: [{ id: "melody", notes: [] }],
    structure: [{ id: "chorus1", name: "Chorus", startBeat: 0, bars: 4 },
      { id: "chorus2", name: "Chorus", startBeat: 16, bars: 4 }] };
  assert.deepEqual(proposeMelodyCommitment(song), []);
});

test("candidate limit zero disables optional proposals", () => {
  assert.deepEqual(proposeMelodyCommitment({ tracks: [] }, { maxCandidates: 0 }), []);
});
