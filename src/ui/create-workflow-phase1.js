import { applyCreateControlContract } from "./create-control-contract.js";
import "./create-shape-bridge.js";

function setCopy(rootDocument, selector, text) {
  const element = rootDocument?.querySelector?.(selector);
  if (element) element.textContent = text;
}

function setActionCopy(createPanel, selector, { eyebrow, title, detail }) {
  const action = createPanel.querySelector(selector);
  if (!action) return;
  const small = action.querySelector("small");
  const strong = action.querySelector("strong");
  const em = action.querySelector("em");
  if (small && eyebrow) small.textContent = eyebrow;
  if (strong && title) strong.textContent = title;
  if (em && detail) em.textContent = detail;
}

function updateCreatePath(createPanel) {
  const items = [...createPanel.querySelectorAll(".home-path li")];
  const steps = [
    ["Listen", "Hear the current song before changing it"],
    ["Direct", "Stage only the musical choices you care about"],
    ["Generate", "Let Producer Brain compose the next result"],
  ];
  items.forEach((item, index) => {
    const [title, detail] = steps[index] ?? [];
    if (!title) return;
    const strong = item.querySelector("strong");
    const small = item.querySelector("small");
    if (strong) strong.textContent = title;
    if (small) small.textContent = detail;
  });
}

function upgradeWorkflowCopy(createPanel) {
  const disclosure = createPanel.querySelector("#workflowPanel .workflow-disclosure");
  const summaryStrong = disclosure?.querySelector("strong");
  const summaryAction = disclosure?.querySelector(":scope > span:last-child");
  if (summaryStrong) summaryStrong.textContent = "From first idea to export-ready MIDI";
  if (summaryAction) summaryAction.textContent = "Open guided path";
  setCopy(createPanel.ownerDocument, "#workflowPanelTitle", "A producer-guided path through Create, Shape and export");

  const coachTitle = createPanel.querySelector("#workflowCoachTitle");
  const coachText = createPanel.querySelector("#workflowCoachText");
  if (coachTitle) coachTitle.textContent = "Choose the direction, then listen before editing";
  if (coachText) coachText.textContent = "Leave anything uncertain on Auto. Manual choices become authoritative only when you make them.";
}

function mountCreativeRangeControl(rootDocument, createPanel) {
  const generationActions = createPanel.querySelector("#preGenSection .generation-actions-bar");
  if (!generationActions || createPanel.querySelector("#creativeRangeControl") || typeof rootDocument?.createElement !== "function") return false;

  const label = rootDocument.createElement("label");
  label.className = "select-control generation-envelope-select creative-range-control";
  label.innerHTML = `
    <span>CREATIVE RANGE <small>VARIETY ENVELOPE</small></span>
    <select id="creativeRangeControl" aria-label="Creative range">
      <option value="" selected>Default · existing behavior</option>
      <option value="familiar">Familiar · stay close</option>
      <option value="fresh">Fresh · balanced ideas</option>
      <option value="wild">Wild · explore safely</option>
    </select>
    <small>Widens how boldly harmony, rhythm and instrument color can vary while key, scale and quality gates stay authoritative.</small>
  `;
  generationActions.insertAdjacentElement("beforebegin", label);
  return true;
}

function mountPerformanceKnobs(rootDocument, createPanel) {
  const controls = createPanel.querySelector(".create-live-controls");
  if (!controls || controls.querySelector("#syncopationControl") || typeof rootDocument?.createElement !== "function") return;
  const knobs = [
    ["syncopationControl", "syncopationValue", "SYNCOPATION", "Straight to playful offbeat movement", 50],
    ["drumFillsControl", "drumFillsValue", "DRUM FILLS", "Sparse to active phrase-ending fills", 50],
  ];
  for (const [id, outputId, label, hint, value] of knobs) {
    const knob = rootDocument.createElement("label");
    knob.className = "create-live-control create-expression-knob";
    knob.innerHTML = `<span><b>${label}</b><output id="${outputId}">${value}%</output></span>
      <input id="${id}" type="range" min="0" max="100" value="${value}" aria-label="${label.toLowerCase()} percentage" />
      <small>${hint} · Auto preserves your genre's original behavior</small>`;
    controls.append(knob);
  }
}

function moveGenerationEssentials(rootDocument, createPanel) {
  const controls = createPanel.querySelector(".create-live-controls");
  const slot = createPanel.querySelector(".create-showcase-slot");
  if (!controls || !slot || createPanel.querySelector(".create-performance-deck") || typeof rootDocument?.createElement !== "function") return;
  const deck = rootDocument.createElement("section");
  deck.className = "create-performance-deck panel";
  deck.setAttribute("aria-labelledby", "directionEssentialsTitle");
  deck.innerHTML = `<div class="create-performance-heading">
    <div><p class="eyebrow">YOUR SOUND, YOUR CONTROL</p>
      <h2 id="directionEssentialsTitle">Shape the next take</h2>
      <p class="create-deck-hint">Tune your next song. Manual Tempo may update current playback.</p>
    </div><span class="create-deck-state" role="status" aria-live="polite">DIRECTION READY</span>
  </div>`;
  controls.setAttribute("aria-label", "Generation essentials");
  controls.setAttribute("aria-labelledby", "directionEssentialsTitle");
  const selectLabels = controls.querySelectorAll(".create-live-select > span");
  if (selectLabels[0]) selectLabels[0].textContent = "ARRANGEMENT LENGTH";
  if (selectLabels[1]) selectLabels[1].textContent = "GROOVE FEEL";
  deck.append(controls);
  // Follow the song card directly: no tutorial, recipe or promotional card in between.
  slot.insertAdjacentElement("afterend", deck);
}

function organizePrimaryDirection(rootDocument, createPanel) {
  const genre = createPanel.querySelector(".genre-direction");
  const controls = createPanel.querySelector(".create-live-controls");
  if (!genre || !controls || controls.querySelector('[data-create-stage="feel"]') || typeof rootDocument?.createElement !== "function") return;
  const heading = (id, label, copy) => {
    const element = rootDocument.createElement("div");
    element.className = "direction-essentials-heading section-heading create-stage-heading";
    element.dataset.createStage = id;
    element.innerHTML = `<div><p class="eyebrow">${label}</p><h3>${copy}</h3></div>`;
    return element;
  };
  genre.insertAdjacentElement("afterbegin", heading("song", "SONG", "Choose the musical world"));
  const find = (id) => createPanel.querySelector(`#${id}`)?.closest?.("label");
  const rhythmDetails = createPanel.querySelector(".advanced-controls .details-content");
  // Move existing live engine controls rather than cloning IDs or inventing a
  // parallel set of values. Hidden advanced settings retain their own controls.
  const core = ["tempoControl", "energyControl", "complexityControl", "variationControl", "evolutionControl"].map(find).filter(Boolean);
  const feel = ["swingControl", "humanizeControl", "syncopationControl", "drumFillsControl"].map(find).filter(Boolean);
  const form = ["grooveControl", "barsControl"].map(find).filter(Boolean);
  controls.append(
    heading("feel", "CREATIVE FLOW", "Tempo · impact · detail · development"), ...core,
    heading("rhythm", "RHYTHM & DYNAMICS", "Pocket, timing and drum conversation"), ...feel,
    heading("structure", "SONG SHAPE", "Groove and arrangement length"), ...form,
  );
  // The advanced drawer now contains only genuinely secondary options.
  if (rhythmDetails) rhythmDetails.dataset.primaryKnobsMoved = "true";
}

/**
 * Put every existing producer control on one surface beneath the song card.
 * Move live nodes (do NOT clone inputs: IDs, event listeners, Auto state, and
 * session persistence continue to use their original DOM elements).
 * Avoid nested <details> so Root Key / Mode / Harmonic Path are visible.
 */
function consolidateCreateSurface(rootDocument, createPanel) {
  const deck = createPanel.querySelector(".create-performance-deck");
  const creator = createPanel.querySelector("#preGenSection");
  const creatorGrid = creator?.querySelector(".creator-grid");
  const shapeControls = creator?.querySelector(".shape-controls");
  const recipeControls = creator?.querySelector(".creator-recipe-side");
  if (!deck || !creator || !creatorGrid || !shapeControls || !recipeControls) return false;
  if (creator.parentElement === deck) return true;
  if (typeof rootDocument?.createElement !== "function") return false;

  const harmony = rootDocument.createElement("section");
  harmony.className = "create-harmony-inline";
  harmony.setAttribute("aria-label", "Key, mode and harmonic path");
  harmony.innerHTML = '<div class="create-inline-heading"><strong>HARMONY</strong><span>Key · mode · chord direction</span></div>';
  const harmonyBody = shapeControls.querySelector(".shape-controls-body");
  if (harmonyBody) {
    while (harmonyBody.firstChild) harmony.append(harmonyBody.firstChild);
  }
  shapeControls.replaceWith(harmony);

  const recipe = rootDocument.createElement("section");
  recipe.className = "create-recipe-inline";
  recipe.setAttribute("aria-label", "Creative recipe and fine tuning");
  const recipeCard = recipeControls.querySelector(".recipe-card");
  const rhythm = recipeControls.querySelector(".advanced-controls .details-content");
  if (recipeCard) recipe.append(recipeCard);
  if (rhythm) {
    const detail = rootDocument.createElement("div");
    detail.className = "create-fine-tuning-inline";
    while (rhythm.firstChild) detail.append(rhythm.firstChild);
    recipe.append(detail);
  }
  recipeControls.replaceWith(recipe);
  creatorGrid.classList.add("phase1-essentials-grid");

  // One bordered card owns both quick knobs and the entire direction form.
  // All selectors scoped to #preGenSection keep working after this move.
  deck.append(creator);
  deck.classList.add("create-unified-surface");
  return true;
}

function moveOptionalGuide(createPanel) {
  const workflow = createPanel.querySelector("#workflowPanel");
  const deck = createPanel.querySelector(".create-performance-deck");
  if (!workflow || !deck?.parentElement) return;
  deck.insertAdjacentElement("afterend", workflow);
}

function upgradeStaticCreateCopy(rootDocument, createPanel) {
  setCopy(rootDocument, "#homeCommandTitle", "Hear it. Direct it. Make it yours.");
  const intro = createPanel.querySelector(".home-command>div>p:not(.eyebrow)");
  if (intro) intro.textContent = "Use the current song as your reference, stage only the changes you want, then let Producer Brain compose the next version.";
  updateCreatePath(createPanel);

  const nowPlayingLabel = createPanel.querySelector(".song-showcase .showcase-copy>.eyebrow");
  if (nowPlayingLabel) nowPlayingLabel.innerHTML = '<span></span> CURRENT PROJECT';

  const tasteLabel = createPanel.querySelector(".taste-actions > span");
  if (tasteLabel) tasteLabel.textContent = "Teach Producer Brain from this song";

  setCopy(rootDocument, "#directionTitle", "Direct the next generation");
  const directionCopy = createPanel.querySelector("#preGenSection .creator-heading .section-description");
  if (directionCopy) directionCopy.textContent = "Genre establishes the writing rules. Everything else can stay on Auto until you want precise control.";

  const genreLabel = createPanel.querySelector("#genreControl")?.closest?.("label")?.querySelector("span");
  if (genreLabel) genreLabel.innerHTML = "GENRE <small>COMPOSITION GRAMMAR</small>";
  const fusionLabel = createPanel.querySelector("#secondaryGenreControl")?.closest?.("label")?.querySelector("span");
  if (fusionLabel) fusionLabel.innerHTML = "FUSION PARTNER <small>SECONDARY INFLUENCE</small>";

  setActionCopy(createPanel, "#generateNew .action-copy", {
    eyebrow: "COMPOSE FROM THIS DIRECTION",
    title: "Generate new song",
    detail: "Builds a fresh full arrangement from the staged settings above",
  });
  setActionCopy(createPanel, "#generateSimilar .action-copy", {
    eyebrow: "KEEP THIS SONG DNA",
    title: "Create Fire / Electric / Drip",
    detail: "Three branch ideas from the same DNA: impact · motion · space",
  });

  const variationTitle = createPanel.querySelector("#songVariationTitle");
  if (variationTitle) variationTitle.textContent = "Choose the personality that earns the next move";
  const variationHeading = createPanel.querySelector("#songVariationTray .song-variation-heading em");
  if (variationHeading) variationHeading.textContent = "Same identity · clearly different production and composition pressure";
  const variationDescriptions = createPanel.querySelectorAll("#songVariationTray [data-song-variation] small");
  if (variationDescriptions[0]) variationDescriptions[0].textContent = "Impact · punch · groove";
  if (variationDescriptions[1]) variationDescriptions[1].textContent = "Motion · hook · syncopation";
  if (variationDescriptions[2]) variationDescriptions[2].textContent = "Space · harmony · flow";

  const resetText = createPanel.querySelector("#resetControlsButton span");
  if (resetText) resetText.textContent = "Reset direction";
  const advancedText = createPanel.querySelector("#artistModeButton span");
  if (advancedText) advancedText.textContent = "Focus mode";

  upgradeWorkflowCopy(createPanel);
}


function setupCreateScrollState(rootDocument, createPanel) {
  const ownerWindow = rootDocument?.defaultView ?? globalThis.window;
  const hero = createPanel.querySelector?.("#heroPanel");
  const compact = createPanel.querySelector?.("#compactCreatePlayer");
  const topbar = rootDocument.querySelector?.(".topbar");
  if (!ownerWindow?.addEventListener || !createPanel?.classList || !hero || !compact || createPanel.dataset.createScrollState === "ready") return;
  createPanel.dataset.createScrollState = "ready";
  createPanel.classList.remove("is-scrolled");

  let compactVisible = false;
  let framePending = false;

  const apply = () => {
    framePending = false;
    const active = !createPanel.hidden && createPanel.classList.contains("is-active");
    if (!active) {
      compactVisible = false;
      createPanel.classList.remove("has-compact-player");
      compact.setAttribute("aria-hidden", "true");
      return;
    }

    const heroRect = hero.getBoundingClientRect?.();
    const topbarBottom = topbar?.getBoundingClientRect?.().bottom || 74;
    const nextVisible = Boolean(heroRect && heroRect.bottom <= topbarBottom + 12);
    if (nextVisible === compactVisible) return;

    compactVisible = nextVisible;
    createPanel.classList.toggle("has-compact-player", compactVisible);
    compact.setAttribute("aria-hidden", String(!compactVisible));
  };

  const schedule = () => {
    if (framePending) return;
    framePending = true;
    if (typeof ownerWindow.requestAnimationFrame === "function") ownerWindow.requestAnimationFrame(apply);
    else ownerWindow.setTimeout?.(apply, 16);
  };

  apply();
  ownerWindow.addEventListener("scroll", schedule, { passive: true });
  ownerWindow.addEventListener("resize", schedule, { passive: true });
}
export function applyCreateWorkflowPhase1(rootDocument = globalThis.document) {
  if (!rootDocument?.querySelector) return false;
  const createPanel = rootDocument.querySelector("#tab-create");
  if (!createPanel?.dataset || typeof createPanel.querySelector !== "function" || typeof createPanel.querySelectorAll !== "function") return false;
  if (createPanel.dataset.uiuxPhase1 === "ready") return true;

  createPanel.dataset.uiuxPhase1 = "ready";
  if (rootDocument.documentElement?.dataset) rootDocument.documentElement.dataset.uiuxPhase1Create = "true";

  mountCreativeRangeControl(rootDocument, createPanel);
  upgradeStaticCreateCopy(rootDocument, createPanel);
  mountPerformanceKnobs(rootDocument, createPanel);
  moveGenerationEssentials(rootDocument, createPanel);
  organizePrimaryDirection(rootDocument, createPanel);
  consolidateCreateSurface(rootDocument, createPanel);
  moveOptionalGuide(createPanel);
  applyCreateControlContract(rootDocument, createPanel);
  setupCreateScrollState(rootDocument, createPanel);
  return true;
}

if (typeof document !== "undefined") applyCreateWorkflowPhase1(document);
