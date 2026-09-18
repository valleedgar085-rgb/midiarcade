import {
  sanitizePersistedTrackSettings,
  sanitizeTasteProfile,
} from "./session-contract.js";
import { createDefaultAutoControls, sanitizeAutoControls } from "./auto-control-policy.js";
import { cloneValue } from "./clone-value.js";

export const GENERATION_PREFERENCE_IDS = Object.freeze([
  "genreControl",
  "keyControl",
  "modeControl",
  "tempoControl",
  "barsControl",
  "grooveControl",
  "creativeRangeControl",
  "chordPathControl",
  "energyControl",
  "complexityControl",
  "swingControl",
  "humanizeControl",
  "tripletControl",
  "rollControl",
  "variationControl",
  "evolutionControl",
  "surpriseControl",
]);

export function sanitizeGenerationPreferences(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const preferences = {};
  for (const id of GENERATION_PREFERENCE_IDS) {
    if (typeof value[id] !== "string") continue;
    preferences[id] = value[id].slice(0, 80);
  }
  return preferences;
}

function boundedIndex(value, maxExclusive) {
  const numeric = Number(value);
  const rounded = Number.isFinite(numeric) ? Math.round(numeric) : 0;
  return Math.max(0, Math.min(Math.max(0, maxExclusive - 1), rounded));
}

export function migratePersistedSessionRecord(value, schema) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const targetSchema = Number(schema);
  const sourceSchema = Number(value.schema);
  if (!Number.isFinite(targetSchema) || !Number.isFinite(sourceSchema)) return null;
  if (sourceSchema === targetSchema) return value;
  if (sourceSchema >= 1 && sourceSchema < targetSchema) {
    return {
      ...value,
      schema: targetSchema,
    };
  }
  return null;
}

function restoredPreferenceState({
  parsed = {},
  trackOrder = [],
  defaultTrackSettings = {},
  genreIds = [],
  recipeCount = 1,
  normalizeMixAssistant = (value) => value,
  defaultToAuto = false,
} = {}) {
  return {
    // Reopening the studio intentionally starts with an empty plate. Persisted
    // preferences are restored independently from any legacy song payload.
    song: null,
    trackSettings: sanitizePersistedTrackSettings(parsed.trackSettings, {
      defaults: defaultTrackSettings,
      trackOrder,
    }),
    muted: new Set(Array.isArray(parsed.muted) ? parsed.muted.filter((id) => trackOrder.includes(id)) : []),
    solo: new Set(Array.isArray(parsed.solo) ? parsed.solo.filter((id) => trackOrder.includes(id)) : []),
    locked: new Set(Array.isArray(parsed.locked) ? parsed.locked.filter((id) => trackOrder.includes(id)) : []),
    autoControls: sanitizeAutoControls(parsed.autoControls, {
      trackIds: trackOrder,
      defaultToAuto,
    }),
    selectedTrack: trackOrder.includes(parsed.selectedTrack) ? parsed.selectedTrack : (trackOrder[0] ?? "drums"),
    guidedMode: parsed.guidedMode !== false,
    recipeIndex: boundedIndex(parsed.recipeIndex, recipeCount),
    mixAssistant: { ...normalizeMixAssistant(parsed.mixAssistant) },
    tasteProfile: sanitizeTasteProfile(parsed.tasteProfile, { genreIds }),
    generationPreferences: sanitizeGenerationPreferences(parsed.generationPreferences),
  };
}

export function createPersistedSessionSnapshot(state = {}, {
  schema,
  normalizeMixAssistant = (value) => value,
  now = () => new Date(),
  captureGenerationPreferences = () => ({}),
} = {}) {
  if (!Number.isFinite(Number(schema))) throw new TypeError("session snapshot requires a schema");
  const savedAt = now();
  const stamp = savedAt instanceof Date ? savedAt.toISOString() : String(savedAt);
  return {
    schema,
    savedAt: stamp,
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
    generationPreferences: sanitizeGenerationPreferences(captureGenerationPreferences()),
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
    return {
      status: "ready",
      value: restoredPreferenceState({
        parsed: { autoControls: [...createDefaultAutoControls(trackOrder)] },
        trackOrder,
        defaultTrackSettings,
        genreIds,
        recipeCount,
        normalizeMixAssistant,
        defaultToAuto: true,
      }),
    };
  }
  if (stored?.status !== "ready") {
    return { status: "rejected", value: null, error: stored?.error ?? null };
  }

  const parsed = migratePersistedSessionRecord(stored.value, schema);
  if (!parsed) {
    return { status: "rejected", value: null };
  }
  return {
    status: "ready",
    value: restoredPreferenceState({
      parsed,
      trackOrder,
      defaultTrackSettings,
      genreIds,
      recipeCount,
      normalizeMixAssistant,
      defaultToAuto: !Array.isArray(parsed.autoControls),
    }),
  };
}

export function applyPersistedSessionState(state, restored, {
  applyGenerationPreferences = () => {},
  syncAutoPresentation = () => {},
  deferEmptyCanvasFacts = () => {},
} = {}) {
  if (!state || !restored || typeof restored !== "object") return false;
  Object.assign(state, restored);
  applyGenerationPreferences(restored.generationPreferences);
  syncAutoPresentation(restored.autoControls);
  if (restored.song == null) deferEmptyCanvasFacts();
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
    if (!value || typeof value !== "object") return false;
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
