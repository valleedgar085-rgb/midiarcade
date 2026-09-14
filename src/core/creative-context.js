const ELEMENT_META = Object.freeze({
  fire: Object.freeze({ id: "fire", label: "Fire", glyph: "🔥", character: "Heat · impact" }),
  electric: Object.freeze({ id: "electric", label: "Electric", glyph: "⚡", character: "Voltage · motion" }),
  drip: Object.freeze({ id: "drip", label: "Drip", glyph: "💧", character: "Flow · space" }),
});

function cleanText(value, fallback = "") {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function cleanNumber(value, fallback = null) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function freezeRecord(record) {
  return Object.freeze({ ...record });
}

export function normalizeElementId(value) {
  const raw = cleanText(value).toLowerCase();
  if (raw === "0" || raw.includes("fire")) return "fire";
  if (raw === "1" || raw.includes("electric")) return "electric";
  if (raw === "2" || raw.includes("drip")) return "drip";
  return null;
}

export function elementMeta(value) {
  const id = normalizeElementId(value);
  return id ? ELEMENT_META[id] : null;
}

export function normalizeCreativeContext(input = {}) {
  const songInput = input.song ?? {};
  const directionInput = input.direction ?? {};
  const selectedElement = elementMeta(input.element?.id ?? input.element ?? null);

  const song = freezeRecord({
    title: cleanText(songInput.title, "Current idea"),
    genre: cleanText(songInput.genre, "AUTO STYLE"),
    keyMode: cleanText(songInput.keyMode, "AUTO KEY"),
    tempo: cleanText(songInput.tempo, "AUTO BPM"),
    bars: cleanText(songInput.bars, "AUTO LENGTH"),
    groove: cleanText(songInput.groove, "AUTO POCKET"),
    dnaFingerprint: cleanText(songInput.dnaFingerprint, "--"),
    dnaScore: cleanText(songInput.dnaScore, "--"),
  });

  const direction = freezeRecord({
    status: cleanText(directionInput.status, "CURRENT SONG"),
    genreId: cleanText(directionInput.genreId, "auto"),
    secondaryGenreId: cleanText(directionInput.secondaryGenreId, "none"),
    key: cleanText(directionInput.key, "auto"),
    mode: cleanText(directionInput.mode, "auto"),
    tempo: cleanNumber(directionInput.tempo),
    bars: cleanText(directionInput.bars, "auto"),
    groove: cleanText(directionInput.groove, "auto"),
    energy: cleanNumber(directionInput.energy),
    complexity: cleanNumber(directionInput.complexity),
    variation: cleanNumber(directionInput.variation),
    evolution: cleanNumber(directionInput.evolution),
    surprise: cleanNumber(directionInput.surprise),
  });

  return Object.freeze({
    version: 1,
    source: "create",
    song,
    direction,
    element: selectedElement,
  });
}

export function creativeContextChips(context) {
  const normalized = normalizeCreativeContext(context);
  const chips = [
    normalized.song.genre,
    normalized.song.keyMode,
    normalized.song.tempo,
    normalized.song.groove,
  ].filter(Boolean);
  if (normalized.element) chips.push(`${normalized.element.glyph} ${normalized.element.label}`);
  return Object.freeze(chips);
}

export function creativeContextSignature(context) {
  const normalized = normalizeCreativeContext(context);
  return [
    normalized.song.title,
    normalized.song.genre,
    normalized.song.keyMode,
    normalized.song.tempo,
    normalized.song.bars,
    normalized.song.groove,
    normalized.song.dnaFingerprint,
    normalized.element?.id ?? "base",
  ].join("|");
}

export { ELEMENT_META };
