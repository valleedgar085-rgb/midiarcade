function setCopy(selector, text) {
  const element = document.querySelector(selector);
  if (element) element.textContent = text;
}

function updateCreatePath(createPanel) {
  const items = [...createPanel.querySelectorAll(".home-path li")];
  const steps = [
    ["Listen", "Know the current song"],
    ["Direct", "Set the next direction"],
    ["Generate", "Create the next song"],
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

function moveGenerationEssentials(createPanel) {
  const controls = createPanel.querySelector(".create-live-controls");
  const creatorMain = createPanel.querySelector(".creator-main-controls");
  const shapeControls = creatorMain?.querySelector(".shape-controls");
  if (!controls || !creatorMain || !shapeControls || creatorMain.querySelector(".direction-essentials-heading")) return;

  controls.setAttribute("aria-label", "Generation essentials");
  const notes = controls.querySelectorAll(".create-live-control small");
  if (notes[0]) notes[0].textContent = "Sets the speed for the next generation";
  if (notes[1]) notes[1].textContent = "Sets the intensity of the next generation";
  if (notes[2]) notes[2].textContent = "Sets how busy the next generation becomes";

  const heading = document.createElement("div");
  heading.className = "direction-essentials-heading section-heading";
  heading.innerHTML = `
    <div>
      <p class="eyebrow">ESSENTIALS</p>
      <h3 id="directionEssentialsTitle">Feel &amp; length</h3>
      <p class="section-description">These settings shape the next generation. The song playing above stays your reference.</p>
    </div>
  `;
  controls.setAttribute("aria-labelledby", "directionEssentialsTitle");
  creatorMain.insertBefore(heading, shapeControls);
  creatorMain.insertBefore(controls, shapeControls);
}

function moveOptionalGuide(createPanel) {
  const workflow = createPanel.querySelector("#workflowPanel");
  const creator = createPanel.querySelector("#preGenSection");
  if (!workflow || !creator || !creator.parentElement) return;
  creator.insertAdjacentElement("afterend", workflow);
}

export function applyCreateWorkflowPhase1() {
  const createPanel = document.querySelector("#tab-create");
  if (!createPanel || createPanel.dataset.uiuxPhase1 === "ready") return;

  createPanel.dataset.uiuxPhase1 = "ready";
  document.documentElement.dataset.uiuxPhase1Create = "true";

  setCopy("#homeCommandTitle", "Listen. Direct. Generate.");
  const intro = createPanel.querySelector(".home-command>div>p:not(.eyebrow)");
  if (intro) intro.textContent = "Hear what you have, change only what matters, then ask the Producer Brain for the next direction.";
  updateCreatePath(createPanel);

  const nowPlayingLabel = createPanel.querySelector(".song-showcase .showcase-copy>.eyebrow");
  if (nowPlayingLabel) nowPlayingLabel.innerHTML = '<span></span> NOW PLAYING';

  setCopy("#directionTitle", "Direct the next idea");
  const directionCopy = createPanel.querySelector("#preGenSection .section-description");
  if (directionCopy) directionCopy.textContent = "Choose a genre and shape the essentials. Everything deeper is optional.";

  const newAction = createPanel.querySelector("#generateNew .action-copy");
  if (newAction) {
    const small = newAction.querySelector("small");
    const strong = newAction.querySelector("strong");
    if (small) small.textContent = "NEXT GENERATION";
    if (strong) strong.textContent = "Generate new song";
  }
  const similarAction = createPanel.querySelector("#generateSimilar .action-copy");
  if (similarAction) {
    const small = similarAction.querySelector("small");
    if (small) small.textContent = "FROM CURRENT SONG";
  }

  moveGenerationEssentials(createPanel);
  moveOptionalGuide(createPanel);
}

applyCreateWorkflowPhase1();
