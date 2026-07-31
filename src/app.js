import {
  CHORD_PATH_DEFAULTS_BY_GENRE,
  CHORD_PATH_IDS,
  encodeMidi,
  generateNew,
  generateSectionVariations,
  generateSimilar,
  GENRE_PROFILES,
  ONE_SHOT_KITS,
  TRACK_DEFINITIONS,
} from "./music-engine.js";
import { clamp } from "./utils.js";
import { buildSectionMatrix, updateSectionBars, updateSectionEnergy, updateSectionInstrumentMask, calculateNextQueuedSection, getSongSections } from "./core/arranger-matrix.js";
import { createMidiInputManager } from "./midi-input.js";
import { createAppStore, createInitialAppState } from "./core/app-store.js";
import { createSessionStorage } from "./core/session-storage.js";
import { createGenerationRunner } from "./core/generation-runner.js";
import { createGenerationExecutor } from "./core/generation-executor.js";
import { applyGenerationTheme } from "./core/generation-theme.js";
import { createWorkspaceController } from "./ui/workspace-controller.js";
import { createRenderCoordinator } from "./ui/render-coordinator.js";
import { createPlaybackView, shouldRefreshPlaybackDetails } from "./ui/playback-view.js";
import {
  analyzeSectionRelationship,
  nearestScalePitch,
  transposeScaleStep,
} from "./ui/shape-logic.js";
import { executeArrangementCommand } from "./ui/arrangement-logic.js";
import { coverArtworkDataUrl, coverArtworkFinish, createCoverArtworkSvg } from "./cover-art.js";
import {
  GENERATION_STATUS_COPY,
  generationIntentCopy,
  trackRewriteStatus,
} from "./ui/copy-catalog.js";
import {
  ATTITUDE_ADJUSTMENTS,
  ATTITUDE_LABELS,
  resolveControlHelp,
  TRACK_EXPRESSION_KEYS,
  TRACK_META,
  TRACK_ORDER,
  WORKFLOW_COPY,
} from "./ui/control-catalog.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const GENRE_IDS = ["neoSoul", "hipHop", "rap", "trap", "house", "techno", "drumBass", "synthwave", "pop", "loFiHipHop", "rnbSoul", "drill", "reggaeton", "afrobeats", "jazz", "ambient", "funk", "country", "rock"];

const PATCHES = {
  drums: [[0, "Arcade Kit"], [8, "Room Kit"], [16, "Power Kit"], [24, "Electronic Kit"], [25, "TR Kit"]],
  bass: [[32, "Acoustic Bass"], [33, "Fingered Electric"], [34, "Picked Electric"], [35, "Fretless Bass"], [36, "Slap Bass"], [37, "Pop Slap Bass"], [38, "Sub Synth"], [39, "Rubber Synth"], [43, "Contrabass"], [87, "Bass + Lead"], [88, "New Age Sub"]],
  chords: [[0, "Studio Grand"], [4, "Velvet Electric Piano"], [5, "Crystal Electric Piano"], [6, "Harpsichord"], [7, "Clavinet"], [11, "Vibraphone"], [12, "Soft Marimba"], [16, "Drawbar Organ"], [17, "Percussive Organ"], [19, "Church Organ"], [24, "Nylon Guitar"], [25, "Steel Guitar"], [27, "Clean Electric Guitar"], [29, "Overdriven Guitar"], [30, "Distortion Guitar"], [48, "String Ensemble"], [52, "Choir Aahs"], [61, "Brass Stabs"], [62, "Synth Brass"], [81, "Saw Chords"], [89, "Warm Pad"], [90, "Polysynth"], [95, "Sweep Texture"]],
  melody: [[24, "Nylon Guitar Lead"], [25, "Steel Guitar Lead"], [26, "Jazz Guitar Lead"], [29, "Overdriven Guitar Lead"], [30, "Distortion Guitar Lead"], [40, "Solo Violin"], [56, "Muted Trumpet"], [65, "Alto Sax"], [68, "Oboe Lead"], [71, "Clarinet Lead"], [73, "Soft Flute"], [80, "Soft Square"], [81, "Warm Saw"], [82, "Calliope Lead"], [84, "Charang Lead"], [85, "Air Voice"], [86, "Fifths Lead"], [87, "Bass + Lead"]],
  counterpoint: [[10, "Music Box"], [11, "Vibraphone"], [14, "Tubular Bell"], [24, "Nylon Guitar"], [25, "Steel Guitar"], [27, "Clean Electric Guitar"], [29, "Overdriven Guitar"], [40, "Solo Violin"], [48, "String Ensemble"], [53, "Voice Oohs"], [56, "Muted Trumpet"], [65, "Alto Sax"], [71, "Clarinet"], [73, "Soft Flute"], [80, "Soft Square"], [81, "Warm Saw"], [82, "Calliope"], [84, "Charang Pluck"], [85, "Air Voice"], [86, "Fifths Lead"], [98, "Crystal"]],
  pad: [[48, "String Ensemble"], [51, "Synth Strings"], [52, "Choir Aahs"], [54, "Synth Voice"], [88, "New Age Pad"], [89, "Warm Pad"], [90, "Polysynth"], [91, "Choir Pad"], [92, "Bowed Glass"], [93, "Metallic Pad"], [94, "Halo Pad"], [95, "Sweep Pad"], [96, "Rain Texture"], [99, "Atmosphere FX"]],
};
const ONE_SHOT_KIT_BY_ID = new Map(ONE_SHOT_KITS.map((kit) => [kit.id, kit]));

function oneShotKitForSong(song = state.song) {
  return ONE_SHOT_KIT_BY_ID.get(song?.oneShotKit?.id) ?? ONE_SHOT_KITS[0];
}

const PROGRAM_NAMES = {
  0: "Acoustic Grand Piano", 4: "Electric Piano 1", 5: "Electric Piano 2", 6: "Harpsichord",
  7: "Clavinet", 10: "Music Box", 11: "Vibraphone", 12: "Marimba", 14: "Tubular Bells",
  16: "Drawbar Organ", 17: "Percussive Organ", 19: "Church Organ", 24: "Nylon Guitar",
  25: "Steel Guitar", 26: "Jazz Guitar", 27: "Clean Electric Guitar", 29: "Overdriven Guitar",
  30: "Distortion Guitar", 32: "Acoustic Bass", 33: "Fingered Electric Bass",
  34: "Picked Electric Bass", 35: "Fretless Bass", 36: "Slap Bass", 37: "Slap Bass 2",
  38: "Synth Bass 1", 39: "Synth Bass 2", 40: "Violin", 43: "Contrabass",
  48: "String Ensemble", 51: "Synth Strings", 52: "Choir Aahs", 53: "Voice Oohs",
  54: "Synth Voice", 56: "Muted Trumpet", 61: "Brass Section", 62: "Synth Brass",
  65: "Alto Sax", 68: "Oboe", 71: "Clarinet", 73: "Flute", 80: "Square Lead",
  81: "Saw Lead", 82: "Calliope Lead",
  84: "Charang Lead", 85: "Voice Lead", 86: "Fifths Lead", 87: "Bass + Lead",
  88: "New Age Pad", 89: "Warm Pad", 90: "Polysynth Pad", 91: "Choir Pad",
  92: "Bowed Pad", 93: "Metallic Pad", 94: "Halo Pad", 95: "Sweep Pad",
  96: "Rain FX", 98: "Crystal FX", 99: "Atmosphere FX",
};

const GENRE_GROOVE_DEFAULTS = {
  neoSoul: "laidback", hipHop: "laidback", rap: "laidback", trap: "straight", house: "straight",
  techno: "straight", drumBass: "syncopated", synthwave: "straight", pop: "straight",
  loFiHipHop: "laidback", rnbSoul: "laidback", drill: "straight", reggaeton: "straight",
  afrobeats: "syncopated", jazz: "shuffled", ambient: "straight", funk: "syncopated",
  country: "shuffled", rock: "straight",
};

const GENRE_GUIDANCE = {
  neoSoul: "Elastic drums, rich voicings and a vocal pocket with room to breathe.",
  hipHop: "Head-nod drums, sample-minded harmony and hooks that land behind the beat.",
  rap: "Verse-first beats with vocal space, firm backbeats, grounded bass and sparse hooks between the bars.",
  trap: "Half-time weight, animated hats and selective rolls that frame the downbeat.",
  house: "Four-on-the-floor momentum, bright stabs and bass built around the kick.",
  techno: "Focused repetition, evolving motion and disciplined tension across the arrangement.",
  drumBass: "Fast breakbeat energy, grounded sub movement and sharp phrase-level contrast.",
  synthwave: "Driving electronic drums, nostalgic harmony and widescreen melodic color.",
  pop: "Immediate hooks, clean section lifts and a rhythm pocket made to support the song.",
  loFiHipHop: "Dusty drums, warm chord stabs and a lazy swing that feels like a rainy afternoon.",
  rnbSoul: "Slow-burning groove, gospel-touched chords and vocals that breathe deep and wide.",
  drill: "Sliding 808s, fast animated hats and half-time weight that hits like concrete.",
  reggaeton: "Dembow pulse, syncopated bass and chord stabs built for the dance floor.",
  afrobeats: "Polyrhythmic percussion, bright harmony and a groove that refuses to stop moving.",
  jazz: "Swinging bass, extended chord colors and a conversation between every instrument.",
  ambient: "Long pad tones, gentle movement and space left wide open for the listener to fill.",
  funk: "Tight 16th-note pocket, slap bass snap and stabs that catch you off guard.",
  country: "Story-led harmony, train-beat motion, acoustic picking and memorable open-road hooks.",
  rock: "Live backbeat weight, driving guitars and bass, and choruses built for a full-band lift.",
};

const RECIPES = [
  {
    name: "Neon afterglow",
    text: "Warm extensions, syncopated bass and a melody that leaves room to breathe.",
    tags: ["SOULFUL", "WIDE", "SYNCOPATED"],
    mode: "dorian", groove: "syncopated", energy: 68, complexity: 54,
  },
  {
    name: "Velvet machinery",
    text: "Precise drums meet soft chords, restless arpeggios and a patient low end.",
    tags: ["HYPNOTIC", "CLEAN", "DRIVING"],
    mode: "minor", groove: "straight", energy: 76, complexity: 63,
  },
  {
    name: "Sunday on Saturn",
    text: "Weightless harmony, elastic rhythm and a hook with a little sunlight in it.",
    tags: ["DREAMY", "LIFTED", "PLAYFUL"],
    mode: "lydian", groove: "laidback", energy: 55, complexity: 47,
  },
  {
    name: "Chrome confetti",
    text: "Bright stabs, quick-footed drums and surprising answers around every corner.",
    tags: ["BOLD", "GLITCHY", "BRIGHT"],
    mode: "mixolydian", groove: "shuffled", energy: 88, complexity: 72,
  },
  {
    name: "Blue hour radio",
    text: "A restrained pocket, suspended colors and phrases that glow after they end.",
    tags: ["INTIMATE", "LATE-NIGHT", "WARM"],
    mode: "minorPentatonic", groove: "laidback", energy: 42, complexity: 38,
  },
];

const TITLE_LEFT = ["Velvet", "Satellite", "Electric", "Midnight", "Paper", "Golden", "Chrome", "Soft", "Neon", "Pocket", "Quiet", "Summer"];
const TITLE_RIGHT = ["Polaroid", "Daydream", "Mirage", "Frequency", "Firefly", "Arcade", "Afterglow", "Parade", "Weather", "Blueprint", "Comet", "Cinema"];
const SESSION_STORAGE_KEY = "midi-arcade/session-v2";
const SESSION_SCHEMA = 2;
let rejectedPersistedSession = false;
const appStore = createAppStore(createInitialAppState());
const state = appStore.getState();
const sessionStorage = createSessionStorage({
  key: SESSION_STORAGE_KEY,
  schema: SESSION_SCHEMA,
  storageProvider: () => typeof window !== "undefined" ? window.localStorage : null,
});

function handleMidiInputEvent(event) {
  if (!event) return;
  if (event.type === "noteon") {
    void player.liveNoteOn(event.pitch, event.velocity);
  } else if (event.type === "noteoff") {
    player.liveNoteOff(event.pitch);
  }
}

export function shouldDisconnectStaleMidiConnection(connectedId, requestedId) {
  if (!connectedId || !requestedId) return false;
  return connectedId !== requestedId;
}

export function getScaleChordGuide(song = state.song, startBeat = 0) {
  const key = song?.global?.key || song?.key || song?.meta?.key || "C";
  const mode = song?.global?.mode || song?.mode || song?.meta?.mode || "minor";
  const harmony = Array.isArray(song?.harmony) ? song.harmony : [];
  const currentHarmony = harmony.find((ev) => {
    const s = Number(ev.startBeat ?? ev.start ?? 0);
    const d = Number(ev.duration ?? ev.durationBeats ?? 4);
    return startBeat >= s && startBeat < s + d;
  }) || harmony[0];

  const symbol = currentHarmony?.symbol || currentHarmony?.roman || currentHarmony?.chord?.symbol || currentHarmony?.chord?.roman || key;
  const roman = currentHarmony?.roman || currentHarmony?.chord?.roman || "i";
  const quality = currentHarmony?.quality || currentHarmony?.chord?.quality || "triad";
  const notes = Array.isArray(currentHarmony?.notes)
    ? currentHarmony.notes
    : Array.isArray(currentHarmony?.chord?.notes)
      ? currentHarmony.chord.notes
      : [key];

  const CHROMATIC = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  const rootIndex = CHROMATIC.indexOf(key) >= 0 ? CHROMATIC.indexOf(key) : 0;
  const MODE_INTERVALS = {
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
    dorian: [0, 2, 3, 5, 7, 9, 10],
    mixolydian: [0, 2, 4, 5, 7, 9, 10],
    lydian: [0, 2, 4, 6, 7, 9, 11],
    phrygian: [0, 1, 3, 5, 7, 8, 10],
    locrian: [0, 1, 3, 5, 6, 8, 10],
    harmonicMinor: [0, 2, 3, 5, 7, 8, 11],
  };
  const intervals = MODE_INTERVALS[mode] || MODE_INTERVALS.minor;
  const scaleNotes = intervals.map((i) => CHROMATIC[(rootIndex + i) % 12]);

  return {
    key,
    mode,
    scaleNotes,
    chord: {
      symbol,
      roman,
      quality,
      notes,
    },
  };
}

function handleMidiDevicesChanged(_devices = []) {
  /* MIDI hot-plug notification listener */
}

const midiInput = createMidiInputManager({
  onNote: handleMidiInputEvent,
  onDevicesChanged: handleMidiDevicesChanged,
  onError(error) {
    console.warn("MIDI input bridge warning", error);
  },
});

export async function discoverMidiDevices(options) {
  return midiInput.refreshDevices(options);
}

let sessionSaveTimer = null;
let midiConnectionRequestGeneration = 0;
let latestMidiRequestedDeviceId = "onscreen";

function persistedSession() {
  return {
    schema: SESSION_SCHEMA,
    savedAt: new Date().toISOString(),
    song: state.song,
    trackSettings: state.trackSettings,
    muted: [...state.muted],
    solo: [...state.solo],
    locked: [...state.locked],
    autoControls: [...state.autoControls],
    selectedTrack: state.selectedTrack,
    guidedMode: state.guidedMode,
    recipeIndex: state.recipeIndex,
    tasteProfile: state.tasteProfile,
  };
}

export function saveSessionNow() {
  clearTimeout(sessionSaveTimer);
  sessionSaveTimer = null;
  if (!state.song) return false;
  const result = sessionStorage.save(persistedSession());
  if (result.ok) {
    const status = $("#autosaveStatus");
    if (status) status.innerHTML = "<i></i> SAVED ON DEVICE";
    return true;
  }
  if (result.error) console.warn("Session autosave was unavailable", result.error);
  const status = $("#autosaveStatus");
  if (status) status.textContent = "SESSION OPEN";
  return false;
}

function scheduleSessionSave() {
  clearTimeout(sessionSaveTimer);
  sessionSaveTimer = setTimeout(() => {
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(() => saveSessionNow(), { timeout: 1000 });
    } else {
      saveSessionNow();
    }
  }, 400);
}

function discardPersistedSession() {
  sessionStorage.discard();
}

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function validPersistedNote(note, totalBeats) {
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

function validPersistedSong(song) {
  if (!isRecord(song) || !isRecord(song.meta) || !Array.isArray(song.tracks)) return false;
  const totalBeats = Number(song.meta.totalBeats);
  const tempo = Number(song.meta.tempo ?? song.bpm);
  if (!Number.isFinite(totalBeats) || totalBeats <= 0 || totalBeats > 4096) return false;
  if (!Number.isFinite(tempo) || tempo < 30 || tempo > 300) return false;
  if (song.tracks.length !== TRACK_ORDER.length) return false;
  const ids = new Set();
  let noteCount = 0;
  for (const track of song.tracks) {
    if (!isRecord(track) || !TRACK_ORDER.includes(track.id) || ids.has(track.id) || !Array.isArray(track.notes)) return false;
    if (track.settings != null && !isRecord(track.settings)) return false;
    if (track.automation != null && (!Array.isArray(track.automation) || !track.automation.every(isRecord))) return false;
    noteCount += track.notes.length;
    if (noteCount > 100_000 || !track.notes.every((note) => validPersistedNote(note, totalBeats))) return false;
    ids.add(track.id);
  }
  if (!TRACK_ORDER.every((id) => ids.has(id))) return false;
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

function finiteSetting(value, fallback, min, max, { integer = false } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const bounded = clamp(numeric, min, max);
  return integer ? Math.round(bounded) : bounded;
}

function sanitizePersistedTrackSettings(value) {
  const source = isRecord(value) ? value : {};
  const result = deepClone(DEFAULT_TRACK_SETTINGS);
  for (const id of TRACK_ORDER) {
    const saved = isRecord(source[id]) ? source[id] : {};
    const fallback = result[id];
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
      waveform: ["sine", "triangle", "square", "sawtooth"].includes(saved.waveform) ? saved.waveform : (fallback.waveform ?? "triangle"),
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



function sanitizeTasteProfile(value) {
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
      Object.entries(source.genreVotes).filter(([genre]) => GENRE_IDS.includes(genre)).map(([genre, vote]) => [genre, Number(vote) || 0]),
    ) : {},
    songRatings: isRecord(source.songRatings) ? Object.fromEntries(
      Object.entries(source.songRatings).slice(-64).map(([id, rating]) => [String(id).slice(0, 96), String(rating).slice(0, 16)]),
    ) : {},
  };
}

export function restorePersistedSession() {
  rejectedPersistedSession = false;
  const stored = sessionStorage.load();
  if (stored.status === "empty" || stored.status === "unavailable") return false;
  if (stored.status !== "ready") {
    if (stored.error) console.warn("Saved session was corrupt and has been ignored", stored.error);
    rejectedPersistedSession = true;
    discardPersistedSession();
    return false;
  }
  try {
    const parsed = stored.value;
    if (!parsed || parsed.schema !== SESSION_SCHEMA || !validPersistedSong(parsed.song)) {
      rejectedPersistedSession = true;
      discardPersistedSession();
      return false;
    }
    state.song = deepClone(parsed.song);
    state.trackSettings = sanitizePersistedTrackSettings(parsed.trackSettings);
    state.muted = new Set(Array.isArray(parsed.muted) ? parsed.muted.filter((id) => TRACK_ORDER.includes(id)) : []);
    state.solo = new Set(Array.isArray(parsed.solo) ? parsed.solo.filter((id) => TRACK_ORDER.includes(id)) : []);
    state.locked = new Set(Array.isArray(parsed.locked) ? parsed.locked.filter((id) => TRACK_ORDER.includes(id)) : []);
    state.autoControls = new Set(
      Array.isArray(parsed.autoControls)
        ? parsed.autoControls.filter((key) => typeof key === "string" && key.length <= 80).slice(0, 128)
        : [],
    );
    state.selectedTrack = TRACK_ORDER.includes(parsed.selectedTrack) ? parsed.selectedTrack : "drums";
    state.guidedMode = parsed.guidedMode !== false;
    state.recipeIndex = clamp(Math.round(Number(parsed.recipeIndex) || 0), 0, RECIPES.length - 1);
    state.tasteProfile = sanitizeTasteProfile(parsed.tasteProfile);
    return true;
  } catch (error) {
    console.warn("Saved session was corrupt and has been ignored", error);
    rejectedPersistedSession = true;
    discardPersistedSession();
    return false;
  }
}

const editorNoteIds = new WeakMap();
let editorNoteIdCounter = 0;

for (const [index, id] of TRACK_ORDER.entries()) {
  const defaults = TRACK_DEFINITIONS[id] || {};
  state.trackSettings[id] = {
    density: [68, 58, 48, 52, 28, 34][index],
    variation: [36, 44, 31, 52, 63, 24][index],
    octave: 0,
    program: PATCHES[id][0][0],
    volume: clamp(Number(defaults.volume ?? 0.8), 0, 1),
    velocity: clamp(Number(defaults.velocity ?? 1), 0.1, 1.5),
    pan: clamp(Number(defaults.pan ?? 0), -1, 1),
    reverb: clamp(Number(defaults.reverb ?? 0.2), 0, 1),
    cutoff: clamp(Number(defaults.cutoff ?? 8000), 1000, 14000),
    resonance: clamp(Number(defaults.resonance ?? 0.2), 0, 1),
    gate: clamp(Number(defaults.gate ?? 0.9), 0.08, 1.5),
    humanize: clamp(Number(defaults.humanize ?? 0.7), 0, 1),
    feel: clamp(Number(defaults.feel ?? 0.7), 0, 1),
    attitude: "neutral",
  };
}

const DEFAULT_TRACK_SETTINGS = deepClone(state.trackSettings);

function hashNumber(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function deepClone(value) {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value));
}

function helpForControl(element) {
  return resolveControlHelp(element);
}

function showControlHelp(element) {
  const help = helpForControl(element);
  if (!help || !$("#contextHelpTitle") || !$("#contextHelpText")) return;
  $("#contextHelpTitle").textContent = help[0];
  $("#contextHelpText").textContent = help[1];
}

function applyControlDescriptions(root = document) {
  const controls = root.querySelectorAll?.("button, input, select, summary") ?? [];
  for (const control of controls) {
    const help = helpForControl(control);
    if (!help) continue;
    control.dataset.helpTitle = help[0];
    control.dataset.helpText = help[1];
    control.setAttribute("aria-description", help[1]);
    if (!control.getAttribute?.("title")) control.setAttribute("title", `${help[0]} — ${help[1]}`);
  }
}

function bindControlHelp() {
  const findControl = (target) => target?.closest?.("button, input, select, summary") ?? target;
  document.addEventListener("focusin", (event) => showControlHelp(findControl(event.target)));
  document.addEventListener("pointerover", (event) => showControlHelp(findControl(event.target)));
}

function renderWorkflow() {
  const step = clamp(Math.round(Number(state.workflowStep) || 1), 1, 4);
  const copy = WORKFLOW_COPY[step];
  $("#workflowProgress").textContent = `STEP ${step} OF 4`;
  $("#workflowCoachTitle").textContent = copy.title;
  $("#workflowCoachText").textContent = copy.text;
  $("#workflowAction").innerHTML = `${copy.action} <span>→</span>`;
  $$('[data-workflow-step]').forEach((button) => {
    const buttonStep = Number(button.dataset.workflowStep);
    button.classList.toggle("is-active", buttonStep === step);
    button.classList.toggle("is-complete", buttonStep < step);
    if (buttonStep === step) button.setAttribute("aria-current", "step");
    else button.removeAttribute("aria-current");
  });
  document.body.classList.toggle("guided-off", !state.guidedMode);
  $("#guidedModeButton").setAttribute("aria-pressed", String(state.guidedMode));
  $("#guidedModeButton").innerHTML = `Guided mode <b>${state.guidedMode ? "ON" : "OFF"}</b>`;
}

function focusRelationship(trackId, section) {
  const sectionName = section?.name || "the full arrangement";
  const relationships = {
    drums: `Drums establish the pocket through ${sectionName}; bass movement and every phrase lean against that pulse.`,
    bass: `Bass interlocks with the kick through ${sectionName}, translating harmony into physical movement.`,
    chords: `Chords define the emotional gravity of ${sectionName}; melody and counterline inherit their available color.`,
    melody: `Melody carries the memorable identity across ${sectionName}, while the counterline protects its breathing room.`,
    counterpoint: `Counterline answers the main motif inside ${sectionName}, filling silence without competing for attention.`,
    pad: `Atmosphere controls depth and emotional air around ${sectionName}, binding transitions without crowding the rhythm.`,
  };
  return relationships[trackId] || `Every instrument contributes to ${sectionName}, and every edit reaches preview and export.`;
}

function renderCreativeThread() {
  if (!state.song || !$("#creativeThread")) return;
  const trackId = TRACK_ORDER.includes(state.selectedTrack) ? state.selectedTrack : "drums";
  const meta = TRACK_META[trackId];
  const section = editorSection();
  const bars = songBars();
  const notes = songTracks().reduce((sum, track) => sum + trackNotes(track).length, 0);
  document.body.style.setProperty("--focus-color", meta.color);
  $("#creativeThread").style.setProperty("--thread-color", meta.color);
  $("#threadSongName").textContent = deriveTitle();
  $("#threadSongMeta").textContent = `${bars} bars · ${notes} MIDI notes`;
  $("#threadSectionName").textContent = section?.name || "Full song";
  $("#threadSectionMeta").textContent = section
    ? `Bars ${section.start + 1}–${section.start + section.bars} · piano roll open`
    : `${normalizeSections().length} sections · choose from the map`;
  $("#threadSectionButton").classList.toggle("has-focus", Boolean(section));
  $("#threadTrackName").textContent = meta.name;
  $("#threadTrackMeta").textContent = `${meta.role} · shared focus`;
  $("#transportContext").textContent = `${section?.name || "Full song"} · ${meta.name} focus`;
  $("#threadRelationship").textContent = focusRelationship(trackId, section);
  $("#threadActionButton").innerHTML = section
    ? `Continue editing ${section.name} <span>↘</span>`
    : `Choose a section to edit <span>↘</span>`;
  if (!player?.playing) $("#threadLiveSection").textContent = section ? `${section.name} ready from bar ${section.start + 1}` : "Ready to listen";
}

function playbackViewForSong(song = state.song) {
  return createPlaybackView({
    sections: normalizeSections(song),
    bars: songBars(song),
    bpm: songBpm(song),
    beatsPerBar: Number(song?.meta?.beatsPerBar ?? 4),
  });
}

function updateCreativeThreadPlayback(position, duration, { view = playbackViewForSong(), refreshDetails = true } = {}) {
  if (!state.song || !$("#threadProgress")) return;
  const ratio = clamp(position / Math.max(0.01, duration), 0, 1);
  $("#threadProgress").style.setProperty("--thread-progress", `${ratio * 100}%`);
  document.body.classList.toggle("is-playing", Boolean(player?.playing));
  if (!refreshDetails) return;
  const beat = position * view.bpm / 60;
  const beatsPerBar = view.beatsPerBar;
  const playingSection = view.sectionAtBeat(beat);
  const nextId = player?.playing ? playingSection?.id || null : null;
  if (state.playingSection !== nextId) {
    state.playingSection = nextId;
    $$("[data-section], [data-showcase-section]").forEach((element) => {
      const id = element.dataset.section || element.dataset.showcaseSection;
      element.classList.toggle("is-playing-section", id === nextId);
    });
  }
  $("#threadLiveSection").textContent = player?.playing && playingSection
    ? `${playingSection.name} · bar ${Math.floor(beat / beatsPerBar) + 1}`
    : editorSection()
      ? `${editorSection().name} ready from bar ${editorSection().start + 1}`
      : "Ready to listen";
}

export function setWorkflowStep(step, { force = false } = {}) {
  const next = clamp(Math.round(Number(step) || 1), 1, 4);
  appStore.transaction("workflow:advance", (draft) => {
    draft.workflowStep = force ? next : Math.max(draft.workflowStep, next);
  });
  renderWorkflow();
}

function scrollToControl(selector) {
  $(selector)?.scrollIntoView?.({ behavior: "smooth", block: "center" });
}

function runWorkflowAction() {
  if (state.workflowStep === 1) {
    switchWorkspace("create");
    scrollToControl("#directionTitle");
    showControlHelp($("#genreControl"));
    return;
  }
  if (state.workflowStep === 2) {
    player.toggle();
    return;
  }
  if (state.workflowStep === 3) {
    switchWorkspace("mix");
    scrollToControl("#attitudeStrip");
    selectAttitudeTrack(state.selectedTrack || "drums");
    return;
  }
  exportSong();
}

let seedSequence = 0;

function createSeed() {
  seedSequence = (seedSequence + 1) >>> 0;
  const cryptoObject = globalThis.crypto;
  const entropy = cryptoObject?.getRandomValues
    ? cryptoObject.getRandomValues(new Uint32Array(1))[0]
    : Math.floor(Math.random() * 0xffffffff);
  return [
    "arcade",
    Date.now().toString(36),
    seedSequence.toString(36),
    (entropy || 1).toString(36),
  ].join("-");
}

function formatSeed(seed) {
  const str = String(seed ?? "1");
  const hash = hashNumber(str);
  return hash.toString(16).toUpperCase().padStart(6, "0").slice(-6);
}

function readNumber(selector, fallback = 0) {
  const value = Number($(selector)?.value);
  return Number.isFinite(value) ? value : fallback;
}

function selectedGenreId() {
  const value = String($("#genreControl")?.value || "neoSoul");
  return GENRE_PROFILES[value] ? value : "neoSoul";
}

function genreProfile(id = selectedGenreId()) {
  return GENRE_PROFILES[id] || GENRE_PROFILES.neoSoul || Object.values(GENRE_PROFILES)[0] || {};
}

function genreLabel(id = selectedGenreId(), profile = genreProfile(id)) {
  return String(profile.label || profile.name || id)
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function tempoRangeFrom(value, fallbackProfile = genreProfile()) {
  const source = value || fallbackProfile.bpm || fallbackProfile.tempoRange || {};
  if (Array.isArray(source)) {
    const min = Number(source[0]);
    const max = Number(source[1] ?? source[0]);
    return { min, max, default: Number(source[2] ?? Math.round((min + max) / 2)) };
  }
  const min = Number(source.min ?? source.low ?? fallbackProfile.bpm?.min ?? 72);
  const max = Number(source.max ?? source.high ?? fallbackProfile.bpm?.max ?? 112);
  const defaultTempo = Number(source.default ?? source.recommended ?? fallbackProfile.bpm?.default ?? Math.round((min + max) / 2));
  return {
    min: Number.isFinite(min) ? min : 72,
    max: Number.isFinite(max) ? max : 112,
    default: Number.isFinite(defaultTempo) ? defaultTempo : 92,
  };
}

function tempoPocket(tempo, range) {
  if (tempo < range.min) return "below";
  if (tempo > range.max) return "above";
  return "in";
}

function songGenreId(song = state.song) {
  const raw = song?.idea?.genreId ?? song?.genre ?? song?.meta?.genre ?? song?.config?.genre ?? selectedGenreId();
  const id = typeof raw === "object" ? raw.id : raw;
  return GENRE_PROFILES[id] ? id : selectedGenreId();
}

function listText(value, fallback = []) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (value == null || value === "") return fallback;
  return [String(value)];
}

function profilePrograms(id, profile = genreProfile()) {
  const source = profile.instrumentPrograms?.[id]
    ?? profile.programPalettes?.[id]
    ?? profile.programs?.[id]
    ?? profile.soundPalette?.[id]
    ?? [];
  const values = Array.isArray(source) ? source : [source];
  return [...new Set(values.map((entry) => Number(
    Array.isArray(entry) ? entry[0] : entry?.program ?? entry?.value ?? entry,
  )).filter(Number.isFinite))];
}

function profileNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function fallbackProgramName(id, program) {
  const numericProgram = Number(program);
  return PATCHES[id]?.find(([candidate]) => Number(candidate) === numericProgram)?.[1]
    || PROGRAM_NAMES[numericProgram]
    || `GM Program ${numericProgram + 1}`;
}

function probabilityPercent(value, fallback = 0) {
  const numeric = Number(value);
  const safe = Number.isFinite(numeric) ? numeric : fallback;
  return Math.round(clamp(safe <= 1 ? safe * 100 : safe, 0, 100));
}

function profileRhythmDefaults(profile = genreProfile()) {
  const rhythm = profile.rhythm || profile.rhythmProbabilities || {};
  return {
    triplet: probabilityPercent(profile.tripletChance ?? rhythm.tripletChance ?? rhythm.triplets, 0.16),
    roll: probabilityPercent(profile.snareRollChance ?? rhythm.snareRollChance ?? rhythm.rolls, 0.12),
  };
}

function rhythmAmountLabel(value) {
  const amount = clamp(Math.round(Number(value) || 0), 0, 100);
  const feel = amount === 0
    ? "OFF"
    : amount <= 15
      ? "SUBTLE"
      : amount <= 35
        ? "LIGHT"
        : amount <= 60
          ? "PRESENT"
          : amount <= 80
            ? "SPICY"
            : "BOLD";
  return `${amount}% · ${feel}`;
}

function applyGenreDefaultsToControls(id = selectedGenreId(), { includeMode = true } = {}) {
  const profile = genreProfile(id);
  const range = tempoRangeFrom(profile.bpm, profile);
  const rhythm = profileRhythmDefaults(profile);
  $("#tempoControl").value = clamp(Math.round(range.default), 62, 190);
  $("#swingControl").value = clamp(Math.round(profileNumber(profile.swing, 0.12) * 100), 0, 65);
  $("#humanizeControl").value = clamp(Math.round(profileNumber(profile.humanize, 0.18) * 100), 0, 35);
  $("#tripletControl").value = rhythm.triplet;
  $("#rollControl").value = rhythm.roll;
  $("#grooveControl").value = GENRE_GROOVE_DEFAULTS[id] || "straight";
  if (includeMode && $("#modeControl").value !== "auto") {
    const preferredMode = profile.preferredScales?.[0];
    if (preferredMode && [...$("#modeControl").options].some((option) => option.value === preferredMode)) {
      $("#modeControl").value = preferredMode;
    }
  }
}

const MODE_DESCRIPTIONS = {
  major: "Bright, uplifting & resolved",
  minor: "Natural, reflective & dark",
  dorian: "Soulful minor with a bright 6th",
  mixolydian: "Bluesy, driving major with flat 7th",
  lydian: "Dreamy & floating with raised 4th",
  phrygian: "Tense, mysterious & dark minor",
  minorPentatonic: "Open, bluesy & foolproof",
};

function renderModeGuidance() {
  const mode = $("#modeControl")?.value || "dorian";
  const desc = mode === "auto"
    ? "Auto chooses a scale color that belongs to the selected genre"
    : MODE_DESCRIPTIONS[mode] || "Balanced scale color";
  if ($("#modeGuidance")) $("#modeGuidance").textContent = desc;
}

function transposeKey(delta) {
  const currentKey = $("#keyControl")?.value || "C";
  const index = NOTE_NAMES.indexOf(currentKey);
  if (index === -1) return;
  const nextIndex = (index + delta + 12) % 12;
  $("#keyControl").value = NOTE_NAMES[nextIndex];
  renderGenerationIntent();
  scheduleSessionSave();
  showToast(`Root key ${NOTE_NAMES[nextIndex]} is staged for the next generation.`);
}

const AUTO_GENERATION_RANGE_IDS = new Set([
  "tempoControl", "energyControl", "complexityControl", "swingControl", "humanizeControl",
  "tripletControl", "rollControl", "variationControl", "evolutionControl", "surpriseControl",
]);
const AUTO_TRACK_RANGE_KEYS = new Set([
  "volume", "density", "variation", "octave", "velocity", "gate", "pan", "reverb", "cutoff", "resonance",
]);
const AUTO_SELECT_IDS = new Set(["keyControl", "modeControl", "barsControl", "grooveControl", "chordPathControl"]);

function autoKeyForRange(input) {
  if (input.id && AUTO_GENERATION_RANGE_IDS.has(input.id)) return input.id;
  const trackId = input.closest?.(".track-card")?.dataset.track;
  const control = input.dataset.control;
  return trackId && AUTO_TRACK_RANGE_KEYS.has(control) ? `track:${trackId}:${control}` : null;
}

function syncAutoRangeControl(input, key = autoKeyForRange(input)) {
  if (!input || !key) return;
  const active = state.autoControls.has(key);
  input.disabled = active;
  input.classList.toggle("is-auto", active);
  const button = input.closest("label")?.querySelector(`[data-auto-key="${key}"]`);
  if (button) {
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
    button.textContent = active ? "AUTO ✓" : "AUTO";
  }
  const output = input.closest("label")?.querySelector("output");
  if (active && output) output.textContent = "AUTO";
}

function decorateAutoRangeControls(root = document) {
  const ranges = root.querySelectorAll?.('input[type="range"]') ?? [];
  for (const input of ranges) {
    const key = autoKeyForRange(input);
    const label = input.closest("label");
    if (!key || !label) continue;
    if (!label.querySelector(`[data-auto-key="${key}"]`)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "auto-control-button";
      button.dataset.autoKey = key;
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", `Let MIDI Arcade choose ${input.getAttribute("aria-label") || key}`);
      button.textContent = "AUTO";
      label.append(button);
    }
    syncAutoRangeControl(input, key);
  }
}

function syncAutoSelects() {
  for (const id of AUTO_SELECT_IDS) {
    const control = $(`#${id}`);
    if (control && state.autoControls.has(id) && [...control.options].some((option) => option.value === "auto")) {
      control.value = "auto";
    }
  }
}

function toggleAutoControl(key) {
  if (!key) return;
  state.autoControls.has(key) ? state.autoControls.delete(key) : state.autoControls.add(key);
  const input = $$('input[type="range"]').find((candidate) => autoKeyForRange(candidate) === key);
  syncAutoRangeControl(input, key);
  updateRangeDisplays();
  renderGenerationIntent();
  scheduleSessionSave();
  showToast(state.autoControls.has(key)
    ? "Auto is ready. The next generation will make this choice from the song seed and genre."
    : "Manual control restored at its previous value.");
}

function autoUnit(seed, key) {
  return hashNumber(`${seed}:auto:${key}`) / 0xffffffff;
}

function autoNumber(seed, key, min, max, step = 1) {
  const raw = min + autoUnit(seed, key) * (max - min);
  return Math.round(raw / step) * step;
}

function autoGenerationValue(id, seed, profile, fallback) {
  const tempo = tempoRangeFrom(profile.bpm, profile);
  const rhythm = profileRhythmDefaults(profile);
  const profileSwing = profileNumber(profile.swing, 0.12) * 100;
  const profileHumanize = profileNumber(profile.humanize, 0.18) * 100;
  const ranges = {
    tempoControl: [tempo.min, tempo.max, 1],
    energyControl: [38, 92, 1],
    complexityControl: [30, 86, 1],
    swingControl: [clamp(profileSwing - 8, 0, 65), clamp(profileSwing + 10, 0, 65), 1],
    humanizeControl: [clamp(profileHumanize - 7, 0, 35), clamp(profileHumanize + 8, 0, 35), 1],
    tripletControl: [clamp(rhythm.triplet * 0.55, 0, 100), clamp(rhythm.triplet * 1.45 + 8, 0, 100), 1],
    rollControl: [clamp(rhythm.roll * 0.5, 0, 100), clamp(rhythm.roll * 1.5 + 7, 0, 100), 1],
    variationControl: [34, 88, 1],
    evolutionControl: [38, 90, 1],
    surpriseControl: [12, 74, 1],
  };
  const range = ranges[id];
  return range ? autoNumber(seed, id, ...range) : fallback;
}

function autoTrackValue(id, key, seed, fallback) {
  const ranges = {
    volume: [id === "pad" ? 0.48 : 0.66, id === "drums" ? 0.98 : 0.94, 0.01],
    density: [id === "counterpoint" ? 18 : 30, id === "drums" ? 92 : 86, 1],
    variation: [24, 90, 1],
    octave: [-1, 1, 1],
    velocity: [0.72, 1.18, 0.01],
    gate: [id === "drums" ? 0.55 : 0.62, id === "pad" ? 1.35 : 1.12, 0.01],
    pan: [-0.42, 0.42, 0.01],
    reverb: [id === "drums" ? 0.04 : 0.12, id === "pad" ? 0.72 : 0.58, 0.01],
    cutoff: [3600, 12800, 100],
    resonance: [0.08, 0.52, 0.01],
  };
  const range = ranges[key];
  return range ? autoNumber(seed, `${id}:${key}`, ...range) : fallback;
}

function chordPathChoicesForGenre(genreId = selectedGenreId()) {
  const preferred = CHORD_PATH_DEFAULTS_BY_GENRE[genreId];
  const ordered = preferred ? [preferred] : CHORD_PATH_IDS;
  return [...new Set([...ordered, ...CHORD_PATH_IDS])];
}

function selectedSecondaryGenreId() {
  const value = String($("#secondaryGenreControl")?.value || "none");
  return value !== "none" && GENRE_PROFILES[value] ? value : null;
}

export function buildConfig(seed = createSeed(), { isNew = false } = {}) {
  const profile = genreProfile();
  const genreId = selectedGenreId();
  const secondaryGenre = selectedSecondaryGenreId();
  const rhythm = profileRhythmDefaults(profile);
  const selectedGroove = $("#grooveControl").value;
  const grooveChoices = ["straight", "laidback", "shuffled", "syncopated"];
  const groove = selectedGroove === "auto"
    ? grooveChoices[hashNumber(`${seed}:auto:groove`) % grooveChoices.length]
    : selectedGroove;
  const grooveSettings = {
    straight: { syncopation: 0.2, drumFills: 0.42 },
    laidback: { syncopation: 0.34, drumFills: 0.36 },
    shuffled: { syncopation: 0.48, drumFills: 0.56 },
    syncopated: { syncopation: 0.72, drumFills: 0.64 },
  }[groove] || { syncopation: 0.38, drumFills: 0.5 };
  const tasteAverages = state.tasteProfile.ratings > 0 ? {
    energyControl: state.tasteProfile.energyTotal / state.tasteProfile.ratings,
    complexityControl: state.tasteProfile.complexityTotal / state.tasteProfile.ratings,
    variationControl: state.tasteProfile.variationTotal / state.tasteProfile.ratings,
  } : {};
  const generationValue = (id, fallback) => {
    const selected = state.autoControls.has(id)
      ? autoGenerationValue(id, seed, profile, fallback)
      : readNumber(`#${id}`, fallback);
    const learned = tasteAverages[id];
    return state.autoControls.has(id) && Number.isFinite(learned)
      ? selected * 0.72 + learned * 0.28
      : selected;
  };
  const complexity = generationValue("complexityControl", 54) / 100;
  const selectedKey = $("#keyControl").value;
  const selectedMode = $("#modeControl").value;
  const selectedBars = $("#barsControl").value;
  const selectedChordPath = $("#chordPathControl")?.value || "auto";
  const resolvedKey = selectedKey === "auto"
    ? NOTE_NAMES[hashNumber(`${seed}:auto:key`) % NOTE_NAMES.length]
    : selectedKey;
  const preferredModes = profile.preferredScales?.filter((mode) => mode !== "auto") ?? ["major", "minor"];
  const resolvedMode = selectedMode === "auto"
    ? preferredModes[hashNumber(`${seed}:auto:mode`) % preferredModes.length]
    : selectedMode;
  const barChoices = [16, 24, 32, 48, 64];
  const resolvedBars = selectedBars === "auto"
    ? barChoices[hashNumber(`${seed}:auto:bars`) % barChoices.length]
    : readNumber("#barsControl", 32);
  const chordPathChoices = chordPathChoicesForGenre(genreId);
  const resolvedChordPath = selectedChordPath === "auto"
    ? chordPathChoices[hashNumber(`${seed}:auto:chord-path:${genreId}`) % chordPathChoices.length]
    : selectedChordPath;
  const trackControls = {};
  for (const id of TRACK_ORDER) {
    const settings = state.trackSettings[id];
    const trackValue = (key) => state.autoControls.has(`track:${id}:${key}`)
      ? autoTrackValue(id, key, seed, settings[key])
      : settings[key];
    trackControls[id] = {
      density: trackValue("density") / 100,
      variation: trackValue("variation") / 100,
      octave: clamp((TRACK_DEFINITIONS[id]?.octave || 0) + trackValue("octave"), 0, 8),
      ...(isNew ? {} : { program: settings.program }),
      volume: clamp(trackValue("volume"), 0, 1),
      velocity: clamp(trackValue("velocity"), 0.1, 1.5),
      pan: clamp(trackValue("pan"), -1, 1),
      reverb: clamp(trackValue("reverb"), 0, 1),
      cutoff: clamp(trackValue("cutoff"), 1000, 14000),
      resonance: clamp(trackValue("resonance"), 0, 1),
      gate: clamp(trackValue("gate"), 0.08, 1.5),
      humanize: clamp(settings.humanize, 0, 1),
      feel: clamp(settings.feel, 0, 1),
      mute: state.muted.has(id),
      solo: state.solo.has(id),
    };
  }

  return {
    seed,
    genre: genreId,
    key: resolvedKey,
    root: resolvedKey,
    mode: resolvedMode,
    chordPath: resolvedChordPath,
    tempo: generationValue("tempoControl", 112),
    bpm: generationValue("tempoControl", 112),
    bars: resolvedBars,
    groove,
    energy: generationValue("energyControl", 68) / 100,
    complexity,
    syncopation: clamp(profileNumber(profile.syncopation, grooveSettings.syncopation) * (0.72 + grooveSettings.syncopation * 0.55), 0, 1),
    drumFills: clamp(profileNumber(profile.arrangement?.fillFrequency, grooveSettings.drumFills) * (0.72 + grooveSettings.drumFills * 0.55), 0, 1),
    chordExtensions: clamp(profileNumber(profile.chordExtensions, 0.4) * (0.58 + complexity * 0.78), 0, 1),
    harmonicRhythm: clamp(profileNumber(profile.harmonicRhythm, 0.34) * (0.68 + complexity * 0.62), 0, 1),
    swing: generationValue("swingControl", 14) / 100,
    humanize: generationValue("humanizeControl", 9) / 100,
    tripletAmount: clamp(generationValue("tripletControl", rhythm.triplet) / 100, 0, 1),
    rollAmount: clamp(generationValue("rollControl", rhythm.roll) / 100, 0, 1),
    variation: generationValue("variationControl", 42) / 100,
    evolution: generationValue("evolutionControl", 58) / 100,
    surprise: generationValue("surpriseControl", 28) / 100,
    similarity: clamp(1 - generationValue("variationControl", 42) / 165, 0.58, 0.92),
    trackControls,
    tracks: trackControls,
    tasteProfile: deepClone(state.tasteProfile),
  };
}

const GENERATION_SETTING_IDS = [
  "genreControl", "keyControl", "modeControl", "tempoControl", "barsControl", "grooveControl", "chordPathControl",
  "energyControl", "complexityControl", "swingControl", "humanizeControl", "tripletControl", "rollControl",
  "variationControl", "evolutionControl", "surpriseControl",
];
let appliedGenerationSettings = null;

function generationSettingsSnapshot() {
  return {
    ...Object.fromEntries(GENERATION_SETTING_IDS.map((id) => [id, String($(`#${id}`)?.value ?? "")])),
    autoControls: [...state.autoControls].filter((key) => (
      AUTO_GENERATION_RANGE_IDS.has(key) || AUTO_SELECT_IDS.has(key)
    )).sort().join("|"),
  };
}

function renderGenerationIntent() {
  const panel = $("#generationIntent");
  if (!panel) return;
  const current = generationSettingsSnapshot();
  const staged = Boolean(appliedGenerationSettings && (
    GENERATION_SETTING_IDS.some((id) => current[id] !== appliedGenerationSettings[id])
    || current.autoControls !== appliedGenerationSettings.autoControls
  ));
  const copy = generationIntentCopy(staged);
  panel.classList.toggle("is-staged", staged);
  $("#generationIntentLabel").textContent = copy.label;
  $("#generationIntentTitle").textContent = copy.title;
  $("#generationIntentCopy").textContent = copy.body;
}

function captureAppliedGenerationSettings() {
  appliedGenerationSettings = generationSettingsSnapshot();
  renderGenerationIntent();
}

function songSeed(song = state.song) {
  return String(song?.seed ?? song?.genome?.seed ?? song?.meta?.seed ?? "1");
}

function songBpm(song = state.song) {
  return Number(song?.bpm ?? song?.tempo ?? song?.meta?.tempo ?? song?.global?.tempo ?? song?.config?.tempo ?? 112);
}

function songBars(song = state.song) {
  return Number(song?.bars ?? song?.meta?.bars ?? song?.global?.bars ?? song?.config?.bars ?? 32);
}

function songMode(song = state.song) {
  return String(song?.mode ?? song?.meta?.scale ?? song?.global?.key?.mode ?? song?.config?.mode ?? $("#modeControl").value);
}

function songKey(song = state.song) {
  const raw = song?.key ?? song?.meta?.key ?? song?.global?.key?.tonic ?? song?.config?.key ?? $("#keyControl").value;
  return typeof raw === "number" ? NOTE_NAMES[((raw % 12) + 12) % 12] : String(raw);
}

function songTracks(song = state.song) {
  if (Array.isArray(song?.tracks)) return song.tracks;
  if (Array.isArray(song?.renderedTracks)) return song.renderedTracks;
  return [];
}

function trackId(track, index = 0) {
  const raw = String(track?.id ?? track?.role ?? track?.name ?? TRACK_ORDER[index] ?? `track-${index}`).toLowerCase();
  if (raw.includes("drum") || raw.includes("perc")) return "drums";
  if (raw.includes("bass")) return "bass";
  if (raw.includes("chord") || raw.includes("harmon") || raw.includes("key")) return "chords";
  if (raw.includes("melod") || raw.includes("lead")) return "melody";
  if (raw.includes("counter") || raw.includes("arp") || raw.includes("pluck")) return "counterpoint";
  if (raw.includes("pad") || raw.includes("atmos") || raw.includes("texture")) return "pad";
  return raw;
}

function trackNotes(track) {
  return Array.isArray(track?.notes) ? track.notes : Array.isArray(track?.events) ? track.events.filter((event) => event.pitch != null || event.note != null) : [];
}

function notePitch(note) {
  return Number(note?.pitch ?? note?.note ?? note?.midi ?? 60);
}

function noteStart(note) {
  return Number(note?.start ?? note?.tick ?? note?.startTick ?? note?.time ?? 0);
}

function noteDuration(note) {
  return Math.max(0.01, Number(note?.duration ?? note?.durationTicks ?? note?.length ?? note?.ticks ?? 0.25));
}

function noteVelocity(note) {
  const raw = Number(note?.velocity ?? note?.vel ?? 90);
  return raw <= 1 ? Math.round(raw * 127) : raw;
}

function deriveTitle(song = state.song) {
  if (song?.title) return song.title;
  const hash = hashNumber(songSeed(song));
  return `${TITLE_LEFT[hash % TITLE_LEFT.length]} ${TITLE_RIGHT[(hash >>> 8) % TITLE_RIGHT.length]}`;
}

function normalizeSections(song = state.song) {
  const source = song?.sections ?? song?.structure ?? song?.form ?? song?.arrangement;
  const validSections = Array.isArray(source)
    ? source.filter((section) => section && typeof section === "object")
    : [];
  if (validSections.length) {
    let runningBar = 0;
    return validSections.map((section, index) => {
      const start = Number(section.startBar ?? section.start ?? section.bar ?? runningBar);
      const bars = Number(section.bars ?? section.length ?? section.durationBars ?? 4);
      const rawName = String(section.name ?? section.label ?? section.id ?? `Part ${index + 1}`).replace(/[-_]+/g, " ");
      runningBar = start + bars;
      return {
        id: String(section.id ?? section.name ?? `section-${index}`),
        name: rawName.replace(/\b\w/g, (letter) => letter.toUpperCase()),
        start,
        bars,
        energy: Number(section.energy ?? section.intensity ?? 0.5),
      };
    });
  }

  const total = songBars(song);
  const templates = total <= 16
    ? [["Intro", 4], ["Verse", 4], ["Hook", 4], ["Outro", 4]]
    : total <= 24
      ? [["Intro", 4], ["Verse", 8], ["Hook", 8], ["Outro", 4]]
      : [["Intro", 4], ["Verse", 8], ["Hook", 8], ["Lift", Math.max(4, total - 24)], ["Outro", 4]];
  let cursor = 0;
  return templates.map(([name, bars], index) => {
    const section = { id: `${name.toLowerCase()}-${index}`, name, start: cursor, bars, energy: 0.35 + index * 0.12 };
    cursor += bars;
    return section;
  });
}

const DRUM_NOTE_NAMES = {
  35: "Acoustic Kick", 36: "Kick", 37: "Side Stick", 38: "Snare", 39: "Clap", 40: "Electric Snare",
  41: "Low Tom", 43: "Floor Tom", 45: "Mid Tom", 47: "High-Mid Tom", 48: "High Tom", 49: "Crash",
  50: "High Tom", 51: "Ride", 42: "Closed Hat", 44: "Pedal Hat", 46: "Open Hat", 57: "Crash 2",
};

function editorNoteId(note) {
  if (!editorNoteIds.has(note)) editorNoteIds.set(note, `editor-note-${++editorNoteIdCounter}`);
  return editorNoteIds.get(note);
}

function editorSection() {
  return normalizeSections().find((section) => section.id === state.focusedSection) || null;
}

function editorTrack() {
  return songTracks().find((track, index) => trackId(track, index) === state.editorTrack) || songTracks()[0] || null;
}

function editorBeatRange(section = editorSection()) {
  const beatsPerBar = Number(state.song?.meta?.beatsPerBar ?? 4);
  return section
    ? { start: section.start * beatsPerBar, end: (section.start + section.bars) * beatsPerBar, beatsPerBar }
    : { start: 0, end: 0, beatsPerBar };
}

function setNoteField(note, field, value) {
  const keys = {
    start: ["start", "tick", "startTick", "time"],
    duration: ["duration", "durationTicks", "length", "ticks"],
    pitch: ["pitch", "note", "midi"],
    velocity: ["velocity", "vel"],
  }[field];
  const key = keys.find((candidate) => Object.prototype.hasOwnProperty.call(note, candidate)) || keys[0];
  note[key] = field === "velocity" && Number(note[key]) <= 1 ? value / 127 : value;
}

function pitchLabel(pitch, drums = false) {
  if (drums) return DRUM_NOTE_NAMES[pitch] || `Drum ${pitch}`;
  return `${NOTE_NAMES[((pitch % 12) + 12) % 12]}${Math.floor(pitch / 12) - 1}`;
}

export { nearestScalePitch, transposeScaleStep };

const EDITOR_PARTNERS = Object.freeze({
  drums: "bass",
  bass: "drums",
  chords: "melody",
  melody: "counterpoint",
  counterpoint: "melody",
  pad: "chords",
});

function editorEntries(track = editorTrack(), section = editorSection()) {
  if (!track || !section) return [];
  const range = editorBeatRange(section);
  return trackNotes(track).map((note, index) => ({ note, index, id: editorNoteId(note) }))
    .filter(({ note }) => noteStart(note) >= range.start - 1e-7 && noteStart(note) < range.end - 1e-7);
}

function editorPitchRows(entries, drums = state.editorTrack === "drums") {
  const used = [...new Set(entries.map(({ note }) => Math.round(notePitch(note))))];
  if (drums) {
    const essentials = [57, 51, 49, 46, 44, 42, 40, 39, 38, 37, 36, 35, 50, 48, 47, 45, 43, 41];
    return [...new Set([...used, ...essentials])].sort((a, b) => b - a);
  }
  const minPitch = used.length ? Math.min(...used) : state.editorTrack === "bass" ? 36 : 52;
  const maxPitch = used.length ? Math.max(...used) : state.editorTrack === "bass" ? 53 : 72;
  const center = Math.round((minPitch + maxPitch) / 2);
  const rowCount = clamp(Math.max(18, maxPitch - minPitch + 7), 18, 30);
  let low = clamp(center - Math.floor(rowCount / 2), 0, 127 - rowCount + 1);
  if (minPitch < low + 2) low = clamp(minPitch - 2, 0, 127 - rowCount + 1);
  if (maxPitch > low + rowCount - 3) low = clamp(maxPitch - rowCount + 3, 0, 127 - rowCount + 1);
  return Array.from({ length: rowCount }, (_, index) => low + rowCount - 1 - index);
}

function selectedEditorEntries(entries = editorEntries()) {
  return entries.filter((entry) => state.editorSelection.has(entry.id));
}

function sortEditorTrackNotes(track = editorTrack()) {
  if (Array.isArray(track?.notes)) track.notes.sort((a, b) => noteStart(a) - noteStart(b) || notePitch(a) - notePitch(b));
}

function finishEditorMutation(message, { keepSelection = true } = {}) {
  player.stop();
  refreshSongIdea(state.song);
  sortEditorTrackNotes();
  if (!keepSelection) state.editorSelection.clear();
  renderSummary();
  renderTimeline();
  renderTrackRack();
  renderSectionEditor(message);
  renderCreativeThread();
  showToast(message);
}

export function applyEditorAction(action) {
  const section = editorSection();
  const track = editorTrack();
  const entries = editorEntries(track, section);
  if (!section || !track) return false;
  if (action === "select-all") {
    state.editorSelection = new Set(entries.map((entry) => entry.id));
    renderSectionEditor(`${entries.length} ${TRACK_META[state.editorTrack]?.name || "track"} notes selected.`);
    return true;
  }
  const selected = selectedEditorEntries(entries);
  if (!selected.length) {
    renderSectionEditor("Select one or more notes first. Shift-click adds notes to the selection.");
    return false;
  }
  const range = editorBeatRange(section);
  const grid = clamp(Number(state.editorGrid) || 0.25, 1 / 12, 1);
  pushHistory();

  if (action === "delete") {
    const selectedNotes = new Set(selected.map((entry) => entry.note));
    track.notes = trackNotes(track).filter((note) => !selectedNotes.has(note));
    finishEditorMutation(`Deleted ${selected.length} note${selected.length === 1 ? "" : "s"}. Undo is ready.`, { keepSelection: false });
    return true;
  }

  if (action === "duplicate") {
    const copies = selected.map(({ note }) => {
      const copy = deepClone(note);
      setNoteField(copy, "start", clamp(noteStart(note) + grid, range.start, range.end - Math.max(grid, noteDuration(note))));
      return copy;
    });
    track.notes.push(...copies);
    state.editorSelection = new Set(copies.map(editorNoteId));
    finishEditorMutation(`Duplicated ${copies.length} note${copies.length === 1 ? "" : "s"}.`);
    return true;
  }

  for (const { note, id } of selected) {
    const duration = noteDuration(note);
    if (action === "quantize") setNoteField(note, "start", clamp(Math.round(noteStart(note) / grid) * grid, range.start, range.end - Math.min(grid, duration)));
    if (action === "humanize") {
      const direction = hashNumber(id) % 2 ? 1 : -1;
      const drift = Math.min(grid * 0.14, 0.035) * direction;
      setNoteField(note, "start", clamp(noteStart(note) + drift, range.start, range.end - Math.min(grid, duration)));
      setNoteField(note, "velocity", clamp(noteVelocity(note) + ((hashNumber(`${id}:velocity`) % 9) - 4), 1, 127));
    }
    if (action === "nudge-left") setNoteField(note, "start", clamp(noteStart(note) - grid, range.start, range.end - Math.min(grid, duration)));
    if (action === "nudge-right") setNoteField(note, "start", clamp(noteStart(note) + grid, range.start, range.end - Math.min(grid, duration)));
    if (action === "shorter") setNoteField(note, "duration", Math.max(grid, duration - grid));
    if (action === "longer") setNoteField(note, "duration", Math.max(grid, Math.min(duration + grid, range.end - noteStart(note))));
    if (state.editorTrack !== "drums") {
      const pitchDelta = { "octave-down": -12, "pitch-down": -1, "pitch-up": 1, "octave-up": 12 }[action];
      if (pitchDelta) {
        const guide = getScaleChordGuide(state.song, noteStart(note));
        const pitch = Math.abs(pitchDelta) === 12
          ? clamp(notePitch(note) + pitchDelta, 0, 127)
          : transposeScaleStep(notePitch(note), pitchDelta, guide);
        setNoteField(note, "pitch", pitch);
      }
    }
  }
  const labels = {
    quantize: "Quantized", humanize: "Humanized", "nudge-left": "Nudged earlier", "nudge-right": "Nudged later",
    shorter: "Shortened", longer: "Lengthened", "octave-down": "Moved down one octave", "pitch-down": "Moved down one semitone",
    "pitch-up": "Moved up one semitone", "octave-up": "Moved up one octave",
  };
  finishEditorMutation(`${labels[action] || "Edited"} ${selected.length} note${selected.length === 1 ? "" : "s"}.`);
  return true;
}

function setEditorVelocity(value) {
  const selected = selectedEditorEntries();
  if (!selected.length) {
    renderSectionEditor("Select notes before changing velocity.");
    return false;
  }
  pushHistory();
  const velocity = clamp(Math.round(Number(value) || 100), 1, 127);
  for (const { note } of selected) setNoteField(note, "velocity", velocity);
  finishEditorMutation(`Set ${selected.length} note${selected.length === 1 ? "" : "s"} to velocity ${velocity}.`);
  return true;
}

function addEditorNote(event) {
  const section = editorSection();
  const track = editorTrack();
  const gridElement = $("#pianoRollGrid");
  if (!section || !track || !gridElement?.getBoundingClientRect) return;
  const entries = editorEntries(track, section);
  const rows = editorPitchRows(entries);
  const rect = gridElement.getBoundingClientRect();
  const beatWidth = state.editorZoom;
  const rowHeight = 22;
  const range = editorBeatRange(section);
  const localBeat = clamp((event.clientX - rect.left) / beatWidth, 0, range.end - range.start - state.editorGrid);
  const start = range.start + Math.round(localBeat / state.editorGrid) * state.editorGrid;
  const row = clamp(Math.floor((event.clientY - rect.top) / rowHeight), 0, rows.length - 1);
  const rawPitch = rows[row];
  const pitch = state.editorTrack === "drums"
    ? rawPitch
    : nearestScalePitch(rawPitch, getScaleChordGuide(state.song, start));
  const note = { pitch, start, duration: state.editorGrid, velocity: Number($("#editorVelocityControl").value || 100) };
  pushHistory();
  track.notes.push(note);
  state.editorSelection = new Set([editorNoteId(note)]);
  finishEditorMutation(`Drew ${pitchLabel(note.pitch, state.editorTrack === "drums")} at beat ${(start - range.start + 1).toFixed(2)}.`);
}

let sectionEditorInteractionsBound = false;

function bindSectionEditorInteractions(container) {
  if (sectionEditorInteractionsBound || !container) return;
  sectionEditorInteractionsBound = true;
  container.addEventListener("click", (event) => {
    const trackButton = event.target.closest?.("[data-editor-track]");
    if (trackButton) {
      selectAttitudeTrack(trackButton.dataset.editorTrack, { announce: false });
      state.editorSelection.clear();
      renderUiRegions("tracks", "timeline", "editor");
      return;
    }
    const noteButton = event.target.closest?.("[data-editor-note]");
    if (!noteButton) return;
    const id = noteButton.dataset.editorNote;
    if (!event.shiftKey && !event.ctrlKey && !event.metaKey) state.editorSelection.clear();
    if (state.editorSelection.has(id) && (event.shiftKey || event.ctrlKey || event.metaKey)) state.editorSelection.delete(id);
    else state.editorSelection.add(id);
    renderUiRegions("editor");
  });
  container.addEventListener("dblclick", (event) => {
    if (event.target.closest?.("[data-editor-note]")) event.stopPropagation();
  }, true);
}

function renderSectionEditor(message = "") {
  const container = $("#sectionEditor");
  const section = editorSection();
  if (!container) return;
  bindSectionEditorInteractions(container);
  const open = Boolean(section && state.song && state.sectionEditorOpen);
  container.classList.toggle("is-open", open);
  container.setAttribute("aria-hidden", String(!open));
  $("#tab-arrange")?.classList.toggle("has-section-focus", open);
  renderArrangeWorkflow();
  if (!open) return;

  const track = editorTrack();
  const entries = editorEntries(track, section);
  const availableIds = new Set(entries.map((entry) => entry.id));
  state.editorSelection = new Set([...state.editorSelection].filter((id) => availableIds.has(id)));
  const selected = selectedEditorEntries(entries);
  const rows = editorPitchRows(entries);
  const range = editorBeatRange(section);
  const meta = TRACK_META[state.editorTrack] || TRACK_META.melody;
  const grid = clamp(Number(state.editorGrid) || 0.25, 1 / 12, 1);
  const guide = getScaleChordGuide(state.song, range.start);
  const partnerId = EDITOR_PARTNERS[state.editorTrack];
  const partnerTrack = songTracks().find((candidate, index) => trackId(candidate, index) === partnerId);
  const partnerEntries = editorEntries(partnerTrack, section);
  container.style.setProperty("--editor-color", meta.color);
  $("#sectionEditorTitle").textContent = `${section.name} · ${meta.name}`;
  $("#sectionEditorSubtitle").textContent = `Bars ${section.start + 1}–${section.start + section.bars} · ${entries.length} notes · edits write directly into the exported MIDI`;
  $("#editorGuideChord").textContent = `${guide.chord.symbol || guide.chord.roman} · ${guide.key} ${guide.mode.replace(/([A-Z])/g, " $1").toLowerCase()}`;
  $("#editorGuideScale").textContent = `${guide.scaleNotes.join(" · ")} · drawn and transposed notes stay in scale`;
  $("#editorOverlayControl").value = state.editorOverlay;
  const relationship = analyzeSectionRelationship(
    entries.map(({ note }) => note),
    partnerEntries.map(({ note }) => note),
  );
  const relationshipLabel = partnerId
    ? `${TRACK_META[state.editorTrack]?.name || "Track"} ↔ ${TRACK_META[partnerId]?.name || partnerId}`
    : "Selected instrument";
  $("#editorRelationshipSummary").innerHTML = `
    <span><small>RELATIONSHIP</small><strong>${relationshipLabel}</strong></span>
    <span><small>SHARED ATTACKS</small><strong>${relationship.sharedAttacks}</strong></span>
    <span><small>BREATHING NOTES</small><strong>${relationship.breathingNotes}</strong></span>
    <span><small>GUIDE</small><strong>${state.editorOverlay === "none" ? "Hidden" : state.editorOverlay === "harmony" ? "Harmony" : "Partner + harmony"}</strong></span>`;

  $("#editorTrackTabs").innerHTML = TRACK_ORDER.map((id) => {
    const trackObject = songTracks().find((candidate, index) => trackId(candidate, index) === id);
    const count = editorEntries(trackObject, section).length;
    const trackMeta = TRACK_META[id];
    return `<button class="editor-track-tab" type="button" role="tab" data-editor-track="${id}" aria-selected="${id === state.editorTrack}" style="--tab-color:${trackMeta.color}"><i></i>${trackMeta.name}<small>${count}</small></button>`;
  }).join("");

  $("#pianoKeyboard").innerHTML = rows.map((pitch) => {
    const black = !state.editorTrack.includes("drum") && [1, 3, 6, 8, 10].includes(((pitch % 12) + 12) % 12);
    const role = state.editorTrack === "drums" ? "" : classifyNoteRole(pitch, guide).role;
    return `<div class="piano-key${black ? " black" : ""}${state.editorTrack === "drums" ? " drum" : ""} ${role}">${pitchLabel(pitch, state.editorTrack === "drums")}</div>`;
  }).join("");

  const rowIndex = new Map(rows.map((pitch, index) => [pitch, index]));
  const notesMarkup = entries.map(({ note, id }) => {
    const pitch = Math.round(notePitch(note));
    const left = Math.max(0, noteStart(note) - range.start) * state.editorZoom;
    const width = Math.max(0.04, Math.min(noteDuration(note), range.end - noteStart(note))) * state.editorZoom;
    const top = (rowIndex.get(pitch) ?? 0) * 22 + 2;
    const selectedClass = state.editorSelection.has(id) ? " is-selected" : "";
    const label = pitchLabel(pitch, state.editorTrack === "drums");
    const role = state.editorTrack === "drums" ? "drum-hit" : classifyNoteRole(note, state.song).role;
    return `<button class="piano-note ${role}${selectedClass}" type="button" data-editor-note="${id}" style="--note-left:${left}px;--note-width:${width}px;--note-top:${top}px" aria-pressed="${state.editorSelection.has(id)}" aria-label="${label}, ${role.replace("-", " ")}, velocity ${noteVelocity(note)}">${label}</button>`;
  }).join("");
  const guideRows = state.editorTrack === "drums" || state.editorOverlay === "none"
    ? ""
    : rows.map((pitch, index) => {
      const role = classifyNoteRole(pitch, guide).role;
      return `<i class="editor-guide-row ${role}" style="--guide-row-top:${index * 22}px"></i>`;
    }).join("");
  const partnerMarkup = state.editorOverlay !== "partner" || !partnerTrack
    ? ""
    : partnerEntries.slice(0, 120).map(({ note }) => {
      const pitch = Math.round(notePitch(note));
      const left = Math.max(0, noteStart(note) - range.start) * state.editorZoom;
      const width = Math.max(2, Math.min(noteDuration(note), range.end - noteStart(note)) * state.editorZoom);
      const fallbackRow = state.editorTrack === "bass" && partnerId === "drums" ? rows.length - 1 : 0;
      const top = (rowIndex.get(pitch) ?? fallbackRow) * 22 + 8;
      return `<i class="partner-ghost-note" style="--ghost-left:${left}px;--ghost-width:${width}px;--ghost-top:${top}px" title="${TRACK_META[partnerId]?.name || partnerId} relationship note"></i>`;
    }).join("");
  const totalBeats = range.end - range.start;
  $("#pianoRollGrid").style.setProperty("--editor-width", `${totalBeats * state.editorZoom}px`);
  $("#pianoRollGrid").style.setProperty("--editor-height", `${rows.length * 22}px`);
  $("#pianoRollGrid").style.setProperty("--beat-width", `${state.editorZoom}px`);
  $("#pianoRollGrid").style.setProperty("--bar-width", `${state.editorZoom * range.beatsPerBar}px`);
  $("#pianoRollGrid").style.setProperty("--subdivision-width", `${Math.max(4, state.editorZoom * grid)}px`);
  $("#pianoRollGrid").innerHTML = `<div class="piano-roll-editor-playhead" aria-hidden="true"><i></i></div>${guideRows}${partnerMarkup}${notesMarkup}`;
  $("#editorSelectionCount").textContent = `${selected.length} NOTE${selected.length === 1 ? "" : "S"} SELECTED`;
  $("#editorVelocityValue").textContent = selected.length ? Math.round(selected.reduce((sum, entry) => sum + noteVelocity(entry.note), 0) / selected.length) : "—";
  $("#editorVelocityControl").value = selected.length ? Math.round(selected.reduce((sum, entry) => sum + noteVelocity(entry.note), 0) / selected.length) : 100;
  $("#editorGridControl").value = String(state.editorGrid);
  $("#editorZoomControl").value = state.editorZoom;
  $("#editorStatus").textContent = message || (entries.length
    ? `${meta.name} in ${section.name}. Click a note, Shift-click for several, or double-click empty space to draw.`
      : `No ${meta.name.toLowerCase()} notes are in ${section.name}. Double-click the grid to draw one.`);
  renderSectionVariationLab(section);
  $$('[data-editor-action]', container).forEach((button) => {
    const tonalAction = ["octave-down", "pitch-down", "pitch-up", "octave-up"].includes(button.dataset.editorAction);
    button.disabled = (button.dataset.editorAction !== "select-all" && !selected.length)
      || (state.editorTrack === "drums" && tonalAction);
  });

  applyControlDescriptions(container);
  renderArrangeWorkflow();
}

function renderSectionVariationLab(section = editorSection()) {
  const lab = $("#sectionVariationLab");
  if (!lab) return;
  const variations = state.sectionVariations?.sectionId === section?.id
    ? state.sectionVariations.options
    : [];
  const active = Number(state.sectionVariations?.activeOption || 0);
  const sectionRange = editorBeatRange(section);
  const baseNoteCount = state.sectionVariations?.base
    ? songTracks(state.sectionVariations.base).reduce((sum, track) => sum + trackNotes(track).filter((note) => (
      noteStart(note) >= sectionRange.start && noteStart(note) < sectionRange.end
    )).length, 0)
    : 0;
  const directionNames = ["Space", "Lift", "Contrast"];
  lab.innerHTML = variations?.length
    ? `
      <div class="variation-lab-heading"><small>A/B SECTION LAB</small><strong>Compare complete musical directions</strong><p>Playback jumps to ${section.name}. Nothing is committed until you keep a choice.</p></div>
      <div class="variation-actions variation-comparison" role="radiogroup" aria-label="Section variation choices">
        <button type="button" data-section-variation="0" class="${active === 0 ? "is-active" : ""}" role="radio" aria-checked="${active === 0}"><b>ORIGINAL</b><small>Current arrangement</small></button>
        ${variations.map((option, index) => {
          const count = songTracks(option).reduce((sum, track) => sum + trackNotes(track).filter((note) => {
            return noteStart(note) >= sectionRange.start && noteStart(note) < sectionRange.end;
          }).length, 0);
          const delta = count - baseNoteCount;
          return `<button type="button" data-section-variation="${index + 1}" class="${active === index + 1 ? "is-active" : ""}" role="radio" aria-checked="${active === index + 1}"><b>${String.fromCharCode(65 + index)} · ${directionNames[index]}</b><small>${delta === 0 ? "Balanced note count" : `${delta > 0 ? "+" : ""}${delta} section notes`}</small></button>`;
        }).join("")}
      </div>
      <div class="variation-commit-actions">
        <button type="button" data-section-variation-cancel>Restore original</button>
        <button class="variation-keep" type="button" data-section-variation-keep>Keep ${active ? `Option ${String.fromCharCode(64 + active)}` : "original"}</button>
      </div>`
    : `
      <div><small>A/B SECTION LAB</small><strong>Need a different version of this moment?</strong><p>Create three bounded alternatives without rewriting the rest of the song.</p></div>
      <button class="variation-explore" type="button" data-section-variation-explore>Explore 3 variations</button>`;
}

async function exploreSectionVariations() {
  const section = editorSection();
  if (!section || !state.song || state.isGenerating) return;
  const base = deepClone(state.song);
  appStore.transaction("generation:section-variations-start", (draft) => {
    draft.isGenerating = true;
  });
  armGenerationSafetyTimer();
  renderSectionVariationLab(section);
  showGenerationActivity("COMPOSING THREE SECTION DIRECTIONS");
  try {
    const variationInput = {
      count: 3,
      lockedTrackIds: [...state.locked],
      seed: `${createSeed()}:variation-lab`,
    };
    const generated = await generationExecutor.run("sectionVariations", {
      sourceSong: base,
      sectionId: section.id,
      input: variationInput,
    });
    const options = generated?.options || generateSectionVariations(base, section.id, variationInput);
    state.sectionVariations = { sectionId: section.id, base, options, activeOption: 0 };
    renderSectionVariationLab(section);
    showToast(`Three ${section.name} alternatives are ready. Audition A, B, and C, then keep your favorite.`);
  } catch (error) {
    console.error(error);
    showToast("The variation lab could not finish this pass.");
  } finally {
    clearGenerationSafetyTimer();
    hideGenerationActivity();
    try {
      appStore.transaction("generation:section-variations-finish", (draft) => {
        draft.isGenerating = false;
      });
    } catch {
      state.isGenerating = false;
    }
  }
}

async function auditionSectionVariation(option) {
  const lab = state.sectionVariations;
  const section = editorSection();
  if (!lab || !section) return;
  const candidate = option === 0 ? lab.base : lab.options?.[option - 1];
  if (!candidate) return;
  state.song = deepClone(candidate);
  lab.activeOption = option;
  applyTrackSettingsToSong(state.song);
  renderAll();
  const range = editorBeatRange(section);
  player.seek(range.start * 60 / songBpm());
  if (!player.playing) await player.play();
}

function keepSectionVariation() {
  const lab = state.sectionVariations;
  if (!lab) return;
  if (lab.activeOption > 0) {
    pushHistory({ ...createHistorySnapshot(), song: deepClone(lab.base) });
    showToast(`Option ${String.fromCharCode(64 + lab.activeOption)} is now part of the song.`);
  } else {
    showToast("The original section is staying in the song.");
  }
  state.sectionVariations = null;
  renderSectionVariationLab();
  scheduleSessionSave();
}

function cancelSectionVariations() {
  const lab = state.sectionVariations;
  if (!lab) return;
  player.stop();
  state.song = deepClone(lab.base);
  applyTrackSettingsToSong(state.song);
  state.sectionVariations = null;
  renderAll();
  scheduleSessionSave();
  showToast("The original section is restored. No variation was committed.");
}

function renderArrangeWorkflow() {
  const workflow = $("#arrangeWorkflow");
  if (!workflow) return;
  const section = editorSection();
  const selectionCount = state.editorSelection.size;
  const activeStep = !section ? "map" : selectionCount ? "notes" : "section";
  const order = ["map", "section", "notes"];
  $$("[data-arrange-step]", workflow).forEach((step) => {
    const index = order.indexOf(step.dataset.arrangeStep);
    const activeIndex = order.indexOf(activeStep);
    step.classList.toggle("is-active", index === activeIndex);
    step.classList.toggle("is-complete", index < activeIndex);
    if (index === activeIndex) step.setAttribute("aria-current", "step");
    else step.removeAttribute("aria-current");
  });
  $("#arrangeSectionStep").textContent = section ? section.name : "Open a section";
  $("#arrangeNoteStep").textContent = selectionCount
    ? `${selectionCount} note${selectionCount === 1 ? "" : "s"} selected`
    : "Shape its notes";
}

export function totalSeconds(song = state.song) {
  const metaBeats = Number(song?.meta?.totalBeats);
  const beatsPerBar = Number(song?.meta?.beatsPerBar);
  const signature = song?.meta?.timeSignature ?? song?.timeSignature;
  const signatureBeats = Array.isArray(signature)
    ? Number(signature[0]) * (4 / Math.max(1, Number(signature[1])))
    : NaN;
  const totalBeats = Number.isFinite(metaBeats) && metaBeats > 0
    ? metaBeats
    : songBars(song) * (
      Number.isFinite(beatsPerBar) && beatsPerBar > 0
        ? beatsPerBar
        : Number.isFinite(signatureBeats) && signatureBeats > 0
          ? signatureBeats
          : 4
    );
  return totalBeats * 60 / songBpm(song);
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.round(Number(seconds) || 0));
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
}

function refreshSongIdea(song) {
  if (!song) return song;
  const idea = song.idea || (song.idea = {});
  const notes = songTracks(song).flatMap((track) => trackNotes(track));
  const triplets = notes.filter((note) => String(note.rhythmicFeature || "").startsWith("triplet-"));
  const rolls = notes.filter((note) => note.rhythmicFeature === "snare-roll");
  const retainedFeatures = listText(idea.rhythmicFeatures, [String(idea.grooveLabel || "Genre pocket")])
    .filter((feature) => !/triplet|snare.?roll/i.test(feature));
  if (triplets.some((note) => note.rhythmicFeature === "triplet-eighth")) retainedFeatures.push("Eighth-note triplets");
  if (triplets.some((note) => note.rhythmicFeature === "triplet-sixteenth")) retainedFeatures.push("Sixteenth-note triplets");
  if (rolls.length) retainedFeatures.push("Phrase-boundary snare rolls");
  idea.tripletEvents = triplets.length;
  idea.snareRollEvents = rolls.length;
  idea.rhythmicFeatures = [...new Set(retainedFeatures)];

  const previousPalette = new Map();
  for (const entry of Array.isArray(idea.soundPalette) ? idea.soundPalette : []) {
    if (entry && typeof entry === "object") previousPalette.set(`${entry.trackId}:${Number(entry.program)}`, entry.name || entry.label);
  }
  idea.soundPalette = songTracks(song).map((track, index) => {
    const id = trackId(track, index);
    const program = Number(track.program ?? state.trackSettings[id]?.program ?? 0);
    const oneShotKit = oneShotKitForSong(song);
    return {
      trackId: id,
      program,
      name: id === "drums"
        ? `${oneShotKit.name} · ${oneShotKit.oneShots.kick} / ${oneShotKit.oneShots.snare}`
        : previousPalette.get(`${id}:${program}`) || fallbackProgramName(id, program),
    };
  });
  return song;
}

function applyTrackSettingsToSong(song) {
  for (const [index, track] of songTracks(song).entries()) {
    const id = trackId(track, index);
    const settings = state.trackSettings[id];
    if (!settings) continue;
    track.program = settings.program;
    track.settings = {
      ...(track.settings || {}),
      density: settings.density / 100,
      variation: settings.variation / 100,
      octave: clamp((TRACK_DEFINITIONS[id]?.octave || 0) + settings.octave, 0, 8),
      volume: clamp(settings.volume, 0, 1),
      velocity: clamp(settings.velocity, 0.1, 1.5),
      pan: clamp(settings.pan, -1, 1),
      reverb: clamp(settings.reverb, 0, 1),
      cutoff: clamp(settings.cutoff, 1000, 14000),
      resonance: clamp(settings.resonance, 0, 1),
      gate: clamp(settings.gate, 0.08, 1.5),
      humanize: clamp(settings.humanize, 0, 1),
      feel: clamp(settings.feel, 0, 1),
      attitude: settings.attitude || "neutral",
      mute: state.muted.has(id),
      solo: state.solo.has(id),
    };
  }
  return refreshSongIdea(song);
}

function captureResolvedAutoTrackSettings(song) {
  for (const [index, track] of songTracks(song).entries()) {
    const id = trackId(track, index);
    const controls = track.settings ?? {};
    const settings = state.trackSettings[id];
    if (!settings) continue;
    for (const key of AUTO_TRACK_RANGE_KEYS) {
      if (!state.autoControls.has(`track:${id}:${key}`) || controls[key] == null) continue;
      const value = Number(controls[key]);
      if (!Number.isFinite(value)) continue;
      if (key === "density" || key === "variation") {
        settings[key] = Math.round(value * (value <= 1 ? 100 : 1));
      } else if (key === "octave") {
        settings.octave = clamp(value - (TRACK_DEFINITIONS[id]?.octave || 0), -2, 2);
      } else {
        settings[key] = value;
      }
    }
  }
}

function preserveLockedTracks(previous, next) {
  if (!previous || !next || !state.locked.size) return next;
  const previousById = new Map(songTracks(previous).map((track, index) => [trackId(track, index), track]));
  if (!Array.isArray(next.tracks)) return next;
  next.tracks = next.tracks.map((track, index) => {
    const id = trackId(track, index);
    return state.locked.has(id) && previousById.has(id) ? deepClone(previousById.get(id)) : track;
  });
  return next;
}

function createHistorySnapshot() {
  if (!state.song) return null;
  return {
    song: deepClone(state.song),
    trackSettings: deepClone(state.trackSettings),
    muted: [...state.muted],
    solo: [...state.solo],
    locked: [...state.locked],
    selectedTrack: state.selectedTrack,
    focusedSection: state.focusedSection,
    editorTrack: state.editorTrack,
    sectionEditorOpen: state.sectionEditorOpen,
  };
}

function updateHistoryButtons() {
  const undoButton = $("#undoButton");
  const redoButton = $("#redoButton");
  if (undoButton) undoButton.disabled = state.history.length === 0;
  if (redoButton) redoButton.disabled = state.future.length === 0;
}

function pushHistory(snapshot = createHistorySnapshot(), { preserveFuture = false } = {}) {
  if (!snapshot) return;
  state.history.push(snapshot);
  if (state.history.length > 12) state.history.shift();
  if (!preserveFuture) state.future = [];
  updateHistoryButtons();
}

function recentSongsForGeneration(sourceSong = state.song) {
  const candidates = [
    sourceSong,
    ...[...state.history].reverse().map((snapshot) => snapshot?.song),
  ];
  const seen = new Set();
  return candidates.filter((song) => {
    if (!song?.meta || !Array.isArray(song.tracks)) return false;
    const identity = String(song.id ?? `${song.seed}:${song.title}`);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  }).slice(0, 6);
}

export function getAppStateSnapshot() {
  return deepClone({
    song: state.song,
    trackSettings: state.trackSettings,
    muted: [...state.muted],
    solo: [...state.solo],
    locked: [...state.locked],
    selectedTrack: state.selectedTrack,
    focusedSection: state.focusedSection,
    editorTrack: state.editorTrack,
    generationCount: state.generationCount,
    isGenerating: state.isGenerating,
  });
}

function applyHistorySnapshot(snapshot) {
  if (!snapshot) return false;
  player.stop();
  state.song = snapshot.song;
  state.trackSettings = snapshot.trackSettings;
  state.muted = new Set(snapshot.muted);
  state.solo = new Set(snapshot.solo);
  state.locked = new Set(snapshot.locked);
  state.selectedTrack = TRACK_ORDER.includes(snapshot.selectedTrack) ? snapshot.selectedTrack : "drums";
  state.focusedSection = snapshot.focusedSection ?? null;
  state.editorTrack = TRACK_ORDER.includes(snapshot.editorTrack) ? snapshot.editorTrack : state.selectedTrack;
  state.sectionEditorOpen = Boolean(snapshot.sectionEditorOpen && state.focusedSection);
  state.editorSelection.clear();
  syncControlsFromSong();
  renderAll();
  scheduleSessionSave();
  return true;
}

function restoreHistory({ captureFuture = true, announce = true } = {}) {
  const snapshot = state.history.pop();
  if (!snapshot) return;
  const current = captureFuture ? createHistorySnapshot() : null;
  if (current && captureFuture) {
    state.future.push(current);
    if (state.future.length > 12) state.future.shift();
  }
  applyHistorySnapshot(snapshot);
  updateHistoryButtons();
  if (announce) showToast("Back to the previous idea.");
}

function redoHistory() {
  const snapshot = state.future.pop();
  if (!snapshot) return;
  pushHistory(createHistorySnapshot(), { preserveFuture: true });
  applyHistorySnapshot(snapshot);
  updateHistoryButtons();
  showToast("Reapplied the next idea.");
}

function syncControlsFromSong() {
  if (!state.song) return;
  const generatedGenre = songGenreId();
  if ([...$("#genreControl").options].some((option) => option.value === generatedGenre)) {
    $("#genreControl").value = generatedGenre;
  }
  $("#keyControl").value = NOTE_NAMES.includes(songKey()) ? songKey() : "C";
  $("#modeControl").value = [...$("#modeControl").options].some((option) => option.value === songMode()) ? songMode() : "major";
  $("#tempoControl").value = clamp(songBpm(), 62, 190);
  const barsValue = String(songBars());
  if ([...$("#barsControl").options].some((option) => option.value === barsValue)) $("#barsControl").value = barsValue;
  const generatedSettings = state.song.settings || {};
  const generationControlMap = {
    groove: "grooveControl",
    chordPath: "chordPathControl",
    energy: "energyControl",
    complexity: "complexityControl",
    swing: "swingControl",
    humanize: "humanizeControl",
    variation: "variationControl",
  };
  for (const [setting, controlId] of Object.entries(generationControlMap)) {
    const control = $(`#${controlId}`);
    const value = generatedSettings[setting];
    if (!control || value == null) continue;
    const normalized = typeof value === "number" && !["groove", "chordPath"].includes(setting)
      ? probabilityPercent(value)
      : String(value);
    if (control instanceof HTMLSelectElement) {
      if ([...control.options].some((option) => option.value === String(normalized))) control.value = String(normalized);
    } else {
      control.value = normalized;
    }
  }
  if (generatedSettings.tripletAmount != null) {
    $("#tripletControl").value = probabilityPercent(generatedSettings.tripletAmount);
  }
  if (generatedSettings.rollAmount != null) {
    $("#rollControl").value = probabilityPercent(generatedSettings.rollAmount);
  }
  if (generatedSettings.evolution != null) {
    $("#evolutionControl").value = probabilityPercent(generatedSettings.evolution);
  }
  if (generatedSettings.surprise != null) {
    $("#surpriseControl").value = probabilityPercent(generatedSettings.surprise);
  }
  syncAutoSelects();

  for (const [index, track] of songTracks().entries()) {
    const id = trackId(track, index);
    if (!state.trackSettings[id]) continue;
    if (Number.isFinite(Number(track.program))) state.trackSettings[id].program = Number(track.program);
    const controls = track.settings || track.controls || {};
    if (controls.density != null) state.trackSettings[id].density = Math.round(Number(controls.density) * (Number(controls.density) <= 1 ? 100 : 1));
    if (controls.variation != null) state.trackSettings[id].variation = Math.round(Number(controls.variation) * (Number(controls.variation) <= 1 ? 100 : 1));
    if (controls.octave != null) {
      state.trackSettings[id].octave = clamp(Number(controls.octave) - (TRACK_DEFINITIONS[id]?.octave || 0), -2, 2);
    }
    const defaults = TRACK_DEFINITIONS[id] || {};
    for (const key of TRACK_EXPRESSION_KEYS) {
      if (controls[key] == null) continue;
      const limits = {
        volume: [0, 1], velocity: [0.1, 1.5], pan: [-1, 1], reverb: [0, 1],
        cutoff: [1000, 14000], resonance: [0, 1],
        gate: [0.08, 1.5], humanize: [0, 1], feel: [0, 1],
      }[key];
      state.trackSettings[id][key] = clamp(Number(controls[key]), limits[0], limits[1]);
    }
    state.trackSettings[id].attitude = String(controls.attitude || state.trackSettings[id].attitude || "neutral");
    for (const key of TRACK_EXPRESSION_KEYS) {
      if (!Number.isFinite(state.trackSettings[id][key])) state.trackSettings[id][key] = Number(defaults[key]);
    }
  }
  updateRangeDisplays();
  decorateAutoRangeControls();
}

function renderTempoPocket() {
  const id = selectedGenreId();
  const profile = genreProfile(id);
  const range = tempoRangeFrom(profile.bpm, profile);
  const tempo = readNumber("#tempoControl", range.default);
  const position = tempoPocket(tempo, range);
  const status = $("#tempoPocketStatus");
  $("#genreTempoRange").textContent = `${Math.round(range.min)}–${Math.round(range.max)} BPM`;
  $("#genreGuidance").textContent = GENRE_GUIDANCE[id] || "A genre-aware balance of groove, harmony and arrangement.";
  status.classList.remove("in-pocket", "outside-pocket");
  status.classList.add(position === "in" ? "in-pocket" : "outside-pocket");
  status.innerHTML = `<i></i> ${position === "in" ? "IN POCKET" : position === "below" ? "BELOW POCKET" : "ABOVE POCKET"}`;
}

function renderIdeaInspector() {
  const song = state.song;
  if (!song) return;
  const idea = song.idea || {};
  const id = songGenreId(song);
  const profile = genreProfile(id);
  const label = String(idea.genreLabel || song?.meta?.genreLabel || genreLabel(id, profile));
  const range = tempoRangeFrom(idea.tempoRange, profile);
  const bpm = Math.round(songBpm(song));
  const pocket = tempoPocket(bpm, range);
  const fit = String(idea.tempoFit || (pocket === "in" ? "Genre pocket" : pocket === "below" ? "Below typical" : "Above typical"));
  const triplets = Math.max(0, Math.round(Number(idea.tripletEvents) || 0));
  const rolls = Math.max(0, Math.round(Number(idea.snareRollEvents) || 0));
  const progression = listText(idea.chordProgression, ["Generated from the selected mode"]);
  const sectionArc = listText(idea.sectionArc, normalizeSections(song).map((section) => section.name));
  const rhythmFeatures = listText(idea.rhythmicFeatures, [String(idea.grooveLabel || "Musical pocket")]);
  const rhythmIdentity = idea.rhythmIdentity || {};
  const phraseShape = {
    questionAnswer: "question + answer",
    syncopatedLoop: "syncopated loop",
    longShort: "long-short phrase",
    staircase: "stepping phrase",
    sparseEcho: "sparse echo",
  }[rhythmIdentity.phraseShape] || "developing phrase";
  const timingPocket = {
    centered: "centered timing",
    laidBack: "laid-back timing",
    pushed: "forward timing",
    elastic: "elastic timing",
  }[rhythmIdentity.timingPocket] || "human timing";
  const motifBars = Math.max(1, Math.round(Number(rhythmIdentity.motifBars) || 2));
  const palette = Array.isArray(idea.soundPalette)
    ? idea.soundPalette.map((entry) => typeof entry === "string" ? entry : entry?.name || entry?.label).filter(Boolean)
    : listText(idea.soundPalette, ["Editable General MIDI palette"]);
  const fingerprint = formatSeed(songSeed(song)).match(/.{1,2}/g)?.join("·") || "00·00·00";

  const scoreDetails = song?.meta?.scoreDetails;
  const scoreBadge = $("#dnaScoreBadge");
  if (scoreBadge) {
    const scoreVal = scoreDetails?.totalScore ?? 94;
    scoreBadge.textContent = `✦ SCORE ${scoreVal}/100`;
    const scoreNames = {
      harmonic: "Harmony",
      groove: "Groove",
      motif: "Motif",
      storyArc: "Story arc",
      density: "Density",
      voiceLeading: "Voice leading",
      separation: "Part separation",
      cadence: "Cadences",
      repetition: "Repetition",
      transitions: "Transitions",
      harmonicJourney: "Harmonic journey",
      performance: "Performance",
      orchestration: "Orchestration",
      memory: "Musical memory",
      production: "Production",
      phraseResolution: "Phrase resolution",
      tensionFollow: "Tension response",
      drumVariety: "Drum development",
      registerHealth: "Register health",
      stageInterlock: "Generation connections",
    };
    scoreBadge.title = Object.entries(scoreDetails?.subscores ?? {})
      .map(([name, value]) => `${scoreNames[name] ?? name}: ${value}`)
      .concat(scoreDetails?.balance
        ? [
            `Balanced floor: ${scoreDetails.balance.creativeFloor}`,
            `Lower-band balance: ${scoreDetails.balance.balanceScore}`,
          ]
        : [])
      .join(" · ");
  }

  $("#dnaFingerprint").textContent = fingerprint;
  $("#dnaGenre").textContent = label;
  $("#dnaTempoDetail").textContent = `${bpm} BPM · ${fit.toLowerCase()} · usual ${Math.round(range.min)}–${Math.round(range.max)}`;
  $("#dnaHarmony").textContent = progression.slice(0, 8).join(" → ");
  $("#dnaGroove").textContent = `${String(rhythmIdentity.label || idea.grooveLabel || rhythmFeatures[0] || "Genre-aware pocket")} · ${phraseShape}`;
  $("#dnaHalfTime").textContent = `${idea.halfTime ? "Half-time feel" : "Full-time pulse"} · ${timingPocket} · ${motifBars}-bar motif`;
  $("#dnaRhythmCounts").textContent = `${triplets} triplet ${triplets === 1 ? "hit" : "hits"} · ${rolls} snare-roll ${rolls === 1 ? "hit" : "hits"}`;
  $("#dnaRhythmFeatures").textContent = rhythmFeatures.slice(0, 3).join(" · ");
  const narrative = song?.songBlueprint?.narrative?.label;
  const phase9 = song?.producerPass?.status;
  const phase39 = song?.generationInterlock?.phase === 39 ? " · Phase 39 connected" : "";
  $("#dnaArc").textContent = `${narrative ? `${narrative} · ` : ""}${sectionArc.slice(0, 8).join(" → ")}${phase9 ? ` · Phase 9 ${phase9}` : ""}${phase39}`;
  $("#dnaPalette").textContent = palette.slice(0, 5).join(" · ");
}

function renderSongShowcase() {
  if (!state.song) return;
  const title = deriveTitle();
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase() || "MA";
  const sections = normalizeSections();
  const totalBars = Math.max(1, songBars());
  const tracks = songTracks();
  const cover = $("#showcaseArt");
  const coverHash = hashNumber(`${songSeed()}:${state.song?.genre}:${title}`);
  const coverHue = coverHash % 360;
  const secondHue = (coverHue + 74 + (hashNumber(`${songSeed()}:cover-secondary`) % 112)) % 360;
  const coverAngle = 82 + (hashNumber(`${songSeed()}:cover-angle`) % 116);

  $("#showcaseMonogram").textContent = initials;
  $("#showcaseSeed").textContent = `ORIGINAL ${formatSeed(songSeed())}`;
  if (cover) {
    cover.dataset.coverStyle = "original";
    cover.style.backgroundImage = `url("${coverArtworkDataUrl({ ...state.song, title }, { variation: 0 })}")`;
    cover.style.setProperty("--cover-hue", coverHue);
    cover.style.setProperty("--cover-hue-2", secondHue);
    cover.style.setProperty("--cover-angle", `${coverAngle}deg`);
    cover.style.setProperty("--cover-angle-number", coverAngle);
    cover.style.setProperty("--cover-x", `${28 + (coverHash % 38)}%`);
    cover.style.setProperty("--cover-y", `${24 + (hashNumber(`${songSeed()}:cover-y`) % 42)}%`);
  }
  if ($("#showcaseCoverLabel")) $("#showcaseCoverLabel").textContent = "ORIGINAL COVER";
  const currentRating = state.tasteProfile.songRatings[state.song.id] || "";
  if ($("#tasteRating")) $("#tasteRating").value = currentRating;
  $("#showcaseArc").innerHTML = sections.map((section) => `
    <span
      class="showcase-segment"
      data-showcase-section="${section.id}"
      style="--section-bars:${Math.max(1, section.bars)};--section-energy:${clamp(section.energy, 0, 1).toFixed(2)}"
      title="${section.name}, ${section.bars} bars"
    ><small>${section.name}</small></span>
  `).join("");
  $("#showcaseArc").setAttribute(
    "aria-label",
    sections.map((section) => `${section.name}, ${section.bars} bars`).join("; "),
  );

  for (const [index, track] of tracks.entries()) {
    const id = trackId(track, index);
    const meter = $(`[data-showcase-track="${id}"]`, $("#showcaseTrackMeter"));
    if (!meter) continue;
    const noteCount = trackNotes(track).length;
    const activity = clamp(Math.log2(noteCount + 1) / Math.log2(totalBars * 10 + 1), 0.14, 1);
    meter.style.setProperty("--activity", activity.toFixed(2));
    meter.style.setProperty("--track-color", TRACK_META[id]?.color || "var(--accent)");
  }
}

function rateCurrentSong(rating) {
  if (!state.song || !["like", "reject", "favorite"].includes(rating)) return;
  const profile = state.tasteProfile;
  if (profile.songRatings[state.song.id] === rating) return;
  profile.songRatings[state.song.id] = rating;
  const recentRatings = Object.entries(profile.songRatings).slice(-64);
  profile.songRatings = Object.fromEntries(recentRatings);
  const weight = rating === "favorite" ? 2 : rating === "like" ? 1 : -1;
  if (rating === "like") profile.likes += 1;
  if (rating === "reject") profile.rejects += 1;
  if (rating === "favorite") profile.favorites += 1;
  profile.genreVotes[state.song.genre] = (profile.genreVotes[state.song.genre] || 0) + weight;
  if (weight > 0) {
    profile.ratings += weight;
    profile.energyTotal += Number(state.song.settings?.energy ?? 0.68) * 100 * weight;
    profile.complexityTotal += Number(state.song.settings?.complexity ?? 0.54) * 100 * weight;
    profile.variationTotal += Number(state.song.settings?.variation ?? 0.42) * 100 * weight;
  }
  renderSongShowcase();
  scheduleSessionSave();
  showToast(rating === "favorite"
    ? "Favorite saved. Auto settings will lean further toward this musical character."
    : rating === "like"
      ? "Taste learned. Future Auto choices will gently favor this direction."
      : "Noted. The idea engine will move away from this direction.");
}

function renderSummary() {
  applyGenerationTheme(document.documentElement || document.body, state.song);
  const title = deriveTitle();
  const mode = songMode();
  const modeLabel = mode.replace(/([a-z])([A-Z])/g, "$1 $2");
  const key = songKey();
  const bpm = songBpm();
  const bars = songBars();
  const duration = formatTime(totalSeconds());
  const seed = songSeed();
  const recipe = RECIPES[state.recipeIndex % RECIPES.length];
  const idea = state.song?.idea || {};
  const generatedGenreId = songGenreId();
  const generatedGenreLabel = String(idea.genreLabel || state.song?.meta?.genreLabel || genreLabel(generatedGenreId));
  const triplets = Math.max(0, Math.round(Number(idea.tripletEvents) || 0));
  const rolls = Math.max(0, Math.round(Number(idea.snareRollEvents) || 0));
  const rhythmFeatures = listText(idea.rhythmicFeatures, [String(idea.grooveLabel || "Genre pocket")]);
  const rhythmFact = [
    idea.halfTime ? "HALF-TIME" : String(rhythmFeatures[0] || "GROOVE").toUpperCase(),
    triplets ? `${triplets} TRIPLET ${triplets === 1 ? "HIT" : "HITS"}` : null,
    rolls ? `${rolls} ROLL ${rolls === 1 ? "HIT" : "HITS"}` : null,
  ].filter(Boolean).slice(0, 2).join(" · ");

  $("#songTitle").textContent = title;
  $("#transportTitle").textContent = title;
  const phraseShape = {
    questionAnswer: "question-and-answer phrases",
    syncopatedLoop: "a syncopated phrase loop",
    longShort: "long-short phrases",
    staircase: "stepping phrases",
    sparseEcho: "spacious echo phrases",
  }[idea.rhythmIdentity?.phraseShape] || "developing phrases";
  $("#songSummary").textContent = `${generatedGenreLabel} · ${String(idea.rhythmIdentity?.label || idea.grooveLabel || recipe.tags[2]).toLowerCase()} · ${phraseShape} · fully editable MIDI`;
  $("#factGenre").textContent = generatedGenreLabel.toUpperCase();
  $("#factKey").textContent = `${key} ${modeLabel}`.toUpperCase();
  $("#factTempo").textContent = `${Math.round(bpm)} BPM`;
  $("#factBars").textContent = `${bars} BARS`;
  $("#factDuration").textContent = duration;
  $("#factRhythm").textContent = rhythmFact;
  $("#totalTime").textContent = duration;
  $("#seedLabel").textContent = `SEED ${formatSeed(seed)}`;
  $("#dnaValue").textContent = String(82 + (hashNumber(seed) % 14));
  if ($("#recipeTitle")) $("#recipeTitle").textContent = recipe.name;
  const recipeDesc = $(".recipe-card p") || $(".recipe-panel > p");
  if (recipeDesc) recipeDesc.textContent = recipe.text;
  if ($("#recipeTags")) $("#recipeTags").innerHTML = recipe.tags.map((tag) => `<span>${tag}</span>`).join("");
  renderTempoPocket();
  renderModeGuidance();
  renderIdeaInspector();
  renderSongShowcase();
  renderCreativeThread();
}

let timelineInteractionsBound = false;

function bindTimelineInteractions(timeline) {
  if (timelineInteractionsBound || !timeline) return;
  timelineInteractionsBound = true;
  timeline.addEventListener("click", (event) => {
    const clip = event.target.closest?.("[data-section]");
    if (!clip) return;
    focusSongSection(clip.dataset.section, clip.dataset.editorTrack, {
      openEditor: Boolean(clip.dataset.editorTrack),
      scroll: true,
    });
  });
  timeline.addEventListener("dragstart", (event) => {
    const chip = event.target.closest?.(".section-chip[data-section]");
    if (!chip) return;
    timeline.dataset.dragSection = chip.dataset.section;
    chip.classList.add("is-dragging");
    event.dataTransfer?.setData?.("text/plain", chip.dataset.section);
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  });
  timeline.addEventListener("dragend", (event) => {
    event.target.closest?.(".section-chip")?.classList.remove("is-dragging");
    delete timeline.dataset.dragSection;
  });
  timeline.addEventListener("dragover", (event) => {
    if (event.target.closest?.(".section-chip[data-section]")) event.preventDefault();
  });
  timeline.addEventListener("drop", (event) => {
    const target = event.target.closest?.(".section-chip[data-section]");
    const sourceId = timeline.dataset.dragSection || event.dataTransfer?.getData?.("text/plain");
    if (!target || !sourceId || sourceId === target.dataset.section) return;
    event.preventDefault();
    state.focusedSection = sourceId;
    const targetIndex = normalizeSections().findIndex((section) => section.id === target.dataset.section);
    moveFocusedSectionToIndex(targetIndex);
  });
  timeline.addEventListener("keydown", (event) => {
    const chip = event.target.closest?.(".section-chip[data-section]");
    if (!chip || !event.altKey || !["ArrowLeft", "ArrowRight"].includes(event.key)) return;
    event.preventDefault();
    state.focusedSection = chip.dataset.section;
    moveFocusedSection(event.key === "ArrowLeft" ? -1 : 1);
  });
}

function renderArrangementInsights(sections, bars) {
  const energyLane = $("#energyArcLane");
  const harmonyLane = $("#harmonyMapLane");
  if (!energyLane || !harmonyLane) return;
  const points = sections.map((section) => {
    const entries = sectionNotes(section);
    const velocity = entries.length
      ? entries.reduce((sum, entry) => sum + noteVelocity(entry.note), 0) / entries.length / 127
      : 0;
    const density = clamp(entries.length / Math.max(1, section.bars * 28), 0, 1);
    const energy = clamp(section.energy * 0.42 + velocity * 0.36 + density * 0.22, 0, 1);
    const x = ((section.start + section.bars / 2) / Math.max(1, bars)) * 100;
    const y = 26 - energy * 20;
    return { section, energy, x, y, notes: entries.length };
  });
  const polyline = points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" ");
  energyLane.innerHTML = `
    <span class="insight-lane-label">ENERGY</span>
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="energyArcGradient"><stop stop-color="#16dac4"/><stop offset=".55" stop-color="#9d6fff"/><stop offset="1" stop-color="#f472b6"/></linearGradient></defs>
      <polyline points="${polyline}" vector-effect="non-scaling-stroke"></polyline>
      ${points.map((point) => `<circle cx="${point.x.toFixed(2)}" cy="${point.y.toFixed(2)}" r="1.1"></circle>`).join("")}
    </svg>
    <span class="energy-arc-caption">${points.map(({ section, energy }) => `${section.name} ${Math.round(energy * 100)}%`).join(" · ")}</span>`;

  const harmony = Array.isArray(state.song?.harmony) ? state.song.harmony : [];
  const totalBeats = Math.max(1, bars * Number(state.song?.meta?.beatsPerBar ?? 4));
  harmonyLane.innerHTML = `<span class="insight-lane-label">HARMONY</span><div class="harmony-map-track">${
    harmony.map((event) => {
      const start = Number(event.startBeat ?? event.start ?? 0);
      const duration = Number(event.duration ?? event.durationBeats ?? 4);
      const symbol = event.symbol || event.roman || event.chord?.symbol || event.chord?.roman || "I";
      const roman = event.roman || event.chord?.roman || "";
      const notes = Array.isArray(event.notes) ? event.notes.join(" · ") : (Array.isArray(event.chord?.notes) ? event.chord.notes.join(" · ") : symbol);
      return `<span style="--harmony-left:${(start / totalBeats * 100).toFixed(3)}%;--harmony-width:${(duration / totalBeats * 100).toFixed(3)}%" title="${notes}"><b>${symbol}</b><small>${roman}</small></span>`;
    }).join("")
  }</div>`;
}

function renderTimeline() {
  const sections = normalizeSections();
  const bars = songBars();
  const beatsPerBar = Number(state.song?.meta?.beatsPerBar ?? 4);
  const tracks = songTracks();

  const ruler = $("#timelineRuler");
  const rulerStep = bars <= 24 ? 4 : 8;
  const markers = Math.ceil(bars / rulerStep);
  ruler.style.gridTemplateColumns = `repeat(${markers}, 1fr)`;
  ruler.innerHTML = Array.from({ length: markers }, (_, index) => `<span>${index * rulerStep + 1}</span>`).join("");

  const sectionStrip = sections.map((section) => {
    const active = state.focusedSection === section.id ? " active" : "";
    const playing = state.playingSection === section.id ? " is-playing-section" : "";
    const energy = clamp(section.energy, 0, 1);
    const noteCount = sectionNotes(section).length;
    return `<button class="section-chip${active}${playing}" data-section="${section.id}" type="button" draggable="true" style="grid-column:${section.start + 1} / span ${section.bars};--section-border:${(0.12 + energy * 0.18).toFixed(2)};--section-fill:${(0.025 + energy * 0.045).toFixed(3)}" title="Focus ${section.name}. Drag to reorder." aria-label="${section.name}, ${section.bars} bars, ${noteCount} notes. Drag or press Alt plus an arrow key to reorder."><span>${section.name}</span><small>${section.bars} bars · ${noteCount} notes</small></button>`;
  }).join("");

  const rows = tracks.map((track, index) => {
    const id = trackId(track, index);
    const meta = TRACK_META[id] || { name: track.name || id, icon: "•", color: "#ae8cff" };
    const notes = trackNotes(track);
    const clips = sections.map((section) => {
      const sectionStart = section.start * beatsPerBar;
      const sectionEnd = (section.start + section.bars) * beatsPerBar;
      const sectionNotes = notes.filter((note) => noteStart(note) >= sectionStart && noteStart(note) < sectionEnd).slice(0, 22);
      const stitches = sectionNotes.map((note) => {
        const local = (noteStart(note) - sectionStart) / Math.max(1, sectionEnd - sectionStart);
        const relativePitch = clamp((notePitch(note) - 32) / 64, 0, 1);
        const width = clamp(noteDuration(note) / Math.max(1, sectionEnd - sectionStart) * 100, 2, 24);
        return `<i class="note-stitch" style="--x:${(local * 96).toFixed(2)}%;--y:${(8 + (1 - relativePitch) * 17).toFixed(1)}px;--w:${width.toFixed(2)}%"></i>`;
      }).join("");
      const active = state.focusedSection === section.id ? " active" : "";
      const playing = state.playingSection === section.id ? " is-playing-section" : "";
      const muted = state.muted.has(id) ? " muted" : "";
      return `<button class="timeline-clip${active}${playing}${muted}" data-section="${section.id}" data-editor-track="${id}" type="button" title="Open ${meta.name} in ${section.name} piano roll" style="grid-column:${section.start + 1} / span ${section.bars}">${stitches}</button>`;
    }).join("");

    return `<div class="timeline-row${state.selectedTrack === id ? " is-focus-track" : ""}" data-timeline-track="${id}" style="--track-color:${meta.color}">
      <div class="timeline-track-label"><i></i><span>${meta.name.toUpperCase()}</span></div>
      <div class="timeline-lane" style="--bars:${bars}">${clips}</div>
    </div>`;
  }).join("");

  const timeline = $("#timeline");
  timeline.innerHTML = `<div class="timeline-row section-strip-row"><div class="timeline-track-label">SECTIONS</div><div class="section-strip" style="--bars:${bars}">${sectionStrip}</div></div>${rows}`;
  bindTimelineInteractions(timeline);
  renderArrangementInsights(sections, bars);
  renderSectionShaper();
}

function sectionMacroValues(sectionId) {
  if (!state.sectionMacroValues[sectionId]) {
    state.sectionMacroValues[sectionId] = {
      energy: "auto",
      density: "auto",
      tension: "auto",
      pocket: "auto",
    };
  }
  return state.sectionMacroValues[sectionId];
}

function sectionNotes(section, trackFilter = null) {
  if (!section) return [];
  const range = editorBeatRange(section);
  return songTracks().flatMap((track, index) => {
    const id = trackId(track, index);
    if (trackFilter && !trackFilter.has(id)) return [];
    return trackNotes(track)
      .filter((note) => noteStart(note) >= range.start - 1e-7 && noteStart(note) < range.end - 1e-7)
      .map((note) => ({ note, track, id }));
  });
}

function renderSectionShaper(message = "") {
  const shaper = $("#sectionShaper");
  if (!shaper) return;
  const section = editorSection();
  const empty = $("#sectionShaperEmpty");
  const content = $("#sectionShaperContent");
  const summary = $("#shapeMapSummary");
  empty.hidden = Boolean(section);
  content.hidden = !section;
  shaper.classList.toggle("has-selection", Boolean(section));
  if (!section) {
    if (summary) summary.textContent = `${normalizeSections().length} sections · click a block to shape it`;
    return;
  }

  const values = sectionMacroValues(section.id);
  const entries = sectionNotes(section);
  const averageVelocity = entries.length
    ? entries.reduce((sum, entry) => sum + noteVelocity(entry.note), 0) / entries.length
    : 0;
  const energyLabel = averageVelocity >= 98 ? "high-impact"
    : averageVelocity <= 72 ? "restrained" : "balanced";
  $("#sectionShaperName").textContent = section.name;
  $("#sectionShaperMeta").textContent = `Bars ${section.start + 1}–${section.start + section.bars} · ${entries.length} notes · ${energyLabel}`;
  $("#sectionShaperStatus").textContent = message || "Auto follows the song’s composition blueprint. Choose only what you want to direct.";
  if (summary) summary.textContent = `${section.name} selected · ${section.bars} bars · ${energyLabel}`;
  $$("[data-section-macro]", shaper).forEach((control) => {
    control.value = values[control.dataset.sectionMacro] || "auto";
  });
  const barSelect = $('[data-section-bars]', shaper);
  if (barSelect) barSelect.value = String(section.bars);
  const sections = normalizeSections();
  const sectionIndex = sections.findIndex((candidate) => candidate.id === section.id);
  $('[data-section-action="earlier"]', shaper).disabled = sectionIndex <= 0;
  $('[data-section-action="later"]', shaper).disabled = sectionIndex < 0 || sectionIndex >= sections.length - 1;
}

const ARRANGEMENT_ERROR_COPY = {
  "invalid-song-shape": "This song is missing arrangement data required for that edit.",
  "invalid-section-identity": "Two sections share an identity. Generate a related idea to rebuild the arrangement safely.",
  "noncontiguous-sections": "The section timeline could not be realigned safely.",
  "invalid-song-duration": "The song length and section map do not agree.",
  "invalid-track-events": "A note falls outside the playable song range, so the edit was protected.",
  "invalid-automation-events": "An automation point falls outside the song range, so the edit was protected.",
  "invalid-harmony-events": "A harmony event falls outside the song range, so the edit was protected.",
  "invalid-transform": "That section direction is not supported.",
  "no-musical-change": "This section already matches that musical direction. No Undo step was added.",
};

function commitArrangementCommand(command, message, { closeEditor = false, rejectedMessage = "" } = {}) {
  if (!state.song) return false;
  const result = executeArrangementCommand(state.song, command);
  if (!result.changed) {
    const feedback = ARRANGEMENT_ERROR_COPY[result.error]
      || rejectedMessage
      || "That arrangement change is not available for this section.";
    renderSectionShaper(feedback);
    showToast(feedback);
    return false;
  }

  pushHistory();
  player.stop();
  state.song = result.song;
  state.focusedSection = result.focusSectionId ?? state.focusedSection;
  state.sectionEditorOpen = closeEditor ? false : state.sectionEditorOpen;
  state.editorSelection.clear();
  refreshSongIdea(state.song);
  renderAll();
  const feedback = result.repaired
    ? `${message} The section timeline was safely realigned first.`
    : message;
  renderSectionShaper(feedback);
  scheduleSessionSave();
  showToast(feedback);
  return true;
}

function applySectionMacro(kind, value) {
  const section = editorSection();
  if (!section) return false;
  sectionMacroValues(section.id)[kind] = value;
  if (value === "auto") {
    renderSectionShaper(`${kind[0].toUpperCase()}${kind.slice(1)} returned to Auto. Future variations will follow the composition engine.`);
    return true;
  }
  const label = `${section.name} ${kind} set to ${value}.`;
  return commitArrangementCommand({
    type: "transform",
    sectionId: section.id,
    operation: kind,
    value,
  }, label);
}

function simplifyFocusedSection() {
  const section = editorSection();
  if (!section) return false;
  return commitArrangementCommand({
    type: "transform",
    sectionId: section.id,
    operation: "simplify",
  }, `${section.name} has more breathing room.`);
}

function buildFocusedSection() {
  const section = editorSection();
  if (!section) return false;
  return commitArrangementCommand({
    type: "transform",
    sectionId: section.id,
    operation: "build",
  }, `${section.name} now rises toward its next transition.`);
}

function duplicateFocusedSection() {
  const section = editorSection();
  if (!section || !state.song) return false;
  return commitArrangementCommand({
    type: "duplicate",
    sectionId: section.id,
    maxBars: 64,
  }, `${section.name} variation duplicated with its MIDI, automation, and harmony intact.`, {
    closeEditor: true,
    rejectedMessage: "This section cannot be duplicated because the song would exceed the 64-bar arrangement limit.",
  });
}

function moveFocusedSection(direction) {
  const sections = normalizeSections();
  const currentIndex = sections.findIndex((section) => section.id === state.focusedSection);
  return moveFocusedSectionToIndex(currentIndex + direction);
}

function moveFocusedSectionToIndex(targetIndex) {
  const sections = normalizeSections();
  const currentIndex = sections.findIndex((section) => section.id === state.focusedSection);
  if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sections.length || !state.song) return false;
  if (currentIndex === targetIndex) return true;
  const section = sections[currentIndex];
  return commitArrangementCommand({
    type: "reorder",
    sectionId: section.id,
    targetIndex,
  }, `${section.name} moved to position ${targetIndex + 1} with its MIDI, automation, and harmony intact.`);

}

export function focusSongSection(sectionId, track = state.editorTrack, { openEditor = false, scroll = false } = {}) {
  const section = normalizeSections().find((candidate) => candidate.id === sectionId);
  if (!section) return false;
  state.focusedSection = section.id;
  if (TRACK_ORDER.includes(track)) {
    state.editorTrack = track;
    state.selectedTrack = track;
  }
  state.sectionEditorOpen = Boolean(openEditor);
  state.editorSelection.clear();
  renderTimeline();
  renderTrackRack();
  renderAttitudeStrip(`${TRACK_META[state.selectedTrack]?.name || "Instrument"} and ${section.name} are now connected.`);
  renderSectionEditor();
  renderCreativeThread();
  showToast(openEditor
    ? `Opened ${section.name} in the ${TRACK_META[state.editorTrack]?.name || "MIDI"} piano roll.`
    : `${section.name} is ready in the Section Shaper.`);
  if (scroll) {
    const target = openEditor ? $("#sectionEditor") : $("#sectionShaper");
    setTimeout(() => target?.scrollIntoView?.({ behavior: "smooth", block: "center" }), 80);
  }
  return true;
}

function programName(id, program) {
  const numericProgram = Number(program);
  const generatedName = state.song?.idea?.soundPalette?.find?.((entry) => (
    entry && typeof entry === "object"
    && entry.trackId === id
    && Number(entry.program) === numericProgram
  ))?.name;
  return String(generatedName || fallbackProgramName(id, numericProgram));
}

function patchOptions(id, selectedProgram) {
  const profileChoices = profilePrograms(id);
  const baseChoices = (PATCHES[id] || []).map(([program]) => Number(program));
  const programs = [...new Set([...profileChoices, ...baseChoices, Number(selectedProgram)].filter(Number.isFinite))];
  return programs.map((program) => {
    const profilePick = profileChoices.includes(program);
    const name = programName(id, program);
    return `<option value="${program}" ${program === Number(selectedProgram) ? "selected" : ""}>${profilePick ? "✦ " : ""}${name}</option>`;
  }).join("");
}

function renderAttitudeStrip(message = "") {
  const id = TRACK_ORDER.includes(state.selectedTrack) ? state.selectedTrack : "drums";
  const meta = TRACK_META[id];
  const attitude = state.trackSettings[id]?.attitude || "neutral";
  $("#attitudeStrip").style.setProperty("--attitude-color", meta.color);
  $("#attitudeTargetName").textContent = meta.name;
  $("#attitudeTargetState").textContent = `· ${ATTITUDE_LABELS[attitude] || ATTITUDE_LABELS.neutral}`;
  $("#attitudeStatus").textContent = message || `${meta.name} is targeted. Choose an attitude to rewrite only this part.`;
  $$("[data-attitude]", $("#attitudeStrip")).forEach((button) => {
    button.setAttribute("aria-pressed", String(button.dataset.attitude === attitude));
    button.setAttribute("aria-label", `${ATTITUDE_LABELS[button.dataset.attitude] || button.dataset.attitude} attitude for ${meta.name}`);
  });
  $$(".track-card").forEach((card) => {
    const selected = card.dataset.track === id;
    card.classList.toggle("is-attitude-target", selected);
    selected ? card.setAttribute("aria-current", "true") : card.removeAttribute("aria-current");
    $('[data-action="target"]', card)?.setAttribute("aria-pressed", String(selected));
  });
}

function renderMixOverview() {
  if (!$("#mixOverview")) return;
  const id = TRACK_ORDER.includes(state.selectedTrack) ? state.selectedTrack : "drums";
  const meta = TRACK_META[id];
  const settings = state.trackSettings[id];
  const audible = state.solo.size
    ? state.solo.size
    : Math.max(0, TRACK_ORDER.length - state.muted.size);
  $("#mixOverview").style.setProperty("--mix-focus-color", meta.color);
  $("#mixFocusName").textContent = meta.name;
  $("#mixFocusSound").textContent = `${programName(id, settings.program)} · ${ATTITUDE_LABELS[settings.attitude] || "Neutral"}`;
  $("#mixAudibleCount").textContent = `${audible} / ${TRACK_ORDER.length}`;
  $("#mixLockedCount").textContent = String(state.locked.size);
}

export function selectAttitudeTrack(id, { announce = true } = {}) {
  if (!TRACK_ORDER.includes(id)) return false;
  state.selectedTrack = id;
  state.editorTrack = id;
  renderAttitudeStrip(announce ? `${TRACK_META[id].name} selected. Its attitude controls are ready.` : "");
  renderMixOverview();
  $$('[data-timeline-track]').forEach((row) => row.classList.toggle("is-focus-track", row.dataset.timelineTrack === id));
  renderCreativeThread();
  if (state.focusedSection) renderSectionEditor();
  return true;
}

function neutralizeTrackExpression(id, settings) {
  const defaults = TRACK_DEFINITIONS[id] || {};
  settings.density = Math.round(clamp(Number(defaults.density ?? 0.5) * 100, 10, 100));
  settings.variation = Math.round(clamp(Number(defaults.variation ?? 0.5) * 100, 0, 100));
  for (const key of TRACK_EXPRESSION_KEYS) settings[key] = Number(defaults[key]);
  settings.attitude = "neutral";
}

export async function applyTrackAttitude(attitude) {
  const id = state.selectedTrack;
  if (!TRACK_ORDER.includes(id) || !ATTITUDE_LABELS[attitude] || state.isGenerating || !state.song) return false;
  const historySnapshot = createHistorySnapshot();
  const settings = state.trackSettings[id];
  if (attitude === "neutral") {
    neutralizeTrackExpression(id, settings);
  } else {
    const base = ATTITUDE_ADJUSTMENTS[attitude];
    const adjustment = id === "drums" && attitude === "power"
      ? { ...base, density: 14, variation: 9, volume: 0.08, velocity: 0.2, gate: 0.1, feel: 0.14 }
      : base;
    settings.density = Math.round(clamp(settings.density + adjustment.density, 10, 100));
    settings.variation = Math.round(clamp(settings.variation + adjustment.variation, 0, 100));
    settings.volume = clamp(settings.volume + adjustment.volume, 0, 1);
    settings.velocity = clamp(settings.velocity + adjustment.velocity, 0.1, 1.5);
    settings.reverb = clamp(settings.reverb + adjustment.reverb, 0, 1);
    settings.gate = clamp(settings.gate + adjustment.gate, 0.08, 1.5);
    settings.humanize = clamp(settings.humanize + adjustment.humanize, 0, 1);
    settings.feel = clamp(settings.feel + adjustment.feel, 0, 1);
    settings.attitude = attitude;
  }
  renderTrackRack();
  renderAttitudeStrip(`${ATTITUDE_LABELS[attitude]} is reshaping ${TRACK_META[id].name.toLowerCase()}…`);
  $("#attitudeStrip").setAttribute("aria-busy", "true");
  try {
    await regenerateTrack(id, { historySnapshot, attitude });
    setWorkflowStep(4);
    return true;
  } finally {
    $("#attitudeStrip").removeAttribute("aria-busy");
  }
}

const DRUM_NOTE_MAP = {
  36: "Kick",
  38: "Snare",
  42: "Closed Hat",
  46: "Open Hat",
  41: "Low Tom",
  45: "Mid Tom",
  48: "High Tom",
  49: "Crash",
  51: "Ride",
};

let pianoRollState = {
  trackId: "melody",
  tool: "draw",
  quantize: 0.5,
  bound: false,
};

export function openPianoRoll(id = "melody") {
  if (!TRACK_ORDER.includes(id)) id = "melody";
  pianoRollState.trackId = id;
  const modal = $("#pianoRollModal");
  if (!modal) return;
  const meta = TRACK_META[id] || { name: id };
  $("#pianoRollTitle").textContent = `Piano Roll — ${meta.name}`;
  bindPianoRollInteractions();
  renderPianoRollGrid();
  try {
    modal.showModal();
  } catch {
    modal.setAttribute("open", "true");
  }
}

function renderPianoRollGrid() {
  const grid = $("#prModalGrid");
  const keysContainer = $("#pianoRollKeys");
  if (!grid || !state.song) return;

  const trackObj = songTracks().find((t, idx) => trackId(t, idx) === pianoRollState.trackId);
  const notes = trackObj ? trackNotes(trackObj) : [];
  const totalBeats = Number(state.song?.meta?.totalBeats) || songBars() * 4 || 32;
  const stepSize = pianoRollState.quantize;
  const totalSteps = Math.min(128, Math.max(16, Math.ceil(totalBeats / stepSize)));

  const isDrums = pianoRollState.trackId === "drums";
  const basePitch = isDrums ? 36 : (pianoRollState.trackId === "bass" ? 24 : 48);
  const numPitches = isDrums ? 16 : 36;
  const pitches = Array.from({ length: numPitches }, (_, i) => basePitch + numPitches - 1 - i);

  keysContainer.innerHTML = pitches.map((pitch) => {
    const isBlack = isBlackKey(pitch);
    const label = isDrums ? (DRUM_NOTE_MAP[pitch] || `Hit ${pitch}`) : pitchLabel(pitch);
    const isRoot = !isBlack && (pitch % 12 === 0);
    return `<div class="pr-key-label ${isBlack ? "is-black" : ""} ${isRoot ? "is-root" : ""}"><span>${label}</span></div>`;
  }).join("");

  grid.style.gridTemplateColumns = `repeat(${totalSteps}, 28px)`;
  grid.style.gridTemplateRows = `repeat(${numPitches}, 1fr)`;

  let cellsHtml = "";
  for (let r = 0; r < numPitches; r++) {
    const pitch = pitches[r];
    const isBlackRow = isBlackKey(pitch);

    for (let c = 0; c < totalSteps; c++) {
      const stepStart = c * stepSize;
      const stepEnd = stepStart + stepSize;
      const hasNote = notes.some((n) => {
        const nStart = noteStart(n);
        const nPitch = notePitch(n);
        return nPitch === pitch && nStart >= stepStart - 0.01 && nStart < stepEnd - 0.01;
      });

      cellsHtml += `<div class="pr-cell ${isBlackRow ? "is-black-row" : ""} ${hasNote ? "has-note" : ""}" data-pitch="${pitch}" data-step="${c}" data-start="${stepStart}" role="gridcell" title="${isDrums ? (DRUM_NOTE_MAP[pitch] || pitch) : pitchLabel(pitch)} at beat ${stepStart.toFixed(2)}"></div>`;
    }
  }
  grid.innerHTML = cellsHtml;
}

function bindPianoRollInteractions() {
  if (pianoRollState.bound) return;
  pianoRollState.bound = true;
  const modal = $("#pianoRollModal");
  if (!modal) return;

  $("#closePianoRoll")?.addEventListener("click", () => modal.close?.() || modal.removeAttribute("open"));
  $("#prSaveClose")?.addEventListener("click", () => modal.close?.() || modal.removeAttribute("open"));

  $("#prToolDraw")?.addEventListener("click", () => {
    pianoRollState.tool = "draw";
    $("#prToolDraw")?.classList.add("is-active");
    $("#prToolErase")?.classList.remove("is-active");
  });
  $("#prToolErase")?.addEventListener("click", () => {
    pianoRollState.tool = "erase";
    $("#prToolErase")?.classList.add("is-active");
    $("#prToolDraw")?.classList.remove("is-active");
  });

  $("#prQuantizeStep")?.addEventListener("change", (e) => {
    pianoRollState.quantize = parseFloat(e.target.value) || 0.5;
    renderPianoRollGrid();
  });

  $("#prBtnQuantize")?.addEventListener("click", () => {
    quantizeTrackNotes(pianoRollState.trackId, pianoRollState.quantize);
    renderPianoRollGrid();
    renderTimeline();
    showToast(`Quantized ${TRACK_META[pianoRollState.trackId]?.name || "notes"} to grid.`);
  });

  $("#prBtnOctaveUp")?.addEventListener("click", () => {
    transposeTrackNotes(pianoRollState.trackId, 12);
    renderPianoRollGrid();
    renderTimeline();
  });
  $("#prBtnOctaveDown")?.addEventListener("click", () => {
    transposeTrackNotes(pianoRollState.trackId, -12);
    renderPianoRollGrid();
    renderTimeline();
  });

  $("#prBtnClear")?.addEventListener("click", () => {
    clearTrackNotes(pianoRollState.trackId);
    renderPianoRollGrid();
    renderTimeline();
    showToast(`Cleared ${TRACK_META[pianoRollState.trackId]?.name || "track"} notes.`);
  });

  const grid = $("#prModalGrid");
  if (grid) {
    grid.addEventListener("click", (e) => {
      const cell = e.target.closest?.(".pr-cell");
      if (!cell) return;
      const pitch = parseInt(cell.dataset.pitch, 10);
      const start = parseFloat(cell.dataset.start);
      handlePianoRollCellClick(pitch, start);
    });
  }
}

function handlePianoRollCellClick(pitch, startBeat) {
  const targetId = pianoRollState.trackId;
  const trackObj = songTracks().find((t, idx) => trackId(t, idx) === targetId);
  if (!trackObj || !Array.isArray(trackObj.notes)) return;

  const duration = pianoRollState.quantize;
  const existingIdx = trackObj.notes.findIndex((n) => {
    const nStart = noteStart(n);
    const nPitch = notePitch(n);
    return nPitch === pitch && Math.abs(nStart - startBeat) < 0.05;
  });

  if (pianoRollState.tool === "erase" || existingIdx !== -1) {
    if (existingIdx !== -1) trackObj.notes.splice(existingIdx, 1);
  } else {
    trackObj.notes.push({ pitch, start: startBeat, duration, velocity: 0.8 });
    trackObj.notes.sort((a, b) => noteStart(a) - noteStart(b));
    void player.liveNoteOn(pitch, 90).then(() => setTimeout(() => player.liveNoteOff(pitch, true), 120));
  }

  renderPianoRollGrid();
  renderTimeline();
}

function quantizeTrackNotes(id, step) {
  const trackObj = songTracks().find((t, idx) => trackId(t, idx) === id);
  if (!trackObj || !Array.isArray(trackObj.notes)) return;
  trackObj.notes.forEach((n) => {
    const s = noteStart(n);
    n.start = Math.round(s / step) * step;
    n.duration = Math.max(step, Math.round((n.duration || step) / step) * step);
  });
}

function transposeTrackNotes(id, semitones) {
  const trackObj = songTracks().find((t, idx) => trackId(t, idx) === id);
  if (!trackObj || !Array.isArray(trackObj.notes)) return;
  trackObj.notes.forEach((n) => {
    n.pitch = clamp(n.pitch + semitones, 12, 110);
  });
}

function clearTrackNotes(id) {
  const trackObj = songTracks().find((t, idx) => trackId(t, idx) === id);
  if (!trackObj) return;
  trackObj.notes = [];
}

let trackRackInteractionsBound = false;

function bindTrackRackInteractions(rack) {
  if (trackRackInteractionsBound || !rack) return;
  trackRackInteractionsBound = true;
  const cardFrom = (target) => target.closest?.(".track-card");
  rack.addEventListener("click", (event) => {
    const card = cardFrom(event.target);
    if (!card) return;
    const action = event.target.closest?.("[data-action]");
    if (action) {
      event.stopPropagation();
      handleTrackAction(card.dataset.track, action.dataset.action);
      return;
    }
    selectAttitudeTrack(card.dataset.track);
  });
  rack.addEventListener("focusin", (event) => {
    const card = cardFrom(event.target);
    if (card) selectAttitudeTrack(card.dataset.track, { announce: false });
  });
  rack.addEventListener("keydown", (event) => {
    const card = cardFrom(event.target);
    if (!card || event.target !== card || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    selectAttitudeTrack(card.dataset.track);
  });
  rack.addEventListener("input", (event) => {
    const card = cardFrom(event.target);
    const control = event.target.closest?.("[data-control]");
    if (card && control) handleTrackControl(card.dataset.track, control);
  });
  rack.addEventListener("change", (event) => {
    const card = cardFrom(event.target);
    const control = event.target.closest?.("[data-control]");
    if (card && control) handleTrackControlCommit(card.dataset.track, control);
  });
}

function renderTrackRack() {
  const tracksById = new Map(songTracks().map((track, index) => [trackId(track, index), track]));
  const rack = $("#trackRack");
  rack.innerHTML = TRACK_ORDER.map((id) => {
    const track = tracksById.get(id) || { id, program: state.trackSettings[id].program, notes: [] };
    const meta = TRACK_META[id];
    const settings = state.trackSettings[id];
    const muted = state.muted.has(id);
    const solo = state.solo.has(id);
    const locked = state.locked.has(id);
    const profilePick = profilePrograms(id).includes(Number(settings.program));
    const soundName = programName(id, settings.program);
    const targeted = state.selectedTrack === id;
    const panAmount = Math.round(Math.abs(settings.pan) * 100);
    const panLabel = Math.abs(settings.pan) < 0.01 ? "C" : `${settings.pan < 0 ? "L" : "R"}${panAmount}`;
    return `<article class="track-card${muted ? " is-muted" : ""}${solo ? " is-solo" : ""}${targeted ? " is-attitude-target" : ""}" data-track="${id}" style="--track-color:${meta.color}" tabindex="0" aria-label="${meta.name} mixer channel; click to select" ${targeted ? 'aria-current="true"' : ""}>
      <div class="track-card-header">
        <div class="track-identity">
          <span class="track-icon" aria-hidden="true">${meta.icon}</span>
          <span><strong class="track-name">${meta.name}</strong><small class="track-role">${meta.role} · ${trackNotes(track).length} notes</small><small class="track-voice">${soundName}</small></span>
        </div>
        <div class="track-primary-actions" aria-label="${meta.name} quick controls">
        <button class="track-toggle" data-action="mute" type="button" aria-label="Mute ${meta.name}" aria-pressed="${muted}" title="Mute">M</button>
        <button class="track-toggle" data-action="solo" type="button" aria-label="Solo ${meta.name}" aria-pressed="${solo}" title="Solo">S</button>
        </div>
      </div>
      <label class="track-control track-level-control"><span>LEVEL <output>${Math.round(settings.volume * 100)}%</output></span><input data-control="volume" type="range" min="0" max="1" step="0.01" value="${settings.volume}" aria-label="${meta.name} level" /></label>
      <details class="track-expression track-shaping">
        <summary><span><b>SHAPE INSTRUMENT</b><small>Sound · performance · space</small></span><i aria-hidden="true">+</i></summary>
        <div class="track-shaping-body">
          <label class="track-patch"><span><b>SOUND</b><em>${profilePick ? "STYLE PICK" : "CUSTOM"}</em></span><select data-control="program" aria-label="${meta.name} sound">${patchOptions(id, settings.program)}</select></label>
          <div class="track-shaping-grid">
            <label class="track-control"><span>DENSITY <output>${settings.density}%</output></span><input data-control="density" type="range" min="10" max="100" value="${settings.density}" aria-label="${meta.name} density" /></label>
            <label class="track-control variation-control"><span>MOVEMENT <output>${settings.variation}%</output></span><input data-control="variation" type="range" min="0" max="100" value="${settings.variation}" aria-label="${meta.name} variation" /></label>
            <label class="track-control octave-control"><span>REGISTER <output>${settings.octave > 0 ? "+" : ""}${settings.octave}</output></span><input data-control="octave" type="range" min="-2" max="2" step="1" value="${settings.octave}" aria-label="${meta.name} octave" /></label>
          </div>
          <div class="track-secondary-actions">
            <button class="track-toggle target-toggle" data-action="target" type="button" aria-label="Target ${meta.name} character" aria-pressed="${targeted}" title="Select for Character Shaper">◎ Character</button>
            <button class="track-toggle" data-action="lock" type="button" aria-label="Preserve ${meta.name} in similar ideas" aria-pressed="${locked}" title="Preserve in similar ideas">${locked ? "◆ Preserved" : "◇ Preserve"}</button>
            <button class="track-toggle" data-action="reroll" type="button" aria-label="Regenerate ${meta.name}" aria-pressed="false" title="Regenerate only this instrument">↻ Rewrite part</button>
            <button class="track-toggle" data-action="pianoroll" type="button" aria-label="Open Piano Roll for ${meta.name}" title="Open visual note editor">✎ Piano Roll</button>
          </div>
          <div class="track-expression-grid">
          <label class="track-control"><span>VELOCITY <output>${Math.round(settings.velocity * 100)}%</output></span><input data-control="velocity" type="range" min="0.5" max="1.5" step="0.01" value="${settings.velocity}" aria-label="${meta.name} velocity scale" /></label>
          <label class="track-control"><span>GATE <output>${Math.round(settings.gate * 100)}%</output></span><input data-control="gate" type="range" min="0.25" max="1.5" step="0.01" value="${settings.gate}" aria-label="${meta.name} note length" /></label>
          <label class="track-control"><span>PAN <output>${panLabel}</output></span><input data-control="pan" type="range" min="-1" max="1" step="0.01" value="${settings.pan}" aria-label="${meta.name} pan" /></label>
          <label class="track-control"><span>SPACE <output>${Math.round(settings.reverb * 100)}%</output></span><input data-control="reverb" type="range" min="0" max="1" step="0.01" value="${settings.reverb}" aria-label="${meta.name} reverb" /></label>
          <label class="track-control"><span>CUTOFF <output>${Math.round(settings.cutoff ?? 8000)}Hz</output></span><input data-control="cutoff" type="range" min="1000" max="14000" step="100" value="${settings.cutoff ?? 8000}" aria-label="${meta.name} filter cutoff" /></label>
          <label class="track-control"><span>RESONANCE <output>${Math.round((settings.resonance ?? 0.2) * 100)}%</output></span><input data-control="resonance" type="range" min="0" max="1" step="0.01" value="${settings.resonance ?? 0.2}" aria-label="${meta.name} filter resonance" /></label>
          </div>
          <details class="synth-designer-expander">
            <summary><span><b>ARCADE SYNTH DESIGNER</b><small>Live Web Audio Synthesis</small></span><i aria-hidden="true">+</i></summary>
            <div class="synth-designer-grid">
              <label class="track-control"><span>WAVEFORM</span>
                <select data-control="waveform" aria-label="${meta.name} synth waveform">
                  <option value="sine" ${settings.waveform === "sine" ? "selected" : ""}>Sine (Soft)</option>
                  <option value="triangle" ${!settings.waveform || settings.waveform === "triangle" ? "selected" : ""}>Triangle (Warm)</option>
                  <option value="square" ${settings.waveform === "square" ? "selected" : ""}>Square (Hollow)</option>
                  <option value="sawtooth" ${settings.waveform === "sawtooth" ? "selected" : ""}>Sawtooth (Bright)</option>
                </select>
              </label>
              <label class="track-control"><span>ATTACK <output>${Math.round((settings.attack ?? 0.01) * 1000)}ms</output></span>
                <input data-control="attack" type="range" min="0.002" max="0.5" step="0.005" value="${settings.attack ?? 0.01}" aria-label="${meta.name} attack" />
              </label>
              <label class="track-control"><span>RELEASE <output>${Math.round((settings.release ?? 0.25) * 1000)}ms</output></span>
                <input data-control="release" type="range" min="0.05" max="2.0" step="0.05" value="${settings.release ?? 0.25}" aria-label="${meta.name} release" />
              </label>
              <label class="track-control"><span>DETUNE <output>${settings.detune ?? 0}¢</output></span>
                <input data-control="detune" type="range" min="-25" max="25" step="1" value="${settings.detune ?? 0}" aria-label="${meta.name} detune" />
              </label>
            </div>
          </details>
        </div>
      </details>
    </article>`;
  }).join("");

  bindTrackRackInteractions(rack);
  decorateAutoRangeControls(rack);
  updateAllRangeFills();
  applyControlDescriptions(rack);
  renderMixOverview();
}

const workspaceController = createWorkspaceController({
  root: document,
  initialWorkspace: state.activeWorkspace,
  onChange(workspace) {
    appStore.transaction("workspace:activate", (draft) => {
      draft.activeWorkspace = workspace;
    });
  },
});

function initTabNav() {
  workspaceController.bind();
}

export function switchWorkspace(workspace) {
  return workspaceController.activate(workspace);
}

const uiRenderCoordinator = createRenderCoordinator({
  summary: renderSummary,
  timeline: renderTimeline,
  tracks: renderTrackRack,
  attitude: renderAttitudeStrip,
  editor: renderSectionEditor,
  thread: renderCreativeThread,
  ranges: updateRangeDisplays,
  workflow: renderWorkflow,
  descriptions: applyControlDescriptions,
  persistence: scheduleSessionSave,
});

export function renderUiRegions(...regions) {
  return uiRenderCoordinator.render(...regions);
}

export function getUiRenderMetrics() {
  return uiRenderCoordinator.snapshot();
}

export function resetUiRenderMetrics() {
  uiRenderCoordinator.resetMetrics();
}

function renderAll() {
  uiRenderCoordinator.renderAll();
  renderFinishWorkspace();
}

function renderFinishWorkspace() {
  if (!state.song || !$("#finishCoverImage")) return;
  const finish = coverArtworkFinish(state.coverVariation || 0);
  $("#finishCoverImage").src = coverArtworkDataUrl(
    { ...state.song, title: deriveTitle() },
    { variation: state.coverVariation || 0 },
  );
  $("#finishCoverImage").dataset.finish = finish.id;
  $("#finishCoverTitle").textContent = deriveTitle();
  if ($("#finishCoverLabel")) $("#finishCoverLabel").textContent = `${finish.label.toUpperCase()} FINISH`;
  $("#finishFacts").innerHTML = [
    `${songTracks().length} named tracks`,
    `${songKey()} ${songMode().replace(/([a-z])([A-Z])/g, "$1 $2")}`,
    `${Math.round(songBpm())} BPM`,
    `${songBars()} bars`,
    "Velocity + articulation",
    "CC expression + sustain + modulation",
  ].map((fact) => `<span>${fact}</span>`).join("");
}

async function saveCoverArtwork() {
  if (!state.song) return;
  const svg = createCoverArtworkSvg(
    { ...state.song, title: deriveTitle() },
    { variation: state.coverVariation || 0 },
  );
  const slug = deriveTitle().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "midi-arcade-cover";
  const filename = `${slug}-cover.svg`;
  const isNative = Boolean(window.Capacitor?.isNativePlatform?.());
  try {
    if (isNative) {
      const Filesystem = window.Capacitor?.Plugins?.Filesystem;
      const Share = window.Capacitor?.Plugins?.Share;
      if (!Filesystem?.writeFile || !Share?.share) throw new Error("Native save and share plugins are unavailable.");
      const result = await Filesystem.writeFile({
        path: `midi-exports/${filename}`,
        data: uint8ArrayToBase64(new TextEncoder().encode(svg)),
        directory: "CACHE",
        recursive: true,
      });
      await Share.share({ title: filename, url: result.uri, dialogTitle: "Save Cover Artwork" });
    } else {
      const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    showToast("Cover artwork is ready to save or share.");
  } catch (error) {
    console.error(error);
    showToast("Cover artwork could not be saved this time.");
  }
}


function updateRangeFill(input) {
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const ratio = (Number(input.value) - min) / Math.max(1, max - min);
  input.style.setProperty("--range-fill", `${clamp(ratio, 0, 1) * 100}%`);
}

function updateAllRangeFills() {
  $$('input[type="range"]').forEach(updateRangeFill);
}

function updateRangeDisplays() {
  const mappings = [
    ["#tempoControl", "#tempoValue", (value) => `${value} BPM`],
    ["#energyControl", "#energyValue", String],
    ["#complexityControl", "#complexityValue", String],
    ["#swingControl", "#swingValue", (value) => `${value}%`],
    ["#humanizeControl", "#humanizeValue", (value) => `${value}%`],
    ["#tripletControl", "#tripletValue", rhythmAmountLabel],
    ["#rollControl", "#rollValue", rhythmAmountLabel],
    ["#variationControl", "#variationValue", (value) => `${value}%`],
    ["#evolutionControl", "#evolutionValue", (value) => `${value}%`],
    ["#surpriseControl", "#surpriseValue", (value) => `${value}%`],
  ];
  for (const [inputSelector, outputSelector, formatter] of mappings) {
    const input = $(inputSelector);
    $(outputSelector).textContent = state.autoControls.has(input.id) ? "AUTO" : formatter(input.value);
    updateRangeFill(input);
  }
  renderTempoPocket();
}

let toastTimer;
function showToast(message) {
  const toast = $("#toast");
  if (!toast) return false;
  toast.textContent = message;
  toast.classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("visible"), 2600);
  return true;
}

function generationDelay() {
  return new Promise((resolve) => setTimeout(resolve, 430));
}

/**
 * Owns the shared visual and accessibility state for every composition job.
 * Keeping this in one place prevents a failed job from leaving an invisible
 * overlay, stale aria-busy state, or CPU-heavy generating animations behind.
 */
let generationSafetyTimer = null;

function clearGenerationSafetyTimer() {
  if (generationSafetyTimer) {
    clearTimeout(generationSafetyTimer);
    generationSafetyTimer = null;
  }
}

function armGenerationSafetyTimer() {
  clearGenerationSafetyTimer();
  generationSafetyTimer = setTimeout(() => {
    if (state.isGenerating) {
      console.warn("[generation-watchdog] Resetting stuck generation state after 15s timeout.");
      try { hideGenerationActivity(); } catch { /* ignore */ }
      try {
        appStore.transaction("generation:watchdog-reset", (draft) => {
          draft.isGenerating = false;
        });
      } catch {
        state.isGenerating = false;
      }
      showToast("Generation took longer than expected. Please try again.");
    }
  }, 15000);
}

function showGenerationActivity(message, { threadCopy = "" } = {}) {
  const wash = $("#generationWash");
  const messageElement = $("#generationMessage");
  if (messageElement && message) messageElement.textContent = message;
  wash?.classList.add("visible");
  wash?.setAttribute("aria-hidden", "false");
  document.body?.setAttribute("aria-busy", "true");
  $("#creativeThread")?.classList.add("is-generating");
  if (threadCopy && $("#threadLiveSection")) $("#threadLiveSection").textContent = threadCopy;
}

function hideGenerationActivity() {
  const wash = $("#generationWash");
  wash?.classList.remove("visible");
  wash?.setAttribute("aria-hidden", "true");
  document.body?.removeAttribute("aria-busy");
  $("#creativeThread")?.classList.remove("is-generating");
}

const generationRunner = createGenerationRunner({
  generateNew,
  generateSimilar,
  validate: (song) => Boolean(song && songTracks(song).length),
});

const generationExecutor = createGenerationExecutor({
  workerFactory: () => new Worker(new URL("./generation-worker.js", import.meta.url), { type: "module" }),
  fallback: (kind, payload) => {
    if (kind === "sectionVariations") {
      return Promise.resolve({
        status: "committed",
        options: generateSectionVariations(payload.sourceSong, payload.sectionId, payload.input),
      });
    }
    return generationRunner.generate(kind, {
      sourceSong: payload.sourceSong,
      config: payload.config,
    });
  },
});

function chooseNewGenrePrograms(seed) {
  const profile = genreProfile();
  for (const id of TRACK_ORDER) {
    const currentProgram = Number(state.trackSettings[id].program);
    const genreChoices = profilePrograms(id, profile);
    const fallbackChoices = (PATCHES[id] || []).map(([program]) => Number(program));
    const currentCharacter = previewVoice(id, currentProgram).character;
    const preferredAlternatives = genreChoices.filter((program) => (
      program !== currentProgram
      && previewVoice(id, program).character !== currentCharacter
    ));
    const expandedAlternatives = fallbackChoices.filter((program) => (
      program !== currentProgram
      && previewVoice(id, program).character !== currentCharacter
    ));
    // Most fresh ideas stay inside the genre palette. One in four explores the
    // wider role-safe palette so repeated generations do not converge on two sounds.
    const explorePalette = hashNumber(`${seed}:${selectedGenreId()}:${id}:palette-depth`) % 4 === 0;
    const alternatives = explorePalette && expandedAlternatives.length
      ? expandedAlternatives
      : preferredAlternatives.length
        ? preferredAlternatives
        : expandedAlternatives;
    if (alternatives.length) {
      state.trackSettings[id].program = alternatives[hashNumber(`${seed}:${selectedGenreId()}:${id}`) % alternatives.length];
    }
  }
}

async function runGeneration(kind, options = {}) {
  if (state.isGenerating) return;
  const copy = GENERATION_STATUS_COPY[kind] ?? GENERATION_STATUS_COPY.new;
  appStore.transaction("generation:start", (draft) => {
    draft.isGenerating = true;
  });
  armGenerationSafetyTimer();
  try {
    try { player.stop(); } catch (_) { /* ignore player errors */ }
    if (!options.skipHistory) pushHistory(createHistorySnapshot());
    showGenerationActivity(copy.busy, { threadCopy: copy.thread });

    const seed = createSeed();
    if (kind === "new") chooseNewGenrePrograms(seed);
    const sourceSong = options.sourceSong ?? state.song;
    const config = {
      ...buildConfig(seed),
      recentSongs: recentSongsForGeneration(sourceSong),
      ...(kind === "new" && sourceSong?.oneShotKit?.id
        ? { excludeOneShotKitIds: [sourceSong.oneShotKit.id] }
        : {}),
    };
    const work = generationExecutor.run(kind, { sourceSong, config });
    const [generated] = await Promise.all([work, generationDelay()]);
    let candidateSong = generated?.song;
    if (!candidateSong) {
      candidateSong = kind === "new"
        ? generateNew(config)
        : generateSimilar(sourceSong, config);
    }
    if (!candidateSong) throw new Error("The composition engine could not produce a valid arrangement.");
    const nextSong = kind === "similar" ? preserveLockedTracks(state.song, candidateSong) : candidateSong;
    appStore.transaction("generation:commit", (draft) => {
      draft.song = nextSong;
      draft.generationCount += 1;
      draft.focusedSection = null;
      draft.coverVariation = 0;
    });
    captureResolvedAutoTrackSettings(state.song);
    applyTrackSettingsToSong(state.song);
    syncControlsFromSong();
    captureAppliedGenerationSettings();
    renderAll();
    scheduleSessionSave();
    try { if (player.playing) player.restart(); } catch (_) { /* ignore */ }
    setWorkflowStep(2);
    const kitMessage = state.song?.oneShotKit?.name ? ` ${state.song.oneShotKit.name} is loaded.` : "";
    showToast(`${copy.ready}${kitMessage}`);
  } catch (error) {
    console.error(error);
    if (state.history.length) restoreHistory({ captureFuture: false, announce: false });
    showToast(`That idea hit a wrong note. ${error?.message || "Please try again."}`);
  } finally {
    clearGenerationSafetyTimer();
    hideGenerationActivity();
    try {
      appStore.transaction("generation:finish", (draft) => {
        draft.isGenerating = false;
      });
    } catch {
      state.isGenerating = false;
    }
  }
}

function handleTrackAction(id, action) {
  if (action === "target") {
    selectAttitudeTrack(id);
    return;
  }
  if (action === "mute") {
    state.muted.has(id) ? state.muted.delete(id) : state.muted.add(id);
    renderTrackRack();
    renderTimeline();
    if (player.playing) player.restart();
    scheduleSessionSave();
    return;
  }
  if (action === "solo") {
    state.solo.has(id) ? state.solo.delete(id) : state.solo.add(id);
    renderTrackRack();
    if (player.playing) player.restart();
    scheduleSessionSave();
    return;
  }
  if (action === "lock") {
    state.locked.has(id) ? state.locked.delete(id) : state.locked.add(id);
    renderTrackRack();
    showToast(state.locked.has(id) ? `${TRACK_META[id].name} will be preserved in related ideas.` : `${TRACK_META[id].name} is free to evolve again.`);
    scheduleSessionSave();
    return;
  }
  if (action === "reroll") regenerateTrack(id);
  if (action === "pianoroll") openPianoRoll(id);
}

function handleTrackControl(id, control) {
  const key = control.dataset.control;
  state.trackSettings[id][key] = Number(control.value);
  const output = control.closest("label")?.querySelector("output");
  if (output) {
    const value = Number(control.value);
    output.textContent = key === "octave"
      ? `${value > 0 ? "+" : ""}${value}`
      : key === "pan"
        ? Math.abs(value) < 0.01 ? "C" : `${value < 0 ? "L" : "R"}${Math.round(Math.abs(value) * 100)}`
        : key === "cutoff"
          ? `${Math.round(value)}Hz`
          : ["volume", "velocity", "reverb", "resonance", "gate"].includes(key)
          ? `${Math.round(value * 100)}%`
          : `${control.value}%`;
  }
  if (control.type === "range") updateRangeFill(control);
}

async function handleTrackControlCommit(id, control) {
  const key = control.dataset.control;
  state.trackSettings[id][key] = Number(control.value);
  if (key === "program") {
    const track = songTracks().find((candidate, index) => trackId(candidate, index) === id);
    if (track) track.program = Number(control.value);
    refreshSongIdea(state.song);
    renderIdeaInspector();
    renderMixOverview();
    if (player.playing) player.restart();
    scheduleSessionSave();
    showToast(`${TRACK_META[id].name} is now using ${control.selectedOptions[0].textContent}.`);
    return;
  }
  if (["volume", "velocity", "pan", "reverb", "cutoff", "resonance", "gate", "waveform", "synthCutoff", "synthResonance", "attack", "release", "detune"].includes(key)) {
    const val = key === "waveform" ? control.value : Number(control.value);
    state.trackSettings[id][key] = val;
    const track = songTracks().find((candidate, index) => trackId(candidate, index) === id);
    if (track) track.settings = { ...(track.settings || {}), [key]: val };
    if (player.playing) player.restart();
    else if (["waveform", "synthCutoff", "synthResonance", "attack", "release", "detune"].includes(key)) {
      void player.liveNoteOn(id === "bass" ? 36 : id === "pad" ? 48 : 60, 96).then(() => {
        setTimeout(() => player.liveNoteOff(id === "bass" ? 36 : id === "pad" ? 48 : 60, true), 160);
      });
    }
    scheduleSessionSave();
    return;
  }
  await regenerateTrack(id);
}

export function contextTracksForReroll(id, song = state.song) {
  const contextId = {
    drums: "bass",
    bass: "drums",
    melody: "counterpoint",
    counterpoint: "melody",
  }[id] || null;
  if (!contextId || !song) return undefined;
  const retainedTrack = songTracks(song).find((track, index) => trackId(track, index) === contextId);
  return retainedTrack ? { [contextId]: retainedTrack } : undefined;
}

export function buildTrackRerollInput(id, song = state.song, seed = createSeed()) {
  if (!TRACK_ORDER.includes(id) || !song) return null;
  const selectedTrackControls = buildConfig(seed).trackControls[id];
  const contextTracks = contextTracksForReroll(id, song);
  return {
    seed,
    targetTrack: id,
    compositionRoute: song.compositionRoute?.id,
    recentSongs: recentSongsForGeneration(song),
    tracks: { [id]: selectedTrackControls },
    ...(contextTracks ? { contextTracks } : {}),
  };
}

async function regenerateTrack(id, options = {}) {
  if (state.isGenerating || !state.song) return;
  const original = state.song;
  pushHistory(options.historySnapshot);
  appStore.transaction("generation:reroll-start", (draft) => {
    draft.isGenerating = true;
  });
  armGenerationSafetyTimer();
  showGenerationActivity(trackRewriteStatus(TRACK_META[id].name));
  try {
    const generationInput = buildTrackRerollInput(id, original, createSeed());
    const work = generationExecutor.run("similar", { sourceSong: original, config: generationInput })
      .then((result) => result?.song)
      .catch(() => null);
    let [candidate] = await Promise.all([work, generationDelay()]);
    if (!candidate) candidate = generateSimilar(original, generationInput);
    const replacement = songTracks(candidate).find((track, index) => trackId(track, index) === id);
    if (!replacement) throw new Error(`No ${id} track was generated.`);
    const next = deepClone(original);
    next.id = candidate.id ?? next.id;
    next.parentId = original.id ?? null;
    next.generation = "similar";
    next.revision = candidate.revision ?? (Number(original.revision) || 0) + 1;
    next.seed = candidate.seed ?? createSeed();
    next.tracks = songTracks(next).map((track, index) => trackId(track, index) === id ? deepClone(replacement) : track);
    next.settings = { ...(next.settings || {}) };
    const candidateSettings = candidate.settings || {};
    if ((id === "drums" || id === "melody") && candidateSettings.tripletAmount != null) {
      next.settings.tripletAmount = candidateSettings.tripletAmount;
    }
    if (id === "drums" && candidateSettings.rollAmount != null) {
      next.settings.rollAmount = candidateSettings.rollAmount;
    }
    state.song = applyTrackSettingsToSong(next);
    renderAll();
    const attitude = options.attitude ? ` with ${ATTITUDE_LABELS[options.attitude].toLowerCase()} attitude` : "";
    const message = `${TRACK_META[id].name} found a fresh part${attitude}; the rest of the band stayed untouched.`;
    renderAttitudeStrip(message);
    showToast(message);
  } catch (error) {
    console.error(error);
    restoreHistory({ captureFuture: false, announce: false });
    showToast(`Could not rewrite ${TRACK_META[id].name.toLowerCase()} this time.`);
  } finally {
    clearGenerationSafetyTimer();
    hideGenerationActivity();
    try {
      appStore.transaction("generation:reroll-finish", (draft) => {
        draft.isGenerating = false;
      });
    } catch {
      state.isGenerating = false;
    }
  }
}

function randomizeTrackControls() {
  for (const id of TRACK_ORDER) {
    const settings = state.trackSettings[id];
    settings.density = Math.round(clamp(settings.density + (Math.random() - 0.5) * 32, 14, 94));
    settings.variation = Math.round(clamp(settings.variation + (Math.random() - 0.5) * 38, 5, 95));
  }
  renderTrackRack();
  showToast("The band has a new balance. Generate a related idea to hear it compose.");
}

function reshapeArrangement() {
  const source = state.song?.structure ?? state.song?.sections;
  if (!Array.isArray(source) || source.length < 4) {
    runGeneration("similar");
    return;
  }
  const reordered = [source[0], ...source.slice(1, -1).reverse(), source.at(-1)].map(deepClone);
  const reshaped = deepClone(state.song);
  const beatsPerBar = Number(reshaped.meta?.beatsPerBar ?? 4);
  const occurrences = {};
  let startBar = 0;
  reshaped.structure = reordered.map((section) => {
    const name = String(section.name || "idea").toLowerCase();
    const bars = Math.max(1, Math.round(Number(section.bars) || 1));
    occurrences[name] = (occurrences[name] || 0) + 1;
    const next = {
      ...section,
      id: `${name}-${occurrences[name]}`,
      name,
      bars,
      startBar,
      startBeat: startBar * beatsPerBar,
      endBeat: (startBar + bars) * beatsPerBar,
    };
    startBar += bars;
    return next;
  });
  reshaped.sections = deepClone(reshaped.structure);
  showToast(`Reshaping toward ${reshaped.structure.map((section) => section.name).join(" → ")}.`);
  runGeneration("similar", { sourceSong: reshaped });
}

function chooseRecipe() {
  state.recipeIndex = (state.recipeIndex + 1 + Math.floor(Math.random() * (RECIPES.length - 1))) % RECIPES.length;
  const recipe = RECIPES[state.recipeIndex];
  $("#modeControl").value = recipe.mode;
  $("#grooveControl").value = recipe.groove;
  $("#energyControl").value = recipe.energy;
  $("#complexityControl").value = recipe.complexity;
  updateRangeDisplays();
  renderSummary();
  renderGenerationIntent();
  scheduleSessionSave();
  showToast(`${recipe.name} is loaded. Spark a new song when you are ready.`);
}

function renameSong() {
  if (!state.song) return;
  const current = deriveTitle();
  const next = window.prompt("Name this song idea", current)?.trim();
  if (!next) return;
  state.song.title = next.slice(0, 60);
  renderSummary();
  scheduleSessionSave();
  showToast("Idea renamed.");
}

function uint8ArrayToBase64(bytes) {
  let binary = "";
  const len = bytes.byteLength;
  for (let i = 0; i < len; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export async function exportSongNative(payload, filename) {
  const base64Data = uint8ArrayToBase64(payload);
  const Filesystem = window.Capacitor?.Plugins?.Filesystem;
  const Share = window.Capacitor?.Plugins?.Share;
  if (!Filesystem?.writeFile || !Share?.share) throw new Error("Native save and share plugins are unavailable.");

  if (typeof Filesystem.checkPermissions === "function") {
    try {
      const status = await Filesystem.checkPermissions();
      if (status?.publicStorage === "prompt" || status?.publicStorage === "denied") {
        if (typeof Filesystem.requestPermissions === "function") {
          await Filesystem.requestPermissions({ permissions: ["publicStorage"] });
        }
      }
    } catch {
      // Permission check non-fatal, proceed with write
    }
  }

  const result = await Filesystem.writeFile({
    path: `midi-exports/${filename}`,
    data: base64Data,
    directory: "CACHE",
    recursive: true,
  });

  await Share.share({
    title: filename,
    url: result.uri,
    dialogTitle: "Save MIDI Song Idea",
  });
  pruneMidiExportsCache().catch(() => {});
}

/**
 * Prune the midi-exports cache directory when it exceeds maxBytes.
 * Deletes oldest files first. Called on init and after every native export.
 * @param {number} maxBytes - default 5 MB
 */
async function pruneMidiExportsCache(maxBytes = 5_000_000) {
  try {
    const Filesystem = window.Capacitor?.Plugins?.Filesystem;
    if (!Filesystem?.readdir || !Filesystem?.stat || !Filesystem?.deleteFile) return;

    const { files } = await Filesystem.readdir({
      path: "midi-exports",
      directory: "CACHE",
    }).catch(() => ({ files: [] }));

    if (!files || files.length === 0) return;

    // Stat all files to get mtime and size.
    const entries = await Promise.all(
      files.map(async (f) => {
        const name = typeof f === "string" ? f : f.name;
        try {
          const info = await Filesystem.stat({
            path: `midi-exports/${name}`,
            directory: "CACHE",
          });
          return { name, size: info.size || 0, mtime: info.mtime || 0 };
        } catch {
          return { name, size: 0, mtime: 0 };
        }
      }),
    );

    // Sort oldest first.
    entries.sort((a, b) => a.mtime - b.mtime);

    let totalSize = entries.reduce((s, e) => s + e.size, 0);
    let pruned = 0;

    for (const entry of entries) {
      if (totalSize <= maxBytes) break;
      await Filesystem.deleteFile({
        path: `midi-exports/${entry.name}`,
        directory: "CACHE",
      }).catch(() => {});
      totalSize -= entry.size;
      pruned += 1;
    }

    if (pruned > 0) {
      console.info(`[cache] Pruned ${pruned} old MIDI export(s) to stay under ${Math.round(maxBytes / 1024)} KB.`);
    }
  } catch (err) {
    // Cache cleanup is best-effort; never block the user.
    console.warn("[cache] pruneMidiExportsCache failed silently:", err);
  }
}

function triggerBrowserDownload(payload, filename) {
  const blob = new Blob([payload], { type: "audio/midi" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function triggerHaptic(type = "light") {
  try {
    if (typeof window !== "undefined" && window.navigator?.vibrate) {
      const pattern = type === "medium" ? 25 : type === "heavy" ? 40 : 12;
      window.navigator.vibrate(pattern);
    }
  } catch {
    // Ignore haptic failures
  }
}

export function buildExportSongSnapshot(song = state.song, { includeLiveTake = true } = {}) {
  if (!song) return null;
  const clone = deepClone(song);
  clone.tracks = songTracks(clone).map((track, index) => {
    const id = trackId(track, index);
    const defaults = TRACK_DEFINITIONS[id] || {};
    const liveSettings = state.trackSettings[id] || {};
    return {
      ...track,
      program: Number.isFinite(Number(liveSettings.program)) ? Number(liveSettings.program) : Number(track.program ?? 0),
      settings: {
        ...defaults,
        ...(track.settings || track.controls || {}),
        ...liveSettings,
        mute: state.muted.has(id),
        solo: state.solo.has(id),
      },
    };
  });
  return clone;
}

async function exportSong() {
  if (!state.song) return;
  let isNative = false;
  try {
    const clone = buildExportSongSnapshot();
    const bytes = encodeMidi(clone, { alwaysIncludeTrackIds: ["live-take"] });
    const payload = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const keyStr = songKey().toLowerCase();
    const modeStr = songMode().toLowerCase();
    const bpmVal = Math.round(songBpm());
    const genreStr = songGenreId().toLowerCase();
    const titleSlug = deriveTitle().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "midi-arcade-idea";
    const filename = `${titleSlug}_${keyStr}-${modeStr}_${bpmVal}bpm_${genreStr}.mid`;

    isNative = Boolean(typeof window !== "undefined"
      && window.Capacitor?.isNativePlatform?.());

    if (isNative) {
      await exportSongNative(payload, filename);
    } else {
      triggerBrowserDownload(payload, filename);
    }

    $("#creativeThread")?.classList.add("is-exported");
    if ($("#threadLiveSection")) {
      $("#threadLiveSection").textContent = isNative
        ? `${clone.tracks?.length || 0} connected tracks prepared for sharing`
        : `${clone.tracks?.length || 0} connected tracks exported`;
    }
    setTimeout(() => {
      $("#creativeThread")?.classList.remove("is-exported");
      renderCreativeThread();
    }, 1800);
    showToast(isNative
      ? `Sound-ready MIDI prepared with ${clone.tracks?.length || 0} named tracks and instrument setup.`
      : `Exported sound-ready MIDI with ${clone.tracks?.length || 0} named tracks and matching performance data.`);
  } catch (error) {
    console.error(error);
    if (isNative) {
      const canceled = /cancel/i.test(String(error?.message || ""));
      showToast(canceled
        ? "MIDI export canceled. No file was shared."
        : "MIDI export failed. No file was shared; please try again.");
    } else {
      showToast("MIDI export could not finish. Please generate the idea again.");
    }
  }
}

function expressionPoints(automation) {
  const sorted = (Array.isArray(automation) ? automation : [])
    .filter((event) => String(event?.type).toLowerCase() === "cc"
      && Number(event?.controller) === 11
      && Number.isFinite(Number(event?.beat))
      && Number.isFinite(Number(event?.value)))
    .map((event) => ({ beat: Number(event.beat), value: clamp(Number(event.value), 0, 127) }))
    .sort((a, b) => a.beat - b.beat);
  return sorted.reduce((points, point) => {
    if (points.length && Math.abs(points.at(-1).beat - point.beat) < 1e-7) points[points.length - 1] = point;
    else points.push(point);
    return points;
  }, []);
}

export function expressionAtBeat(automation, beat, fallback = 127) {
  const points = expressionPoints(automation);
  const targetBeat = Number(beat);
  if (!points.length || !Number.isFinite(targetBeat)) return clamp(Number(fallback), 0, 127);
  if (targetBeat < points[0].beat) return clamp(Number(fallback), 0, 127);
  if (targetBeat >= points.at(-1).beat) return points.at(-1).value;
  const rightIndex = points.findIndex((point) => point.beat > targetBeat);
  const left = points[rightIndex - 1];
  const right = points[rightIndex];
  const ratio = (targetBeat - left.beat) / Math.max(0.000001, right.beat - left.beat);
  return left.value + (right.value - left.value) * ratio;
}

export function expressionCurveBetween(automation, startBeat, endBeat) {
  const start = Math.max(0, Number(startBeat) || 0);
  const end = Math.max(start, Number(endBeat) || start);
  const interior = expressionPoints(automation)
    .filter((point) => point.beat > start + 1e-7 && point.beat < end - 1e-7);
  const curve = [
    { beat: start, value: expressionAtBeat(automation, start) / 127 },
    ...interior.map((point) => ({ beat: point.beat, value: point.value / 127 })),
  ];
  if (end > start + 1e-7) curve.push({ beat: end, value: expressionAtBeat(automation, end) / 127 });
  return curve;
}

function membershipSet(value) {
  return value instanceof Set ? value : new Set(Array.isArray(value) ? value : []);
}

export function buildPreviewEvents(song = state.song, options = {}) {
  if (!song) return [];
  const muted = membershipSet(options.muted ?? state.muted);
  const solo = membershipSet(options.solo ?? state.solo);
  const settingsById = options.trackSettings ?? state.trackSettings;
  const secondsPerBeat = 60 / songBpm(song);
  const activeSolo = solo.size > 0;
  const backingOnly = Boolean(options.backingOnly);
  const oneShotKitId = oneShotKitForSong(song).id;
  return songTracks(song).flatMap((track, index) => {
    const id = trackId(track, index);
    if (muted.has(id) || (activeSolo && !solo.has(id)) || (backingOnly && ["melody", "counterpoint"].includes(id))) return [];
    const defaults = TRACK_DEFINITIONS[id] || {};
    const uiSettings = settingsById?.[id] || {};
    const settings = { ...defaults, ...(track.settings || track.controls || {}), ...uiSettings };
    const velocityScale = Math.sqrt(clamp(Number(settings.velocity ?? defaults.velocity ?? 1), 0.1, 1.5)
      / Math.max(0.1, Number(defaults.velocity ?? 1)));
    const gateScale = Math.sqrt(clamp(Number(settings.gate ?? defaults.gate ?? 0.9), 0.08, 1.5)
      / Math.max(0.08, Number(defaults.gate ?? 0.9)));
    const mixGain = clamp(Number(settings.volume ?? defaults.volume ?? 0.8), 0, 1);
    const automation = Array.isArray(track.automation) ? track.automation : [];
    return trackNotes(track).map((note) => {
      const startBeat = Math.max(0, noteStart(note));
      const durationBeats = Math.max(0.01, noteDuration(note));
      const audibleDurationBeats = durationBeats * clamp(gateScale, 0.65, 1.4);
      const noteExpressionCurve = expressionCurveBetween(automation, startBeat, startBeat + audibleDurationBeats);
      const expressionCurve = (id === "drums" ? noteExpressionCurve.slice(0, 1) : noteExpressionCurve)
        .map((point) => ({
          beat: point.beat,
          offset: (point.beat - startBeat) * secondsPerBeat,
          value: point.value,
        }));
      const expressionStart = expressionCurve[0]?.value ?? 1;
      const expressionEnd = expressionCurve.at(-1)?.value ?? expressionStart;
      const baseVelocity = clamp(noteVelocity(note) * velocityScale, 1, 127);
      return {
        id,
        oneShotKitId,
        program: Number(track.program ?? uiSettings.program ?? 0),
        pitch: notePitch(note),
        velocity: clamp(baseVelocity * expressionStart, 1, 127),
        baseVelocity,
        time: startBeat * secondsPerBeat,
        duration: Math.max(0.03, audibleDurationBeats * secondsPerBeat),
        expressionStart,
        expressionEnd,
        expressionCurve,
        mixGain,
        pan: clamp(Number(settings.pan ?? defaults.pan ?? 0), -1, 1),
        reverb: clamp(Number(settings.reverb ?? defaults.reverb ?? 0.2), 0, 1),
        cutoff: clamp(Number(settings.cutoff ?? defaults.cutoff ?? 8000), 1000, 14000),
        resonance: clamp(Number(settings.resonance ?? defaults.resonance ?? 0.2), 0, 1),
        gate: clamp(Number(settings.gate ?? defaults.gate ?? 0.9), 0.08, 1.5),
        articulation: String(note.articulation || "natural"),
        glideFromSemitones: Number.isFinite(Number(note.glideFromSemitones)) ? Number(note.glideFromSemitones) : 0,
        glideDuration: Math.max(0, Number(note.glideBeats || 0) * secondsPerBeat),
      };
    });
  }).sort((a, b) => a.time - b.time);
}

const PREVIEW_VOICE_DEFAULTS = Object.freeze({
  bass: { type: "triangle", layer: "sine", filter: 980, q: 0.9, attack: 0.008, release: 0.12, peak: 0.095, detune: -3, mainLevel: 0.84, layerLevel: 0.24, layerRatio: 1, filterPeak: 1.2, filterRest: 0.82, vibratoDepth: 0, vibratoRate: 0 },
  chords: { type: "triangle", layer: "sine", filter: 2400, q: 0.65, attack: 0.012, release: 0.28, peak: 0.05, detune: 5, mainLevel: 0.82, layerLevel: 0.27, layerRatio: 1, filterPeak: 1.38, filterRest: 0.84, vibratoDepth: 0, vibratoRate: 0 },
  melody: { type: "triangle", layer: "sine", filter: 3200, q: 0.85, attack: 0.01, release: 0.17, peak: 0.062, detune: 4, mainLevel: 0.82, layerLevel: 0.2, layerRatio: 1, filterPeak: 1.4, filterRest: 0.86, vibratoDepth: 6, vibratoRate: 5.1 },
  counterpoint: { type: "sine", layer: "triangle", filter: 3800, q: 1.1, attack: 0.006, release: 0.24, peak: 0.043, detune: 8, mainLevel: 0.82, layerLevel: 0.18, layerRatio: 1, filterPeak: 1.35, filterRest: 0.84, vibratoDepth: 4, vibratoRate: 4.2 },
  pad: { type: "sawtooth", layer: "triangle", filter: 1350, q: 0.7, attack: 0.18, release: 0.68, peak: 0.027, detune: 9, mainLevel: 0.68, layerLevel: 0.34, layerRatio: 1, filterPeak: 1.2, filterRest: 0.7, vibratoDepth: 3.5, vibratoRate: 0.34 },
});

const PREVIEW_PROGRAM_VOICES = Object.freeze({
  bass: {
    32: { character: "upright-wood", type: "triangle", layer: "sine", filter: 760, q: 0.7, attack: 0.018, release: 0.2, layerLevel: 0.16 },
    33: { character: "fingered-round", type: "triangle", layer: "sine", filter: 1080, q: 0.85, attack: 0.01, release: 0.13 },
    34: { character: "picked-bright", type: "sawtooth", layer: "triangle", filter: 1550, q: 1.25, attack: 0.003, release: 0.085, layerLevel: 0.16 },
    35: { character: "fretless-singing", type: "sine", layer: "triangle", filter: 920, q: 0.65, attack: 0.028, release: 0.23, vibratoDepth: 7, vibratoRate: 4.6 },
    36: { character: "slap-bite", type: "square", layer: "triangle", filter: 2150, q: 1.8, attack: 0.002, release: 0.07, filterPeak: 1.75 },
    37: { character: "slap-pop", type: "sawtooth", layer: "square", filter: 2600, q: 2.15, attack: 0.002, release: 0.06, layerRatio: 2, layerLevel: 0.1 },
    38: { character: "sub-sine", type: "sine", layer: "square", filter: 560, q: 1.3, attack: 0.012, release: 0.18, layerLevel: 0.11 },
    39: { character: "rubber-resonant", type: "sawtooth", layer: "square", filter: 1120, q: 3.4, attack: 0.006, release: 0.14, detune: -8 },
    43: { character: "contrabass-bow", type: "triangle", layer: "sawtooth", filter: 680, q: 0.75, attack: 0.075, release: 0.32, layerLevel: 0.12, vibratoDepth: 4, vibratoRate: 4.1 },
    87: { character: "hybrid-lead-bass", type: "sawtooth", layer: "square", filter: 1780, q: 2.1, attack: 0.004, release: 0.12, detune: 9 },
    88: { character: "new-age-sub", type: "sine", layer: "triangle", filter: 820, q: 0.55, attack: 0.045, release: 0.38, layerRatio: 0.5, layerLevel: 0.2 },
  },
  chords: {
    0: { character: "grand-piano", type: "triangle", layer: "sine", filter: 3600, q: 0.5, attack: 0.003, release: 0.32, layerRatio: 2, layerLevel: 0.14 },
    4: { character: "velvet-ep", type: "sine", layer: "triangle", filter: 1850, q: 0.7, attack: 0.012, release: 0.46, vibratoDepth: 2.5, vibratoRate: 5.3 },
    5: { character: "crystal-ep", type: "sine", layer: "square", filter: 4200, q: 1.25, attack: 0.004, release: 0.38, layerRatio: 2, layerLevel: 0.1 },
    6: { character: "harpsichord-pluck", type: "sawtooth", layer: "square", filter: 3900, q: 1.1, attack: 0.002, release: 0.1, layerRatio: 2, layerLevel: 0.08 },
    7: { character: "clavinet-funk", type: "square", layer: "sawtooth", filter: 2850, q: 2.2, attack: 0.002, release: 0.08, layerLevel: 0.12 },
    11: { character: "vibes-glass", type: "sine", layer: "triangle", filter: 5200, q: 1.5, attack: 0.003, release: 0.66, layerRatio: 2, layerLevel: 0.12, vibratoDepth: 3, vibratoRate: 5.8 },
    12: { character: "marimba-wood", type: "sine", layer: "triangle", filter: 2800, q: 0.9, attack: 0.002, release: 0.13, layerRatio: 2, layerLevel: 0.18 },
    16: { character: "drawbar-organ", type: "square", layer: "sine", filter: 2100, q: 0.45, attack: 0.018, release: 0.25, layerRatio: 2, layerLevel: 0.22, filterPeak: 1.05 },
    17: { character: "percussive-organ", type: "square", layer: "triangle", filter: 2750, q: 0.8, attack: 0.003, release: 0.22, layerRatio: 2, layerLevel: 0.2 },
    19: { character: "church-organ", type: "sine", layer: "square", filter: 1500, q: 0.4, attack: 0.075, release: 0.62, layerRatio: 0.5, layerLevel: 0.24 },
    24: { character: "nylon-guitar", type: "triangle", layer: "sine", filter: 2450, q: 0.8, attack: 0.003, release: 0.16, layerRatio: 2, layerLevel: 0.1 },
    25: { character: "steel-guitar", type: "triangle", layer: "sawtooth", filter: 3400, q: 1.1, attack: 0.003, release: 0.2, layerLevel: 0.11 },
    48: { character: "string-ensemble", type: "sawtooth", layer: "triangle", filter: 1350, q: 0.65, attack: 0.12, release: 0.55, detune: 11 },
    52: { character: "choir-aahs", type: "triangle", layer: "sine", filter: 1250, q: 1.4, attack: 0.1, release: 0.58, vibratoDepth: 3, vibratoRate: 4.5 },
    61: { character: "brass-stab", type: "sawtooth", layer: "square", filter: 2500, q: 1.35, attack: 0.018, release: 0.16, filterPeak: 1.65 },
    62: { character: "synth-brass", type: "sawtooth", layer: "square", filter: 1850, q: 2.2, attack: 0.035, release: 0.24, detune: 13 },
    81: { character: "saw-chords", type: "sawtooth", layer: "sawtooth", filter: 2300, q: 1.4, attack: 0.012, release: 0.25, detune: 17 },
    89: { character: "warm-pad-chords", type: "triangle", layer: "sawtooth", filter: 980, q: 0.55, attack: 0.16, release: 0.68, detune: 10 },
    90: { character: "poly-chords", type: "square", layer: "sawtooth", filter: 1900, q: 1.7, attack: 0.04, release: 0.34, detune: 15 },
    95: { character: "sweep-chords", type: "sawtooth", layer: "triangle", filter: 1080, q: 2.8, attack: 0.22, release: 0.72, filterPeak: 1.9 },
  },
  melody: {
    24: { character: "nylon-lead", type: "triangle", layer: "sine", filter: 2600, q: 0.8, attack: 0.004, release: 0.15, vibratoDepth: 2 },
    26: { character: "jazz-guitar", type: "triangle", layer: "square", filter: 2150, q: 0.9, attack: 0.004, release: 0.18, layerLevel: 0.1 },
    40: { character: "solo-violin", type: "sawtooth", layer: "triangle", filter: 2200, q: 1.2, attack: 0.055, release: 0.3, vibratoDepth: 12, vibratoRate: 5.7 },
    56: { character: "muted-trumpet", type: "square", layer: "sawtooth", filter: 2450, q: 2.4, attack: 0.012, release: 0.15, layerLevel: 0.12, vibratoDepth: 4 },
    65: { character: "alto-sax", type: "sawtooth", layer: "sine", filter: 1900, q: 2, attack: 0.025, release: 0.2, layerLevel: 0.15, vibratoDepth: 8, vibratoRate: 5.2 },
    68: { character: "oboe-reed", type: "square", layer: "sine", filter: 1650, q: 3.1, attack: 0.035, release: 0.22, layerLevel: 0.13, vibratoDepth: 5 },
    71: { character: "clarinet-wood", type: "square", layer: "triangle", filter: 1450, q: 1.5, attack: 0.028, release: 0.24, layerLevel: 0.11, vibratoDepth: 5 },
    73: { character: "breathy-flute", type: "sine", layer: "triangle", filter: 4800, q: 0.45, attack: 0.055, release: 0.26, layerLevel: 0.12, vibratoDepth: 7 },
    80: { character: "soft-square", type: "square", layer: "sine", filter: 2050, q: 1.65, attack: 0.012, release: 0.17, layerLevel: 0.14 },
    81: { character: "warm-saw", type: "sawtooth", layer: "triangle", filter: 2850, q: 1.5, attack: 0.008, release: 0.15, detune: 8 },
    82: { character: "calliope", type: "square", layer: "sine", filter: 4300, q: 2.4, attack: 0.004, release: 0.13, layerRatio: 2, layerLevel: 0.12 },
    84: { character: "charang", type: "sawtooth", layer: "square", filter: 3600, q: 2.7, attack: 0.003, release: 0.11, detune: 12 },
    85: { character: "air-voice", type: "sine", layer: "sawtooth", filter: 1350, q: 1.3, attack: 0.075, release: 0.36, layerLevel: 0.11, vibratoDepth: 9 },
    86: { character: "fifths-lead", type: "sawtooth", layer: "square", filter: 2700, q: 1.8, attack: 0.007, release: 0.17, layerRatio: 1.5, layerLevel: 0.16 },
    87: { character: "bass-lead-hybrid", type: "square", layer: "sawtooth", filter: 1750, q: 2.5, attack: 0.006, release: 0.19, layerRatio: 0.5, layerLevel: 0.2 },
  },
  counterpoint: {
    10: { character: "music-box", type: "sine", layer: "triangle", filter: 5400, q: 1.6, attack: 0.002, release: 0.58, layerRatio: 2, layerLevel: 0.15, vibratoDepth: 0 },
    11: { character: "vibraphone", type: "sine", layer: "triangle", filter: 4600, q: 1.2, attack: 0.003, release: 0.64, layerRatio: 2, vibratoDepth: 5, vibratoRate: 5.6 },
    14: { character: "tubular-bell", type: "sine", layer: "square", filter: 6200, q: 2.1, attack: 0.002, release: 0.82, layerRatio: 2.5, layerLevel: 0.08, vibratoDepth: 0 },
    24: { character: "nylon-answer", type: "triangle", layer: "sine", filter: 2750, q: 0.8, attack: 0.004, release: 0.16, vibratoDepth: 1 },
    25: { character: "steel-answer", type: "triangle", layer: "sawtooth", filter: 3400, q: 1, attack: 0.003, release: 0.2, layerLevel: 0.09 },
    40: { character: "violin-answer", type: "sawtooth", layer: "triangle", filter: 2100, q: 1.2, attack: 0.06, release: 0.31, vibratoDepth: 11, vibratoRate: 5.8 },
    48: { character: "string-answer", type: "sawtooth", layer: "triangle", filter: 1400, q: 0.65, attack: 0.11, release: 0.48, detune: 11 },
    53: { character: "voice-ooh", type: "sine", layer: "triangle", filter: 1150, q: 1.7, attack: 0.085, release: 0.5, vibratoDepth: 6 },
    65: { character: "sax-answer", type: "sawtooth", layer: "sine", filter: 1800, q: 2.1, attack: 0.025, release: 0.2, vibratoDepth: 7 },
    71: { character: "clarinet-answer", type: "square", layer: "triangle", filter: 1450, q: 1.4, attack: 0.03, release: 0.24, vibratoDepth: 4 },
    73: { character: "flute-answer", type: "sine", layer: "triangle", filter: 4800, q: 0.45, attack: 0.05, release: 0.26, vibratoDepth: 7 },
    80: { character: "square-answer", type: "square", layer: "sine", filter: 2200, q: 1.8, attack: 0.01, release: 0.16 },
    81: { character: "saw-answer", type: "sawtooth", layer: "triangle", filter: 2900, q: 1.6, attack: 0.008, release: 0.15 },
    82: { character: "calliope-answer", type: "square", layer: "sine", filter: 4400, q: 2.3, attack: 0.004, release: 0.13, layerRatio: 2 },
    84: { character: "charang-answer", type: "sawtooth", layer: "square", filter: 3700, q: 2.7, attack: 0.003, release: 0.11 },
    85: { character: "air-answer", type: "sine", layer: "sawtooth", filter: 1250, q: 1.3, attack: 0.075, release: 0.34, vibratoDepth: 8 },
    86: { character: "fifths-answer", type: "sawtooth", layer: "square", filter: 2700, q: 1.8, attack: 0.007, release: 0.17, layerRatio: 1.5 },
    98: { character: "crystal-answer", type: "sine", layer: "square", filter: 5600, q: 2.8, attack: 0.006, release: 0.7, layerRatio: 2, layerLevel: 0.1, vibratoDepth: 2 },
  },
  pad: {
    48: { character: "orchestral-strings", type: "sawtooth", layer: "triangle", filter: 1150, q: 0.55, attack: 0.22, release: 0.78, detune: 12 },
    51: { character: "synth-strings", type: "sawtooth", layer: "square", filter: 1550, q: 0.9, attack: 0.16, release: 0.66, detune: 17 },
    52: { character: "choir-aahs-pad", type: "triangle", layer: "sine", filter: 980, q: 1.5, attack: 0.2, release: 0.82, vibratoDepth: 4, vibratoRate: 4.3 },
    54: { character: "synth-voice-pad", type: "sine", layer: "sawtooth", filter: 1250, q: 1.8, attack: 0.18, release: 0.74, layerLevel: 0.18 },
    88: { character: "new-age-shimmer", type: "sine", layer: "triangle", filter: 2100, q: 0.65, attack: 0.24, release: 0.9, layerRatio: 2, layerLevel: 0.2 },
    89: { character: "warm-analog-pad", type: "triangle", layer: "sawtooth", filter: 880, q: 0.55, attack: 0.2, release: 0.82, detune: 13 },
    90: { character: "polysynth-pad", type: "square", layer: "sawtooth", filter: 1650, q: 1.45, attack: 0.11, release: 0.58, detune: 18 },
    91: { character: "choir-pad", type: "sine", layer: "triangle", filter: 1050, q: 1.7, attack: 0.28, release: 0.94, vibratoDepth: 4.5, vibratoRate: 4.1 },
    92: { character: "bowed-glass", type: "triangle", layer: "sine", filter: 1850, q: 2.7, attack: 0.3, release: 1.05, layerRatio: 2, layerLevel: 0.16 },
    93: { character: "metallic-pad", type: "square", layer: "sine", filter: 2250, q: 3.2, attack: 0.16, release: 0.76, layerRatio: 2.5, layerLevel: 0.09 },
    94: { character: "halo-pad", type: "sine", layer: "sawtooth", filter: 1700, q: 1.05, attack: 0.26, release: 0.95, layerRatio: 2, layerLevel: 0.12 },
    95: { character: "sweep-pad", type: "sawtooth", layer: "triangle", filter: 950, q: 2.9, attack: 0.34, release: 1.08, filterPeak: 2.1 },
    96: { character: "rain-texture", type: "triangle", layer: "square", filter: 2600, q: 2.2, attack: 0.26, release: 0.88, layerRatio: 2.5, layerLevel: 0.08 },
    99: { character: "atmosphere", type: "sine", layer: "sawtooth", filter: 720, q: 1.2, attack: 0.42, release: 1.2, layerRatio: 0.5, layerLevel: 0.24 },
  },
});

export function previewVoice(id, program, customSynth = null) {
  const normalizedId = PREVIEW_VOICE_DEFAULTS[id] ? id : "melody";
  const normalizedProgram = clamp(Math.round(Number(program) || 0), 0, 127);
  const base = PREVIEW_VOICE_DEFAULTS[normalizedId];
  const programmed = PREVIEW_PROGRAM_VOICES[normalizedId]?.[normalizedProgram];
  const voice = programmed ? { ...base, ...programmed } : {
    ...base,
    character: `${normalizedId}-gm-${normalizedProgram}`,
    type: ["sine", "triangle", "square", "sawtooth"][(normalizedProgram + TRACK_ORDER.indexOf(normalizedId)) % 4],
    layer: ["sine", "triangle", "square", "sawtooth"][(normalizedProgram + 1) % 4],
    filter: clamp(base.filter * (0.72 + (normalizedProgram % 8) * 0.095), 320, 6200),
    q: clamp(base.q + ((normalizedProgram % 8) % 4) * 0.35, 0.3, 4.5),
    attack: base.attack * (0.72 + ((normalizedProgram % 8) % 3) * 0.34),
    release: base.release * (0.76 + ((normalizedProgram % 8) % 4) * 0.19),
    detune: base.detune + ((normalizedProgram % 8) - 3.5) * 1.6,
    layerRatio: (normalizedProgram % 8) % 3 === 0 ? 2 : (normalizedProgram % 8) % 3 === 1 ? 1 : 0.5,
  };

  if (customSynth && typeof customSynth === "object") {
    if (["sine", "triangle", "square", "sawtooth"].includes(customSynth.waveform)) {
      voice.type = customSynth.waveform;
    }
    if (Number.isFinite(Number(customSynth.synthCutoff))) {
      voice.filter = clamp(Number(customSynth.synthCutoff), 150, 14000);
    }
    if (Number.isFinite(Number(customSynth.synthResonance))) {
      voice.q = clamp(Number(customSynth.synthResonance), 0.1, 14);
    }
    if (Number.isFinite(Number(customSynth.attack))) {
      voice.attack = clamp(Number(customSynth.attack), 0.002, 0.6);
    }
    if (Number.isFinite(Number(customSynth.release))) {
      voice.release = clamp(Number(customSynth.release), 0.04, 2.5);
    }
    if (Number.isFinite(Number(customSynth.detune))) {
      voice.detune = clamp(Number(customSynth.detune), -35, 35);
    }
  }
  return voice;
}

export const PREVIEW_AUDIO_LIMITS = Object.freeze({
  scheduleIntervalMs: 75,
  visualIntervalMs: 33,
  detailRefreshMs: 250,
  lookAheadSeconds: 0.85,
  lateEventGraceSeconds: 0.12,
  maxScheduledVoices: 96,
});

let screenWakeLock = null;

export async function requestScreenWakeLock() {
  if (typeof navigator !== "undefined" && "wakeLock" in navigator && !screenWakeLock) {
    try {
      screenWakeLock = await navigator.wakeLock.request("screen");
      screenWakeLock.addEventListener("release", () => {
        screenWakeLock = null;
      });
    } catch {
      screenWakeLock = null;
    }
  }
}

export function releaseScreenWakeLock() {
  if (screenWakeLock) {
    try { screenWakeLock.release(); } catch { /* ignore */ }
    screenWakeLock = null;
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      void requestScreenWakeLock();
    } else {
      releaseScreenWakeLock();
    }
  });
  if (document.visibilityState === "visible") {
    void requestScreenWakeLock();
  }
}

export class PreviewPlayer {
  constructor() {
    this.context = null;
    this.master = null;
    this.reverbBus = null;
    this.delayBus = null;
    this.noiseBuffers = new Map();
    this.periodicWaves = new Map();
    this.timer = null;
    this.frame = null;
    this.idleTimer = null;
    this.events = [];
    this.eventIndex = 0;
    this.startedAt = 0;
    this.offset = 0;
    this.position = 0;
    this.playing = false;
    this.playRequestGeneration = 0;
    this.scheduledVoices = new Set();
    this.lastScheduleAt = 0;
    this.lastDetailRefreshAt = -Infinity;
    this.playbackView = null;
    this.recoveryPromise = null;
    this.liveVoices = new Map();
  }

  async ensureContext() {
    this.cancelIdleSuspend();
    if (this.context?.state === "closed") this.resetContextReferences(this.context);
    if (!this.context) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) throw new Error("Web Audio is unavailable.");
      // Allow native hardware sample rate matching to avoid DAC resampling buffer pops on Android/tablets
      this.context = new AudioContextClass({ latencyHint: "interactive" });
      const createdContext = this.context;
      createdContext.onstatechange = () => this.handleContextStateChange(createdContext);
      if (typeof window !== "undefined") {
        if (!this.visibilityHandler) {
          this.visibilityHandler = () => {
            if (document.visibilityState === "visible" && this.playing && this.context?.state === "suspended") {
              void this.recoverAudioContext(this.context);
            }
          };
          document.addEventListener("visibilitychange", this.visibilityHandler);
        }
        if (navigator.mediaDevices?.addEventListener && !this.deviceChangeHandler) {
          this.deviceChangeHandler = () => {
            if (this.playing && this.context) void this.recoverAudioContext(this.context);
          };
          navigator.mediaDevices.addEventListener("devicechange", this.deviceChangeHandler);
        }
      }

      // Master output — raised to 0.42 for phone speaker loudness.
      this.master = this.context.createGain();
      this.master.gain.value = 0.42;

      // High-pass at 35 Hz removes sub-bass rumble on phone speakers.
      const highpass = this.context.createBiquadFilter();
      highpass.type = "highpass";
      highpass.frequency.value = 35;
      highpass.Q.value = 0.55;

      // Low-shelf boost for warmth on phone speakers (+2.2 dB).
      const warmth = this.context.createBiquadFilter();
      warmth.type = "lowshelf";
      warmth.frequency.value = 135;
      warmth.gain.value = 2.2;

      // Main compressor — tighter knee, lower threshold for punchy mobile playback.
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -18;
      compressor.knee.value = 14;
      compressor.ratio.value = 5.5;
      compressor.attack.value = 0.008;
      compressor.release.value = 0.14;

      // Brick-wall limiter — raised to -1.5 dB for more headroom.
      const limiter = this.context.createDynamicsCompressor();
      limiter.threshold.value = -1.5;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.002;
      limiter.release.value = 0.075;

      // Soft-clip waveshaper — reduced drive (1.08) for less harshness on phone.
      if (typeof this.context.createWaveShaper === "function") {
        const saturation = this.context.createWaveShaper();
        const curve = new Float32Array(4096);
        for (let index = 0; index < curve.length; index += 1) {
          const x = index * 2 / (curve.length - 1) - 1;
          curve[index] = Math.tanh(x * 1.08) / Math.tanh(1.08);
        }
        saturation.curve = curve;
        saturation.oversample = "4x";
        this.master.connect(highpass).connect(warmth).connect(saturation).connect(compressor).connect(limiter).connect(this.context.destination);
      } else {
        this.master.connect(highpass).connect(warmth).connect(compressor).connect(limiter).connect(this.context.destination);
      }

      // Reverb bus — extended to 2.2 s with smoother exponential decay (2.2 exponent).
      if (typeof this.context.createConvolver === "function") {
        this.reverbBus = this.context.createConvolver();
        const length = Math.floor(this.context.sampleRate * 2.2);
        const impulse = this.context.createBuffer(2, length, this.context.sampleRate);
        for (let channel = 0; channel < impulse.numberOfChannels; channel += 1) {
          const data = impulse.getChannelData(channel);
          for (let index = 0; index < length; index += 1) {
            const phase = Math.sin((index + 1) * (12.9898 + channel * 31.417)) * 43758.5453;
            const noise = (phase - Math.floor(phase)) * 2 - 1;
            data[index] = noise * Math.pow(1 - index / length, 2.2);
          }
        }
        this.reverbBus.buffer = impulse;
        const reverbFilter = this.context.createBiquadFilter();
        reverbFilter.type = "lowpass";
        reverbFilter.frequency.value = 4600;
        const reverbReturn = this.context.createGain();
        reverbReturn.gain.value = 0.26;
        this.reverbBus.connect(reverbFilter).connect(reverbReturn).connect(this.master);
      }

      // Delay bus — reduced feedback (0.18) and return (0.12) to avoid mud on mobile.
      if (typeof this.context.createDelay === "function") {
        this.delayBus = this.context.createDelay(1);
        this.delayBus.delayTime.value = 0.285;
        const delayFilter = this.context.createBiquadFilter();
        delayFilter.type = "lowpass";
        delayFilter.frequency.value = 4100;
        const feedback = this.context.createGain();
        feedback.gain.value = 0.18;
        const delayReturn = this.context.createGain();
        delayReturn.gain.value = 0.12;
        this.delayBus.connect(delayFilter);
        delayFilter.connect(feedback).connect(this.delayBus);
        delayFilter.connect(delayReturn).connect(this.master);
      }
    }
    if (["suspended", "interrupted"].includes(this.context.state)) await this.context.resume();
    if (this.context.state !== "running") throw new Error("Audio output is not ready yet.");
  }

  resetContextReferences(context = this.context) {
    if (context && context.onstatechange) context.onstatechange = null;
    if (context === this.context) this.context = null;
    this.master = null;
    this.reverbBus = null;
    this.delayBus = null;
    this.noiseBuffers.clear();
    this.periodicWaves.clear();
  }

  currentSongTime() {
    if (!this.playing || !this.context) return this.position;
    return clamp(this.offset + (this.context.currentTime - this.startedAt), 0, totalSeconds());
  }

  handleContextStateChange(context) {
    if (context !== this.context || !this.playing) return;
    if (["suspended", "interrupted", "closed"].includes(context.state)) {
      void this.recoverAudioContext(context);
    }
  }

  async recoverAudioContext(interruptedContext = this.context) {
    if (!this.playing || !interruptedContext) return false;
    if (this.recoveryPromise) return this.recoveryPromise;
    const requestGeneration = this.playRequestGeneration;
    const resumePosition = this.currentSongTime();
    const recovery = (async () => {
      this.clearScheduledAudio();
      if (interruptedContext.state === "closed") this.resetContextReferences(interruptedContext);
      try {
        await this.ensureContext();
      } catch {
        return false;
      }
      if (!this.playing || requestGeneration !== this.playRequestGeneration || this.context?.state !== "running") {
        return false;
      }
      this.position = resumePosition;
      this.offset = resumePosition;
      this.startedAt = this.context.currentTime;
      this.eventIndex = this.events.findIndex((event) => event.time >= resumePosition - PREVIEW_AUDIO_LIMITS.lateEventGraceSeconds);
      if (this.eventIndex < 0) this.eventIndex = this.events.length;
      this.lastScheduleAt = this.context.currentTime;
      this.schedule();
      return true;
    })();
    this.recoveryPromise = recovery;
    try {
      return await recovery;
    } finally {
      if (this.recoveryPromise === recovery) this.recoveryPromise = null;
    }
  }

  cancelIdleSuspend() {
    clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  suspendWhenIdle(delay = 1200) {
    this.cancelIdleSuspend();
    if (!this.context) return;
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      if (this.playing || this.liveVoices.size || this.context?.state !== "running") return;
      this.context.suspend().catch(() => {});
    }, Math.max(0, delay));
  }

  buildEvents() {
    this.events = buildPreviewEvents();
    this.playbackView = playbackViewForSong();
    this.lastDetailRefreshAt = -Infinity;
  }

  async toggle() {
    this.playing ? this.pause() : await this.play();
  }

  async play() {
    if (!state.song) return false;
    if (this.playing) return true;
    const requestGeneration = ++this.playRequestGeneration;
    try {
      await this.ensureContext();
    } catch (error) {
      if (requestGeneration === this.playRequestGeneration) showToast(error.message);
      return false;
    }
    if (requestGeneration !== this.playRequestGeneration || this.playing) return this.playing;
    void requestScreenWakeLock();
    if (this.master?.gain) {
      try {
        const now = this.context.currentTime;
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.setValueAtTime(0.0001, now);
        this.master.gain.exponentialRampToValueAtTime(0.42, now + 0.015);
      } catch {
        this.master.gain.value = 0.42;
      }
    }
    this.buildEvents();
    const duration = totalSeconds();
    if (this.position >= duration - 0.05) this.position = 0;
    this.offset = this.position;
    this.startedAt = this.context.currentTime;
    this.eventIndex = this.events.findIndex((event) => event.time >= this.offset - PREVIEW_AUDIO_LIMITS.lateEventGraceSeconds);
    if (this.eventIndex < 0) this.eventIndex = this.events.length;
    this.lastScheduleAt = this.context.currentTime;
    this.playing = true;
    setPlaybackPresentation(true);
    $("#playButton").classList.add("playing");
    $("#playButton").setAttribute("aria-label", "Pause song");
    const mobileDockPlay = $("#mobilePlayPause");
    if (mobileDockPlay) {
      mobileDockPlay.classList.add("playing");
      const mobileIcon = $("#mobilePlayIcon");
      if (mobileIcon) mobileIcon.innerHTML = '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>';
      const mobileText = $("#mobilePlayText");
      if (mobileText) mobileText.textContent = "Pause";
    }
    $("#playhead").classList.add("visible");
    this.schedule();
    this.timer = setInterval(() => this.schedule(), PREVIEW_AUDIO_LIMITS.scheduleIntervalMs);
    this.updateFrame();
    setWorkflowStep(3);
    return true;
  }

  schedule() {
    if (!this.playing || !this.context) return;
    if (this.context.state !== "running") {
      void this.recoverAudioContext(this.context);
      return;
    }
    this.lastScheduleAt = this.context.currentTime;
    const currentSongTime = this.offset + (this.context.currentTime - this.startedAt);
    const horizon = currentSongTime + PREVIEW_AUDIO_LIMITS.lookAheadSeconds;
    while (this.eventIndex < this.events.length && this.events[this.eventIndex].time <= horizon) {
      const event = this.events[this.eventIndex++];
      if (event.time >= currentSongTime - PREVIEW_AUDIO_LIMITS.lateEventGraceSeconds) {
        const when = this.context.currentTime + Math.max(0, event.time - currentSongTime);
        this.scheduleEvent(event, when);
      }
    }
  }

  voicePriority(event) {
    return ({ melody: 6, bass: 5, counterpoint: 4, chords: 3, pad: 3, drums: 2 }[event?.id] || 1);
  }

  registerScheduledVoice(sources, nodes, event, startedAt) {
    const voiceSources = new Set(sources.filter(Boolean));
    const voiceNodes = new Set([...nodes, ...voiceSources].filter(Boolean));
    const voice = {
      sources: voiceSources,
      nodes: voiceNodes,
      endedSources: new Set(),
      priority: this.voicePriority(event),
      startedAt,
      cleaned: false,
    };
    this.scheduledVoices.add(voice);
    for (const source of voiceSources) {
      source.onended = () => {
        if (voice.cleaned) return;
        voice.endedSources.add(source);
        if (voice.endedSources.size >= voice.sources.size) this.cleanupScheduledVoice(voice, false);
      };
    }
    this.enforceScheduledVoiceLimit();
    return voice;
  }

  cleanupScheduledVoice(voice, stopSources = true) {
    if (!voice || voice.cleaned) return;
    voice.cleaned = true;
    this.scheduledVoices.delete(voice);
    if (this.context && stopSources) {
      const now = this.context.currentTime;
      for (const node of voice.nodes) {
        if (node.gain?.cancelScheduledValues) {
          try {
            node.gain.cancelScheduledValues(now);
            node.gain.setValueAtTime(Math.max(0.0001, node.gain.value || 0.01), now);
            node.gain.exponentialRampToValueAtTime(0.0001, now + 0.008);
          } catch { /* ignore */ }
        }
      }
    }
    for (const source of voice.sources) {
      source.onended = null;
      if (stopSources) {
        try { source.stop(); } catch { /* source already stopped */ }
      }
    }
    for (const node of voice.nodes) {
      try { node.disconnect(); } catch { /* node already disconnected */ }
    }
    voice.sources.clear();
    voice.nodes.clear();
    voice.endedSources.clear();
  }

  enforceScheduledVoiceLimit() {
    while (this.scheduledVoices.size > PREVIEW_AUDIO_LIMITS.maxScheduledVoices) {
      const victim = [...this.scheduledVoices].sort((left, right) => (
        left.priority - right.priority || left.startedAt - right.startedAt
      ))[0];
      if (!victim) return;
      this.cleanupScheduledVoice(victim, true);
    }
  }

  async liveNoteOn(pitch, velocity = 96) {
    await this.ensureContext();
    const safePitch = clamp(Math.round(Number(pitch) || 60), 0, 127);
    const safeVelocity = clamp(Math.round(Number(velocity) || 96), 1, 127);
    if (this.liveVoices.has(safePitch)) this.liveNoteOff(safePitch, true);
    if (this.liveVoices.size >= 16) {
      const oldest = [...this.liveVoices.entries()].sort((left, right) => left[1].startedAt - right[1].startedAt)[0];
      if (oldest) this.liveNoteOff(oldest[0], true);
    }

    const context = this.context;
    const when = context.currentTime;
    const voice = previewVoice("melody", 0);
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const oscillators = [];
    const nodes = new Set([filter, gain]);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1700, when);
    filter.frequency.exponentialRampToValueAtTime(4300, when + 0.035);
    filter.frequency.exponentialRampToValueAtTime(2500, when + 0.38);
    gain.gain.setValueAtTime(0.0001, when);
    const peak = 0.075 * (safeVelocity / 127);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), when + 0.006);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak * 0.66), when + 0.42);
    this.connectPreviewOutput(gain, { id: "melody", pan: 0.04, reverb: 0.2 }, 0.04, 1, nodes);

    const startOscillator = (type, level, detune = 0) => {
      const oscillator = context.createOscillator();
      const levelGain = context.createGain();
      oscillator.type = type;
      oscillator.frequency.value = 440 * 2 ** ((safePitch - 69) / 12);
      oscillator.detune.value = detune;
      levelGain.gain.value = level;
      oscillator.connect(levelGain).connect(filter);
      oscillator.start(when);
      oscillators.push(oscillator);
      nodes.add(oscillator);
      nodes.add(levelGain);
    };
    startOscillator(voice.type, 0.82);
    startOscillator("sine", 0.24, 4);
    filter.connect(gain);
    this.liveVoices.set(safePitch, { gain, filter, oscillators, nodes, startedAt: when });
  }

  liveNoteOff(pitch, immediate = false) {
    const safePitch = clamp(Math.round(Number(pitch) || 60), 0, 127);
    const active = this.liveVoices.get(safePitch);
    if (!active || !this.context) return;
    this.liveVoices.delete(safePitch);
    const now = this.context.currentTime;
    const release = immediate ? 0.012 : 0.09;
    if (typeof active.gain.gain.cancelAndHoldAtTime === "function") active.gain.gain.cancelAndHoldAtTime(now);
    else {
      active.gain.gain.cancelScheduledValues(now);
      active.gain.gain.setValueAtTime(Math.max(0.0002, active.gain.gain.value || 0.02), now);
    }
    active.gain.gain.exponentialRampToValueAtTime(0.0001, now + release);
    let remainingSources = active.oscillators.length;
    const cleanup = () => {
      for (const node of active.nodes) {
        try { node.disconnect(); } catch { /* node already disconnected */ }
      }
      active.nodes.clear();
    };
    for (const oscillator of active.oscillators) {
      try { oscillator.stop(now + release + 0.025); } catch { /* voice already ended */ }
      oscillator.onended = () => {
        remainingSources -= 1;
        if (remainingSources <= 0) cleanup();
      };
    }
    if (!remainingSources) cleanup();
    if (!this.liveVoices.size && !this.playing) this.suspendWhenIdle((release + 0.2) * 1000);
  }

  stopAllLiveNotes() {
    for (const pitch of [...this.liveVoices.keys()]) this.liveNoteOff(pitch, true);
  }

  connectPreviewOutput(node, event, defaultPan = 0, reverbScale = 1, trackedNodes = null) {
    trackedNodes?.add(node);
    let output = node;
    if (event.id === "drums" && typeof this.context.createBiquadFilter === "function") {
      const tone = this.context.createBiquadFilter();
      tone.type = "lowpass";
      tone.frequency.value = clamp(Number(event.cutoff ?? 8000), 1000, 14000);
      tone.Q.value = 0.4 + clamp(Number(event.resonance ?? 0.2), 0, 1) * 8;
      output.connect(tone);
      output = tone;
      trackedNodes?.add(tone);
    }
    if (typeof this.context.createStereoPanner === "function") {
      const panner = this.context.createStereoPanner();
      panner.pan.value = Number.isFinite(Number(event.pan)) ? Number(event.pan) : defaultPan;
      output.connect(panner);
      output = panner;
      trackedNodes?.add(panner);
    }
    output.connect(this.master);
    if (this.reverbBus && Number(event.reverb) > 0) {
      const send = this.context.createGain();
      send.gain.value = clamp(Number(event.reverb) * 0.42 * reverbScale, 0, 0.48);
      output.connect(send).connect(this.reverbBus);
      trackedNodes?.add(send);
    }
    const delayAmount = ({ bass: 0.018, chords: 0.055, melody: 0.16, counterpoint: 0.2, pad: 0.09 }[event.id] || 0);
    if (this.delayBus && delayAmount > 0) {
      const delaySend = this.context.createGain();
      delaySend.gain.value = delayAmount * clamp(0.35 + Number(event.reverb || 0), 0.35, 1.15);
      output.connect(delaySend).connect(this.delayBus);
      trackedNodes?.add(delaySend);
    }
    return trackedNodes;
  }

  noiseBufferForKit(kit) {
    if (this.noiseBuffers.has(kit.id)) return this.noiseBuffers.get(kit.id);
    const context = this.context;
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * 0.9), context.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = hashNumber(`${kit.id}:one-shot-noise`) || 0x6d2b79f5;
    let smoothed = 0;
    const brightness = clamp(Number(kit.preview.noiseColor) / 1.8, 0.18, 1);
    for (let index = 0; index < data.length; index += 1) {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      const white = ((seed >>> 0) / 0xffffffff) * 2 - 1;
      smoothed += (white - smoothed) * (0.08 + brightness * 0.42);
      data[index] = clamp(white * (0.3 + brightness * 0.7) + smoothed * (1 - brightness) * 0.75, -1, 1);
    }
    this.noiseBuffers.set(kit.id, buffer);
    return buffer;
  }

  periodicWaveForVoice(voice, event) {
    if (!this.context?.createPeriodicWave) return null;
    const character = String(voice.character || `${event.id}:${event.program}`);
    if (this.periodicWaves.has(character)) return this.periodicWaves.get(character);
    const harmonics = 10;
    const real = new Float32Array(harmonics);
    const imaginary = new Float32Array(harmonics);
    const brightness = clamp(Number(event.cutoff ?? 8000) / 12000, 0.16, 1);
    const seed = hashNumber(`periodic:${character}`) || 1;
    for (let harmonic = 1; harmonic < harmonics; harmonic += 1) {
      const oddBias = harmonic % 2 ? 1 : 0.58;
      const color = 0.82 + ((seed >>> (harmonic % 16)) & 7) / 28;
      imaginary[harmonic] = oddBias * color * brightness ** (harmonic * 0.28) / harmonic;
    }
    const wave = this.context.createPeriodicWave(real, imaginary, { disableNormalization: false });
    this.periodicWaves.set(character, wave);
    return wave;
  }

  scheduleEvent(event, when) {
    if (event.id === "drums") {
      this.scheduleDrum(event, when);
      return;
    }
    const context = this.context;
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    const oscillator = context.createOscillator();
    const mainLevel = context.createGain();
    const sources = [oscillator];
    const nodes = new Set([gain, filter, oscillator, mainLevel]);
    const voice = previewVoice(event.id, event.program, state?.trackSettings?.[event.id]);
    const cutoffScale = clamp(Number(event.cutoff ?? 8000) / 8000, 0.125, 1.75);
    const resonanceScale = 0.65 + clamp(Number(event.resonance ?? 0.2), 0, 1) * 1.75;
    const velocityScale = 0.76 + (clamp(Number(event.velocity ?? 90), 1, 127) / 127) * 0.44;
    const filterBase = clamp(voice.filter * cutoffScale * velocityScale, 120, 15000);
    const targetFrequency = 440 * 2 ** ((clamp(event.pitch, 24, 108) - 69) / 12);
    const periodicWave = this.periodicWaveForVoice(voice, event);
    if (periodicWave) oscillator.setPeriodicWave(periodicWave);
    else oscillator.type = voice.type;
    const glideSemitones = clamp(Number(event.glideFromSemitones || 0), -2, 2);
    const glideDuration = clamp(Number(event.glideDuration || 0), 0, 0.24);
    oscillator.frequency.setValueAtTime(targetFrequency * 2 ** (glideSemitones / 12), when);
    if (glideDuration > 0.001) oscillator.frequency.exponentialRampToValueAtTime(targetFrequency, when + glideDuration);
    filter.type = "lowpass";
    filter.frequency.value = filterBase;
    filter.Q.value = clamp(voice.q * resonanceScale, 0.1, 18);
    const articulation = String(event.articulation || "natural");
    const attack = voice.attack * (articulation === "accent" ? 0.55 : articulation === "legato" || articulation === "glide" ? 1.35 : 1);
    const release = (voice.release + Number(event.reverb || 0) * (event.id === "pad" ? 1.15 : 0.72))
      * (articulation === "staccato" ? 0.45 : articulation === "legato" || articulation === "sustain" ? 1.28 : 1);
    const duration = clamp(event.duration, 0.04, event.id === "pad" ? 14 : event.id === "chords" ? 8 : 3.5);
    const filterPeak = clamp(filterBase * voice.filterPeak, 180, 14000);
    const filterRest = clamp(filterBase * voice.filterRest, 140, 12000);
    filter.frequency.setValueAtTime(Math.max(120, filterBase * 0.62), when);
    filter.frequency.exponentialRampToValueAtTime(filterPeak, when + Math.max(0.018, attack + 0.045));
    filter.frequency.exponentialRampToValueAtTime(filterRest, when + Math.max(0.08, duration * 0.82));
    mainLevel.gain.value = voice.mainLevel;
    const basePeak = (Number(event.baseVelocity ?? event.velocity) / 127)
      * voice.peak
      * clamp(Number(event.mixGain ?? 1), 0, 1);
    const fallbackCurve = [
      { offset: 0, value: Number(event.expressionStart ?? 1) },
      { offset: duration, value: Number(event.expressionEnd ?? event.expressionStart ?? 1) },
    ];
    const expressionCurve = Array.isArray(event.expressionCurve) && event.expressionCurve.length
      ? event.expressionCurve
      : fallbackCurve;
    const startPeak = Math.max(0.0002, basePeak * clamp(Number(expressionCurve[0]?.value ?? 1), 0, 1));
    const envelopeEnd = Math.max(duration, attack + 0.01);
    gain.gain.setValueAtTime(0.0001, when);
    gain.gain.exponentialRampToValueAtTime(startPeak, when + attack);
    let previousCurveTime = when + attack;
    for (const [index, point] of expressionCurve.slice(1).entries()) {
      const lastPoint = index === expressionCurve.length - 2;
      const requestedOffset = clamp(Number(point.offset ?? envelopeEnd), 0, envelopeEnd);
      const latestInterior = Math.max(attack + 0.002, envelopeEnd - 0.002);
      const scheduledOffset = lastPoint
        ? envelopeEnd
        : clamp(requestedOffset, attack + 0.002, latestInterior);
      const curveTime = Math.max(previousCurveTime + 0.001, when + scheduledOffset);
      const decayPosition = clamp(requestedOffset / Math.max(0.01, duration), 0, 1);
      const naturalDecay = 1 - decayPosition * 0.28;
      const level = Math.max(0.0002, basePeak * clamp(Number(point.value), 0, 1) * naturalDecay);
      gain.gain.exponentialRampToValueAtTime(level, curveTime);
      previousCurveTime = curveTime;
    }
    gain.gain.exponentialRampToValueAtTime(0.0001, Math.max(previousCurveTime + 0.001, when + duration + release));
    this.connectPreviewOutput(
      gain,
      event,
      ({ bass: -0.08, chords: -0.18, melody: 0.12, counterpoint: 0.32, pad: 0.04 }[event.id] || 0),
      1,
      nodes,
    );
    oscillator.connect(mainLevel).connect(filter).connect(gain);
    oscillator.start(when);
    oscillator.stop(when + duration + release + 0.02);
    if (voice.layer) {
      const layer = context.createOscillator();
      const layerLevel = context.createGain();
      sources.push(layer);
      nodes.add(layer);
      nodes.add(layerLevel);
      const layerWave = this.periodicWaveForVoice({ ...voice, character: `${voice.character || event.id}:layer` }, event);
      if (layerWave) layer.setPeriodicWave(layerWave);
      else layer.type = voice.layer;
      layer.frequency.setValueAtTime(targetFrequency * voice.layerRatio * 2 ** (glideSemitones / 12), when);
      if (glideDuration > 0.001) layer.frequency.exponentialRampToValueAtTime(targetFrequency * voice.layerRatio, when + glideDuration);
      layer.detune.value = voice.detune;
      layerLevel.gain.value = voice.layerLevel;
      layer.connect(layerLevel).connect(filter);
      layer.start(when);
      layer.stop(when + duration + release + 0.02);

      const vibratoDepth = voice.vibratoDepth;
      if (vibratoDepth > 0) {
        const lfo = context.createOscillator();
        const lfoDepth = context.createGain();
        sources.push(lfo);
        nodes.add(lfo);
        nodes.add(lfoDepth);
        lfo.type = "sine";
        lfo.frequency.value = voice.vibratoRate;
        lfoDepth.gain.value = vibratoDepth;
        lfo.connect(lfoDepth);
        lfoDepth.connect(oscillator.detune);
        lfoDepth.connect(layer.detune);
        lfo.start(when + Math.min(0.12, duration * 0.25));
        lfo.stop(when + duration + release + 0.02);
      }
    }
    this.registerScheduledVoice(sources, nodes, event, when);
  }

  scheduleDrum(event, when) {
    const context = this.context;
    const mixGain = clamp(Number(event.mixGain ?? 1), 0, 1);
    const kit = ONE_SHOT_KIT_BY_ID.get(event.oneShotKitId) ?? oneShotKitForSong();
    const voice = kit.preview;
    if ([35, 36].includes(event.pitch)) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const sources = [oscillator];
      const nodes = new Set([oscillator, gain]);
      oscillator.type = voice.kickWave;
      oscillator.frequency.setValueAtTime(voice.kickStart, when);
      oscillator.frequency.exponentialRampToValueAtTime(voice.kickEnd, when + Math.min(0.14, voice.kickDecay * 0.55));
      gain.gain.setValueAtTime((event.velocity / 127) * 0.5 * mixGain, when);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + voice.kickDecay);
      oscillator.connect(gain);
      this.connectPreviewOutput(gain, event, 0, 0.08, nodes);
      oscillator.start(when);
      oscillator.stop(when + voice.kickDecay + 0.015);

      const click = context.createOscillator();
      const clickFilter = context.createBiquadFilter();
      const clickGain = context.createGain();
      sources.push(click);
      nodes.add(click);
      nodes.add(clickFilter);
      nodes.add(clickGain);
      click.type = "triangle";
      click.frequency.setValueAtTime(voice.clickPitch, when);
      click.frequency.exponentialRampToValueAtTime(Math.max(520, voice.clickPitch * 0.28), when + 0.018);
      clickFilter.type = "highpass";
      clickFilter.frequency.value = Math.max(700, voice.clickPitch * 0.28);
      clickGain.gain.setValueAtTime((event.velocity / 127) * voice.clickLevel * mixGain, when);
      clickGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.026);
      click.connect(clickFilter).connect(clickGain);
      this.connectPreviewOutput(clickGain, event, 0, 0, nodes);
      click.start(when);
      click.stop(when + 0.03);
      this.registerScheduledVoice(sources, nodes, event, when);
      return;
    }

    if ([41, 43, 45, 47, 48, 50].includes(event.pitch)) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const nodes = new Set([oscillator, gain]);
      const tomFrequencies = { 41: 82, 43: 96, 45: 112, 47: 132, 48: 148, 50: 174 };
      const tomStart = tomFrequencies[event.pitch] * voice.tomTune;
      oscillator.type = voice.kickWave === "triangle" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(tomStart, when);
      oscillator.frequency.exponentialRampToValueAtTime(tomStart * 0.72, when + 0.16);
      gain.gain.setValueAtTime((event.velocity / 127) * 0.24 * mixGain, when);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.24);
      oscillator.connect(gain);
      this.connectPreviewOutput(gain, event, 0, 0.14, nodes);
      oscillator.start(when);
      oscillator.stop(when + 0.25);
      this.registerScheduledVoice([oscillator], nodes, event, when);
      return;
    }

    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    const sources = [source];
    const nodes = new Set([source, filter, gain]);
    source.buffer = this.noiseBufferForKit(kit);
    const isHat = [42, 44, 46].includes(event.pitch);
    const isOpenHat = event.pitch === 46;
    const isCymbal = [49, 51, 52, 55, 57, 59].includes(event.pitch);
    filter.type = isHat || isCymbal ? "highpass" : "bandpass";
    filter.frequency.value = isCymbal
      ? voice.cymbalFilter
      : isHat
        ? voice.hatFilter
        : event.pitch === 37
          ? voice.snareFilter * 1.35
          : voice.snareFilter;
    filter.Q.value = isHat || isCymbal ? 0.8 : 1.3;
    const duration = isCymbal
      ? voice.cymbalDecay
      : isOpenHat
        ? voice.openHatDecay
        : isHat
          ? voice.hatDecay
          : event.pitch === 37
            ? Math.min(0.09, voice.snareDecay * 0.48)
            : voice.snareDecay;
    const peak = isCymbal ? 0.16 : isHat ? 0.12 : event.pitch === 37 ? 0.14 : 0.22;
    const drumPeak = (event.velocity / 127) * peak * mixGain;
    gain.gain.setValueAtTime(Math.max(0.0001, drumPeak), when);
    if (event.pitch === 39) {
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.012);
      gain.gain.setValueAtTime(Math.max(0.0001, drumPeak * 0.72), when + 0.019);
      gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.031);
      gain.gain.setValueAtTime(Math.max(0.0001, drumPeak * 0.48), when + 0.039);
    }
    gain.gain.exponentialRampToValueAtTime(0.0001, when + duration);
    source.connect(filter).connect(gain);
    this.connectPreviewOutput(gain, event, 0, isCymbal ? 0.5 : isHat ? 0.18 : 0.38, nodes);
    source.start(when);
    source.stop(when + duration + 0.01);
    if (!isHat && !isCymbal) {
      const tone = context.createOscillator();
      const toneGain = context.createGain();
      sources.push(tone);
      nodes.add(tone);
      nodes.add(toneGain);
      tone.type = "triangle";
      tone.frequency.setValueAtTime(voice.snareTone, when);
      tone.frequency.exponentialRampToValueAtTime(Math.max(90, voice.snareTone * 0.57), when + Math.min(0.1, voice.snareDecay * 0.7));
      toneGain.gain.setValueAtTime((event.velocity / 127) * 0.11 * mixGain, when);
      toneGain.gain.exponentialRampToValueAtTime(0.0001, when + 0.13);
      tone.connect(toneGain);
      this.connectPreviewOutput(toneGain, event, 0, 0.2, nodes);
      tone.start(when);
      tone.stop(when + 0.14);
    }
    this.registerScheduledVoice(sources, nodes, event, when);
  }

  updateFrame() {
    if (!this.playing || !this.context) return;
    const duration = totalSeconds();
    this.position = this.offset + (this.context.currentTime - this.startedAt);
    if (state.queuedSection && this.position >= (state.queuedSection.triggerBeat * 60 / songBpm())) {
      const targetSec = state.queuedSection;
      state.queuedSection = null;
      this.seek(targetSec.targetStartBeat * 60 / songBpm());
      showToast(`Jumped to ${targetSec.targetSectionName}`);
      return;
    }
    if (this.position >= duration) {
      if (state.loop) {
        this.position = 0;
        this.clearTimers();
        this.playing = false;
        this.play();
        return;
      }
      this.stop();
      return;
    }
    const refreshDetails = shouldRefreshPlaybackDetails(
      this.lastDetailRefreshAt,
      this.context.currentTime,
      PREVIEW_AUDIO_LIMITS.detailRefreshMs,
    );
    if (refreshDetails) this.lastDetailRefreshAt = this.context.currentTime;
    updatePlaybackUi(this.position, duration, {
      view: this.playbackView ?? playbackViewForSong(),
      refreshDetails,
    });
    // Smooth compositor-friendly playheads refresh at ~30 FPS. Expensive section,
    // chord-guide and text work is separately limited to four updates per second.
    this.frame = setTimeout(() => this.updateFrame(), PREVIEW_AUDIO_LIMITS.visualIntervalMs);
  }

  clearTimers() {
    clearInterval(this.timer);
    clearTimeout(this.frame);
    this.timer = null;
    this.frame = null;
  }

  clearScheduledAudio() {
    for (const voice of [...this.scheduledVoices]) this.cleanupScheduledVoice(voice, true);
  }

  cancelPendingPlay() {
    this.playRequestGeneration += 1;
  }

  pause() {
    this.cancelPendingPlay();
    if (this.playing && this.context) this.position = this.offset + (this.context.currentTime - this.startedAt);
    if (!this.context) return;
    if (this.master?.gain) {
      try {
        const now = this.context.currentTime;
        this.master.gain.cancelScheduledValues(now);
        this.master.gain.setValueAtTime(Math.max(0.0001, this.master.gain.value), now);
        this.master.gain.exponentialRampToValueAtTime(0.0001, now + 0.012);
      } catch { /* ignore */ }
    }
    this.playing = false;
    setPlaybackPresentation(false);
    this.clearTimers();
    this.clearScheduledAudio();
    this.suspendWhenIdle();
    $("#playButton").classList.remove("playing");
    $("#playButton").setAttribute("aria-label", "Play song");
    const mobileDockPlay = $("#mobilePlayPause");
    if (mobileDockPlay) {
      mobileDockPlay.classList.remove("playing");
      const mobileIcon = $("#mobilePlayIcon");
      if (mobileIcon) mobileIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3" />';
      const mobileText = $("#mobilePlayText");
      if (mobileText) mobileText.textContent = "Play";
    }
    updateCreativeThreadPlayback(this.position, totalSeconds());
  }

  stop() {
    this.pause();
    this.position = 0;
    updatePlaybackUi(0, totalSeconds());
    $("#playhead").classList.remove("visible");
  }

  seek(position) {
    const wasPlaying = this.playing;
    this.pause();
    this.position = clamp(position, 0, totalSeconds());
    updatePlaybackUi(this.position, totalSeconds());
    if (wasPlaying) this.play();
  }

  restart() {
    const shouldPlay = this.playing;
    this.stop();
    if (shouldPlay) this.play();
  }
}

const player = new PreviewPlayer();

function setPlaybackPresentation(playing) {
  const hero = $("#heroPanel");
  const showcaseButton = $("#showcasePlayButton");
  document.body?.classList.toggle("is-playing", playing);
  hero?.classList.toggle("is-playing", playing);
  showcaseButton?.classList.toggle("is-playing", playing);
  if (showcaseButton) {
    showcaseButton.setAttribute("aria-label", playing ? "Pause current song" : "Play current song");
    const label = $("strong", showcaseButton);
    if (label) label.textContent = playing ? "Pause song" : "Play song";
  }
  const mixButton = $("#mixPlayButton");
  mixButton?.classList.toggle("is-playing", playing);
  if (mixButton) {
    mixButton.setAttribute("aria-label", playing ? "Pause the mix" : "Listen to the mix");
    const label = $("b", mixButton);
    if (label) label.textContent = playing ? "Pause" : "Listen";
  }
}

function updatePlaybackUi(position, duration, { view = playbackViewForSong(), refreshDetails = true } = {}) {
  const ratio = clamp(position / Math.max(0.01, duration), 0, 1);
  $("#currentTime").textContent = formatTime(position);
  $("#songScrubber").value = Math.round(ratio * 1000);
  $("#songScrubber").style.setProperty("--range-fill", `${ratio * 100}%`);
  const playhead = $("#playhead");
  if (playhead) {
    playhead.classList.toggle("visible", Boolean(player.playing || ratio > 0));
    playhead.style.setProperty("--progress", ratio);
  }
  const hero = $("#heroPanel");
  hero?.style.setProperty("--showcase-progress", `${(ratio * 100).toFixed(3)}%`);
  if (refreshDetails) {
    const activeSection = view.sectionAtSeconds(position);
    $$("[data-showcase-section]", $("#showcaseArc")).forEach((segment) => {
      segment.classList.toggle("is-playing-section", Boolean(player.playing && activeSection?.id === segment.dataset.showcaseSection));
    });
    const arcStatus = $("#showcaseArcStatus");
    if (arcStatus) {
      arcStatus.textContent = player.playing && activeSection
        ? `PLAYING ${activeSection.name.toUpperCase()}`
        : ratio > 0 ? `${Math.round(ratio * 100)}% THROUGH SONG` : "READY TO PLAY";
    }
  }
  const editorPlayhead = $(".piano-roll-editor-playhead");
  const section = view.sections.find((candidate) => candidate.id === state.focusedSection) ?? null;
  if (editorPlayhead && section) {
    const range = editorBeatRange(section);
    const beat = position * view.bpm / 60;
    const visible = beat >= range.start && beat <= range.end;
    editorPlayhead.classList.toggle("visible", visible);
    editorPlayhead.style.setProperty("--editor-playhead-x", `${clamp(beat - range.start, 0, range.end - range.start) * state.editorZoom}px`);
  }
  updateCreativeThreadPlayback(position, duration, { view, refreshDetails });
}

function commitTempoToSong(tempo) {
  if (!state.song) return;
  if ("bpm" in state.song) state.song.bpm = tempo;
  if ("tempo" in state.song) state.song.tempo = tempo;
  if (state.song.meta) state.song.meta.tempo = tempo;
  if (state.song.global) state.song.global.tempo = tempo;
  if (appliedGenerationSettings) appliedGenerationSettings.tempoControl = String(tempo);
  renderGenerationIntent();
}

function bindGlobalControls() {
  const menuBtn = $("#menuButton");
  const menuDropdown = $("#menuDropdown");
  if (menuBtn && menuDropdown) {
    menuBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      const open = menuDropdown.getAttribute("aria-hidden") === "false";
      menuDropdown.setAttribute("aria-hidden", String(open));
      menuBtn.setAttribute("aria-expanded", String(!open));
    });
    document.addEventListener("click", () => {
      menuDropdown.setAttribute("aria-hidden", "true");
      menuBtn.setAttribute("aria-expanded", "false");
    });
    $("#menuItemNew")?.addEventListener("click", () => runGeneration("new"));
    $("#menuItemSimilar")?.addEventListener("click", () => runGeneration("similar"));
    $("#menuItemReset")?.addEventListener("click", () => $("#resetControlsButton")?.click());
    $("#menuItemFullscreen")?.addEventListener("click", toggleFullscreen);
    $("#menuItemExport")?.addEventListener("click", exportSong);
    $("#menuItemGuide")?.addEventListener("click", () => $("#helpButton")?.click());
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-auto-key]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    toggleAutoControl(button.dataset.autoKey);
  });

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    if (document.documentElement.requestFullscreen) {
      document.documentElement.requestFullscreen().catch(() => {});
    }
    showToast("Immersive Fullscreen active.");
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    showToast("Standard view active.");
  }
}

  const liveRangeIds = ["tempoControl", "energyControl", "complexityControl", "swingControl", "humanizeControl", "tripletControl", "rollControl", "variationControl", "evolutionControl", "surpriseControl"];
  for (const id of liveRangeIds) {
    $(`#${id}`)?.addEventListener("input", () => {
      updateRangeDisplays();
      renderGenerationIntent();
    });
  }

  const macroLabels = {
    energyControl: "Energy", complexityControl: "Complexity", swingControl: "Swing",
    humanizeControl: "Humanize", tripletControl: "Triplets", rollControl: "Snare Rolls",
    variationControl: "Variation", evolutionControl: "Evolution", surpriseControl: "Surprise",
  };
  for (const [id, label] of Object.entries(macroLabels)) {
    $(`#${id}`)?.addEventListener("change", () => {
      showToast(`${label} set to ${$(`#${id}`).value}%. Tap New song idea to generate with this direction.`);
    });
  }

  $("#tempoControl").addEventListener("change", () => {
    if (state.song && selectedGenreId() === songGenreId()) {
      commitTempoToSong(readNumber("#tempoControl", 112));
      renderSummary();
      if (player.playing) player.restart();
    } else if (state.song) {
      showToast("That tempo is staged for the next genre-aware generation; the current idea stays unchanged.");
    }
  });

  $("#genreControl").addEventListener("change", () => {
    const id = selectedGenreId();
    const profile = genreProfile(id);
    const range = tempoRangeFrom(profile.bpm, profile);
    applyGenreDefaultsToControls(id);
    updateRangeDisplays();
    renderGenerationIntent();
    showToast(`${genreLabel(id, profile)} rules are ready at ${Math.round(range.default)} BPM. Generate to hear the new world.`);
  });

  $("#modeControl")?.addEventListener("change", () => {
    $("#modeControl").value === "auto" ? state.autoControls.add("modeControl") : state.autoControls.delete("modeControl");
    renderModeGuidance();
    renderGenerationIntent();
  });
  $("#chordPathControl")?.addEventListener("change", () => {
    const sel = $("#chordPathControl");
    $("#chordPathControl").value === "auto" ? state.autoControls.add("chordPathControl") : state.autoControls.delete("chordPathControl");
    showToast(`Harmonic path: ${sel.options[sel.selectedIndex]?.text || sel.value}. Tap New song idea to generate.`);
    renderGenerationIntent();
  });
  $("#grooveControl")?.addEventListener("change", () => {
    $("#grooveControl").value === "auto" ? state.autoControls.add("grooveControl") : state.autoControls.delete("grooveControl");
    const sel = $("#grooveControl");
    showToast(`Groove feel: ${sel.options[sel.selectedIndex]?.text || sel.value}. Tap New song idea to generate.`);
    renderGenerationIntent();
  });
  $("#barsControl")?.addEventListener("change", () => {
    $("#barsControl").value === "auto" ? state.autoControls.add("barsControl") : state.autoControls.delete("barsControl");
    showToast(`Song length staged for ${$("#barsControl").value} bars.`);
    renderGenerationIntent();
  });
  $("#keyControl")?.addEventListener("change", () => {
    $("#keyControl").value === "auto" ? state.autoControls.add("keyControl") : state.autoControls.delete("keyControl");
    showToast(`Key root staged for ${$("#keyControl").value}. Tap New song idea to generate.`);
    renderGenerationIntent();
  });
  $$("[data-bus]").forEach((button) => {
    button.addEventListener("click", () => {
      const bus = button.dataset.bus;
      const targets = {
        rhythm: ["drums", "bass"],
        harmony: ["chords", "pad"],
        lead: ["melody", "counterpoint"],
      }[bus] || [];

      const currentMuted = targets.every((id) => state.muted.has(id));
      for (const id of targets) {
        if (currentMuted) state.muted.delete(id);
        else state.muted.add(id);
      }
      renderTrackRack();
      renderTimeline();
      showToast(currentMuted ? `${bus.toUpperCase()} bus unmuted.` : `${bus.toUpperCase()} bus muted.`);
    });
  });
  $("#keyTransposeDown")?.addEventListener("click", () => transposeKey(-1));
  $("#keyTransposeUp")?.addEventListener("click", () => transposeKey(1));

  $("#generateNew").addEventListener("click", () => runGeneration("new"));
  $("#generateSimilar").addEventListener("click", () => runGeneration("similar"));
  $("#mobileNewIdea")?.addEventListener("click", () => {
    switchWorkspace("create");
    scrollToControl("#preGenSection");
  });
  $("#mobilePlayPause")?.addEventListener("click", () => player.toggle());
  $("#mobileExport")?.addEventListener("click", exportSong);
  $("#undoButton").addEventListener("click", restoreHistory);
  $("#redoButton").addEventListener("click", redoHistory);
  $("#renameButton").addEventListener("click", renameSong);
  $("#randomizeMixButton").addEventListener("click", randomizeTrackControls);
  $("#reorderButton").addEventListener("click", reshapeArrangement);
  $("#sectionShaper")?.addEventListener("change", (event) => {
    const barsControl = event.target.closest?.("[data-section-bars]");
    if (barsControl) {
      const section = editorSection();
      if (!section) return;
      const targetBars = Number(barsControl.value);
      state.song = updateSectionBars(state.song, section.id, targetBars);
      pushHistory(`Resized section ${section.name} to ${targetBars} bars`);
      renderArrangement();
      return;
    }
    const control = event.target.closest?.("[data-section-macro]");
    if (control) applySectionMacro(control.dataset.sectionMacro, control.value);
  });
  $("#sectionShaper")?.addEventListener("click", (event) => {
    if (event.target.closest("#sectionShaperPlay")) {
      const section = editorSection();
      if (!section) return;
      const range = editorBeatRange(section);
      player.seek(range.start * 60 / songBpm());
      if (!player.playing) void player.play();
      return;
    }
    const action = event.target.closest?.("[data-section-action]")?.dataset.sectionAction;
    if (!action) return;
    if (action === "queue-jump") {
      const section = editorSection();
      if (!section || !state.song) return;
      const beatsPerBar = Number(state.song.meta?.beatsPerBar ?? state.song.beatsPerBar ?? 4);
      const currentBeat = (player.position / totalSeconds()) * totalBeats();
      const jumpInfo = calculateNextQueuedSection(currentBeat, section.id, state.song);
      if (jumpInfo) {
        state.queuedSection = jumpInfo;
        const targetBarNum = Math.floor(jumpInfo.triggerBeat / beatsPerBar) + 1;
        showToast(`Queued jump to ${section.name} on bar ${targetBarNum}`);
      }
      return;
    }
    if (action === "simplify") simplifyFocusedSection();
    if (action === "build") buildFocusedSection();
    if (action === "earlier") moveFocusedSection(-1);
    if (action === "later") moveFocusedSection(1);
    if (action === "edit") {
      state.sectionEditorOpen = true;
      renderSectionEditor("Choose an instrument, then select notes to shape.");
      setTimeout(() => $("#sectionEditor")?.scrollIntoView?.({ behavior: "smooth", block: "start" }), 60);
    }
    if (action === "variations") {
      state.sectionEditorOpen = true;
      renderSectionEditor();
      void exploreSectionVariations();
    }
    if (action === "duplicate") duplicateFocusedSection();
  });
  $("#newRecipeButton").addEventListener("click", chooseRecipe);
  $$("[data-attitude]", $("#attitudeStrip")).forEach((button) => {
    button.addEventListener("click", () => applyTrackAttitude(button.dataset.attitude));
  });
  $("#artistModeButton")?.addEventListener("click", (event) => {
    const active = document.body.classList.toggle("artist-mode");
    event.currentTarget.classList.toggle("is-active", active);
    event.currentTarget.setAttribute("aria-pressed", String(active));
    event.currentTarget.querySelector("span").textContent = active ? "Essentials" : "Advanced";
    for (const details of $$(".shape-controls, .creator-recipe-side, .advanced-controls")) {
      details.open = active;
    }
    showToast(active ? "Advanced song-shaping controls are open." : "Back to the focused essentials.");
  });
  $("#resetControlsButton").addEventListener("click", () => {
    state.autoControls.clear();
    $("#genreControl").value = "neoSoul";
    applyGenreDefaultsToControls("neoSoul");
    $("#chordPathControl").value = "auto";
    $("#energyControl").value = 68;
    $("#complexityControl").value = 54;
    $("#variationControl").value = 42;
    $("#evolutionControl").value = 58;
    $("#surpriseControl").value = 28;
    updateRangeDisplays();
    decorateAutoRangeControls();
    renderGenerationIntent();
    showToast("Creative compass reset. The current idea stays untouched until you generate.");
  });

  $("#playButton").addEventListener("click", () => player.toggle());
  $("#showcasePlayButton")?.addEventListener("click", () => player.toggle());
  $("#showcaseSimilarButton")?.addEventListener("click", () => runGeneration("similar"));
  $("#tasteRating")?.addEventListener("change", (event) => rateCurrentSong(event.target.value));
  $("#mixPlayButton")?.addEventListener("click", () => player.toggle());
  $("#previousButton").addEventListener("click", () => player.restart());
  $("#loopButton").addEventListener("click", (event) => {
    state.loop = !state.loop;
    event.currentTarget.setAttribute("aria-pressed", String(state.loop));
    showToast(state.loop ? "Looping is on." : "Looping is off.");
  });
  $("#songScrubber").addEventListener("input", (event) => player.seek(Number(event.target.value) / 1000 * totalSeconds()));
  $("#exportButton").addEventListener("click", exportSong);
  $("#saveCoverButton")?.addEventListener("click", saveCoverArtwork);
  $("#varyCoverButton")?.addEventListener("click", () => {
    state.coverVariation = (Number(state.coverVariation) || 0) + 1;
    renderFinishWorkspace();
    showToast(`${coverArtworkFinish(state.coverVariation).label} finish applied. The original composition stays intact.`);
  });

  $("#editorCloseButton").addEventListener("click", () => {
    state.sectionEditorOpen = false;
    state.editorSelection.clear();
    renderTimeline();
    renderSectionEditor();
    renderCreativeThread();
    showToast("Note detail closed. The selected section and your edits remain in Shape.");
  });
  $("#editorPlayButton").addEventListener("click", async () => {
    const section = editorSection();
    if (!section) return;
    const range = editorBeatRange(section);
    player.seek(range.start * 60 / songBpm());
    if (!player.playing) await player.play();
    showToast(`Playing from the start of ${section.name}.`);
  });
  $("#editorGridControl").addEventListener("change", (event) => {
    state.editorGrid = clamp(Number(event.target.value) || 0.25, 1 / 12, 1);
    renderSectionEditor(`Snap grid set to ${event.target.options?.[event.target.selectedIndex]?.text || "the selected division"}.`);
  });
  $("#editorZoomControl").addEventListener("input", (event) => {
    state.editorZoom = clamp(Number(event.target.value) || 64, 44, 100);
    renderSectionEditor();
  });
  $("#editorOverlayControl")?.addEventListener("change", (event) => {
    state.editorOverlay = ["partner", "harmony", "none"].includes(event.target.value)
      ? event.target.value
      : "partner";
    renderSectionEditor(`${event.target.options?.[event.target.selectedIndex]?.text || "Relationship"} overlay selected.`);
  });
  $("#editorVelocityControl").addEventListener("input", (event) => {
    $("#editorVelocityValue").textContent = event.target.value;
  });
  $("#editorVelocityControl").addEventListener("change", (event) => setEditorVelocity(event.target.value));
  $("#sectionVariationLab")?.addEventListener("click", (event) => {
    if (event.target.closest("[data-section-variation-explore]")) {
      void exploreSectionVariations();
      return;
    }
    if (event.target.closest("[data-section-variation-keep]")) {
      keepSectionVariation();
      return;
    }
    if (event.target.closest("[data-section-variation-cancel]")) {
      cancelSectionVariations();
      return;
    }
    const option = event.target.closest("[data-section-variation]");
    if (option) void auditionSectionVariation(Number(option.dataset.sectionVariation));
  });
  $$('[data-editor-action]', $("#sectionEditor")).forEach((button) => button.addEventListener("click", () => applyEditorAction(button.dataset.editorAction)));
  $("#pianoRollGrid").addEventListener("dblclick", addEditorNote);
  $("#pianoRollGrid").addEventListener("pointerup", (event) => {
    if (event.pointerType === "mouse" || event.target !== event.currentTarget) return;
    addEditorNote(event);
  });
  $("#pianoRollViewport").addEventListener("scroll", (event) => {
    $("#pianoKeyboard").scrollTop = event.currentTarget.scrollTop;
  });
  $("#pianoRollViewport").addEventListener("keydown", (event) => {
    const action = {
      ArrowLeft: "nudge-left", ArrowRight: "nudge-right", ArrowUp: "pitch-up", ArrowDown: "pitch-down",
      Delete: "delete", Backspace: "delete",
    }[event.key];
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "a") {
      event.preventDefault();
      applyEditorAction("select-all");
    } else if (action) {
      event.preventDefault();
      applyEditorAction(action);
    } else if (event.key.toLowerCase() === "q") {
      event.preventDefault();
      applyEditorAction("quantize");
    }
  });

  $("#threadSongButton").addEventListener("click", () => scrollToControl("#songTitle"));
  $("#threadSectionButton").addEventListener("click", () => {
    const section = editorSection();
    scrollToControl(section ? "#sectionEditor" : "#arrangementTitle");
    showToast(section ? `${section.name} is open in the piano roll.` : "Choose any section or colored instrument clip in the song map.");
  });
  $("#threadTrackButton").addEventListener("click", () => {
    switchWorkspace("mix");
    scrollToControl(`.track-card[data-track="${state.selectedTrack}"]`);
    showControlHelp($(`.track-card[data-track="${state.selectedTrack}"] [data-action="target"]`));
  });
  $("#threadActionButton").addEventListener("click", () => scrollToControl(editorSection() ? "#sectionEditor" : "#arrangementTitle"));

  $("#guidedModeButton").addEventListener("click", () => {
    state.guidedMode = !state.guidedMode;
    renderWorkflow();
    showToast(state.guidedMode ? "Guided workflow is visible." : "Guided workflow is hidden. The Complete Guide is always available above.");
  });
  $("#workflowAction").addEventListener("click", runWorkflowAction);
  $$('[data-workflow-step]').forEach((button) => button.addEventListener("click", () => {
    const step = Number(button.dataset.workflowStep);
    setWorkflowStep(step, { force: true });
    switchWorkspace(step === 3 ? "mix" : step === 4 ? "finish" : "create");
    const selector = { 1: "#directionTitle", 2: "#playButton", 3: "#attitudeStrip", 4: "#exportButton" }[step];
    scrollToControl(selector);
  }));
  bindControlHelp();

  const dialog = $("#shortcutDialog");
  $("#helpButton").addEventListener("click", () => dialog.showModal());
  $("#closeDialog").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  document.addEventListener("keydown", (event) => {
    const target = event.target;
    const historyShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z";
    const redoShortcut = (event.ctrlKey || event.metaKey)
      && (event.key.toLowerCase() === "y" || (event.shiftKey && event.key.toLowerCase() === "z"));
    if (historyShortcut || redoShortcut) {
      event.preventDefault();
      if (redoShortcut) redoHistory();
      else restoreHistory();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement || dialog.open) return;
    const key = event.key.toLowerCase();
    if (event.code === "Space") { event.preventDefault(); player.toggle(); }
    if (key === "n") runGeneration("new");
    if (key === "s") runGeneration("similar");
    if (key === "e") exportSong();
    if (key === "f") toggleFullscreen();
  });
  document.addEventListener("change", scheduleSessionSave);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) return;
    player.pause();
    player.suspendWhenIdle(0);
    saveSessionNow();
  });
  window.addEventListener?.("pagehide", () => {
    saveSessionNow();
    generationExecutor.dispose();
  });
}

function resetSessionStateForFreshStart() {
  clearTimeout(sessionSaveTimer);
  sessionSaveTimer = null;
  state.song = null;
  state.history = [];
  state.future = [];
  state.trackSettings = deepClone(DEFAULT_TRACK_SETTINGS);
  state.muted = new Set();
  state.solo = new Set();
  state.locked = new Set();
  state.autoControls = new Set();
  state.focusedSection = null;
  state.recipeIndex = 0;
  state.generationCount = 0;
  state.loop = false;
  state.isGenerating = false;
  state.selectedTrack = "drums";
  state.activeWorkspace = "create";
  state.workflowStep = 1;
  state.guidedMode = true;
  state.editorTrack = "melody";
  state.sectionEditorOpen = false;
  state.editorOverlay = "partner";
  state.editorGrid = 0.25;
  state.editorZoom = 64;
  state.editorSelection = new Set();
  state.sectionVariations = null;
  state.sectionMacroValues = {};
  midiConnectionRequestGeneration += 1;
  latestMidiRequestedDeviceId = "onscreen";
  player.cancelPendingPlay();
  workspaceController.activate("create");
}

function hydrateInitialSong() {
  applyTrackSettingsToSong(state.song);
  syncControlsFromSong();
  captureAppliedGenerationSettings();
  renderAll();
  updatePlaybackUi(0, totalSeconds());
}

async function init() {
  initTabNav();
  decorateAutoRangeControls();
  bindGlobalControls();
  applyGenreDefaultsToControls(selectedGenreId());
  updateRangeDisplays();
  try {
    let restored = restorePersistedSession();
    let recovered = rejectedPersistedSession;
    syncAutoSelects();
    if (!restored) state.song = await Promise.resolve(generateNew(buildConfig(0x9f32d6a1)));
    try {
      hydrateInitialSong();
    } catch (error) {
      if (!restored) throw error;
      console.warn("Saved session could not be hydrated and was replaced", error);
      discardPersistedSession();
      resetSessionStateForFreshStart();
      applyGenreDefaultsToControls(selectedGenreId());
      updateRangeDisplays();
      state.song = await Promise.resolve(generateNew(buildConfig(0x9f32d6a1)));
      hydrateInitialSong();
      restored = false;
      recovered = true;
    }
    if (recovered) showToast("A damaged saved session was replaced with a fresh idea.");
    else if (restored) showToast("Your last song and live take were restored.");
    discoverMidiDevices({ requestAccess: false });
    // Prune old MIDI exports at startup (fire-and-forget).
    pruneMidiExportsCache().catch(() => {});
  } catch (error) {
    console.error(error);
    showToast("The composition engine could not start. Refresh to try again.");
  }
}

init();
