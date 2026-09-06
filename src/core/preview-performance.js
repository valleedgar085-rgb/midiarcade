const FULL_PROFILE = Object.freeze({
  mode: "full",
  scheduleIntervalMs: 75,
  lookAheadSeconds: 0.85,
  lateEventGraceSeconds: 0.12,
  maxScheduledVoices: 96,
});

const CONSTRAINED_PROFILE = Object.freeze({
  mode: "constrained",
  scheduleIntervalMs: 45,
  lookAheadSeconds: 0.55,
  lateEventGraceSeconds: 0.08,
  maxScheduledVoices: 48,
});

const FULL_GRAPH_BUDGET = Object.freeze({
  saturation: true,
  saturationOversample: "4x",
  reverbSeconds: 2.2,
  reverbChannels: 2,
  reverbReturnScale: 1,
  delayFeedback: 0.18,
  delayReturnScale: 1,
  preserveKickClick: true,
  preserveSnareSnap: true,
  filterMotion: true,
  sendFloor: 0,
  masterFadeSeconds: 0.015,
});

const CONSTRAINED_GRAPH_BUDGET = Object.freeze({
  saturation: false,
  saturationOversample: "none",
  reverbSeconds: 1.2,
  reverbChannels: 1,
  reverbReturnScale: 0.78,
  delayFeedback: 0.12,
  delayReturnScale: 0.82,
  preserveKickClick: false,
  preserveSnareSnap: false,
  filterMotion: false,
  sendFloor: 0.04,
  masterFadeSeconds: 0.026,
});

const RICH_TRACKS = new Set(["bass", "melody"]);

function finitePositive(value, fallback) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

export function previewRuntimeProfile({
  userAgent = "",
  hardwareConcurrency = 8,
  deviceMemory = 8,
} = {}) {
  const cores = finitePositive(hardwareConcurrency, 8);
  const memory = finitePositive(deviceMemory, 8);
  const isAndroid = /android/i.test(String(userAgent));
  const constrained = isAndroid || cores <= 4 || memory <= 4;
  return constrained ? { ...CONSTRAINED_PROFILE } : { ...FULL_PROFILE };
}

export function previewGraphBudget(profile = FULL_PROFILE) {
  return profile?.mode === "constrained"
    ? { ...CONSTRAINED_GRAPH_BUDGET }
    : { ...FULL_GRAPH_BUDGET };
}

export function previewVoiceFeatures(trackId, profile = FULL_PROFILE) {
  const constrained = profile?.mode === "constrained";
  if (!constrained) {
    return { layer: true, transient: true, sub: true };
  }
  const id = String(trackId || "");
  return {
    layer: RICH_TRACKS.has(id),
    transient: false,
    sub: id === "bass",
  };
}

export function previewVoicePriority(trackId, spotlight = false) {
  const base = ({
    drums: 7,
    melody: 6,
    bass: 6,
    chords: 4,
    counterpoint: 3,
    pad: 2,
  })[String(trackId || "")] || 1;
  return base + (spotlight ? 2 : 0);
}

export function selectPreviewVoiceVictim(voices, {
  now = 0,
  maxVoices = 48,
  futureGuardSeconds = 0.025,
} = {}) {
  const active = [...(voices || [])].filter((voice) => voice && !voice.cleaned);
  if (active.length <= maxVoices) return null;

  const currentTime = Number.isFinite(Number(now)) ? Number(now) : 0;
  const future = active.filter((voice) => Number(voice.startedAt) > currentTime + futureGuardSeconds);
  const pool = future.length ? future : active;

  return [...pool].sort((left, right) => {
    const priorityDelta = Number(left.priority || 0) - Number(right.priority || 0);
    if (priorityDelta) return priorityDelta;
    if (future.length) return Number(right.startedAt || 0) - Number(left.startedAt || 0);
    return Number(left.startedAt || 0) - Number(right.startedAt || 0);
  })[0] || null;
}
