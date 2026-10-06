import test from "node:test";
import assert from "node:assert/strict";
import {
  previewAudioTimeForEvent,
  previewTimelineTime,
} from "../src/core/preview-clock.js";

test("AudioContext time is the authoritative preview timeline clock", () => {
  assert.equal(previewTimelineTime({
    timelineStartSeconds: 12,
    audioStartSeconds: 100,
    audioNowSeconds: 102.5,
  }), 14.5);
});

test("scheduler wake-up jitter does not move a future event", () => {
  const timelineNow = previewTimelineTime({
    timelineStartSeconds: 0,
    audioStartSeconds: 10,
    audioNowSeconds: 10.037,
  });
  const when = previewAudioTimeForEvent({
    eventTimelineSeconds: 0.1,
    timelineNowSeconds: timelineNow,
    audioNowSeconds: 10.037,
  });
  assert.ok(Math.abs(when - 10.1) < 1e-9);
});

test("late events clamp to the current AudioContext time", () => {
  const when = previewAudioTimeForEvent({
    eventTimelineSeconds: 4,
    timelineNowSeconds: 4.08,
    audioNowSeconds: 20,
  });
  assert.equal(when, 20);
});

test("playback-rate math preserves musical placement", () => {
  const timelineNow = previewTimelineTime({
    timelineStartSeconds: 8,
    audioStartSeconds: 50,
    audioNowSeconds: 51,
    playbackRate: 0.5,
  });
  assert.equal(timelineNow, 8.5);

  const when = previewAudioTimeForEvent({
    eventTimelineSeconds: 9,
    timelineNowSeconds: timelineNow,
    audioNowSeconds: 51,
    playbackRate: 0.5,
  });
  assert.equal(when, 52);
});
