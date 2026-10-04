function finiteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function safePlaybackRate(value) {
  return Math.max(0.01, finiteNumber(value, 1));
}

/**
 * Convert the authoritative AudioContext clock into song-timeline seconds.
 *
 * The scheduler timer is only a wake-up mechanism. Musical position always
 * comes from the AudioContext hardware timeline plus the transport anchor.
 */
export function previewTimelineTime({
  timelineStartSeconds = 0,
  audioStartSeconds = 0,
  audioNowSeconds = 0,
  playbackRate = 1,
} = {}) {
  const timelineStart = finiteNumber(timelineStartSeconds, 0);
  const audioStart = finiteNumber(audioStartSeconds, 0);
  const audioNow = finiteNumber(audioNowSeconds, audioStart);
  const rate = safePlaybackRate(playbackRate);
  return timelineStart + Math.max(0, audioNow - audioStart) * rate;
}

/**
 * Map a song-timeline event onto an exact AudioContext target timestamp.
 *
 * Late scheduler wake-ups do not move future notes: the event is still placed
 * at its hardware-clock timestamp. Truly late events clamp to "now".
 */
export function previewAudioTimeForEvent({
  eventTimelineSeconds = 0,
  timelineNowSeconds = 0,
  audioNowSeconds = 0,
  playbackRate = 1,
} = {}) {
  const eventTime = finiteNumber(eventTimelineSeconds, 0);
  const timelineNow = finiteNumber(timelineNowSeconds, 0);
  const audioNow = finiteNumber(audioNowSeconds, 0);
  const rate = safePlaybackRate(playbackRate);
  return audioNow + Math.max(0, eventTime - timelineNow) / rate;
}
