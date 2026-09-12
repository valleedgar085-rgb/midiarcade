import { clamp } from "../utils.js";

export function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

export function validPersistedNote(note, totalBeats) {
  if (!isRecord(note)) return false;
  const pitch = Number(note.pitch);
  const start = Number(note.start);
  const duration = Number(note.duration);
  const velocity = Number(note.velocity);
  return Number.isFinite(pitch) && pitch >= 0 && pitch <= 127
    && Number.isFinite(start) && start >= 0 && start <= totalBeats + 1
    && Number.isFinite(duration) && duration > 0 && duration <= totalBeats + 1
    && Number.isFinite(velocity) && velocity >= 0 && velocity <= 127;
}

export function validPersistedSong(song, { trackOrder = [] } = {}) {
  if (!isRecord(song) || !isRecord(song.meta) || !Array.isArray(song.tracks)) return false;
  const totalBeats = Number(song.meta.totalBeats);
  const tempo = Number(song.meta.tempo ?? song.bpm);
  if (!Number.isFinite(totalBeats) || totalBeats <= 0 || totalBeats > 4096) return false;
  if (!Number.isFinite(tempo) || tempo < 30 || tempo > 300) return false;
  if (song.tracks.length !== trackOrder.length) return false;

  const ids = new Set();
  let noteCount = 0;
  for (const track of song.tracks) {
    if (!isRecord(track) || !trackOrder.includes(track.id) || ids.has(track.id) || !Array.isArray(track.notes)) return false;
    if (track.settings != null && !isRecord(track.settings)) return false;
    if (track.automation != null && (!Array.isArray(track.automation) || !track.automation.every(isRecord))) return false;
    noteCount += track.notes.length;
    if (noteCount > 100_000 || !track.notes.every((note) => validPersistedNote(note, totalBeats))) return false;
    ids.add(track.id);
  }

  if (!trackOrder.every((id) => ids.has(id))) return false;
  for (const key of ["sections", "structure", "form"]) {
    const sections = song[key];
    if (sections != null && (
      !Array.isArray(sections)
      || sections.length > 128
      || !sections.every(isRecord)
    )) return false;
  }
  if (song.idea != null && !isRecord(song.idea)) return false;
  if (song.settings != null && !isRecord(song.settings)) return false;
  return true;
}

export function finiteSetting(value, fallback, min, max, { integer = false } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const bounded = clamp(numeric, min, max);
  return integer ? Math.round(bounded) : bounded;
}

function clone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

export function sanitizePersistedTrackSettings(value, {
  defaults = {},
  trackOrder = [],
} = {}) {
  const source = isRecord(value) ? value : {};
  const result = clone(defaults);
  for (const id of trackOrder) {
    const saved = isRecord(source[id]) ? source[id] : {};
    const fallback = result[id] ?? {};
    result[id] = {
      density: finiteSetting(saved.density, fallback.density, 0, 100, { integer: true }),
      variation: finiteSetting(saved.variation, fallback.variation, 0, 100, { integer: true }),
      octave: finiteSetting(saved.octave, fallback.octave, -2, 2, { integer: true }),
      program: finiteSetting(saved.program, fallback.program, 0, 127, { integer: true }),
      volume: finiteSetting(saved.volume, fallback.volume, 0, 1),
      velocity: finiteSetting(saved.velocity, fallback.velocity, 0.1, 1.5),
      pan: finiteSetting(saved.pan, fallback.pan, -1, 1),
      reverb: finiteSetting(saved.reverb, fallback.reverb, 0, 1),
      cutoff: finiteSetting(saved.cutoff, fallback.cutoff, 1000, 14000),
      resonance: finiteSetting(saved.resonance, fallback.resonance, 0, 1),
      gate: finiteSetting(saved.gate, fallback.gate, 0.08, 1.5),
      humanize: finiteSetting(saved.humanize, fallback.humanize, 0, 1),
      feel: finiteSetting(saved.feel, fallback.feel, 0, 1),
      waveform: ["sine", "triangle", "square", "sawtooth"].includes(saved.waveform)
        ? saved.waveform
        : (fallback.waveform ?? "triangle"),
      synthCutoff: finiteSetting(saved.synthCutoff, fallback.synthCutoff ?? 3500, 150, 14000),
      synthResonance: finiteSetting(saved.synthResonance, fallback.synthResonance ?? 1.2, 0.1, 14),
      attack: finiteSetting(saved.attack, fallback.attack ?? 0.01, 0.002, 0.6),
      release: finiteSetting(saved.release, fallback.release ?? 0.25, 0.04, 2.5),
      detune: finiteSetting(saved.detune, fallback.detune ?? 0, -35, 35),
      attitude: ["neutral", "power", "motion", "bloom", "hush"].includes(saved.attitude)
        ? saved.attitude
        : fallback.attitude,
    };
  }
  return result;
}

export function sanitizeTasteProfile(value, { genreIds = [] } = {}) {
  const source = isRecord(value) ? value : {};
  const numeric = (key) => Math.max(0, Number(source[key]) || 0);
  return {
    ratings: numeric("ratings"),
    likes: numeric("likes"),
    rejects: numeric("rejects"),
    favorites: numeric("favorites"),
    energyTotal: numeric("energyTotal"),
    complexityTotal: numeric("complexityTotal"),
    variationTotal: numeric("variationTotal"),
    genreVotes: isRecord(source.genreVotes) ? Object.fromEntries(
      Object.entries(source.genreVotes)
        .filter(([genre]) => genreIds.includes(genre))
        .map(([genre, vote]) => [genre, Number(vote) || 0]),
    ) : {},
    songRatings: isRecord(source.songRatings) ? Object.fromEntries(
      Object.entries(source.songRatings)
        .slice(-64)
        .map(([id, rating]) => [String(id).slice(0, 96), String(rating).slice(0, 16)]),
    ) : {},
  };
}
