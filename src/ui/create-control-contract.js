const entry = (label, help, intent, event = "change") => Object.freeze({ label, help, intent, event });
const selectorEntry = (key, selector, label, help, intent, event = "click") => Object.freeze({ key, selector, label, help, intent, event });

export const CREATE_CONTROL_CONTRACT = Object.freeze({
  renameButton: entry("Rename song", "Changes only the song title. Notes, sounds, arrangement and Element identity stay untouched.", "current-song", "click"),
  showcasePlayButton: entry("Play current song", "Starts or pauses the same full-song transport used everywhere else in MIDI Arcade.", "current-song", "click"),
  showcaseSimilarButton: entry("Create related Element family", "Builds Fire, Electric and Drip from the current song DNA without changing the reference until a variation is chosen.", "current-song", "click"),
  tasteRating: entry("Teach Producer Brain", "Your reaction gently biases future Auto decisions. It never rewrites the song you are hearing.", "learning"),
  guidedModeButton: entry("Guided mode", "Shows or hides the four-step coach. Music controls and the song remain unchanged.", "guidance", "click"),
  workflowAction: entry("Recommended next action", "Runs the workflow coach's safest next step for the current stage of the song.", "guidance", "click"),
  resetControlsButton: entry("Reset song direction", "Restores beginner-friendly generation controls. The current song stays untouched until you generate again.", "direction", "click"),
  artistModeButton: entry("Advanced controls", "Reveals deeper direction controls without changing any value by itself.", "direction", "click"),
  genreControl: entry("Genre", "Sets the composition grammar: tempo pocket, rhythm vocabulary, harmony behavior, arrangement rules and instrument palette.", "direction"),
  secondaryGenreControl: entry("Fusion partner", "Blends a second genre into the primary writing rules while keeping one coherent song identity.", "direction"),
  tempoControl: entry("Tempo", "Sets the speed of the next generation in BPM. Manual tempo overrides Auto until you return it to Auto.", "essentials", "input"),
  energyControl: entry("Energy", "Controls intensity, hit strength, rhythmic activity and how strongly sections lift.", "essentials", "input"),
  complexityControl: entry("Complexity", "Controls harmonic richness, phrase detail and how busy the arrangement is allowed to become.", "essentials", "input"),
  barsControl: entry("Song length", "Chooses the arrangement length. Auto lets Producer Brain pick an appropriate form length.", "essentials"),
  grooveControl: entry("Groove feel", "Chooses the timing pocket for the next generation: straight, laid back, shuffled, syncopated or Auto.", "essentials"),
  keyControl: entry("Root key", "Sets the tonal center of the next generation. Auto lets the genre and song direction choose it.", "advanced"),
  keyTransposeDown: entry("Transpose key down", "Moves the selected root key down one semitone without changing the mode.", "advanced", "click"),
  keyTransposeUp: entry("Transpose key up", "Moves the selected root key up one semitone without changing the mode.", "advanced", "click"),
  modeControl: entry("Mode / scale", "Sets the pitch collection and tonal color used by harmony, bass, melody and counterpoint.", "advanced"),
  chordPathControl: entry("Harmonic path", "Chooses a chord-motion family for the next composition. Auto follows the selected genre and mood.", "advanced"),
  newRecipeButton: entry("Load another recipe", "Loads a curated combination of mood, groove, energy and complexity. Generate afterward to hear it.", "advanced", "click"),
  swingControl: entry("Swing", "Offsets selected subdivisions for bounce while keeping the song on-grid and export-safe.", "advanced", "input"),
  humanizeControl: entry("Humanize", "Adds bounded timing and velocity variation so performances feel less mechanical.", "advanced", "input"),
  tripletControl: entry("Triplet spice", "Controls how often genre-safe triplet phrases may appear where the groove has room.", "advanced", "input"),
  rollControl: entry("Transition rolls", "Controls drum-roll activity near real phrase and section boundaries.", "advanced", "input"),
  variationControl: entry("Variation", "Controls how much internal phrase and pattern variety Producer Brain may introduce.", "advanced", "input"),
  evolutionControl: entry("Phrase evolution", "Controls how strongly motifs, dynamics and patterns develop over the course of the song.", "advanced", "input"),
  surpriseControl: entry("Surprise", "Allows less-common but genre-compatible musical decisions without abandoning the selected direction.", "advanced", "input"),
  generateNew: entry("Generate new song", "Composes a completely new arrangement from the staged Create settings while leaving those settings selected.", "generate", "click"),
  generateSimilar: entry("Create Fire / Electric / Drip", "Creates three related songs from one DNA: Fire for impact, Electric for motion and Drip for space.", "generate", "click"),
});

export const CREATE_CONTROL_IDS = Object.freeze(Object.keys(CREATE_CONTROL_CONTRACT));

export const CREATE_SELECTOR_CONTRACT = Object.freeze([
  selectorEntry("workflow-step-direct", '[data-workflow-step="1"]', "Workflow step: Direct", "Returns the Create coach to direction-setting so you can choose the musical intent before generating.", "guidance"),
  selectorEntry("workflow-step-listen", '[data-workflow-step="2"]', "Workflow step: Listen", "Moves the Create coach to listening so you can evaluate the generated song before making edits.", "guidance"),
  selectorEntry("workflow-step-shape", '[data-workflow-step="3"]', "Workflow step: Shape", "Moves the workflow toward Shape, where section and instrument-level musical decisions are edited.", "guidance"),
  selectorEntry("workflow-step-export", '[data-workflow-step="4"]', "Workflow step: Export", "Moves the workflow toward Finish so the completed arrangement can be checked and exported as MIDI.", "guidance"),
  selectorEntry("song-insight-toggle", ".dna-integrated-card > summary", "Song insight", "Opens or closes the generated song DNA, harmony, groove and structural analysis without changing the music.", "current-song"),
  selectorEntry("workflow-guide-toggle", "#workflowPanel > summary", "Optional workflow guide", "Opens or closes the four-step Create guide. It changes only guidance visibility, never the song or staged direction.", "guidance"),
  selectorEntry("song-shape-toggle", ".shape-controls > summary", "Key, mode and harmony controls", "Opens or closes optional tonal controls for root key, scale and harmonic path without changing values by itself.", "advanced"),
  selectorEntry("recipe-toggle", ".creator-recipe-side > summary", "Recipe and fine tuning", "Opens or closes the optional recipe and performance-tuning area without changing the staged song direction.", "advanced"),
  selectorEntry("fine-tune-toggle", ".advanced-controls > summary", "Rhythm and variety fine tuning", "Opens or closes detailed swing, humanize, triplet, roll, variation, evolution and surprise controls.", "advanced"),
]);

const CREATE_CONTEXT_CONTRACT = Object.freeze({
  ...CREATE_CONTROL_CONTRACT,
  ...Object.fromEntries(CREATE_SELECTOR_CONTRACT.map((contract) => [contract.key, contract])),
});

const ELEMENT_HELP = Object.freeze([
  Object.freeze(["Fire", "Choose the impact-first sibling: stronger groove pressure, punch, density and transitions while keeping the shared song DNA."]),
  Object.freeze(["Electric", "Choose the motion-first sibling: more hook movement, syncopation, variation and animated phrasing while keeping the shared song DNA."]),
  Object.freeze(["Drip", "Choose the space-first sibling: more harmonic breathing room, flow and restrained rhythmic density while keeping the shared song DNA."]),
]);

export function createControlHelp(element) {
  if (!element) return null;
  const contractKey = String(element.dataset?.createControl || element.id || "");
  if (contractKey && CREATE_CONTEXT_CONTRACT[contractKey]) {
    const { label, help } = CREATE_CONTEXT_CONTRACT[contractKey];
    return [label, help];
  }
  if (element.dataset?.songVariation != null) {
    const index = Number(element.dataset.songVariation);
    return ELEMENT_HELP[index] ?? ["Element variation", "Choose one production personality from the current three-song family."];
  }
  return null;
}

function closestInteractive(target) {
  return target?.closest?.("button, input, select, summary") ?? target;
}

function setContextHelp(rootDocument, element) {
  const help = createControlHelp(element);
  if (!help) return false;
  const title = rootDocument?.querySelector?.("#contextHelpTitle");
  const text = rootDocument?.querySelector?.("#contextHelpText");
  if (title) title.textContent = help[0];
  if (text) text.textContent = help[1];
  return true;
}

function wireControl(control, key, contract) {
  if (!control) return false;
  control.dataset.createControl = key;
  control.dataset.createIntent = contract.intent;
  control.dataset.createEvent = contract.event;
  control.setAttribute?.("aria-description", contract.help);
  if (!control.getAttribute?.("aria-label")) control.setAttribute?.("aria-label", contract.label);
  if (!control.getAttribute?.("title")) control.setAttribute?.("title", contract.help);
  return true;
}

export function applyCreateControlContract(rootDocument = globalThis.document, createPanel = null) {
  const panel = createPanel ?? rootDocument?.querySelector?.("#tab-create");
  if (!panel?.querySelector || !panel?.querySelectorAll) return false;

  let wired = 0;
  for (const [id, contract] of Object.entries(CREATE_CONTROL_CONTRACT)) {
    const control = panel.querySelector(`#${id}`);
    if (wireControl(control, id, contract)) wired += 1;
  }

  for (const contract of CREATE_SELECTOR_CONTRACT) {
    for (const control of panel.querySelectorAll(contract.selector)) {
      if (wireControl(control, contract.key, contract)) wired += 1;
    }
  }

  for (const button of panel.querySelectorAll("[data-song-variation]")) {
    const help = createControlHelp(button);
    if (!help) continue;
    button.dataset.createControl = `element-${button.dataset.songVariation}`;
    button.dataset.createIntent = "element";
    button.dataset.createEvent = "click";
    button.setAttribute?.("aria-label", `${help[0]} Element variation`);
    button.setAttribute?.("aria-description", help[1]);
    button.setAttribute?.("title", help[1]);
    wired += 1;
  }

  if (panel.dataset.createContractWired !== "true" && typeof panel.addEventListener === "function") {
    const refresh = (event) => {
      const control = closestInteractive(event.target);
      if (!setContextHelp(rootDocument, control)) return;
      const id = control?.dataset?.createControl || control?.id || (control?.dataset?.songVariation != null ? `element-${control.dataset.songVariation}` : "delegated");
      panel.dataset.createLastControl = id;
    };
    for (const eventName of ["focusin", "pointerover", "input", "change", "click"]) {
      panel.addEventListener(eventName, refresh);
    }
    panel.dataset.createContractWired = "true";
  }

  panel.dataset.createContractCount = String(wired);
  return wired > 0;
}
