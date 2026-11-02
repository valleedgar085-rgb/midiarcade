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

test("unknown harmony roots and missing kick onsets do not invent bass cohesion evidence", () => {
  const song = {
    tracks: [
      { id: "bass", notes: [
        { start: null, pitch: 40 },
        { start: 0, pitch: null },
        { start: 0, pitch: 48 },
      ] },
      { id: "drums", notes: [
        { pitch: 36 },
        { start: null, pitch: 36 },
        { start: 0, pitch: 38 },
      ] },
    ],
    harmony: [{ start: 0, duration: 4, rootPc: null }],
  };
  const before = structuredClone(song);
  const unknown = analyzeBassEnsembleCohesion(song);
  assert.equal(unknown.bassNotes, 1, "invalid bass onsets and pitches must not become notes");
  assert.equal(unknown.kickNotes, 0, "a kick without an onset must not become a beat-zero kick");
  assert.equal(unknown.kickLockRatio, 0);
  assert.equal(unknown.notes[0].nearestKickBeats, null);
  assert.equal(unknown.rootEvidenceCount, 0, "null root is not a C root");
  assert.equal(unknown.rootOnsetRatio, null);
  assert.equal(unknown.notes[0].rootMatch, null);
  assert.deepEqual(song, before, "audit must not mutate source notes or harmony");

  for (const missingRoot of [undefined, "", "  "]) {
    song.harmony[0].rootPc = missingRoot;
    assert.equal(analyzeBassEnsembleCohesion(song).rootEvidenceCount, 0);
  }
  song.harmony[0].rootPc = 0;
  const actualC = analyzeBassEnsembleCohesion(song);
  assert.equal(actualC.rootEvidenceCount, 1, "explicit C root must still count");
  assert.equal(actualC.rootOnsetRatio, 1);
});
