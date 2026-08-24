const SPOTLIGHT_BY_GENRE = Object.freeze({
  ambient: "pad",
  jazz: "chords",
  neoSoul: "chords",
  rnbSoul: "chords",
  loFiHipHop: "chords",
  house: "bass",
  techno: "bass",
  drumBass: "bass",
  trap: "bass",
  hipHop: "bass",
  rap: "bass",
  drill: "bass",
  reggaeton: "bass",
  afrobeats: "bass",
  funk: "bass",
  rock: "melody",
  country: "melody",
});

export const PREVIEW_TRANSITION = Object.freeze({
  startSeconds: 0.004,
  stopSeconds: 0.016,
  sourceTailSeconds: 0.006,
});

export function characteristicTrackForPreview(song = {}) {
  const explicit = String(song?.characteristicVoice?.trackId || "");
  if (["bass", "chords", "melody", "counterpoint", "pad"].includes(explicit)) return explicit;
  const genre = String(song?.meta?.genre ?? song?.genre ?? "pop");
  return SPOTLIGHT_BY_GENRE[genre] ?? "melody";
}

export function previewSpotlight(song, trackId) {
  const active = String(trackId) === characteristicTrackForPreview(song);
  return Object.freeze({
    active,
    gain: active ? 1.08 : 1,
    cutoff: active ? 1.09 : 1,
    reverb: active ? 1.04 : 1,
    delay: active ? 1.08 : 1,
    priority: active ? 1 : 0,
  });
}

export function clickSafeStopTime(now, startedAt, transition = PREVIEW_TRANSITION) {
  const current = Math.max(0, Number(now) || 0);
  const start = Math.max(0, Number(startedAt) || 0);
  if (start > current + transition.stopSeconds) return current;
  return current + transition.stopSeconds + transition.sourceTailSeconds;
}
