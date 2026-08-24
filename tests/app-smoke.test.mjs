import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GENRE_PROFILES, ONE_SHOT_KITS } from "../src/music-engine.js";
import { previewDrumCharacter, previewDrumEnvelope } from "../src/core/preview-drums.js";
import {
  characteristicTrackForPreview,
  clickSafeStopTime,
  PREVIEW_TRANSITION,
  previewSpotlight,
} from "../src/core/preview-audio.js";

const htmlSource = await readFile(new URL("../index.html", import.meta.url), "utf8");
const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const copyCatalogSource = await readFile(new URL("../src/ui/copy-catalog.js", import.meta.url), "utf8");
const cssSource = await readFile(new URL("../styles.css", import.meta.url), "utf8");
const buildSource = await readFile(new URL("../scripts/build.js", import.meta.url), "utf8");

test("preview drum characters respond musically to velocity without losing bounds", () => {
  for (const kit of ONE_SHOT_KITS) {
    const quietSnare = previewDrumCharacter(kit.preview, 38, 32, 4.5);
    const loudSnare = previewDrumCharacter(kit.preview, 38, 118, 4.5);
    const closedHat = previewDrumCharacter(kit.preview, 42, 92, 7.25);
    const openHat = previewDrumCharacter(kit.preview, 46, 92, 7.25);
    const kick = previewDrumCharacter(kit.preview, 36, 110, 0);

    assert.deepEqual(loudSnare, previewDrumCharacter(kit.preview, 38, 118, 4.5), `${kit.id} character must be deterministic`);
    assert.equal(loudSnare.kind, "snare");
    assert.ok(loudSnare.peak > quietSnare.peak, `${kit.id} velocity must raise drum energy`);
    assert.ok(loudSnare.filterFrequency > quietSnare.filterFrequency, `${kit.id} velocity must brighten the snare`);
    assert.ok(loudSnare.snapLevel > quietSnare.snapLevel, `${kit.id} strong snares need a stronger wire transient`);
    assert.ok(openHat.duration > closedHat.duration, `${kit.id} open hats must sustain beyond closed hats`);
    assert.ok(Math.abs(closedHat.panOffset) <= 0.18 && closedHat.duration >= 0.018);
    assert.ok(kick.bodyLevel > 0 && kick.kickDecay <= 0.42, `${kit.id} kick body must stay present and bounded`);

    const snareEnvelope = previewDrumEnvelope(loudSnare);
    const clapEnvelope = previewDrumEnvelope(previewDrumCharacter(kit.preview, 39, 108, 2));
    assert.equal(snareEnvelope[0].value, 0.0001, `${kit.id} drum voices must fade in from silence`);
    assert.ok(snareEnvelope[1].offset > 0 && snareEnvelope.at(-1).offset === loudSnare.duration);
    assert.equal(clapEnvelope.length, 7, `${kit.id} claps must preserve three smoothed bursts`);
    assert.ok(clapEnvelope.every((point, index) => index === 0 || point.offset > clapEnvelope[index - 1].offset));
  }
});

test("preview transitions and the persistent instrument spotlight stay deterministic", () => {
  const song = { genre: "funk", characteristicVoice: { trackId: "bass" } };
  assert.equal(characteristicTrackForPreview(song), "bass");
  assert.equal(characteristicTrackForPreview({ genre: "ambient" }), "pad");
  assert.equal(previewSpotlight(song, "bass").active, true);
  assert.ok(previewSpotlight(song, "bass").gain > previewSpotlight(song, "chords").gain);
  assert.equal(clickSafeStopTime(4, 6), 4, "future voices should cancel before they start");
  assert.equal(
    clickSafeStopTime(4, 3),
    4 + PREVIEW_TRANSITION.stopSeconds + PREVIEW_TRANSITION.sourceTailSeconds,
    "active voices need time to finish their click-safe release",
  );
});

class MockElement {
  constructor(value = "") {
    this.value = value;
    this.textContent = "";
    this.innerHTML = "";
    this.disabled = false;
    this.open = false;
    this.options = [];
    this.dataset = {};
    this.style = { setProperty() {} };
    this.listeners = new Map();
    this.attributes = new Map();
    const classes = new Set();
    this.classList = {
      add(...names) { names.forEach((name) => classes.add(name)); },
      remove(...names) { names.forEach((name) => classes.delete(name)); },
      contains(name) { return classes.has(name); },
      toggle(name, force) {
        const shouldAdd = force == null ? !classes.has(name) : Boolean(force);
        shouldAdd ? classes.add(name) : classes.delete(name);
        return shouldAdd;
      },
    };
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }
  dispatch(type) {
    for (const listener of this.listeners.get(type) || []) listener({ target: this, currentTarget: this });
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  querySelector() { return new MockElement(); }
  querySelectorAll() { return []; }
  append() {}
  remove() {}
  click() {}
  close() { this.open = false; }
  showModal() { this.open = true; }
}

test("static UI selectors and accessibility hooks stay wired to real markup", () => {
  assert.match(htmlSource, /Created by Edgar Valle/, "the creator credit must remain visible in the app menu");
  assert.match(htmlSource, /class="home-command"[\s\S]*?Turn a direction into a complete song/, "Create should open with a concise composition desk");
  assert.match(cssSource, /#tab-create\.is-active[\s\S]*?grid-template-columns:minmax\(0,1\.45fr\) minmax\(360px,\.72fr\)/, "desktop Create should pair the live song with its direction controls");
  assert.match(cssSource, /@media\(max-width:1120px\)[\s\S]*?#tab-create\.is-active\{grid-template-columns:1fr\}/, "the home composition desk must stack before tablet widths");
  const ids = [...htmlSource.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, "HTML IDs must be unique");
  const referencedIds = [...appSource.matchAll(/\$\("#([A-Za-z][\w-]*)"\)/g)].map((match) => match[1]);
  for (const id of new Set(referencedIds)) assert.ok(ids.includes(id), `#${id} must exist in index.html`);
  for (const genre of Object.keys(GENRE_PROFILES)) assert.match(htmlSource, new RegExp(`value="${genre}"`));
  for (const id of [
    "tripletControl", "tripletValue", "rollControl", "rollValue",
    "evolutionControl", "evolutionValue", "surpriseControl", "surpriseValue",
    "attitudeStrip", "attitudeTargetName", "attitudeTargetState", "attitudeStatus",
    "workflowPanel", "guidedModeButton", "workflowProgress", "workflowCoachTitle",
    "workflowCoachText", "workflowAction", "contextHelpTitle", "contextHelpText",
    "sectionEditor", "sectionEditorTitle", "sectionEditorSubtitle", "editorTrackTabs",
    "editorGridControl", "editorVelocityControl", "editorZoomControl", "pianoRollGrid",
    "creativeThread", "threadProgress", "threadSongButton", "threadSongName", "threadSongMeta",
    "threadSectionButton", "threadSectionName", "threadSectionMeta", "threadTrackButton",
    "threadTrackName", "threadTrackMeta", "threadLiveSection", "threadActionButton",
    "showcaseMonogram", "showcaseSeed", "showcaseTrackMeter", "showcasePlayButton",
    "showcaseSimilarButton", "showcaseArc", "showcaseArcStatus",
    "arrangeWorkflow", "arrangeSectionStep", "arrangeNoteStep", "mixOverview",
    "mixFocusName", "mixFocusSound", "mixAudibleCount", "mixLockedCount", "mixPlayButton",
  ]) {
    assert.ok(ids.includes(id), `#${id} rhythm control must exist in index.html`);
  }
  for (const attitude of ["power", "motion", "bloom", "hush", "neutral"]) {
    assert.match(htmlSource, new RegExp(`data-attitude="${attitude}"[^>]+aria-pressed=`), `${attitude} must be keyboard-accessible and expose its state`);
  }
  assert.match(htmlSource, /id="attitudeStatus"[^>]+role="status"[^>]+aria-live="polite"/);
  assert.match(htmlSource, /id="generationWash"[^>]+role="status"[^>]+aria-live="polite"/);
  assert.match(htmlSource, /id="shortcutDialog"[^>]+aria-labelledby="shortcutDialogTitle"/);
  assert.match(htmlSource, /Make a song in four steps/);
  assert.match(htmlSource, /What sound gets exported\?/);
  for (const workspace of ["create", "arrange", "mix", "finish"]) {
    assert.match(htmlSource, new RegExp(`data-workspace="${workspace}"`), `${workspace} must be a first-class workspace`);
    assert.match(htmlSource, new RegExp(`data-workspace-panel="${workspace}"`), `${workspace} must own one workspace panel`);
  }
  assert.match(htmlSource, /<details class="dna-integrated-card"/, "song analysis should be progressively disclosed");
  assert.match(htmlSource, /<details class="shape-controls"/, "key, tempo and song shape should be optional");
  assert.match(htmlSource, /<details class="creator-recipe-side"/, "recipes and fine tuning should be optional");
  assert.doesNotMatch(htmlSource, /Start with a mood|moodPresetsTitle|moodGrid/, "retired mood presets should not ship");
  assert.match(cssSource, /\[hidden\]\{display:none!important\}/, "inactive workspace panels must not leak into the layout");
  assert.doesNotMatch(cssSource, /fonts\.googleapis\.com/, "app typography must stay available offline");
  assert.match(cssSource, /@font-face[\s\S]*?inter-latin-wght-normal\.woff2/, "the bundled body font must be declared locally");
  assert.match(cssSource, /--type-display:[^;]+;[\s\S]*?--type-body:[^;]+;/, "Phase 12 must expose a reusable fluid type scale");
  assert.match(htmlSource, /class="hero-panel song-showcase panel"/, "the current song must be presented as the Phase 13 showcase");
  assert.match(appSource, /function renderSongShowcase\(\)[\s\S]*?data-showcase-section/, "the showcase arc must render from live song sections");
  assert.match(appSource, /function setPlaybackPresentation\(playing\)[\s\S]*?showcasePlayButton/, "showcase playback must share transport state");
  assert.match(cssSource, /\.song-showcase \.title-row>div\{flex:1;min-width:0\}/, "long generated titles need a shrink-safe container");
  assert.match(cssSource, /\.song-showcase h1\{[\s\S]*?max-width:100%;[\s\S]*?overflow-wrap:anywhere;/, "long generated titles must wrap instead of clipping");
  assert.match(cssSource, /\.finish-cover figcaption strong\{[^}]*min-width:0;[^}]*overflow-wrap:anywhere/, "finish artwork titles must remain readable");
  assert.match(cssSource, /PHASE 14: ARRANGEMENT WORKSPACE[\s\S]*?\.arrange-workflow/, "Phase 14 must expose the guided arrangement workspace");
  assert.match(htmlSource, /class="shape-stage"[\s\S]*?id="sectionShaper"/, "Shape must prioritize its arrangement canvas and contextual section shaper");
  assert.match(htmlSource, /data-section-macro="energy"[\s\S]*?data-section-macro="pocket"/, "the section shaper must expose Auto-aware musical macros");
  assert.match(htmlSource, /class="section-edit-primary"[\s\S]*?data-section-action="edit"/, "Shape must promote note editing as one clear optional precision action");
  assert.match(cssSource, /PHASE 73: SHAPE WORKSPACE CLARITY[\s\S]*?\.shaper-group-heading[\s\S]*?\.section-edit-primary/, "Shape must provide a readable grouped control hierarchy");
  assert.match(htmlSource, /class="editor-toolbar"[\s\S]*?class="editor-advanced-tools"[\s\S]*?data-editor-action="delete"/, "the note editor must keep essential and advanced actions in a progressive hierarchy");
  assert.match(cssSource, /PHASE 74: FOCUSED NOTE EDITOR[\s\S]*?\.editor-advanced-tools-body/, "the focused note editor must have responsive progressive-disclosure styling");
  assert.match(appSource, /function commitArrangementCommand[\s\S]*?executeArrangementCommand[\s\S]*?pushHistory/, "Shape mutations must share one immutable command and history boundary");
  assert.match(appSource, /const ARRANGEMENT_ERROR_COPY[\s\S]*?invalid-automation-events[\s\S]*?function commitArrangementCommand/, "command validation failures must provide actionable musical diagnostics");
  assert.match(htmlSource, /id="undoButton"[\s\S]*?id="redoButton"/, "transactional history must expose adjacent Undo and Redo controls");
  assert.match(appSource, /function restoreHistory[\s\S]*?state\.future\.push[\s\S]*?function redoHistory/, "Undo must capture a forward snapshot that Redo can reapply");
  assert.match(appSource, /function pushHistory[\s\S]*?state\.future = \[\]/, "a new edit after Undo must invalidate the abandoned Redo branch");
  assert.match(appSource, /function applySectionMacro[\s\S]*?commitArrangementCommand[\s\S]*?function simplifyFocusedSection/, "section macros must route through the shared arrangement command path");
  assert.match(htmlSource, /id="editorMusicalGuide"[\s\S]*?id="editorOverlayControl"/, "Phase 56 must expose harmony and relationship guidance");
  assert.match(appSource, /from "\.\/ui\/shape-logic\.js"[\s\S]*?export \{ nearestScalePitch, transposeScaleStep \}/, "manual note editing must share extracted scale-safe pitch helpers");
  assert.match(appSource, /function cancelSectionVariations[\s\S]*?state\.song = deepClone\(lab\.base\)/, "the A/B lab must restore its exact original without committing");
  assert.match(cssSource, /PHASES 56–58:[\s\S]*?prefers-contrast:more/, "advanced Shape guidance must include responsive and high-contrast styling");
  assert.match(htmlSource, /id="energyArcLane"[\s\S]*?id="harmonyMapLane"/, "Phase 59 must expose arrangement energy and harmony lanes");
  assert.match(appSource, /draggable="true"[\s\S]*?Alt plus an arrow key/, "Phase 60 section ordering must support pointer and keyboard interaction");
  assert.match(appSource, /function duplicateFocusedSection[\s\S]*?type: "duplicate"[\s\S]*?commitArrangementCommand/, "section duplication must use the unified arrangement command engine");
  assert.match(appSource, /function renderArrangeWorkflow\(\)[\s\S]*?data-arrange-step/, "arrangement guidance must follow real section and note focus");
  assert.match(cssSource, /PHASE 15: MIX WORKSPACE[\s\S]*?\.mix-overview/, "Phase 15 must expose the simplified mixer hierarchy");
  assert.match(appSource, /function renderMixOverview\(\)[\s\S]*?mixAudibleCount/, "the mix overview must render from live mixer state");
  assert.match(appSource, /class="track-expression track-shaping"[\s\S]*?SHAPE INSTRUMENT/, "deep track controls must use progressive disclosure");
  assert.match(appSource, /createAppStore[\s\S]*?createSessionStorage[\s\S]*?createGenerationRunner[\s\S]*?createWorkspaceController/, "app lifecycle boundaries must use the Phase 10 core modules");
  assert.match(appSource, /createGenerationExecutor[\s\S]*?new Worker\(new URL\("\.\/generation-worker\.js"/, "candidate search must run outside the UI thread when workers are available");
  assert.match(appSource, /resolveControlHelp[\s\S]*?from "\.\/ui\/control-catalog\.js"/, "Phase 21 must keep the control catalog outside the application shell");
  assert.doesNotMatch(appSource, /const CONTROL_HELP\s*=/, "Phase 21 must not duplicate the extracted help catalog in app.js");
  assert.match(appSource, /aria-description/);
  assert.match(appSource, /setWorkflowStep\(2\)/, "generation should advance the guided workflow to listening");
  assert.match(appSource, /setWorkflowStep\(3\)/, "playback should advance the guided workflow to instrument shaping");
  assert.match(appSource, /setWorkflowStep\(4\)/, "a targeted rewrite should advance the guided workflow to export");
  const rerollSource = appSource.slice(appSource.indexOf("async function regenerateTrack"), appSource.indexOf("function randomizeTrackControls"));
  assert.match(rerollSource, /showGenerationActivity\(trackRewriteStatus/, "instrument rerolls must expose their live status through the shared lifecycle");
  assert.match(rerollSource, /finally \{[\s\S]*?hideGenerationActivity\(\)/, "instrument rerolls must clear their busy state through the shared lifecycle");
  assert.match(rerollSource, /candidateSettings\.tripletAmount/, "melody and drum rerolls must persist triplet intent");
  assert.match(rerollSource, /candidateSettings\.rollAmount/, "drum rerolls must persist roll intent");
  assert.match(rerollSource, /buildTrackRerollInput\(id, original/, "single-track generation must use its isolated contextual input");
  assert.match(
    rerollSource,
    /generationExecutor\.run\("similar", \{ sourceSong: original, config: generationInput \}\)/,
    "contextual input must be passed through the background generation boundary",
  );
  assert.match(appSource, /for \(const \[index, point\] of expressionCurve\.slice\(1\)\.entries\(\)\)/, "preview gain must schedule every interior expression point");
  assert.match(appSource, /createConvolver/, "preview audio must include a real ambience bus");
  assert.match(appSource, /createWaveShaper/, "preview audio must include oversampled saturation");
  assert.match(appSource, /oversample = "4x"/, "preview saturation must use high-quality oversampling");
  assert.match(appSource, /createDelay/, "preview audio must include a tempo-safe stereo space bus");
  assert.match(appSource, /filter\.frequency\.exponentialRampToValueAtTime/, "preview voices must use animated filters");
  assert.match(appSource, /periodicWaveForVoice[\s\S]*?createPeriodicWave/, "instrument timbres must reuse cached harmonic waves");
  assert.match(appSource, /resetContextReferences[\s\S]*?periodicWaves\.clear\(\)/, "context recovery must discard audio objects owned by the closed context");
  assert.match(appSource, /maxScheduledVoices:\s*96/, "preview playback must enforce a bounded polyphony ceiling");
  assert.match(appSource, /cleanupScheduledVoice[\s\S]*?node\.disconnect\(\)/, "finished preview voices must disconnect their complete audio graph");
  assert.match(appSource, /createdContext\.onstatechange[\s\S]*?recoverAudioContext/, "preview playback must recover an interrupted Android audio context");
  assert.match(appSource, /lookAheadSeconds:\s*0\.85/, "the scheduler must look far enough ahead to survive ordinary WebView stalls");
  assert.match(appSource, /export function focusSongSection/, "timeline selection must open the real section editor");
  assert.match(appSource, /export function applyEditorAction/, "piano-roll tools must mutate song MIDI through one undo-safe path");
  assert.match(appSource, /pushHistory\(\);[\s\S]*?if \(action === "delete"\)/, "destructive piano-roll edits must capture undo history first");
  assert.match(htmlSource, /data-editor-action="quantize"[\s\S]*?data-editor-action="humanize"/);
  assert.match(htmlSource, /Double-click empty space to draw/);
  assert.match(htmlSource, /id="sectionVariationLab"/);
  assert.match(htmlSource, /data-workspace="finish"[\s\S]*?id="finishCoverImage"/);
  assert.match(cssSource, /\.section-editor\.is-open[\s\S]*?transform:\s*translateY\(0\) scale\(1\)/, "section editor must animate into a zoomed workspace");
  assert.match(appSource, /piano-roll-editor-playhead[\s\S]*?beat - range\.start/, "focused piano roll must animate its own musical playhead");
  assert.match(cssSource, /--font-display:[^;]+;[\s\S]*?--font-data:[^;]+;/, "typography must separate expressive titles from precise musical data");
  assert.match(cssSource, /\.creative-thread[\s\S]*?--thread-color:\s*var\(--focus-color\)/, "shared focus must have one adaptive visual thread");
  assert.match(appSource, /function updateCreativeThreadPlayback[\s\S]*?is-playing-section/, "playback must illuminate its section across the shared timeline");
  assert.match(appSource, /buildExportSongSnapshot\(\)[\s\S]*?encodeMidi\(clone/, "export must snapshot the live mix");
  assert.doesNotMatch(appSource, /encodeMidi\(clone, \{ includeMuted: true \}\)/, "export must not force muted or non-soloed notes back on");
  assert.match(appSource, /function buildExportSongSnapshot[\s\S]*?mute: state\.muted\.has\(id\)[\s\S]*?solo: state\.solo\.has\(id\)/, "the export snapshot must use the exact live mute and solo state");
  const historySource = appSource.slice(appSource.indexOf("function createHistorySnapshot"), appSource.indexOf("function pushHistory"));
  const generationSource = appSource.slice(appSource.indexOf("async function runGeneration"), appSource.indexOf("function handleTrackAction"));
  assert.doesNotMatch(generationSource, /nextKey|keyControl"\)\.value/, "New song must honor the staged root key instead of silently replacing it");
  assert.match(htmlSource, /id="generationIntent"[\s\S]*?id="generationIntentCopy"/, "Create must explain whether settings are current or staged");
  assert.match(htmlSource, /id="tasteRating"[\s\S]*?value="like"[\s\S]*?value="reject"[\s\S]*?value="favorite"/, "the home showcase must expose explicit taste learning");
  assert.match(appSource, /function rateCurrentSong[\s\S]*?Future Auto choices will gently favor this direction/, "song ratings must update the persistent taste profile");
  assert.match(appSource, /tasteAverages[\s\S]*?selected \* 0\.72 \+ learned \* 0\.28/, "taste learning should gently bias only Auto generation values");
  assert.match(appSource, /function renderGenerationIntent\(\)[\s\S]*?generationIntentCopy\(staged\)/, "generation intent must resolve its copy from the shared catalog");
  assert.match(appSource, /function showGenerationActivity[\s\S]*?function hideGenerationActivity/, "every generation path must share one null-safe busy-state lifecycle");
  assert.equal([...appSource.matchAll(/wash\?\.classList\.add\("visible"\)/g)].length, 1, "the generation overlay should have one lifecycle owner");
  assert.match(copyCatalogSource, /New song idea uses every choice above and replaces the full arrangement/, "staged settings guidance must explain the New song behavior");
  assert.match(appSource, /syncControlsFromSong\(\);\s*captureAppliedGenerationSettings\(\);/, "a committed generation must clear the staged-settings state");
  assert.match(appSource, /dataset\.coverStyle = "original"[\s\S]*?coverArtworkDataUrl[\s\S]*?variation: 0/, "each generated song must showcase its deterministic original cover artwork");
  assert.match(generationSource, /draft\.coverVariation = 0/, "each generated song must begin with its original cover finish");
  const updateFrameSource = appSource.slice(appSource.indexOf("  updateFrame()"), appSource.indexOf("  clearTimers()"));
  assert.match(updateFrameSource, /PREVIEW_AUDIO_LIMITS\.visualIntervalMs/, "the visual transport should use the bounded adaptive FPS cadence");
  assert.match(updateFrameSource, /shouldRefreshPlaybackDetails/, "expensive playback details must be throttled independently from smooth playheads");
  assert.doesNotMatch(updateFrameSource, /requestAnimationFrame/, "the DOM transport must not consume a full animation-frame loop");
  const idleAudioSource = appSource.slice(appSource.indexOf("  cancelIdleSuspend()"), appSource.indexOf("  buildEvents()"));
  assert.match(idleAudioSource, /suspendWhenIdle[\s\S]*?this\.context\.suspend\(\)/, "Web Audio must suspend itself after playback and live notes become idle");
  assert.match(cssSource, /Decorative motion sleeps at idle[\s\S]*?body\.is-playing \.ambient-one/, "decorative motion must stay asleep until playback or generation needs it");
  assert.match(cssSource, /content-visibility:auto/, "offscreen workspace panels must be skipped by the rendering engine");
  assert.match(cssSource, /transition-property:color,background-color,border-color,opacity,transform,box-shadow/, "interactive surfaces must not animate every CSS property");
  assert.match(cssSource, /@media\(max-width:700px\)[\s\S]*?backdrop-filter:none/, "mobile rendering must disable expensive backdrop blur");
  assert.match(buildSource, /minify:\s*true/, "production JavaScript must be minified");
  assert.match(htmlSource, /data-section-bars/, "Arranger Studio must expose section bar length controls");
  assert.match(htmlSource, /data-section-action="queue-jump"/, "Arranger Studio must expose live section queue jumping");
  assert.match(appSource, /updateSectionBars\(state\.song, section\.id, targetBars\)/, "Arranger Studio must resize sections immutably");
  assert.match(appSource, /state\.queuedSection && this\.position >=/, "Preview transport must execute queued section jumps seamlessly");
  const pauseSource = appSource.slice(appSource.indexOf("  pause()"), appSource.indexOf("  stop()", appSource.indexOf("  pause()")));
  const playerPlaySource = appSource.slice(appSource.indexOf("  async play()"), appSource.indexOf("  schedule()"));
  assert.match(playerPlaySource, /requestGeneration = \+\+this\.playRequestGeneration[\s\S]*?requestGeneration !== this\.playRequestGeneration/, "overlapping audio starts must be generation-tokened before creating timers");
  assert.match(pauseSource, /this\.cancelPendingPlay\(\)/, "pause must invalidate an asynchronous transport start");
  const exportSongSource = appSource.slice(appSource.indexOf("async function exportSong()"), appSource.indexOf("function expressionPoints"));
  assert.match(exportSongSource, /if \(isNative\) \{\s*await exportSongNative\(payload, filename\);\s*\} else \{\s*triggerBrowserDownload\(payload, filename\);/, "native export must await Filesystem and Share while browser export keeps its download path");
  assert.equal([...exportSongSource.matchAll(/triggerBrowserDownload\(/g)].length, 1, "native failures must never fall back to a WebView anchor download");
  assert.doesNotMatch(exportSongSource, /falling back to browser download/i);
  assert.match(exportSongSource, /Sound-ready MIDI prepared/, "native success copy must describe the prepared sound setup without claiming the share completed");
  assert.match(htmlSource, /6 SOUND-READY MIDI TRACKS/);
  assert.match(appSource, /data-control="velocity"[\s\S]*?data-control="gate"[\s\S]*?data-control="pan"[\s\S]*?data-control="reverb"[\s\S]*?data-control="cutoff"[\s\S]*?data-control="resonance"/, "every generated track must expose performance and sound-ready export controls");
  assert.match(cssSource, /@media \(max-width: 840px\)[\s\S]*?\.attitude-strip\s*\{\s*grid-template-columns:\s*1fr;/, "attitude controls must stack before the tablet-width clipping range");
});

test("browser app initializes against the engine contract", async () => {
  const elements = new Map();
  const storedValues = new Map();
  const values = {
    genreControl: "neoSoul",
    keyControl: "C",
    modeControl: "dorian",
    tempoControl: "84",
    barsControl: "32",
    grooveControl: "straight",
    energyControl: "68",
    complexityControl: "54",
    swingControl: "14",
    humanizeControl: "9",
    tripletControl: "16",
    rollControl: "12",
    variationControl: "42",
    evolutionControl: "58",
    surpriseControl: "28",
    songScrubber: "0",
  };

  function elementFor(selector) {
    if (!elements.has(selector)) {
      const id = selector.startsWith("#") ? selector.slice(1) : selector;
      const element = new MockElement(values[id] ?? "");
      if (id === "genreControl") {
        element.options = ["neoSoul", "hipHop", "trap", "house", "techno", "drumBass", "synthwave", "pop"].map((value) => ({ value }));
      }
      if (id === "modeControl") {
        element.options = ["major", "minor", "dorian", "mixolydian", "lydian", "phrygian", "minorPentatonic"].map((value) => ({ value }));
      }
      if (id === "barsControl") element.options = ["16", "24", "32", "48", "64"].map((value) => ({ value }));
      elements.set(selector, element);
    }
    return elements.get(selector);
  }

  globalThis.window = globalThis;
  globalThis.localStorage = {
    getItem(key) { return storedValues.get(key) ?? null; },
    setItem(key, value) { storedValues.set(key, String(value)); },
    removeItem(key) { storedValues.delete(key); },
  };
  globalThis.HTMLInputElement = MockElement;
  globalThis.HTMLSelectElement = MockElement;
  globalThis.HTMLTextAreaElement = MockElement;
  globalThis.document = {
    body: new MockElement(),
    querySelector: elementFor,
    querySelectorAll() { return []; },
    addEventListener() {},
    createElement() { return new MockElement(); },
  };

  const app = await import(`../src/app.js?smoke=${Date.now()}`);
  await new Promise((resolve) => setTimeout(resolve, 25));

  assert.match(htmlSource, /class="tab-nav-shell"[\s\S]*?id="navDockToggle"/, "desktop navigation needs a persistent bottom-dock handle");
  assert.match(htmlSource, /id="mobileCreate"[\s\S]*?id="mobileArrange"[\s\S]*?id="mobilePlayPause"[\s\S]*?id="mobileMix"[\s\S]*?id="mobileFinish"/, "mobile navigation must mirror the four real workspaces around Play");
  assert.match(htmlSource, /id="mobileSectionJump"[\s\S]*?id="mobileSectionJumpList"/, "mobile playback needs a compact live-section surface");
  assert.doesNotMatch(htmlSource, /id="mobileJam"/, "the retired Jam workspace must not remain as a dead mobile action");
  assert.match(cssSource, /\.tab-nav-shell\{[\s\S]*?position:fixed;[\s\S]*?bottom:var\(--transport-h\)/, "desktop workspace navigation must stay docked above transport");
  assert.match(cssSource, /body\.nav-dock-collapsed \.mobile-dock button:not\(\.mobile-dock-toggle\)\{display:none\}/, "mobile navigation must collapse without losing its restore handle");
  assert.match(appSource, /function renderMobileSectionJump\(\)[\s\S]*?data-mobile-section/, "live section controls must render from the generated arrangement");
  assert.match(appSource, /export function queueMobileSectionJump[\s\S]*?calculateNextQueuedSection/, "mobile section jumps must use safe musical boundaries");
  assert.equal(app.queueMobileSectionJump("missing-section"), false);
  assert.equal(app.setNavigationDockCollapsed(true), true);
  assert.equal(globalThis.document.body.classList.contains("nav-dock-collapsed"), true);
  assert.equal(elementFor("#navDockToggle").getAttribute("aria-expanded"), "false");
  assert.equal(app.setNavigationDockCollapsed(false), false);
  assert.equal(globalThis.document.body.classList.contains("nav-dock-collapsed"), false);

  app.resetUiRenderMetrics();
  assert.deepEqual(app.renderUiRegions("summary", "summary", "workflow"), ["summary", "workflow"]);
  assert.deepEqual(app.getUiRenderMetrics(), {
    cycles: 1,
    counts: {
      summary: 1, timeline: 0, tracks: 0, attitude: 0,
      editor: 0, thread: 0, ranges: 0, workflow: 1, descriptions: 0, persistence: 0,
    },
  });
  assert.equal(app.PREVIEW_AUDIO_LIMITS.visualIntervalMs, 33);
  assert.equal(app.PREVIEW_AUDIO_LIMITS.detailRefreshMs, 250);

  const clubMix = app.previewMixProfile({ genre: "house", bpm: 120 });
  const pocketMix = app.previewMixProfile({ genre: "neoSoul", bpm: 80 });
  const ambientMix = app.previewMixProfile({ genre: "ambient", bpm: 60 });
  assert.equal(clubMix.family, "club");
  assert.equal(pocketMix.family, "pocket");
  assert.equal(ambientMix.family, "atmospheric");
  assert.equal(clubMix.delaySeconds, 0.25, "club delay must follow an eighth-note subdivision");
  assert.equal(pocketMix.delaySeconds, 0.5625, "pocket delay must follow a dotted subdivision");
  assert.ok(ambientMix.reverbReturn > clubMix.reverbReturn);
  assert.ok(clubMix.trackGain.drums > clubMix.trackGain.pad);
  const fxCalls = [];
  const audioParam = () => ({ setTargetAtTime(value, time, constant) { fxCalls.push([value, time, constant]); } });
  const fxPlayer = new app.PreviewPlayer();
  fxPlayer.context = { currentTime: 3 };
  fxPlayer.delayBus = { delayTime: audioParam() };
  fxPlayer.reverbReturn = { gain: audioParam() };
  fxPlayer.delayReturn = { gain: audioParam() };
  fxPlayer.configureSongFx({ genre: "house", bpm: 120 });
  assert.deepEqual(fxCalls, [
    [clubMix.delaySeconds, 3, 0.025],
    [clubMix.reverbReturn, 3, 0.025],
    [clubMix.delayReturn, 3, 0.025],
  ]);

  const timbrePrograms = {
    bass: [32, 33, 34, 35, 36, 38, 39, 43, 87, 88],
    chords: [0, 4, 5, 7, 12, 16, 25, 48, 61, 81, 89, 95],
    melody: [24, 26, 40, 56, 65, 68, 71, 73, 80, 81, 84, 85],
    counterpoint: [10, 11, 14, 25, 40, 48, 53, 71, 73, 80, 84, 98],
    pad: [48, 51, 52, 54, 88, 89, 90, 91, 92, 93, 94, 95, 99],
  };
  for (const [id, programs] of Object.entries(timbrePrograms)) {
    const voices = programs.map((program) => app.previewVoice(id, program));
    assert.equal(new Set(voices.map((voice) => voice.character)).size, programs.length, `${id} programs must keep distinct preview characters`);
    assert.ok(new Set(voices.map((voice) => `${voice.type}:${voice.layer}:${voice.filter}:${voice.attack}`)).size >= Math.ceil(programs.length * 0.75), `${id} programs must be audibly varied`);
  }
  const pianoVoice = app.previewVoice("chords", 0);
  const organVoice = app.previewVoice("chords", 16);
  const subBassVoice = app.previewVoice("bass", 38);
  const padVoice = app.previewVoice("pad", 89);
  assert.ok(pianoVoice.transientLevel > 0 && pianoVoice.transientDecay <= 0.08, "piano preview needs a bounded hammer transient");
  assert.equal(organVoice.transientLevel, 0, "organ preview must remain sustained rather than falsely plucked");
  assert.equal(subBassVoice.subRatio, 0.5);
  assert.ok(subBassVoice.subLevel >= 0.18, "sub programs need reinforced fundamentals");
  assert.ok(padVoice.filterMotionDepth > 0 && padVoice.filterMotionRate < 0.2, "pads need slow timbral movement");

  const makeAudioNode = () => ({
    stopped: 0,
    disconnected: 0,
    onended: null,
    stop() { this.stopped += 1; },
    disconnect() { this.disconnected += 1; },
  });
  const cleanupPlayer = new app.PreviewPlayer();
  const cleanupSource = makeAudioNode();
  const cleanupGain = makeAudioNode();
  cleanupPlayer.registerScheduledVoice([cleanupSource], [cleanupSource, cleanupGain], { id: "melody" }, 0);
  assert.equal(cleanupPlayer.scheduledVoices.size, 1);
  cleanupSource.onended();
  assert.equal(cleanupPlayer.scheduledVoices.size, 0, "an ended voice must leave the active registry");
  assert.equal(cleanupSource.disconnected, 1, "an ended source must be disconnected");
  assert.equal(cleanupGain.disconnected, 1, "downstream nodes must be disconnected with their source");

  const boundedPlayer = new app.PreviewPlayer();
  const boundedSources = Array.from({ length: app.PREVIEW_AUDIO_LIMITS.maxScheduledVoices + 1 }, () => makeAudioNode());
  boundedSources.forEach((source, index) => {
    boundedPlayer.registerScheduledVoice([source], [source], { id: "drums" }, index);
  });
  assert.equal(boundedPlayer.scheduledVoices.size, app.PREVIEW_AUDIO_LIMITS.maxScheduledVoices);
  assert.equal(boundedSources[0].stopped, 1, "the oldest low-priority voice must be released at the ceiling");
  boundedPlayer.clearScheduledAudio();
  assert.equal(boundedPlayer.scheduledVoices.size, 0);

  const gracefulPlayer = new app.PreviewPlayer();
  gracefulPlayer.context = { currentTime: 3 };
  const gracefulSource = makeAudioNode();
  let stopAt = null;
  gracefulSource.stop = (when) => { stopAt = when; gracefulSource.stopped += 1; };
  const gainCalls = [];
  const gracefulGain = makeAudioNode();
  gracefulGain.gain = {
    value: 0.5,
    cancelScheduledValues: () => {},
    cancelAndHoldAtTime: (when) => gainCalls.push(["hold", when]),
    exponentialRampToValueAtTime: (value, when) => gainCalls.push(["ramp", value, when]),
  };
  const gracefulVoice = gracefulPlayer.registerScheduledVoice(
    [gracefulSource],
    [gracefulSource, gracefulGain],
    { id: "bass", spotlight: true },
    2,
  );
  gracefulPlayer.cleanupScheduledVoice(gracefulVoice, true);
  assert.ok(stopAt > gracefulPlayer.context.currentTime, "active voices must not be cut off at the cleanup instant");
  assert.equal(gracefulGain.disconnected, 0, "nodes stay connected until the fade finishes");
  assert.deepEqual(gainCalls, [["hold", 3], ["ramp", 0.0001, 3 + PREVIEW_TRANSITION.stopSeconds]]);
  gracefulSource.onended();
  assert.equal(gracefulGain.disconnected, 1, "the completed release must disconnect its audio graph");

  const schedulerPlayer = new app.PreviewPlayer();
  schedulerPlayer.playing = true;
  schedulerPlayer.context = { state: "running", currentTime: 10 };
  schedulerPlayer.offset = 0;
  schedulerPlayer.startedAt = 0;
  schedulerPlayer.events = [
    { id: "drums", time: 9.5 },
    { id: "drums", time: 9.95 },
    { id: "drums", time: 10.5 },
    { id: "drums", time: 10.9 },
  ];
  const scheduledTimes = [];
  schedulerPlayer.scheduleEvent = (event) => scheduledTimes.push(event.time);
  schedulerPlayer.schedule();
  assert.deepEqual(scheduledTimes, [9.95, 10.5], "lookahead must retain slightly late notes and pre-schedule the next beat");
  assert.equal(schedulerPlayer.eventIndex, 3, "events beyond the lookahead must wait for the next scheduler pass");

  const recoveryPlayer = new app.PreviewPlayer();
  const interruptedContext = {
    state: "suspended",
    currentTime: 4,
    onstatechange: null,
    async resume() { this.state = "running"; },
  };
  recoveryPlayer.context = interruptedContext;
  recoveryPlayer.playing = true;
  recoveryPlayer.startedAt = 0;
  recoveryPlayer.events = [];
  assert.equal(await recoveryPlayer.recoverAudioContext(interruptedContext), true);
  assert.equal(interruptedContext.state, "running", "an interrupted context must be resumed and resynchronized");
  recoveryPlayer.playing = false;

  assert.equal(app.shouldDisconnectStaleMidiConnection("native:keys", "native:keys"), false, "an older waiter for a shared same-port connect must not tear down the winner");
  assert.equal(app.shouldDisconnectStaleMidiConnection("native:old", "native:new"), true, "a stale different-port connection should be disposed");

  const neoSoul = GENRE_PROFILES.neoSoul;
  assert.match(elementFor("#songTitle").textContent, /\S/);
  assert.equal(elementFor("#genreControl").value, "neoSoul");
  assert.match(elementFor("#factGenre").textContent, /NEO SOUL/);
  assert.match(elementFor("#factTempo").textContent, new RegExp(`${neoSoul.bpm.default} BPM`));
  assert.equal(elementFor("#genreTempoRange").textContent, `${neoSoul.bpm.min}–${neoSoul.bpm.max} BPM`);
  assert.match(elementFor("#tempoPocketStatus").innerHTML, /IN POCKET/);
  assert.match(elementFor("#dnaGenre").textContent, /Neo Soul/);
  assert.match(elementFor("#dnaTempoDetail").textContent, /usual \d+–\d+/);
  assert.match(elementFor("#dnaHarmony").textContent, /\S/);
  assert.match(elementFor("#dnaRhythmCounts").textContent, /triplet.*snare-roll/);
  assert.match(elementFor("#dnaPalette").textContent, /\S/);
  assert.match(elementFor("#dnaArc").textContent, /Lift and release|Slow burn|Call and response|Pulse into bloom/);
  assert.match(elementFor("#dnaArc").textContent, /Phase 9 (passed|best-available)/);
  assert.match(elementFor("#dnaArc").textContent, /Phase 39 connected/);
  assert.match(elementFor("#dnaScoreBadge").title, /Voice leading.*Cadences.*Transitions.*Harmonic journey.*Performance.*Orchestration.*Musical memory.*Production/);
  assert.match(elementFor("#trackRack").innerHTML, /data-track="melody"/);
  assert.match(elementFor("#trackRack").innerHTML, /STYLE PICK|CUSTOM/);
  assert.match(elementFor("#timeline").innerHTML, /timeline-row/);
  assert.equal(elementFor("#threadSongName").textContent, elementFor("#songTitle").textContent);
  assert.equal(elementFor("#threadSectionName").textContent, "Full song");
  assert.equal(elementFor("#threadTrackName").textContent, "Drums");
  assert.equal(elementFor("#workflowProgress").textContent, "STEP 1 OF 4");
  assert.match(elementFor("#workflowCoachTitle").textContent, /musical direction/i);

  const initialGeneration = app.getAppStateSnapshot();
  elementFor("#generateNew").dispatch("click");
  elementFor("#generateNew").dispatch("click");
  assert.equal(app.getAppStateSnapshot().isGenerating, true);
  await new Promise((resolve) => setTimeout(resolve, 560));
  const freshGeneration = app.getAppStateSnapshot();
  assert.equal(freshGeneration.generationCount, initialGeneration.generationCount + 1, "rapid taps must commit exactly one generation");
  assert.notEqual(freshGeneration.song.seed, initialGeneration.song.seed, "New must advance to a fresh seed");
  assert.notEqual(freshGeneration.song.id, initialGeneration.song.id, "New must replace the arrangement");
  assert.notEqual(freshGeneration.song.oneShotKit.id, initialGeneration.song.oneShotKit.id, "New must load a different one-shot kit");
  assert.equal(freshGeneration.song.songBlueprint.version, 5, "New must commit the shared song blueprint");
  assert.equal(freshGeneration.song.meta.scoreDetails.criticVersion, 6, "New must be selected by genre-aware Critic 6.0");
  assert.equal(freshGeneration.song.generationInterlock.phase, 39, "New must connect every generation stage");
  assert.equal(freshGeneration.song.producerPass.phase, 9, "New must complete the phase 9 producer pass");

  elementFor("#generateSimilar").dispatch("click");
  await new Promise((resolve) => setTimeout(resolve, 560));
  const relatedGeneration = app.getAppStateSnapshot();
  assert.equal(relatedGeneration.generationCount, freshGeneration.generationCount + 1);
  assert.equal(relatedGeneration.song.revision, freshGeneration.song.revision + 1);
  assert.notEqual(relatedGeneration.song.oneShotKit.id, freshGeneration.song.oneShotKit.id, "Similar must load a different one-shot kit");
  assert.notEqual(relatedGeneration.song.seed, freshGeneration.song.seed, "Similar must advance the variation seed");
  assert.notDeepEqual(
    relatedGeneration.song.tracks.find((track) => track.id === "melody").notes,
    freshGeneration.song.tracks.find((track) => track.id === "melody").notes,
    "Similar must write a real melodic variation",
  );

  elementFor("#tripletControl").value = "73";
  elementFor("#rollControl").value = "41";
  elementFor("#evolutionControl").value = "77";
  elementFor("#surpriseControl").value = "64";
  elementFor("#tripletControl").dispatch("input");
  elementFor("#rollControl").dispatch("input");
  elementFor("#evolutionControl").dispatch("input");
  elementFor("#surpriseControl").dispatch("input");
  const rhythmConfig = app.buildConfig(0x12345678);
  assert.equal(rhythmConfig.tripletAmount, 0.73);
  assert.equal(rhythmConfig.rollAmount, 0.41);
  assert.equal(rhythmConfig.evolution, 0.77);
  assert.equal(rhythmConfig.surprise, 0.64);
  assert.match(elementFor("#tripletValue").textContent, /73%/);
  assert.match(elementFor("#rollValue").textContent, /41%/);
  assert.match(elementFor("#evolutionValue").textContent, /77%/);
  assert.match(elementFor("#surpriseValue").textContent, /64%/);
  for (const id of ["drums", "bass", "chords", "melody", "counterpoint", "pad"]) {
    const settings = rhythmConfig.trackControls[id];
    assert.ok(settings.volume >= 0 && settings.volume <= 1, `${id} volume must be normalized`);
    assert.ok(settings.velocity >= 0.1 && settings.velocity <= 1.5, `${id} velocity must be normalized`);
    assert.ok(settings.pan >= -1 && settings.pan <= 1, `${id} pan must be normalized`);
    assert.ok(settings.reverb >= 0 && settings.reverb <= 1, `${id} reverb must be normalized`);
    assert.ok(settings.cutoff >= 1000 && settings.cutoff <= 14000, `${id} cutoff must be normalized`);
    assert.ok(settings.resonance >= 0 && settings.resonance <= 1, `${id} resonance must be normalized`);
    assert.ok(settings.gate >= 0.08 && settings.gate <= 1.5, `${id} gate must be normalized`);
    assert.ok(settings.humanize >= 0 && settings.humanize <= 1, `${id} humanize must be normalized`);
    assert.ok(settings.feel >= 0 && settings.feel <= 1, `${id} feel must be normalized`);
  }

  assert.equal(app.getAppStateSnapshot().selectedTrack, "drums", "Drums should be the default attitude target");
  const contextSource = app.getAppStateSnapshot().song;
  const firstSection = (contextSource.structure || contextSource.sections)[0];
  assert.equal(app.focusSongSection(firstSection.id, "drums", { openEditor: true }), true);
  assert.equal(app.getAppStateSnapshot().focusedSection, firstSection.id);
  assert.equal(app.getAppStateSnapshot().editorTrack, "drums");
  assert.equal(elementFor("#threadSectionName").textContent.toLowerCase(), firstSection.name.toLowerCase());
  assert.equal(elementFor("#threadTrackName").textContent, "Drums");
  assert.equal(elementFor("#sectionEditor").getAttribute("aria-hidden"), "false");
  assert.match(elementFor("#sectionEditorTitle").textContent, new RegExp(firstSection.name, "i"));
  assert.match(elementFor("#pianoRollGrid").innerHTML, /data-editor-note=/, "focused section must reveal real editable MIDI notes");
  assert.match(elementFor("#editorGuideChord").textContent, /\S/, "the focused editor must name its active harmony");
  assert.match(elementFor("#editorRelationshipSummary").innerHTML, /SHARED ATTACKS/, "the focused editor must summarize its instrument relationship");
  assert.equal(app.nearestScalePitch(61, { scalePitchClasses: [0, 2, 4, 5, 7, 9, 11] }), 60);
  assert.equal(app.transposeScaleStep(60, 1, { scalePitchClasses: [0, 2, 4, 5, 7, 9, 11] }), 62);
  const beforePianoDelete = app.getAppStateSnapshot().song;
  const drumCountBeforeDelete = beforePianoDelete.tracks.find((track) => track.id === "drums").notes.length;
  assert.equal(app.applyEditorAction("select-all"), true);
  assert.equal(app.applyEditorAction("delete"), true);
  assert.ok(app.getAppStateSnapshot().song.tracks.find((track) => track.id === "drums").notes.length < drumCountBeforeDelete);
  elementFor("#undoButton").dispatch("click");
  assert.deepEqual(app.getAppStateSnapshot().song, beforePianoDelete, "Undo must restore a destructive piano-roll edit exactly");
  elementFor("#redoButton").dispatch("click");
  assert.ok(app.getAppStateSnapshot().song.tracks.find((track) => track.id === "drums").notes.length < drumCountBeforeDelete, "Redo must reapply the destructive piano-roll edit exactly");
  elementFor("#undoButton").dispatch("click");
  assert.deepEqual(app.getAppStateSnapshot().song, beforePianoDelete, "Undo must remain available after Redo");
  elementFor("#editorCloseButton").dispatch("click");
  assert.equal(elementFor("#sectionEditor").getAttribute("aria-hidden"), "true");
  const partnerIds = {
    drums: "bass",
    bass: "drums",
    melody: "counterpoint",
    counterpoint: "melody",
  };
  for (const [targetId, partnerId] of Object.entries(partnerIds)) {
    const originalPartner = contextSource.tracks.find((track) => track.id === partnerId);
    const context = app.contextTracksForReroll(targetId, contextSource);
    assert.strictEqual(context[partnerId], originalPartner, `${targetId} must receive the retained original ${partnerId} object`);
    const input = app.buildTrackRerollInput(targetId, contextSource, 0xabc123);
    assert.equal(input.targetTrack, targetId);
    assert.deepEqual(Object.keys(input.tracks), [targetId], "reroll input must include only the selected track controls");
    assert.strictEqual(input.contextTracks[partnerId], originalPartner, "the exact retained partner must be passed to generateSimilar");
    for (const stagedGlobal of ["genre", "key", "bars", "tempo", "mode"]) {
      assert.equal(stagedGlobal in input, false, `reroll input must not override original ${stagedGlobal}`);
    }
  }
  assert.equal(app.contextTracksForReroll("pad", contextSource), undefined);
  assert.equal(app.selectAttitudeTrack("bass"), true);
  assert.equal(elementFor("#attitudeTargetName").textContent, "Bass");
  assert.equal(elementFor("#threadTrackName").textContent, "Bass");
  assert.equal(app.getAppStateSnapshot().editorTrack, "bass", "instrument and piano-roll focus must stay intertwined");
  assert.equal(app.selectAttitudeTrack("drums"), true);
  const beforePower = app.getAppStateSnapshot();
  const unselectedBefore = Object.fromEntries(beforePower.song.tracks
    .filter((track) => track.id !== "drums")
    .map((track) => [track.id, track]));
  await app.applyTrackAttitude("power");
  assert.equal(elementFor("#workflowProgress").textContent, "STEP 4 OF 4");
  const afterPower = app.getAppStateSnapshot();
  assert.equal(afterPower.selectedTrack, "drums");
  assert.equal(afterPower.trackSettings.drums.attitude, "power");
  assert.equal(afterPower.trackSettings.drums.program, beforePower.trackSettings.drums.program, "Attitude must not swap the selected sound");
  assert.ok(afterPower.trackSettings.drums.velocity > beforePower.trackSettings.drums.velocity, "Power must make drums hit harder");
  assert.ok(afterPower.trackSettings.drums.density > beforePower.trackSettings.drums.density, "Power must make drums more dominant");
  for (const id of ["bass", "chords", "melody", "counterpoint", "pad"]) {
    assert.deepEqual(afterPower.trackSettings[id], beforePower.trackSettings[id], `Power must not change ${id} controls`);
    assert.deepEqual(afterPower.song.tracks.find((track) => track.id === id), unselectedBefore[id], `Power reroll must preserve ${id} byte-for-byte`);
  }
  const poweredDrums = afterPower.song.tracks.find((track) => track.id === "drums");
  assert.equal(poweredDrums.settings.attitude, "power");
  assert.ok(Array.isArray(poweredDrums.automation) && poweredDrums.automation.length > 0, "Selected-track reroll must preserve generated automation");
  assert.match(elementFor("#attitudeStatus").textContent, /rest of the band stayed untouched/i);
  elementFor("#undoButton").dispatch("click");
  const afterPowerUndo = app.getAppStateSnapshot();
  assert.deepEqual(afterPowerUndo.trackSettings, beforePower.trackSettings, "One Undo must restore pre-attitude track controls");
  assert.deepEqual(afterPowerUndo.song, beforePower.song, "One Undo must restore the pre-attitude notes");
  assert.equal(afterPowerUndo.selectedTrack, "drums");
  assert.match(elementFor("#toast").textContent, /previous idea/i);

  elementFor("#genreControl").value = "synthwave";
  elementFor("#keyControl").value = "B";
  elementFor("#barsControl").value = "64";
  const beforeContextualBass = app.getAppStateSnapshot();
  const originalTotalBeats = beforeContextualBass.song.meta.totalBeats;
  app.selectAttitudeTrack("bass");
  await app.applyTrackAttitude("motion");
  const afterContextualBass = app.getAppStateSnapshot();
  assert.equal(afterContextualBass.song.meta.totalBeats, originalTotalBeats, "a reroll must retain the original song length");
  assert.equal(afterContextualBass.song.bars, beforeContextualBass.song.bars, "staged bars must not leak into a track reroll");
  assert.equal(afterContextualBass.song.key, beforeContextualBass.song.key, "staged key must not leak into a track reroll");
  assert.equal(afterContextualBass.song.idea.genreId, beforeContextualBass.song.idea.genreId, "staged genre must not leak into a track reroll");
  for (const track of afterContextualBass.song.tracks) {
    if (track.id !== "bass") {
      assert.deepEqual(
        track,
        beforeContextualBass.song.tracks.find((candidate) => candidate.id === track.id),
        `contextual bass reroll must preserve ${track.id} byte-for-byte`,
      );
    }
  }
  for (const note of afterContextualBass.song.tracks.find((track) => track.id === "bass").notes) {
    assert.ok(note.start >= 0 && note.start + note.duration <= originalTotalBeats + 1e-7, "rerolled bass notes must stay inside original song bounds");
  }
  elementFor("#undoButton").dispatch("click");
  assert.deepEqual(app.getAppStateSnapshot().song, beforeContextualBass.song, "Undo must restore the song after a contextual reroll");

  assert.equal(app.totalSeconds({ bpm: 120, bars: 4, meta: { totalBeats: 12 } }), 6, "3/4 duration must use total beats");
  assert.equal(app.totalSeconds({ bpm: 120, bars: 4, meta: { timeSignature: [6, 8] } }), 6, "6/8 duration must use three quarter-note beats per bar");

  const automation = [
    { type: "cc", controller: 11, beat: 0, value: 127 },
    { type: "cc", controller: 11, beat: 8, value: 32 },
  ];
  assert.equal(app.expressionAtBeat(automation, 4), 79.5, "CC11 must interpolate linearly between expression points");
  const fadeEvents = app.buildPreviewEvents({
    bpm: 120,
    tracks: [{
      id: "pad",
      program: 89,
      settings: { volume: 1, velocity: 0.68, pan: 0.25, reverb: 0.8, gate: 1 },
      automation,
      notes: [
        { pitch: 60, start: 0, duration: 8, velocity: 100 },
        { pitch: 64, start: 4, duration: 2, velocity: 100 },
      ],
    }],
  }, { muted: [], solo: [], trackSettings: {} });
  assert.equal(fadeEvents.length, 2, "CC11 automation must not be scheduled as notes");
  assert.equal(fadeEvents[0].expressionStart, 1);
  assert.equal(fadeEvents[0].expressionEnd, 32 / 127);
  assert.ok(fadeEvents[1].expressionEnd < fadeEvents[1].expressionStart, "Sustained preview notes must carry their end-expression fade");
  assert.ok(fadeEvents[1].velocity < fadeEvents[0].velocity, "Later notes must audibly follow the expression fade");
  const spotlightEvents = app.buildPreviewEvents({
    bpm: 120,
    characteristicVoice: { trackId: "bass" },
    tracks: [
      { id: "bass", settings: { volume: 0.5, cutoff: 4000, reverb: 0.2 }, notes: [{ pitch: 36, start: 0, duration: 1, velocity: 90 }] },
      { id: "chords", settings: { volume: 0.5, cutoff: 4000, reverb: 0.2 }, notes: [{ pitch: 60, start: 0, duration: 1, velocity: 90 }] },
    ],
  }, { muted: [], solo: [], trackSettings: {} });
  const spotlightBass = spotlightEvents.find((event) => event.id === "bass");
  const supportingChords = spotlightEvents.find((event) => event.id === "chords");
  assert.equal(spotlightBass.spotlight, true);
  assert.equal(supportingChords.spotlight, false);
  assert.ok(spotlightBass.mixGain > supportingChords.mixGain);
  assert.ok(spotlightBass.cutoff > supportingChords.cutoff);
  const dipRestoreAutomation = [
    { type: "cc", controller: 11, beat: 0, value: 127 },
    { type: "cc", controller: 11, beat: 2, value: 30 },
    { type: "cc", controller: 11, beat: 4, value: 127 },
    { type: "cc", controller: 11, beat: 8, value: 127 },
  ];
  const [dipRestoreEvent] = app.buildPreviewEvents({
    bpm: 120,
    tracks: [{
      id: "pad",
      program: 89,
      settings: { volume: 1, velocity: 0.68, gate: 1 },
      automation: dipRestoreAutomation,
      notes: [{ pitch: 60, start: 0, duration: 8, velocity: 100 }],
    }],
  }, { muted: [], solo: [], trackSettings: {} });
  assert.equal(dipRestoreEvent.expressionStart, 1);
  assert.equal(dipRestoreEvent.expressionEnd, 1, "dip+restore endpoints intentionally match");
  assert.deepEqual(
    dipRestoreEvent.expressionCurve.map((point) => [point.beat, point.value]),
    [[0, 1], [2, 30 / 127], [4, 1], [8, 1]],
    "preview must retain interior CC11 dips and restores inside one sustained note",
  );

  elementFor("#genreControl").value = "trap";
  elementFor("#genreControl").dispatch("change");
  assert.equal(Number(elementFor("#tempoControl").value), GENRE_PROFILES.trap.bpm.default);
  assert.equal(Number(elementFor("#swingControl").value), Math.round(GENRE_PROFILES.trap.swing * 100));
  assert.equal(Number(elementFor("#humanizeControl").value), Math.round(GENRE_PROFILES.trap.humanize * 100));
  assert.equal(Number(elementFor("#tripletControl").value), Math.round(GENRE_PROFILES.trap.tripletChance * 100));
  assert.equal(Number(elementFor("#rollControl").value), Math.round(GENRE_PROFILES.trap.snareRollChance * 100));
  assert.match(elementFor("#genreTempoRange").textContent, new RegExp(`${GENRE_PROFILES.trap.bpm.min}.*${GENRE_PROFILES.trap.bpm.max}`));
  assert.match(elementFor("#tempoPocketStatus").innerHTML, /IN POCKET/);
  assert.match(elementFor("#factGenre").textContent, /NEO SOUL/, "staging a new genre must not relabel the current song");
  assert.match(elementFor("#factTempo").textContent, new RegExp(`${neoSoul.bpm.default} BPM`), "staging a genre must not retime the current song");

  const selectedPrograms = (markup) => Object.fromEntries([...markup.matchAll(/<article[^>]+data-track="([^"]+)"[\s\S]*?<select[^>]*>[\s\S]*?<option value="(\d+)" selected/g)]
    .map((match) => [match[1], Number(match[2])]));
  const previousPrograms = selectedPrograms(elementFor("#trackRack").innerHTML);
  elementFor("#generateNew").dispatch("click");
  await new Promise((resolve) => setTimeout(resolve, 520));
  const newPrograms = selectedPrograms(elementFor("#trackRack").innerHTML);
  assert.equal(Object.keys(newPrograms).length, 6);
  for (const id of Object.keys(newPrograms)) {
    assert.notEqual(newPrograms[id], previousPrograms[id], `New Idea should change ${id}'s sound`);
    assert.notEqual(
      app.previewVoice(id, newPrograms[id]).character,
      app.previewVoice(id, previousPrograms[id]).character,
      `New Idea should change ${id}'s audible character`,
    );
  }

  elementFor("#generateSimilar").dispatch("click");
  await new Promise((resolve) => setTimeout(resolve, 520));
  const similarPrograms = selectedPrograms(elementFor("#trackRack").innerHTML);
  assert.deepEqual(similarPrograms, newPrograms, "More Like This must preserve every instrument program");
  assert.equal(Number(elementFor("#tripletControl").value), Math.round(GENRE_PROFILES.trap.tripletChance * 100));
  assert.equal(Number(elementFor("#rollControl").value), Math.round(GENRE_PROFILES.trap.snareRollChance * 100));

  elementFor("#tripletControl").value = "0";
  elementFor("#rollControl").value = "0";
  elementFor("#undoButton").dispatch("click");
  assert.equal(Number(elementFor("#tripletControl").value), Math.round(GENRE_PROFILES.trap.tripletChance * 100), "Undo must restore generated triplet intent");
  assert.equal(Number(elementFor("#rollControl").value), Math.round(GENRE_PROFILES.trap.snareRollChance * 100), "Undo must restore generated roll intent");

  elementFor("#resetControlsButton").dispatch("click");
  assert.equal(Number(elementFor("#tripletControl").value), Math.round(neoSoul.tripletChance * 100));
  assert.equal(Number(elementFor("#rollControl").value), Math.round(neoSoul.snareRollChance * 100));
  assert.equal(elementFor("#chordPathControl").value, "auto", "Reset must keep chord path in AUTO mode");

  assert.equal(app.saveSessionNow(), true, "a valid song session must save locally on demand");
  const savedSession = JSON.parse(storedValues.get("midi-arcade/session-v2"));
  assert.equal(savedSession.schema, 2);
  assert.ok(savedSession.autoControls.includes("chordPathControl"), "Reset must persist chord path auto selection");
  assert.deepEqual(savedSession.song, app.getAppStateSnapshot().song);
  const restoredApp = await import(`../src/app.js?restore=${Date.now()}`);
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.deepEqual(restoredApp.getAppStateSnapshot().song, savedSession.song, "a fresh app boot must restore the autosaved song");

  const damagedSession = structuredClone(savedSession);
  damagedSession.song.sections = [null];
  damagedSession.song.structure = [null];
  storedValues.set("midi-arcade/session-v2", JSON.stringify(damagedSession));
  const recoveredApp = await import(`../src/app.js?damaged-restore=${Date.now()}`);
  await new Promise((resolve) => setTimeout(resolve, 40));
  const recoveredSong = recoveredApp.getAppStateSnapshot().song;
  assert.equal(recoveredSong.tracks.length, 6, "a damaged session must be replaced with a complete song in the same launch");
  assert.ok(recoveredSong.tracks.every((track) => track && Array.isArray(track.notes)));
  const postRecoverySession = storedValues.get("midi-arcade/session-v2");
  if (postRecoverySession) {
    const recoveredSave = JSON.parse(postRecoverySession);
    assert.ok(
      Array.isArray(recoveredSave.song?.sections)
        && recoveredSave.song.sections.every((section) => section && typeof section === "object"),
      "a concurrent autosave may persist only a healthy replacement, never the rejected session",
    );
  }
  assert.match(elementFor("#toast").textContent, /damaged saved session.*fresh idea/i);

  const nativeCalls = [];
  globalThis.Capacitor = {
    Plugins: {
      Filesystem: {
        async writeFile(options) {
          nativeCalls.push(["write", options]);
          return { uri: "content://midi-arcade/export.mid" };
        },
      },
      Share: {
        async share(options) { nativeCalls.push(["share", options]); },
      },
    },
  };
  await app.exportSongNative(new Uint8Array([1, 2, 3]), "live-take.mid");
  assert.equal(nativeCalls[0][1].path, "midi-exports/live-take.mid");
  assert.equal(nativeCalls[0][1].directory, "CACHE");
  assert.equal(nativeCalls[0][1].data, "AQID");
  assert.equal(nativeCalls[1][1].url, "content://midi-arcade/export.mid");

  let webviewAnchorClicks = 0;
  const originalCreateElement = globalThis.document.createElement;
  const originalConsoleError = console.error;
  globalThis.document.createElement = () => {
    const element = new MockElement();
    element.click = () => { webviewAnchorClicks += 1; };
    return element;
  };
  globalThis.Capacitor = {
    isNativePlatform: () => true,
    Plugins: {
      Filesystem: {
        async writeFile() { return { uri: "content://midi-arcade/canceled.mid" }; },
      },
      Share: {
        async share() { throw new Error("Share canceled"); },
      },
    },
  };
  console.error = () => {};
  try {
    elementFor("#exportButton").dispatch("click");
    await new Promise((resolve) => setTimeout(resolve, 25));
  } finally {
    globalThis.document.createElement = originalCreateElement;
    console.error = originalConsoleError;
  }
  assert.equal(webviewAnchorClicks, 0, "canceling Android Share must not attempt a WebView anchor download");
  assert.match(elementFor("#toast").textContent, /export canceled.*no file was shared/i);
  assert.doesNotMatch(elementFor("#toast").textContent, /^Exported\b/i);
});
