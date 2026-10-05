function finiteNumber(value, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function safePreviewBpm(value, fallback = 120) {
  return Math.max(1, finiteNumber(value, fallback));
}

export function beatsToSeconds(beats, bpm = 120) {
  return finiteNumber(beats, 0) * 60 / safePreviewBpm(bpm);
}

export function secondsToBeats(seconds, bpm = 120) {
  return finiteNumber(seconds, 0) * safePreviewBpm(bpm) / 60;
}

export function previewBeatAtAudioTime({
  beatStart = 0,
  audioStartSeconds = 0,
  audioNowSeconds = 0,
  bpm = 120,
  playbackRate = 1,
} = {}) {
  const audioStart = finiteNumber(audioStartSeconds, 0);
  const audioNow = finiteNumber(audioNowSeconds, audioStart);
  const rate = Math.max(0.01, finiteNumber(playbackRate, 1));
  const elapsedSeconds = Math.max(0, audioNow - audioStart) * rate;
  return finiteNumber(beatStart, 0) + secondsToBeats(elapsedSeconds, bpm);
}

export function previewAudioTimeForBeat({
  eventBeat = 0,
  beatNow = 0,
  audioNowSeconds = 0,
  bpm = 120,
  playbackRate = 1,
} = {}) {
  const deltaBeats = Math.max(0, finiteNumber(eventBeat, 0) - finiteNumber(beatNow, 0));
  const rate = Math.max(0.01, finiteNumber(playbackRate, 1));
  return finiteNumber(audioNowSeconds, 0) + beatsToSeconds(deltaBeats, bpm) / rate;
}

export function previewBeatLookAhead(lookAheadSeconds, bpm = 120) {
  return Math.max(0, secondsToBeats(lookAheadSeconds, bpm));
}
