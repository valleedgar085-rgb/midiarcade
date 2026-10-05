import test from "node:test";
import assert from "node:assert/strict";
import {
  beatsToSeconds,
  previewAudioTimeForBeat,
  previewBeatAtAudioTime,
  previewBeatLookAhead,
  secondsToBeats,
} from "../src/core/preview-beat-clock.js";

test("beat clock round-trips musical position without scheduler-time drift", () => {
  assert.equal(beatsToSeconds(4, 120), 2);
  assert.equal(secondsToBeats(2, 120), 4);
  assert.ok(Math.abs(secondsToBeats(beatsToSeconds(7.25, 93), 93) - 7.25) < 1e-12);
});

test("AudioContext elapsed time advances transport beats", () => {
  assert.equal(previewBeatAtAudioTime({
    beatStart: 8,
    audioStartSeconds: 10,
    audioNowSeconds: 11.5,
    bpm: 120,
  }), 11);
});

test("future beat placement maps to an exact AudioContext timestamp", () => {
  assert.equal(previewAudioTimeForBeat({
    eventBeat: 17,
    beatNow: 16,
    audioNowSeconds: 20,
    bpm: 120,
  }), 20.5);
});

test("late beat events clamp to the current AudioContext time", () => {
  assert.equal(previewAudioTimeForBeat({
    eventBeat: 15.9,
    beatNow: 16,
    audioNowSeconds: 20,
    bpm: 120,
  }), 20);
});

test("lookahead seconds become tempo-relative beat distance", () => {
  assert.equal(previewBeatLookAhead(0.5, 120), 1);
  assert.equal(previewBeatLookAhead(0.5, 60), 0.5);
});
