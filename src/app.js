Warning: truncated output (original token count: 73786)
Total output lines: 6396

import {
  createMidiExportReport,
  defaultChordPathForGenre,
  encodeMidi,
  generateNew,
  generateSectionVariations,
  generateSimilar,
  generateSongVariations,
  GENRE_PROFILES,
  ONE_SHOT_KITS,
  TRACK_DEFINITIONS,
} from "./music-engine.js";
import { clamp } from "./utils.js";
import { deriveSongTitle } from "./core/song-title.js";
import { buildSectionMatrix, updateSectionBars, updateSectionEnergy, updateSectionInstrumentMask, calculateNextQueuedSection, getSongSections } from "./core/arranger-matrix.js";
import { createMidiInputManager } from "./midi-input.js";
import { createAppStore, createInitialAppState } from "./core/app-store.js";
import { createDefaultAutoControls } from "./core/auto-control-policy.js";
import { chooseElementProgram } from "./core/elemental-program-policy.js";
import { createSessionStorage } from "./core/session-storage.js";
import { prepareMidiExport, resolveMidiExportProfile } from "./core/export-profile.js";
import { createGenerationRunner } from "./core/generation-runner.js";
import { createGenerationExecutor } from "./core/generation-executor.js";
import { createGenerationOwnership } from "./core/generation-ownership.js";
import { normalizeCreativeRange } from "./core/creative-range-policy.js";
import { createAppGenerationFallback } from "./core/app-generation-fallback.js";
import { getScaleChordGuide as deriveScaleChordGuide } from "./core/scale-guide.js";
import { applyPersistedSessionState, createPersistedSessionSnapshot, createSessionAutosaveController, decodePersistedSession } from "./core/session-runtime.js";
import { appendWithinLimit, compactRecentSongs } from "./core/generation-memory.js";
import { applyGenerationTheme } from "./core/generation-theme.js";
import { previewDrumCharacter, previewDrumEnvelope } from "./core/preview-drums.js";
import { renderPhrasePerformance } from "./core/phrase-memory.js";
import { canonicalMidiPitch, midiPitchToFrequency } from "./core/pitch-contract.js";
import { previewGraphBudget, previewRuntimeProfile, previewVoiceFeatures, previewVoicePriority, selectPreviewVoiceVictim } from "./core/preview-performance.js";
import {
  hasAudiblePreviewEvents,
  playbackSourceNeedsCanonicalReset,
  playableSongNoteCount,
  shouldRecoverSilentMixState,
} from "./core/playback-recovery.js";
import {
  chooseAutoProgramRotation,
  companionTrackIds,
  curateTrackProgramPalette,
  TRACK_SOUND_ROLE_GOALS,
} from "./core/instrument-program-policy.js";
import {
  characteristicTrackForPreview,
  clickSafeStopTime,
  rampAudioParamValue,
  normalizeMixAssistant,
  PREVIEW_TRANSITION,
  previewNoteEnvelope,
  previewMixHealth,
  previewSidechain,
  previewSpotlight,
} from "./core/preview-audio.js";
import { formatGate, formatLevel, formatMidiVelocity, formatVelocityScale } from "./ui/value-formatters.js";
import { createWorkspaceController } from "./ui/workspace-controller.js";
import {
  applyGenerationPreferences as applySessionGenerationPreferences,
  captureGenerationPreferences,
  deferEmptyCanvasFacts,
  syncAutoPresentation,
} from "./ui/session-preferences.js";
import { createRenderCoordinator } from "./ui/render-coordinator.js";
import { createPlaybackView, shouldRefreshPlaybackDetails } from "./ui/playback-view.js";
import { generationMinimumVisibleMs, generationStageState } from "./ui/generation-progress.js";
import {
  analyzeSectionRelationship,
  nearestScalePitch,
  transposeScaleStep,
} from "./ui/shape-logic.js";
import { SHAPE_QUICK_DIRECTIONS, createShapeIntent, rankShapeSuggestions } from "./core/shape-director-policy.js";
import { auditionShapeCandidate, createShapeCandidate } from "./core/shape-director-engine.js";
import { executeArrangementCommand } from "./ui/arrangement-logic.js";
import { coverArtworkDataUrl, coverArtworkFinish, createCoverArtworkSvg } from "./cover-art.js";
import {
  GENERATION_STATUS_COPY,
  generationIntentCopy,
  qualityTier,
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
  return deriveScaleChordGuide(song, startBeat);
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

let midiConnectionRequestGeneration = 0;
let latestMidiRequestedDeviceId = "onscreen";

const sessionRuntime = createSessionAutosaveController({
  storage: sessionStorage,
  snapshot: () => createPersistedSessionSnapshot(shapeDirectorPersistenceState(), {
    schema: SESSION_SCHEMA,
    normalizeMixAssistant,
    captureGenerationPreferences,
  }),
  onSaved() {
    const status = $("#autosaveStatus");
    if (status) status.innerHTML = "<i></i> SAVED ON DEVICE";
  },
  onUnavailable(result) {
    if (result?.error) console.warn("Session autosave was unavailable", result.error);
    const status = $("#autosaveStatus");
    if (status) status.textContent = "SESSION OPEN";
  },
  defer(task) {
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(task, { timeout: 1000 });
    } else {
      task();
    }
  },
});

export function saveSessionNow() {
  return sessionRuntime.saveNow();
}

function scheduleSessionSave() {
  return sessionRuntime.schedule();
}

function discardPersistedSession() {
  return sessionRuntime.discard();
}

export function restorePersistedSession() {
  rejectedPersistedSession = false;
  const restored = decodePersistedSession(sessionStorage.load(), {
    schema: SESSION_SCHEMA,
    trackOrder: TRACK_ORDER,
    defaultTrackSettings: DEFAULT_TRACK_SETTINGS,
    genreIds: GENRE_IDS,
    recipeCount: RECIPES.length,
    normalizeMixAssistant,
  });
  if (restored.status === "empty") return false;
  if (restored.status !== "ready") {
    if (restored.error) console.warn("Saved session was corrupt and has been ignored", restored.error);
    rejectedPersistedSession = true;
    discardPersistedSession();
    return false;
  }
  applyPersistedSessionState(state, restored.value, {
    applyGenerationPreferences: applySessionGenerationPreferences,
    syncAutoPresentation,
    deferEmptyCanvasFacts,
  });
  return true;
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

function trackProgramAutoKey(trackId) {
  return `track:${trackId}:program`;
}

function isTrackProgramAuto(trackId) {
  return state.autoControls.has(trackProgramAutoKey(trackId));
}

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
    gate: [id === "drums" ? 0.55 : 0.62, id === "pad" ? 1.08 : ["melody", "counterpoint"].includes(id) ? 1.04 : 1.12, 0.01],
    pan: [-0.42, 0.42, 0.01],
    reverb: [id === "drums" ? 0.04 : 0.12, id === "pad" ? 0.72 : 0.58, 0.01],
    cutoff: [3600, 12800, 100],
    resonance: [0.08, 0.52, 0.01],
  };
  const range = ranges[key];
  return range ? autoNumber(seed, `${id}:${key}`, ...range) : fallback;
}

function chordPathChoicesForGenre(genreId = selectedGenreId()) {
  const ordered = [defaultChordPathForGenre(genreId)];
  return [...new Set([...ordered, "soul", "pop", "jazz", "trap", "house"])];
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
  const trapIntroMode = $("#trapIntroModeControl")?.value || "short";
  const creativeRange = normalizeCreativeRange($("#creativeRangeControl")?.value);
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
      ...(!isTrackProgramAuto(id) ? { program: settings.program } : {}),
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
  const averageTrackDensity = TRACK_ORDER.reduce((sum, id) => sum + trackControls[id].density, 0) / TRACK_ORDER.length;
  const variationMacro = generationValue("variationControl", 42) / 100;
  const layeringMode = !state.mixAssistant.enabled
    ? "off"
    : averageTrackDensity >= 0.72 || variationMacro >= 0.68
      ? "high"
      : averageTrackDensity <= 0.44 && variationMacro <= 0.42
        ? "subtle"
        : "medium";

  return {
    seed,
    genre: genreId,
    professionalUpgrade: true,
    ...(creativeRange ? { creativeRange } : {}),
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
    trapIntroMode,
    surprise: generationValue("surpriseControl", 28) / 100,
    similarity: clamp(1 - generationValue("variationControl", 42) / 165, 0.58, 0.92),
    trackControls,
    tracks: trackControls,
    layeringMode,
    arrangementLayering: layeringMode,
    tasteProfile: deepClone(state.tasteProfile),
    thinkingDepth: "deep",
  };
}

const GENERATION_SETTING_IDS = [
  "genreControl", "keyControl", "modeControl", "tempoControl", "barsControl", "grooveControl", "creativeRangeControl", "chordPathControl",
  "energyControl", "complexityControl", "swingControl", "humanizeControl", "tripletControl", "rollControl",
  "variationControl", "evolutionControl", "trapIntroModeControl", "surpriseControl",
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
  return deriveSongTitle(song);
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
    …43786 tokens truncated…  return;
    }
    if (this.context && stopSources) {
      const now = this.context.currentTime;
      for (const node of voice.nodes) {
        if (node.gain?.cancelScheduledValues) {
          try {
            if (typeof node.gain.cancelAndHoldAtTime === "function") node.gain.cancelAndHoldAtTime(now);
            else {
              node.gain.cancelScheduledValues(now);
              node.gain.setValueAtTime(Math.max(0.0001, node.gain.value || 0.01), now);
            }
            node.gain.exponentialRampToValueAtTime(0.0001, now + PREVIEW_TRANSITION.stopSeconds);
          } catch { /* ignore */ }
        }
      }
      let remainingSources = voice.sources.size;
      if (!remainingSources) {
        finalize();
        return;
      }
      const stopAt = clickSafeStopTime(now, voice.startedAt);
      for (const source of voice.sources) {
        source.onended = () => {
          remainingSources -= 1;
          if (remainingSources <= 0) finalize();
        };
        try { source.stop(stopAt); } catch {
          remainingSources -= 1;
          if (remainingSources <= 0) finalize();
        }
      }
      return;
    }
    finalize();
  }

  enforceScheduledVoiceLimit() {
    while (this.scheduledVoices.size > this.previewRuntime.maxScheduledVoices) {
      const victim = selectPreviewVoiceVictim(this.scheduledVoices, {
        now: this.context?.currentTime ?? 0,
        maxVoices: this.previewRuntime.maxScheduledVoices,
      });
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
    if (!active) return;
    this.liveVoices.delete(safePitch);
    if (!this.context) {
      for (const oscillator of active.oscillators) {
        oscillator.onended = null;
        try { oscillator.stop(); } catch { /* voice already ended */ }
      }
      for (const node of active.nodes) {
        try { node.disconnect(); } catch { /* node already disconnected */ }
      }
      active.nodes.clear();
      return;
    }
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
    output.connect(this.trackBusFor(event.id));
    const reverbSend = clamp(Number(event.reverb) * 0.42 * reverbScale, 0, 0.48);
    if (this.reverbBus && reverbSend > this.previewBudget.sendFloor) {
      const send = this.context.createGain();
      send.gain.value = reverbSend;
      output.connect(send).connect(this.reverbBus);
      trackedNodes?.add(send);
    }
    const delayAmount = Number.isFinite(Number(event.delaySend))
      ? clamp(Number(event.delaySend), 0, 0.24)
      : ({ bass: 0.018, chords: 0.055, melody: 0.16, counterpoint: 0.2, pad: 0.09 }[event.id] || 0);
    const delaySendAmount = delayAmount * clamp(0.35 + Number(event.reverb || 0), 0.35, 1.15);
    if (this.delayBus && delaySendAmount > this.previewBudget.sendFloor) {
      const delaySend = this.context.createGain();
      delaySend.gain.value = delaySendAmount;
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
    const voiceFeatures = previewVoiceFeatures(event.id, this.previewRuntime);
    const cutoffScale = clamp(Number(event.cutoff ?? 8000) / 8000, 0.125, 1.75);
    const resonanceScale = 0.65 + clamp(Number(event.resonance ?? 0.2), 0, 1) * 1.75;
    const velocityScale = 0.76 + (clamp(Number(event.velocity ?? 90), 1, 127) / 127) * 0.44;
    const filterBase = clamp(voice.filter * cutoffScale * velocityScale, 120, 15000);
    const targetFrequency = midiPitchToFrequency(event.pitch);
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
    const { duration, release } = previewNoteEnvelope({
      trackId: event.id,
      duration: event.duration,
      release: voice.release,
      reverb: event.reverb,
      articulation,
    });
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
    if (voice.layer && voiceFeatures.layer) {
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
    if (voice.transientLevel > 0 && voiceFeatures.transient) {
      const transient = context.createOscillator();
      const transientGain = context.createGain();
      sources.push(transient);
      nodes.add(transient);
      nodes.add(transientGain);
      transient.type = "triangle";
      transient.frequency.setValueAtTime(targetFrequency * voice.transientRatio, when);
      transient.frequency.exponentialRampToValueAtTime(
        targetFrequency * Math.max(1, voice.transientRatio * 0.72),
        when + voice.transientDecay,
      );
      transientGain.gain.setValueAtTime(0.0001, when);
      transientGain.gain.exponentialRampToValueAtTime(
        voice.transientLevel * (0.72 + velocityScale * 0.28),
        when + PREVIEW_TRANSITION.startSeconds,
      );
      transientGain.gain.exponentialRampToValueAtTime(0.0001, when + voice.transientDecay);
      transient.connect(transientGain).connect(filter);
      transient.start(when);
      transient.stop(when + voice.transientDecay + 0.012);
    }
    if (voice.subLevel > 0 && targetFrequency >= 48 && voiceFeatures.sub) {
      const sub = context.createOscillator();
      const subGain = context.createGain();
      sources.push(sub);
      nodes.add(sub);
      nodes.add(subGain);
      sub.type = "sine";
      sub.frequency.setValueAtTime(targetFrequency * voice.subRatio, when);
      subGain.gain.setValueAtTime(0.0001, when);
      subGain.gain.exponentialRampToValueAtTime(voice.subLevel, when + PREVIEW_TRANSITION.startSeconds);
      sub.connect(subGain).connect(filter);
      sub.start(when);
      sub.stop(when + duration + release + 0.02);
    }
    if (this.previewBudget.filterMotion && voice.filterMotionDepth > 0 && duration >= 0.35) {
      const motion = context.createOscillator();
      const motionDepth = context.createGain();
      sources.push(motion);
      nodes.add(motion);
      nodes.add(motionDepth);
      motion.type = "sine";
      motion.frequency.value = voice.filterMotionRate;
      motionDepth.gain.value = voice.filterMotionDepth;
      motion.connect(motionDepth).connect(filter.detune);
      motion.start(when);
      motion.stop(when + duration + release + 0.02);
    }
    this.registerScheduledVoice(sources, nodes, event, when);
  }

  createDrumOutput(event, character, nodes, reverbScale) {
    const output = this.context.createGain();
    const spatialEvent = { ...event, pan: clamp(Number(event.pan ?? 0) + character.panOffset, -1, 1) };
    nodes.add(output);
    this.connectPreviewOutput(output, spatialEvent, 0, reverbScale, nodes);
    return output;
  }

  shapeDrumGain(parameter, character, peak, duration, when, preserveClapBursts = true) {
    const envelope = previewDrumEnvelope(character, peak, duration, preserveClapBursts);
    parameter.setValueAtTime(envelope[0].value, when);
    for (const point of envelope.slice(1)) {
      parameter.exponentialRampToValueAtTime(Math.max(0.0001, point.value), when + point.offset);
    }
  }

  scheduleDrum(event, when) {
    const context = this.context;
    const mixGain = clamp(Number(event.mixGain ?? 1), 0, 1);
    const kit = ONE_SHOT_KIT_BY_ID.get(event.oneShotKitId) ?? oneShotKitForSong();
    const voice = kit.preview;
    const character = previewDrumCharacter(voice, event.pitch, event.velocity, event.start ?? when);
    if ([35, 36].includes(event.pitch)) {
      this.applyKickSidechain(when);
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const sources = [oscillator];
      const nodes = new Set([oscillator, gain]);
      const output = this.createDrumOutput(event, character, nodes, 0.08);
      oscillator.type = voice.kickWave;
      oscillator.frequency.setValueAtTime(character.kickStart, when);
      oscillator.frequency.exponentialRampToValueAtTime(character.kickEnd, when + Math.min(0.14, character.kickDecay * 0.55));
      this.shapeDrumGain(gain.gain, character, character.amplitude * 0.5 * mixGain, character.kickDecay, when);
      oscillator.connect(gain).connect(output);
      oscillator.start(when);
      oscillator.stop(when + character.kickDecay + 0.015);

      if (this.previewBudget.preserveKickClick) {
        const click = context.createOscillator();
        const clickFilter = context.createBiquadFilter();
        const clickGain = context.createGain();
        sources.push(click);
        nodes.add(click);
        nodes.add(clickFilter);
        nodes.add(clickGain);
        click.type = "triangle";
        click.frequency.setValueAtTime(character.clickPitch, when);
        click.frequency.exponentialRampToValueAtTime(Math.max(520, character.clickPitch * 0.28), when + 0.018);
        clickFilter.type = "highpass";
        clickFilter.frequency.value = Math.max(700, character.clickPitch * 0.28);
        this.shapeDrumGain(clickGain.gain, character, character.clickLevel * mixGain, 0.026, when);
        click.connect(clickFilter).connect(clickGain).connect(output);
        click.start(when);
        click.stop(when + 0.03);
      }

      const body = context.createOscillator();
      const bodyGain = context.createGain();
      sources.push(body);
      nodes.add(body);
      nodes.add(bodyGain);
      body.type = "triangle";
      body.frequency.setValueAtTime(character.kickEnd * 1.45, when);
      body.frequency.exponentialRampToValueAtTime(character.kickEnd, when + 0.085);
      this.shapeDrumGain(bodyGain.gain, character, character.bodyLevel * mixGain, 0.095, when);
      body.connect(bodyGain).connect(output);
      body.start(when);
      body.stop(when + 0.1);
      this.registerScheduledVoice(sources, nodes, event, when);
      return;
    }

    if ([41, 43, 45, 47, 48, 50].includes(event.pitch)) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const nodes = new Set([oscillator, gain]);
      const output = this.createDrumOutput(event, character, nodes, 0.14);
      const tomFrequencies = { 41: 82, 43: 96, 45: 112, 47: 132, 48: 148, 50: 174 };
      const tomStart = tomFrequencies[event.pitch] * voice.tomTune;
      oscillator.type = voice.kickWave === "triangle" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(tomStart, when);
      oscillator.frequency.exponentialRampToValueAtTime(tomStart * 0.72, when + 0.16);
      this.shapeDrumGain(gain.gain, character, character.amplitude * 0.24 * mixGain, 0.24, when);
      oscillator.connect(gain).connect(output);
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
    const isCymbal = [49, 51, 52, 55, 57, 59].includes(event.pitch);
    const output = this.createDrumOutput(event, character, nodes, isCymbal ? 0.5 : isHat ? 0.18 : 0.38);
    filter.type = isHat || isCymbal ? "highpass" : "bandpass";
    filter.frequency.value = character.filterFrequency;
    filter.Q.value = isHat || isCymbal ? 0.8 : 1.3;
    const duration = character.duration;
    const drumPeak = character.peak * mixGain;
    this.shapeDrumGain(gain.gain, character, drumPeak, duration, when);
    source.connect(filter).connect(gain).connect(output);
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
      this.shapeDrumGain(toneGain.gain, character, character.toneLevel * mixGain, 0.13, when, false);
      tone.connect(toneGain).connect(output);
      tone.start(when);
      tone.stop(when + 0.14);

      if (this.previewBudget.preserveSnareSnap && (character.kind === "snare" || character.kind === "clap")) {
        const snap = context.createBufferSource();
        const snapFilter = context.createBiquadFilter();
        const snapGain = context.createGain();
        sources.push(snap);
        nodes.add(snap);
        nodes.add(snapFilter);
        nodes.add(snapGain);
        snap.buffer = this.noiseBufferForKit(kit);
        snapFilter.type = "bandpass";
        snapFilter.frequency.value = character.snapFrequency;
        snapFilter.Q.value = 0.72;
        this.shapeDrumGain(snapGain.gain, character, character.snapLevel * mixGain, character.snapDecay, when, false);
        snap.connect(snapFilter).connect(snapGain).connect(output);
        snap.start(when);
        snap.stop(when + character.snapDecay + 0.01);
      }
    }
    this.registerScheduledVoice(sources, nodes, event, when);
  }

  restartLoopPlayback() {
    if (!this.playing || !this.context) return;
    this.clearTimers();
    this.clearScheduledAudio();
    this.resetDynamicBuses();
    this.position = 0;
    this.offset = 0;
    this.startedAt = this.context.currentTime;
    this.eventIndex = 0;
    this.lastScheduleAt = this.context.currentTime;
    this.schedule();
    this.timer = setInterval(() => this.schedule(), this.previewRuntime.scheduleIntervalMs);
    this.updateFrame();
  }

  updateFrame() {
    if (!this.playing || !this.context) return;
    const playbackSong = this.playbackSong ?? state.song;
    const duration = totalSeconds(playbackSong);
    this.position = this.offset + (this.context.currentTime - this.startedAt);
    if (state.queuedSection && this.position >= (state.queuedSection.triggerBeat * 60 / songBpm(playbackSong))) {
      const targetSec = state.queuedSection;
      state.queuedSection = null;
      syncMobileSectionJump(targetSec.targetSectionId);
      this.seek(targetSec.targetStartBeat * 60 / songBpm(playbackSong));
      showToast(`Jumped to ${targetSec.targetSectionName}`);
      return;
    }
    if (this.position >= duration) {
      if (state.loop) {
        this.restartLoopPlayback();
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

  resetDynamicBuses() {
    if (!this.context) return;
    const now = this.context.currentTime;
    for (const bus of this.trackBuses.values()) {
      const gain = bus?.gain;
      if (!gain) continue;
      try {
        if (typeof gain.cancelAndHoldAtTime === "function") gain.cancelAndHoldAtTime(now);
        else gain.cancelScheduledValues(now);
        gain.setTargetAtTime(1, now, 0.015);
      } catch {
        gain.value = 1;
      }
    }
  }

  releasePlaybackCache() {
    this.events = [];
    this.eventIndex = 0;
    this.playbackView = null;
    this.playbackSong = null;
    this.lastDetailRefreshAt = -Infinity;
  }

  cancelPendingPlay() {
    this.playRequestGeneration += 1;
  }

  pause() {
    this.cancelPendingPlay();
    if (this.playing && this.context) this.position = this.offset + (this.context.currentTime - this.startedAt);
    this.playing = false;
    setPlaybackPresentation(false);
    this.clearTimers();
    if (this.context && this.master?.gain) {
      const now = this.context.currentTime;
      rampAudioParamValue(this.master.gain, 0.0001, now, this.previewBudget.masterFadeSeconds);
    }
    this.clearScheduledAudio();
    this.resetDynamicBuses();
    if (this.context) this.suspendWhenIdle();
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
    updateCreativeThreadPlayback(this.position, totalSeconds(this.playbackSong ?? state.song));
  }

  stop() {
    this.pause();
    this.position = 0;
    this.releasePlaybackCache();
    updatePlaybackUi(0, totalSeconds());
    $("#playhead").classList.remove("visible");
  }

  seek(position) {
    const playbackSong = this.playbackSong ?? state.song;
    const wasPlaying = this.playing;
    this.pause();
    this.position = clamp(position, 0, totalSeconds(playbackSong));
    updatePlaybackUi(this.position, totalSeconds(playbackSong), {
      view: this.playbackView ?? playbackViewForSong(playbackSong),
    });
    if (wasPlaying) this.play();
  }

  restart() {
    const shouldPlay = this.playing;
    const playbackSong = this.playbackSong;
    this.stop();
    if (shouldPlay) {
      this.playbackSong = playbackSong;
      this.play();
    }
  }

  dispose() {
    this.cancelPendingPlay();
    this.stop();
    this.stopAllLiveNotes();
    this.cancelIdleSuspend();
    if (this.visibilityHandler) document.removeEventListener("visibilitychange", this.visibilityHandler);
    if (this.deviceChangeHandler) navigator.mediaDevices?.removeEventListener?.("devicechange", this.deviceChangeHandler);
    this.visibilityHandler = null;
    this.deviceChangeHandler = null;
    const context = this.context;
    this.resetContextReferences(context);
    this.noiseBuffers.clear();
    this.periodicWaves.clear();
    if (context && context.state !== "closed") void context.close().catch(() => {});
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
  if (refreshDetails) syncMobileSectionJump(view.sectionAtSeconds(position)?.id ?? null);
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
    $("#menuItemSimilar")?.addEventListener("click", () => runGeneration("songVariations"));
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
  $("#trapIntroModeControl")?.addEventListener("change", () => {
    const mode = $("#trapIntroModeControl").value;
    showToast(`Trap intro set to ${mode === "extended" ? "extended build" : mode === "auto" ? "Auto" : "short"}. Generate to hear it.`);
  });

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
  $("#creativeRangeControl")?.addEventListener("change", () => {
    const control = $("#creativeRangeControl");
    const creativeRange = normalizeCreativeRange(control?.value);
    const label = control?.options?.[control.selectedIndex]?.text || "Default";
    showToast(creativeRange
      ? `Creative Range: ${label}. Tap New song idea to generate.`
      : "Creative Range returned to default. Existing generation behavior is preserved.");
    renderGenerationIntent();
    scheduleSessionSave();
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
  $("#generateSimilar").addEventListener("click", () => runGeneration("songVariations"));
  $("#songVariationTray")?.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-song-variation]");
    if (button) selectSongVariation(button.dataset.songVariation);
  });
  for (const [workspace, selector] of Object.entries(MOBILE_WORKSPACE_BUTTONS)) {
    $(selector)?.addEventListener("click", () => switchWorkspace(workspace));
  }
  for (const selector of ["#navDockToggle", "#mobileDockToggle"]) {
    $(selector)?.addEventListener("click", () => {
      setNavigationDockCollapsed(!document.body?.classList.contains("nav-dock-collapsed"), { announce: true });
    });
  }
  $("#mobilePlayPause")?.addEventListener("click", () => player.toggle());
  $("#mobileSectionJumpList")?.addEventListener("click", (event) => {
    const button = event.target.closest?.("[data-mobile-section]");
    if (button) queueMobileSectionJump(button.dataset.mobileSection);
  });
  $("#undoButton").addEventListener("click", restoreHistory);
  $("#redoButton").addEventListener("click", redoHistory);
  $("#renameButton").addEventListener("click", renameSong);
  $("#randomizeMixButton").addEventListener("click", randomizeTrackControls);
  $("#clearSoloButton")?.addEventListener("click", () => {
    if (!state.solo.size) return;
    state.solo.clear();
    renderTrackRack();
    renderTimeline();
    renderMixOverview();
    if (player.playing) player.restart();
    scheduleSessionSave();
    showToast("Solo cleared. Full-band playback is restored.");
  });
  $("#mixEnhanceToggle")?.addEventListener("click", () => {
    state.mixAssistant.enabled = !state.mixAssistant.enabled;
    renderSmartMixConsole();
    scheduleSessionSave();
    if (player.playing) player.seek(player.currentSongTime());
    showToast(state.mixAssistant.enabled ? "Enhanced performance mix active." : "Original preview active for comparison.");
  });
  $("#spotlightTrackControl")?.addEventListener("change", (event) => {
    state.mixAssistant.spotlightTrack = event.target.value;
    renderSmartMixConsole();
    scheduleSessionSave();
    if (player.playing) player.seek(player.currentSongTime());
  });
  $("#spotlightIntensityControl")?.addEventListener("input", (event) => {
    state.mixAssistant.spotlightIntensity = clamp(Math.round(Number(event.target.value) || 0), 0, 100);
    renderSmartMixConsole();
  });
  $("#spotlightIntensityControl")?.addEventListener("change", () => {
    scheduleSessionSave();
    if (player.playing) player.seek(player.currentSongTime());
  });
  $("#reorderButton").addEventListener("click", reshapeArrangement);
  $("#sectionShaper")?.addEventListener("change", (event) => {
    const shapeTarget = event.target.closest?.("#shapeDirectorTarget");
    if (shapeTarget) {
      clearShapeDirectorCandidate({ restore: true, rerender: false });
      const director = shapeDirectorState();
      director.target = shapeTarget.value;
      renderAll();
      return;
    }
    const shapeSize = event.target.closest?.("#shapeDirectorSize");
    if (shapeSize) {
      clearShapeDirectorCandidate({ restore: true, rerender: false });
      const director = shapeDirectorState();
      director.size = shapeSize.value;
      renderAll();
      return;
    }
    const preserve = event.target.closest?.("[data-shape-preserve]");
    if (preserve) {
      clearShapeDirectorCandidate({ restore: true, rerender: false });
      const director = shapeDirectorState();
      const locks = new Set(director.preserve);
      if (preserve.checked) locks.add(preserve.dataset.shapePreserve);
      else locks.delete(preserve.dataset.shapePreserve);
      director.preserve = [...locks];
      renderAll();
      return;
    }
    const barsControl = event.target.closest?.("[data-section-bars]");
    if (barsControl) {
      const section = editorSection();
      if (!section) return;
      const targetBars = Number(barsControl.value);
      state.song = updateSectionBars(state.song, section.id, targetBars);
      pushHistory(`Resized section ${section.name} to ${targetBars} bars`);
      renderTimeline();
      return;
    }
    const control = event.target.closest?.("[data-section-macro]");
    if (control) applySectionMacro(control.dataset.sectionMacro, control.value);
  });
  $("#sectionShaper")?.addEventListener("click", (event) => {
    if (event.target.closest?.("[data-shape-more]")) {
      const panel = $("#shapeDirectorPanel");
      if (panel) panel.dataset.shapeMore = panel.dataset.shapeMore === "true" ? "false" : "true";
      renderShapeDirector();
      return;
    }
    const direction = event.target.closest?.("[data-shape-direction]")?.dataset.shapeDirection;
    if (direction) {
      prepareShapeDirectorCandidate(direction);
      return;
    }
    const audition = event.target.closest?.("[data-shape-audition]")?.dataset.shapeAudition;
    if (audition) {
      void auditionShapeDirector(audition);
      return;
    }
    if (event.target.closest?.("[data-shape-accept]")) {
      acceptShapeDirectorCandidate();
      return;
    }
    if (event.target.closest?.("[data-shape-discard]")) {
      discardShapeDirectorCandidate();
      return;
    }
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
      if (section) queueMobileSectionJump(section.id);
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
    resolvePendingShapeDirectorCandidate({ rerender: true });
    state.autoControls.clear();
    for (const key of createDefaultAutoControls(TRACK_ORDER)) state.autoControls.add(key);
    $("#genreControl").value = "neoSoul";
    applyGenreDefaultsToControls("neoSoul");
    $("#chordPathControl").value = "auto";
    $("#creativeRangeControl").value = "";
    state.autoControls.add("chordPathControl");
    $("#energyControl").value = 68;
    $("#complexityControl").value = 54;
    $("#variationControl").value = 42;
    $("#evolutionControl").value = 58;
    $("#trapIntroModeControl").value = "short";
    $("#surpriseControl").value = 28;
    updateRangeDisplays();
    decorateAutoRangeControls();
    renderGenerationIntent();
    scheduleSessionSave();
    showToast("Creative compass reset. The current idea stays untouched until you generate.");
  });

  $("#playButton").addEventListener("click", () => player.toggle());
  $("#showcasePlayButton")?.addEventListener("click", () => player.toggle());
  $("#showcaseArc")?.addEventListener("click", async (event) => {
    const segment = event.target.closest?.("[data-showcase-section]");
    if (!segment || !state.song) return;
    const section = normalizeSections().find((candidate) => candidate.id === segment.dataset.showcaseSection);
    if (!section) return;
    const startSeconds = editorBeatRange(section).start * 60 / songBpm();
    state.queuedSection = null;
    syncMobileSectionJump(section.id);
    // A section tap is an immediate transport seek. Use auditionSong instead of
    // seek()+play() so Android gets one serialized stop/cache/rebuild/play cycle.
    await player.auditionSong(state.song, { startSeconds });
    showToast(`Playing from ${section.name}.`);
  });
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
  for (const selector of ["#exportProfileControl", "#exportTimingControl"]) {
    $(selector)?.addEventListener("change", renderExportSetup);
  }
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
    $("#editorVelocityValue").textContent = formatMidiVelocity(event.target.value);
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
    if (key === "a") switchWorkspace("arrange");
    if (key === "s") runGeneration("songVariations");
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
    generationOwnership.invalidate();
    clearGenerationSafetyTimer();
    hideGenerationActivity();
    state.isGenerating = false;
    saveSessionNow();
    player.dispose();
    generationExecutor.dispose();
  });
}

function resetSessionStateForFreshStart() {
  generationOwnership.invalidate();
  clearGenerationSafetyTimer();
  generationExecutor.dispose();
  hideGenerationActivity();
  resolvePendingShapeDirectorCandidate({ rerender: false });
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
  state.songVariations = [];
  state.activeSongVariation = -1;
  state.sectionMacroValues = {};
  state.shapeDirector = null;
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
    else if (restored && state.solo.size) {
      const soloNames = [...state.solo].map((trackId) => TRACK_META[trackId]?.name ?? trackId);
      showToast(`Your last song was restored. Solo is still active on ${soloNames.join(", ")}.`);
    } else if (restored) showToast("Your last song and live take were restored.");
    discoverMidiDevices({ requestAccess: false });
    // Prune old MIDI exports at startup (fire-and-forget).
    pruneMidiExportsCache().catch(() => {});
  } catch (error) {
    console.error(error);
    showToast("The composition engine could not start. Refresh to try again.");
  }
}

init();
