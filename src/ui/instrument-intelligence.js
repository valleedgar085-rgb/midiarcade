// Create-page instrument macros. Separate versioned preference store: never
// writes into song state or MIDI export. Auto retains legacy generator defaults.
export const INSTRUMENT_INTELLIGENCE_KEY = "midi-arcade/instrument-intelligence-v1";
export const INSTRUMENT_INTELLIGENCE = Object.freeze([
  { id: "drums", title: "Drums", label: "Groove Tightness", value: 65, active: true },
  { id: "bass", title: "Bass", label: "Cohesion", value: 80, active: true },
  { id: "chords", title: "Chords", label: "Harmonic Richness", value: 55, active: false },
  { id: "melody", title: "Melody", label: "Hook Strength", value: 80, active: false },
  { id: "counterpoint", title: "Counterline", label: "Interaction", value: 45, active: false },
  { id: "pad", title: "Atmosphere", label: "Presence", value: 35, active: false },
  { id: "arp", title: "Arpeggio", label: "Movement", value: 40, active: false },
]);
const bounded = (n, fallback) => Number.isFinite(Number(n))
  ? Math.max(0, Math.min(100, Math.round(Number(n)))) : fallback;
export function defaultInstrumentIntelligence() {
  return Object.fromEntries(INSTRUMENT_INTELLIGENCE.map((item) => [item.id,
    { auto: true, value: item.value }]));
}
export function normalizeInstrumentIntelligence(raw) {
  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  return Object.fromEntries(INSTRUMENT_INTELLIGENCE.map((item) => {
    const value = source[item.id];
    return [item.id, {
      auto: value?.auto !== false,
      value: bounded(value?.value, item.value),
    }];
  }));
}
export function loadInstrumentIntelligence(storage = globalThis.localStorage) {
  try {
    return normalizeInstrumentIntelligence(JSON.parse(storage?.getItem(INSTRUMENT_INTELLIGENCE_KEY) ?? "null"));
  } catch {
    return defaultInstrumentIntelligence();
  }
}
export function saveInstrumentIntelligence(settings, storage = globalThis.localStorage) {
  const normalized = normalizeInstrumentIntelligence(settings);
  try { storage?.setItem(INSTRUMENT_INTELLIGENCE_KEY, JSON.stringify(normalized)); }
  catch { /* unavailable/private storage: keep current in-memory values */ }
  return normalized;
}
let preferences = null;
export function instrumentIntelligenceSettings() {
  if (!preferences) preferences = loadInstrumentIntelligence();
  return preferences;
}
export function setInstrumentIntelligence(id, change, storage = globalThis.localStorage) {
  if (!INSTRUMENT_INTELLIGENCE.some((item) => item.id === id)) return instrumentIntelligenceSettings();
  preferences = saveInstrumentIntelligence({
    ...instrumentIntelligenceSettings(),
    [id]: { ...instrumentIntelligenceSettings()[id], ...change },
  }, storage);
  return preferences;
}
export function resolveInstrumentIntelligence(config, settings = instrumentIntelligenceSettings()) {
  // Auto path is exactly neutral. Only the two verified existing knobs are
  // mapped in Phase 1. Never add unknown generator options to config.
  const drums = settings?.drums;
  const bass = settings?.bass;
  if (drums?.auto !== false && bass?.auto !== false) return config;
  const updated = { ...config };
  if (drums?.auto === false) {
    // Higher tightness means less syncopation; no note timing/export rewriting.
    updated.syncopation = Math.max(0, Math.min(1, (100 - bounded(drums.value, 65)) / 100));
  }
  if (bass?.auto === false) {
    // Reduce wandering by dialing down the existing bass variation control.
    // Density, pitch authority, harmony and preview-to-MIDI parity are untouched.
    const tracks = { ...config.trackControls };
    const existing = tracks.bass ?? {};
    tracks.bass = { ...existing, variation: Math.max(0.12, Math.min(0.9,
      (100 - bounded(bass.value, 80)) / 100 * 0.78 + 0.12)) };
    updated.trackControls = tracks;
    updated.tracks = tracks;
  }
  return updated;
}
export function mountInstrumentIntelligence(rootDocument = globalThis.document, createPanel = null) {
  const panel = createPanel ?? rootDocument?.querySelector?.("#tab-create");
  const deck = panel?.querySelector?.(".create-performance-deck");
  if (!deck || panel.querySelector("#instrumentIntelligencePanel") || !rootDocument?.createElement) return false;
  const section = rootDocument.createElement("section");
  section.id = "instrumentIntelligencePanel";
  section.className = "instrument-intelligence-panel";
  section.setAttribute("aria-label", "Instrument intelligence");
  const heading = rootDocument.createElement("div");
  heading.className = "instrument-intelligence-heading";
  heading.innerHTML = '<div><strong>INSTRUMENT INTELLIGENCE</strong><small>Auto follows the genre. Manual drums and bass guide the next generation.</small></div>';
  section.append(heading);
  const initial = instrumentIntelligenceSettings();
  for (const item of INSTRUMENT_INTELLIGENCE) {
    const row = rootDocument.createElement("div");
    row.className = "instrument-intelligence-row";
    const label = rootDocument.createElement("label");
    const input = rootDocument.createElement("input");
    const output = rootDocument.createElement("output");
    const toggleLabel = rootDocument.createElement("label");
    const toggle = rootDocument.createElement("input");
    const value = initial[item.id];
    input.type = "range";
    input.min = "0"; input.max = "100"; input.step = "5";
    input.id = "intelligence-" + item.id;
    input.value = String(value.value);
    input.disabled = value.auto || !item.active;
    input.setAttribute("aria-label", item.title + " " + item.label);
    output.htmlFor = input.id; output.textContent = String(value.value) + "%";
    label.htmlFor = input.id;
    label.textContent = item.title + " · " + item.label;
    toggle.type = "checkbox";
    toggle.checked = value.auto;
    toggle.disabled = !item.active;
    toggle.setAttribute("aria-label", "Auto " + item.title);
    toggleLabel.textContent = item.active ? "Auto " : "Planned ";
    toggleLabel.append(toggle);
    if (!item.active) row.title = "Musical mapping planned for a later phase";
    row.append(label, input, output, toggleLabel);
    if (!item.active) row.classList.add("is-planned");
    toggle.addEventListener("change", () => {
      const latest = setInstrumentIntelligence(item.id, { auto: toggle.checked });
      input.disabled = latest[item.id].auto || !item.active;
    });
    input.addEventListener("input", () => {
      const latest = setInstrumentIntelligence(item.id, { value: input.value });
      output.textContent = latest[item.id].value + "%";
    });
    section.append(row);
  }
  // Under the song card in the existing unified direction surface.
  const live = deck.querySelector(".create-live-controls");
  if (live) live.insertAdjacentElement("afterend", section);
  else deck.append(section);
  return true;
}
