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

const SPOTLIGHT_TRACKS = Object.freeze(["bass", "chords", "melody", "counterpoint", "pad"]);

function clamp01(value) {
  return Math.min(1, Math.max(0, Number(value) || 0));
}

export function normalizeMixAssistant(value = {}) {
  const spotlightTrack = SPOTLIGHT_TRACKS.includes(String(value.spotlightTrack))
    ? String(value.spotlightTrack)
    : "auto";
  const rawIntensity = Number(value.spotlightIntensity);
  const intensity = Number.isFinite(rawIntensity) ? rawIntensity : 68;
  return Object.freeze({
    enabled: value.enabled !== false,
    spotlightTrack,
    spotlightIntensity: Math.round(clamp01(intensity / 100) * 100),
  });
}

export function characteristicTrackForPreview(song = {}, requestedTrack = "auto") {
  if (SPOTLIGHT_TRACKS.includes(String(requestedTrack))) return String(requestedTrack);
  const explicit = String(song?.characteristicVoice?.trackId || "");
  if (SPOTLIGHT_TRACKS.includes(explicit)) return explicit;
  const genre = String(song?.meta?.genre ?? song?.genre ?? "pop");
  return SPOTLIGHT_BY_GENRE[genre] ?? "melody";
}

export function previewSpotlight(song, trackId, assistant = {}) {
  const settings = normalizeMixAssistant(assistant);
  const strength = settings.enabled ? settings.spotlightIntensity / 100 : 0;
  const active = strength > 0 && String(trackId) === characteristicTrackForPreview(song, settings.spotlightTrack);
  return Object.freeze({
    active,
    gain: active ? 1 + 0.12 * strength : 1 - 0.025 * strength,
    cutoff: active ? 1 + 0.14 * strength : 1,
    reverb: active ? 1 + 0.06 * strength : 1,
    delay: active ? 1 + 0.1 * strength : 1,
    priority: active ? 1 : 0,
  });
}

export function previewSidechain(song = {}, assistant = {}) {
  const settings = normalizeMixAssistant(assistant);
  const strength = settings.enabled ? settings.spotlightIntensity / 100 : 0;
  const bpm = Math.min(220, Math.max(48, Number(song?.meta?.tempo ?? song?.bpm ?? 120) || 120));
  return Object.freeze({
    enabled: strength > 0,
    depth: 0.08 + 0.12 * strength,
    attackSeconds: 0.004,
    holdSeconds: Math.min(0.04, (60 / bpm) * 0.06),
    releaseSeconds: Math.min(0.16, Math.max(0.07, (60 / bpm) * 0.22)),
  });
}

export function previewMixHealth(song = {}, trackSettings = {}, assistant = {}) {
  const settings = normalizeMixAssistant(assistant);
  const volumes = Object.values(trackSettings)
    .map((track) => Number(track?.volume))
    .filter(Number.isFinite)
    .map(clamp01);
  const average = volumes.length ? volumes.reduce((sum, value) => sum + value, 0) / volumes.length : 0.72;
  const load = clamp01(average * 0.78 + Math.min(volumes.length, 6) * 0.025);
  const spotlight = characteristicTrackForPreview(song, settings.spotlightTrack);
  const status = load > 0.88 ? "Hot" : load < 0.48 ? "Open" : "Balanced";
  return Object.freeze({
    load: Math.round(load * 100),
    headroom: Math.max(0, Math.round((1 - load) * 12)),
    status,
    spotlight,
  });
}

export function clickSafeStopTime(now, startedAt, transition = PREVIEW_TRANSITION) {
  const current = Math.max(0, Number(now) || 0);
  const start = Math.max(0, Number(startedAt) || 0);
  if (start > current + transition.stopSeconds) return current;
  return current + transition.stopSeconds + transition.sourceTailSeconds;
}
