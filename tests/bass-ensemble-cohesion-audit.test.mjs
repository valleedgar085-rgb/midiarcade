import test from "node:test";
import assert from "node:assert/strict";
import { analyzeBassEnsembleCohesion } from "../src/core/bass-ensemble-cohesion-audit.js";

test("reports kick and harmony relationships without changing a song", () => {
  const song = {
    tracks: [
      { id: "bass", notes: [{ start: 0, pitch: 40 }, { start: 1.5, pitch: 43 }, { start: 2, pitch: 40 }] },
      { id: "drums", notes: [{ start: 0, pitch: 36 }, { start: 2, pitch: 35 }, { start: 1.5, pitch: 38 }] },
    ],
    harmony: [{ start: 0, duration: 4, rootPc: 4, pitchClasses: [4, 7, 11] }],
  };
  const original = JSON.stringify(song);
  const result = analyzeBassEnsembleCohesion(song);
  assert.equal(result.bassNotes, 3);
  assert.equal(result.kickNotes, 2);
  assert.equal(result.kickLockRatio, 0.667);
  assert.equal(result.rootOnsetRatio, 0.667);
  assert.equal(result.outsideKnownChordCount, 0);
  assert.equal(JSON.stringify(song), original);
});

test("handles absent bass, kicks, harmony, and invalid notes", () => {
  const empty = analyzeBassEnsembleCohesion({ tracks: [{ id: "bass", notes: [{ pitch: 40 }] }] });
  assert.equal(empty.bassNotes, 0);
  assert.equal(empty.kickLockRatio, null);
  assert.equal(empty.rootOnsetRatio, null);
  assert.equal(empty.largeLeapRatio, null);
});
