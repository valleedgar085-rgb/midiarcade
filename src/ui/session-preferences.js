import {
  GENERATION_PREFERENCE_IDS,
  sanitizeGenerationPreferences,
} from "../core/session-runtime.js";

function elementById(id) {
  const doc = globalThis?.document;
  if (!doc) return null;
  if (typeof doc.getElementById === "function") return doc.getElementById(id);
  if (typeof doc.querySelector === "function") return doc.querySelector(`#${id}`);
  return null;
}

export function captureGenerationPreferences() {
  const preferences = {};
  for (const id of GENERATION_PREFERENCE_IDS) {
    const control = elementById(id);
    if (!control || control.value == null) continue;
    preferences[id] = String(control.value).slice(0, 80);
  }
  return preferences;
}

export function applyGenerationPreferences(preferences = {}) {
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

export function syncAutoPresentation(autoControls = new Set()) {
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

export function syncEmptyCanvasFacts() {
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

export function deferEmptyCanvasFacts() {
  const task = () => syncEmptyCanvasFacts();
  if (typeof globalThis?.queueMicrotask === "function") globalThis.queueMicrotask(task);
  else Promise.resolve().then(task);
  if (typeof globalThis?.setTimeout === "function") {
    globalThis.setTimeout(task, 0);
    globalThis.setTimeout(task, 20);
  }
}
