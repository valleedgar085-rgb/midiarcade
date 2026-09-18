import {
  sanitizePersistedTrackSettings,
  sanitizeTasteProfile,
} from "./session-contract.js";
import { createDefaultAutoControls, sanitizeAutoControls } from "./auto-control-policy.js";

const GENERATION_PREFERENCE_IDS = Object.freeze([
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

function elementById(id) {
  const doc = globalThis?.document;
  if (!doc) return null;
  if (typeof doc.getElementById === "function") return doc.getElementById(id);
  if (typeof doc.querySelector === "function") return doc.querySelector(`#${id}`);
  return null;
}

function captureGenerationPreferences() {
  const preferences = {};
  for (const id of GENERATION_PREFERENCE_IDS) {
    const control = elementById(id);
    if (!control || control.value == null) continue;
    preferences[id] = String(control.value).slice(0, 80);
  }
  return preferences;
}

function sanitizeGenerationPreferences(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const preferences = {};
  for (const id of GENERATION_PREFERENCE_IDS) {
    if (typeof value[id] !== "string") continue;
    preferences[id] = value[id].slice(0, 80);
  }
  return preferences;
}

function applyGenerationPreferences(preferences = {}) {
  for (const [id, value] of Object.entries(sanitizeGenerationPreferences(preferences))) {
    const control = elementById(id);
    if (!control) continue;
    if (control.tagName === "SELECT") {
      const valid = [...(control.options ?? [])].some((option) => String(option.value) === value);
      if (!valid) continue;
    }
    control.value = value;
  }
}

function syncAutoPresentation(autoControls = new Set()) {
  const doc = globalThis?.document;
  if (!doc?.querySelectorAll) return;
  for (const button of doc.querySelectorAll("[data-auto-key]")) {
    const key = String(button.dataset?.autoKey ?? "");
    const active = autoControls.has(key);
    button.classList?.toggle?.("is-active", active);
    button.setAttribute?.("aria-pressed", String(active));
    button.textContent = active ? "AUTO ✓" : "AUTO";
    const label = button.closest?.("label");
    const input = label?.querySelector?.('input[type="range"]');
    if (!input) continue;
    input.disabled = active;
    input.classList?.toggle?.("is-auto", active);
    if (active) {
      const output = label.querySelector?.("output");
      if (output) output.textContent = "AUTO";
    }
  }
}

function syncEmptyCanvasFacts() {
  const tempo = Number(elementById("tempoControl")?.value);
  const factTempo = elementById("factTempo");
  if (factTempo && Number.isFinite(tempo)) factTempo.textContent = `${Math.round(tempo)} BPM`;

  const bars = Number(elementById("barsControl")?.value);
  const factBars = elementById("factBars");
  if (factBars && Number.isFinite(bars) && bars > 0) factBars.textContent = `${Math.round(bars)} BARS`;

  const key = String(elementById("keyControl")?.value ?? "");
  const mode = String(elementById("modeControl")?.value ?? "");
  const factKey = elementById("factKey");
  if (factKey && key && key !== "auto" && mode && mode !== "auto") {
    factKey.textContent = `${key} ${mode.replace(/([a-z])([A-Z])/g, "$1 $2")}`.toUpperCase();
  }
}

function deferEmptyCanvasFacts() {
  const task = () => syncEmptyCanvasFacts();
  // Initial app hydration can render once after session restore. Reconcile the
  // staged empty-canvas facts both immediately and after that first render so
  // a placeholder song fallback never overwrites the user's staged settings.
  if (typeof globalThis?.queueMicrotask === "function") globalThis.queueMicrotask(task);
  else Promise.resolve().then(task);
  if (typeof globalThis?.setTimeout === "function") {
    globalThis.setTimeout(task, 0);
    globalThis.setTimeout(task, 20);
  }
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
    generationPreferences: captureGenerationPreferences(),
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

  const parsed = stored.value;
  if (!parsed || parsed.schema !== schema) {
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

export function applyPersistedSessionState(state, restored) {
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
