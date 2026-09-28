import assert from "node:assert/strict";
import test from "node:test";

import { createPerformanceAuditionSong, performanceAuditionEligibility } from "../src/core/performance-audition.js";

function fixtureSong() {
  return {
    id: "audition-song",
    seed: "audition-seed",
    genre: "neoSoul",
    bars: 2,
    meta: {
      genre: "neoSoul",
      tempo: 92,
      bars: 2,
      beatsPerBar: 4,
      totalBeats: 8,
      key: "A",
      keyPc: 9,
      scale: "minor",
      scaleIntervals: [0, 2, 3, 5, 7, 8, 10],
      timeSignature: [4, 4],
    },
    structure: [
      { id: "verse", name: "Verse", startBar: 0, bars: 1 },
      { id: "chorus", name: "Chorus", startBar: 1, bars: 1 },
    ],
    harmony: [
      { id: "h1", start: 0, duration: 4, chord: "Am9", root: "A" },
      { id: "h2", start: 4, duration: 4, chord: "Fmaj9", root: "F" },
    ],
    grooveConductor: {
      bars: [
        { bar: 0, sectionId: "verse" },
        { bar: 1, sectionId: "chorus" },
      ],
    },
    tracks: [
      {
        id: "drums",
        notes: [
          { start: 0, duration: 0.15, pitch: 36, velocity: 100 },
          { start: 1, duration: 0.15, pitch: 38, velocity: 94 },
        ],
      },
      {
        id: "bass",
        notes: [
          { start: 0, duration: 0.75, pitch: 33, velocity: 88 },
          { start: 1, duration: 0.5, pitch: 36, velocity: 86 },
        ],
      },
      {
        id: "melody",
        notes: [
          { start: 4.5, duration: 0.5, pitch: 69, velocity: 84, motifId: "hook-A", phraseRole: "answer" },
          { start: 5.5, duration: 0.75, pitch: 72, velocity: 87, motifId: "hook-A", phraseRole: "resolution" },
        ],
      },
    ],
  };
}

test("Trap A/B is paused after repeated listener tests found no audible benefit", () => {
  const song = fixtureSong();
  song.genre = "trap";
  song.meta.genre = "trap";

  const eligibility = performanceAuditionEligibility(song);
  assert.equal(eligibility.allowed, false);
  assert.equal(eligibility.reason, "listener-benefit-unproven");
  assert.throws(
    () => createPerformanceAuditionSong(song, { humanize: 1 }),
    /listener-benefit-unproven/,
  );
});

test("performance A/B audition creates a preview-only copy without mutating the canonical song", () => {
  const song = fixtureSong();
  const before = structuredClone(song);
  const pair = createPerformanceAuditionSong(song, { humanize: 0.8 });

  assert.equal(pair.currentSong, song);
  assert.notEqual(pair.performanceSong, song);
  assert.deepEqual(song, before);
  assert.equal(pair.noteCount, 6);
  assert.equal(pair.mappedNotes, 6);
  assert.equal(pair.performanceSong.performanceAudition.mode, "preview-only");
  assert.equal(pair.performanceSong.performanceAudition.engine, "performance-engine-v1");
  assert.equal(pair.report.safeToAudition, true);
});

test("performance audition preserves track/note identity and pitch while changing only performed values", () => {
  const song = fixtureSong();
  const pair = createPerformanceAuditionSong(song, { humanize: 1 });

  assert.equal(pair.performanceSong.tracks.length, song.tracks.length);
  for (const [trackIndex, track] of song.tracks.entries()) {
    const auditionTrack = pair.performanceSong.tracks[trackIndex];
    assert.equal(auditionTrack.id, track.id);
    assert.equal(auditionTrack.notes.length, track.notes.length);

    for (const [noteIndex, note] of track.notes.entries()) {
      const auditionNote = auditionTrack.notes[noteIndex];
      assert.equal(auditionNote.pitch, note.pitch, `${track.id} note ${noteIndex} pitch changed`);
      assert.equal(auditionNote.performanceAuthority, "performance-engine-v1");
      assert.ok(auditionNote.performed);
      assert.equal(auditionNote.canonicalStartBeat, note.start);
      assert.equal(auditionNote.canonicalDurationBeats, note.duration);
      assert.equal(auditionNote.canonicalVelocity, note.velocity);
    }
  }
});

test("performance audition is deterministic for the same seed and amount", () => {
  const song = fixtureSong();
  const first = createPerformanceAuditionSong(song, { humanize: 0.65, seed: "fixed-audition" });
  const second = createPerformanceAuditionSong(song, { humanize: 0.65, seed: "fixed-audition" });
  assert.deepEqual(first.performanceSong, second.performanceSong);
  assert.deepEqual(first.report, second.report);
});

test("zero-humanize audition remains note-for-note identical in performed values", () => {
  const song = fixtureSong();
  const pair = createPerformanceAuditionSong(song, { humanize: 0 });

  for (const [trackIndex, track] of song.tracks.entries()) {
    for (const [noteIndex, note] of track.notes.entries()) {
      const auditionNote = pair.performanceSong.tracks[trackIndex].notes[noteIndex];
      assert.equal(auditionNote.start, note.start);
      assert.equal(auditionNote.duration, note.duration);
      assert.equal(auditionNote.pitch, note.pitch);
      assert.equal(auditionNote.velocity, note.velocity);
    }
  }
});
