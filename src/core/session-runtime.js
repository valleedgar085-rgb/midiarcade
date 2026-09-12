import {
  sanitizePersistedTrackSettings,
  sanitizeTasteProfile,
  validPersistedSong,
} from "./session-contract.js";

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function boundedIndex(value, maxExclusive) {
  const numeric = Number(value);
  const rounded = Number.isFinite(numeric) ? Math.round(numeric) : 0;
  return Math.max(0, Math.min(Math.max(0, maxExclusive - 1), rounded));
}

export function createPersistedSessionSnapshot(state = {}, {
  schema,
  normalizeMixAssistant = (value) => value,
  now = () => new Date(),
} = {}) {
  if (!Number.isFinite(Number(schema))) throw new TypeError("session snapshot requires a schema");
  const savedAt = now();
  const stamp = savedAt instanceof Date ? savedAt.toISOString() : String(savedAt);
  return {
    schema,
    savedAt: stamp,
    song: state.song,
    trackSettings: state.trackSettings,
    muted: [...(state.muted ?? [])],
    solo: [...(state.solo ?? [])],
    locked: [...(state.locked ?? [])],
    autoControls: [...(state.autoControls ?? [])],
    selectedTrack: state.selectedTrack,
    guidedMode: state.guidedMode,
    recipeIndex: state.recipeIndex,
    mixAssistant: normalizeMixAssistant(state.mixAssistant),
    tasteProfile: state.tasteProfile,
  };
}

export function decodePersistedSession(stored, {
  schema,
  trackOrder = [],
  defaultTrackSettings = {},
  genreIds = [],
  recipeCount = 1,
  normalizeMixAssistant = (value) => value,
} = {}) {
  if (stored?.status === "empty" || stored?.status === "unavailable") {
    return { status: "empty", value: null };
  }
  if (stored?.status !== "ready") {
    return { status: "rejected", value: null, error: stored?.error ?? null };
  }

  const parsed = stored.value;
  if (!parsed || parsed.schema !== schema || !validPersistedSong(parsed.song, { trackOrder })) {
    return { status: "rejected", value: null };
  }

  return {
    status: "ready",
    value: {
      song: clone(parsed.song),
      trackSettings: sanitizePersistedTrackSettings(parsed.trackSettings, {
        defaults: defaultTrackSettings,
        trackOrder,
      }),
      muted: new Set(Array.isArray(parsed.muted) ? parsed.muted.filter((id) => trackOrder.includes(id)) : []),
      solo: new Set(Array.isArray(parsed.solo) ? parsed.solo.filter((id) => trackOrder.includes(id)) : []),
      locked: new Set(Array.isArray(parsed.locked) ? parsed.locked.filter((id) => trackOrder.includes(id)) : []),
      autoControls: new Set(
        Array.isArray(parsed.autoControls)
          ? parsed.autoControls.filter((key) => typeof key === "string" && key.length <= 80).slice(0, 128)
          : [],
      ),
      selectedTrack: trackOrder.includes(parsed.selectedTrack) ? parsed.selectedTrack : (trackOrder[0] ?? "drums"),
      guidedMode: parsed.guidedMode !== false,
      recipeIndex: boundedIndex(parsed.recipeIndex, recipeCount),
      mixAssistant: { ...normalizeMixAssistant(parsed.mixAssistant) },
      tasteProfile: sanitizeTasteProfile(parsed.tasteProfile, { genreIds }),
    },
  };
}

export function applyPersistedSessionState(state, restored) {
  if (!state || !restored || typeof restored !== "object") return false;
  Object.assign(state, restored);
  return true;
}

export function createSessionAutosaveController({
  storage,
  snapshot,
  onSaved = () => {},
  onUnavailable = () => {},
  defer = (task) => task(),
  setTimer = (task, delay) => setTimeout(task, delay),
  clearTimer = (timer) => clearTimeout(timer),
  delayMs = 400,
} = {}) {
  if (!storage || typeof storage.save !== "function" || typeof storage.discard !== "function") {
    throw new TypeError("session autosave requires storage");
  }
  if (typeof snapshot !== "function") throw new TypeError("session autosave requires a snapshot function");

  let timer = null;

  function saveNow() {
    if (timer != null) clearTimer(timer);
    timer = null;
    const value = snapshot();
    if (!value?.song) return false;
    const result = storage.save(value);
    if (result?.ok) {
      onSaved(result);
      return true;
    }
    onUnavailable(result ?? { ok: false });
    return false;
  }

  function schedule() {
    if (timer != null) clearTimer(timer);
    timer = setTimer(() => {
      timer = null;
      defer(() => saveNow());
    }, delayMs);
    return timer;
  }

  function discard() {
    if (timer != null) clearTimer(timer);
    timer = null;
    return storage.discard();
  }

  return Object.freeze({ saveNow, schedule, discard });
}
