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

function moveGenerationEssentials(rootDocument, createPanel) {
  const controls = createPanel.querySelector(".create-live-controls");
  const creatorMain = createPanel.querySelector(".creator-main-controls");
  const shapeControls = creatorMain?.querySelector(".shape-controls");
  if (!controls || !creatorMain || !shapeControls || creatorMain.querySelector(".direction-essentials-heading")) return;
  if (typeof rootDocument?.createElement !== "function") return;

  controls.setAttribute("aria-label", "Generation essentials");
  const notes = controls.querySelectorAll(".create-live-control small");
  if (notes[0]) notes[0].textContent = "Speed of the next composition; Auto remains genre-aware";
  if (notes[1]) notes[1].textContent = "Controls intensity, impact and section lift";
  if (notes[2]) notes[2].textContent = "Controls harmonic and rhythmic detail without changing genre";

  const selectLabels = controls.querySelectorAll(".create-live-select > span");
  if (selectLabels[0]) selectLabels[0].textContent = "ARRANGEMENT LENGTH";
  if (selectLabels[1]) selectLabels[1].textContent = "TIMING POCKET";

  const heading = rootDocument.createElement("div");
  heading.className = "direction-essentials-heading section-heading";
  heading.innerHTML = `
    <div>
      <p class="eyebrow">ESSENTIAL DIRECTION</p>
      <h3 id="directionEssentialsTitle">Song frame, feel &amp; structure</h3>
      <p class="section-description">Set the genre world, pace and pocket here. The song playing above remains your untouched reference until you press Generate.</p>
    </div>
  `;
  controls.setAttribute("aria-labelledby", "directionEssentialsTitle");
  creatorMain.insertBefore(heading, shapeControls);
  creatorMain.insertBefore(controls, shapeControls);
}

function consolidateAdvancedDirection(rootDocument, createPanel) {
  const creator = createPanel.querySelector("#preGenSection");
  const creatorGrid = creator?.querySelector(".creator-grid");
  const shapeControls = creator?.querySelector(".shape-controls");
  const recipeControls = creator?.querySelector(".creator-recipe-side");
  const generationActions = creator?.querySelector(".generation-actions-bar");
  if (!creator || !creatorGrid || !shapeControls || !recipeControls || !generationActions) return;
  if (creator.querySelector(".phase1-advanced-direction") || typeof rootDocument?.createElement !== "function") return;

  const advanced = rootDocument.createElement("details");
  advanced.className = "phase1-advanced-direction";
  advanced.innerHTML = `
    <summary>
      <span><small>OPTIONAL PRECISION</small><strong>Advanced direction</strong></span>
      <span>Key · scale · harmony · recipe · rhythm detail</span>
    </summary>
    <div class="phase1-advanced-direction-body"></div>
  `;
  const body = advanced.querySelector(".phase1-advanced-direction-body");
  if (!body) return;

  const shapeSummary = shapeControls.querySelector("summary strong");
  if (shapeSummary) shapeSummary.textContent = "Key, scale & harmonic path";
  const recipeSummary = recipeControls.querySelector(":scope > summary strong");
  if (recipeSummary) recipeSummary.textContent = "Creative recipe & performance detail";

  body.append(shapeControls, recipeControls);
  generationActions.insertAdjacentElement("afterend", advanced);
  creatorGrid.classList.add("phase1-essentials-grid");
}

function moveOptionalGuide(createPanel) {
  const workflow = createPanel.querySelector("#workflowPanel");
  const creator = createPanel.querySelector("#preGenSection");
  if (!workflow || !creator || !creator.parentElement) return;
  creator.insertAdjacentElement("afterend", workflow);
}

function upgradeStaticCreateCopy(rootDocument, createPanel) {
  setCopy(rootDocument, "#homeCommandTitle", "Hear it. Direct it. Make it yours.");
  const intro = createPanel.querySelector(".home-command>div>p:not(.eyebrow)");
  if (intro) intro.textContent = "Use the current song as your reference, stage only the changes you want, then let Producer Brain compose the next version.";
  updateCreatePath(createPanel);

  const nowPlayingLabel = createPanel.querySelector(".song-showcase .showcase-copy>.eyebrow");
  if (nowPlayingLabel) nowPlayingLabel.innerHTML = '<span></span> CURRENT SONG';

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
  if (advancedText) advancedText.textContent = "Show advanced";

  upgradeWorkflowCopy(createPanel);
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
  moveGenerationEssentials(rootDocument, createPanel);
  consolidateAdvancedDirection(rootDocument, createPanel);
  moveOptionalGuide(createPanel);
  applyCreateControlContract(rootDocument, createPanel);
  return true;
}

if (typeof document !== "undefined") applyCreateWorkflowPhase1(document);
