import assert from "node:assert/strict";
import test from "node:test";

import {
  hasAudiblePreviewEvents,
  playbackSourceNeedsCanonicalReset,
  playableSongNoteCount,
  shouldRecoverSilentMixState,
} from "../src/core/playback-recovery.js";

const song = {
  id: "canonical-song",
  tracks: [
    { id: "drums", notes: [{ start: 0, pitch: 36, duration: 0.1, velocity: 90 }] },
    { id: "bass", notes: [{ start: 0, pitch: 36, duration: 0.5, velocity: 84 }] },
  ],
};

test("silent mute/solo filters recover a valid canonical song instead of losing playback", () => {
  assert.equal(playableSongNoteCount(song), 2);
  assert.equal(shouldRecoverSilentMixState({
    song,
    events: [],
    muted: new Set(["drums", "bass"]),
    solo: new Set(),
  }), true);
  assert.equal(shouldRecoverSilentMixState({
    song,
    events: [],
    muted: new Set(),
    solo: new Set(["melody"]),
  }), true);
});

test("audible preview events never trigger Mix recovery", () => {
  const events = [{ time: 0, velocity: 90, mixGain: 0.8 }];
  assert.equal(hasAudiblePreviewEvents(events), true);
  assert.equal(shouldRecoverSilentMixState({
    song,
    events,
    muted: new Set(["pad"]),
    solo: new Set(),
  }), false);
});

test("intentional zero-level mix stays user-controlled instead of being force-reset", () => {
  const events = [{ time: 0, velocity: 90, mixGain: 0 }];
  assert.equal(hasAudiblePreviewEvents(events), false);
  assert.equal(shouldRecoverSilentMixState({
    song,
    events,
    muted: new Set(),
    solo: new Set(),
  }), false);
});

test("empty compositions are not misdiagnosed as Mix-state loss", () => {
  const empty = { tracks: [{ id: "melody", notes: [] }] };
  assert.equal(playableSongNoteCount(empty), 0);
  assert.equal(shouldRecoverSilentMixState({
    song: empty,
    events: [],
    muted: new Set(["melody"]),
    solo: new Set(),
  }), false);
});

test("explicit audition playback is reset when a canonical workspace takes ownership", () => {
  const audition = structuredClone(song);
  assert.equal(playbackSourceNeedsCanonicalReset(audition, song), true);
  assert.equal(playbackSourceNeedsCanonicalReset(song, song), false);
  assert.equal(playbackSourceNeedsCanonicalReset(null, song), false);
});
