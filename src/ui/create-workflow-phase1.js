const STYLE_ID = "uiux-phase1-create-style";

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
  if (!controls || !creatorMain || !shapeControls || creatorMain.querySelector(".direction-essentials")) return;

  controls.setAttribute("aria-label", "Generation essentials");
  const notes = controls.querySelectorAll(".create-live-control small");
  if (notes[0]) notes[0].textContent = "Sets the speed for the next generation";
  if (notes[1]) notes[1].textContent = "Sets the intensity of the next generation";
  if (notes[2]) notes[2].textContent = "Sets how busy the next generation becomes";

  const section = document.createElement("section");
  section.className = "direction-essentials";
  section.setAttribute("aria-labelledby", "directionEssentialsTitle");
  section.innerHTML = `
    <header class="direction-essentials-heading">
      <span><small>ESSENTIALS</small><strong id="directionEssentialsTitle">Feel &amp; length</strong></span>
      <p>These settings shape the next generation. The song playing above stays your reference.</p>
    </header>
  `;
  section.append(controls);
  creatorMain.insertBefore(section, shapeControls);
}

function moveOptionalGuide(createPanel) {
  const workflow = createPanel.querySelector("#workflowPanel");
  const creator = createPanel.querySelector("#preGenSection");
  if (!workflow || !creator || !creator.parentElement) return;
  creator.insertAdjacentElement("afterend", workflow);
}

function injectStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    /* UI/UX Phase 1 — Create workflow hierarchy */
    #tab-create{--create-section-gap:18px}
    #tab-create .home-command{
      grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:24px;
      margin-bottom:var(--create-section-gap);padding:16px 18px;
      border:1px solid rgba(255,255,255,.07);border-radius:16px;
      background:rgba(255,255,255,.018);box-shadow:none
    }
    #tab-create .home-command h2{margin-top:3px;font-size:clamp(1.2rem,2vw,1.65rem)}
    #tab-create .home-command>div>p:not(.eyebrow){max-width:62ch;margin-top:5px;color:var(--text-3);font-size:.78rem}
    #tab-create .home-path{display:flex;align-items:center;gap:6px}
    #tab-create .home-path li{min-width:118px;padding:8px 10px;border:1px solid transparent;border-radius:11px;background:rgba(255,255,255,.02)}
    #tab-create .home-path li:first-child{border-color:rgba(45,212,191,.2);background:rgba(45,212,191,.05)}

    #tab-create .song-showcase{border-color:rgba(255,255,255,.12);box-shadow:0 24px 64px rgba(0,0,0,.34)}
    #tab-create .song-showcase .showcase-copy>.eyebrow{color:var(--teal)}
    #tab-create .song-showcase .showcase-copy>.eyebrow span{background:var(--teal);box-shadow:0 0 10px rgba(45,212,191,.45)}
    #tab-create .showcase-actions{margin-top:16px}
    #tab-create .taste-actions{opacity:.78}
    #tab-create .dna-integrated-card{border-color:rgba(255,255,255,.07);background:rgba(255,255,255,.014)}

    #tab-create .song-creator-panel{
      margin-top:var(--create-section-gap);border-color:rgba(157,111,255,.24);
      background:linear-gradient(180deg,rgba(157,111,255,.045),rgba(255,255,255,.018))
    }
    #tab-create .creator-heading{align-items:flex-start;padding-bottom:14px;border-bottom:1px solid rgba(255,255,255,.065)}
    #tab-create .creator-grid{grid-template-columns:minmax(0,1fr);gap:14px}
    #tab-create .creator-main-controls{display:grid;gap:14px}
    #tab-create .genre-direction{padding:16px;border:1px solid rgba(157,111,255,.22);border-radius:16px;background:rgba(157,111,255,.055)}
    #tab-create .genre-select-control>span{color:#fff}

    #tab-create .direction-essentials{padding:16px;border:1px solid rgba(255,255,255,.085);border-radius:16px;background:rgba(255,255,255,.025)}
    #tab-create .direction-essentials-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:18px;margin-bottom:14px}
    #tab-create .direction-essentials-heading span small{display:block;color:var(--teal);font:800 .58rem var(--font-data);letter-spacing:.14em}
    #tab-create .direction-essentials-heading span strong{display:block;margin-top:2px;font-family:var(--font-display);font-size:1rem}
    #tab-create .direction-essentials-heading p{max-width:48ch;color:var(--text-3);font-size:.72rem;line-height:1.45;text-align:right}
    #tab-create .direction-essentials .create-live-controls{margin:0;padding:0;border:0;background:none}

    #tab-create .shape-controls,#tab-create .creator-recipe-side{border-color:rgba(255,255,255,.07);background:rgba(255,255,255,.012)}
    #tab-create .creator-recipe-side{margin-top:0}
    #tab-create .generation-intent{margin-top:16px;border-color:rgba(255,255,255,.08);background:rgba(255,255,255,.02)}
    #tab-create .generation-actions-bar{grid-template-columns:minmax(0,1.45fr) minmax(260px,.75fr);gap:10px;margin-top:10px;padding-top:12px;border-top:1px solid rgba(255,255,255,.07)}
    #tab-create .generation-new{min-height:88px;border-color:rgba(157,111,255,.52);background:linear-gradient(135deg,rgba(124,58,237,.82),rgba(157,111,255,.68));box-shadow:0 18px 38px rgba(76,29,149,.22)}
    #tab-create .generation-new:hover{border-color:rgba(255,255,255,.32);box-shadow:0 20px 46px rgba(124,58,237,.32)}
    #tab-create .generation-new .action-copy small,#tab-create .generation-new .action-copy strong,#tab-create .generation-new .action-copy em{color:#fff}
    #tab-create .generation-similar{min-height:88px;border-color:rgba(255,255,255,.1);background:rgba(255,255,255,.025);box-shadow:none}
    #tab-create .generation-similar .action-copy small,#tab-create .generation-similar .action-copy em{color:var(--text-3)}
    #tab-create #workflowPanel{margin-top:14px;border-color:rgba(255,255,255,.06);background:rgba(255,255,255,.01);opacity:.9}

    @media(max-width:800px){
      #tab-create .home-command{grid-template-columns:1fr;gap:10px;padding:13px 14px}
      #tab-create .home-path{display:grid;grid-template-columns:repeat(3,1fr)}
      #tab-create .home-path li{min-width:0}
      #tab-create .direction-essentials-heading{align-items:flex-start;flex-direction:column;gap:4px}
      #tab-create .direction-essentials-heading p{text-align:left}
      #tab-create .generation-actions-bar{grid-template-columns:1fr}
      #tab-create .generation-similar{min-height:62px}
    }

    @media(max-width:600px){
      .topbar .session-status,.topbar #undoButton,.topbar #redoButton,.topbar .guide-button,.topbar .version-chip{display:none!important}
      .topbar{padding-inline:12px}
      .topbar .topbar-actions{margin-left:auto}
      .topbar .menu-button b{display:none}
      .topbar .menu-button{min-width:44px;justify-content:center;padding-inline:10px}
      #tab-create .home-command>div>p:not(.eyebrow),#tab-create .home-path small{display:none}
      #tab-create .home-command h2{font-size:1.15rem}
      #tab-create .home-path li{padding:7px 8px}
      #tab-create .home-path li b{font-size:.55rem}
      #tab-create .home-path li strong{font-size:.68rem}
      #tab-create .song-showcase{padding:14px}
      #tab-create .showcase-art{max-width:360px;margin-inline:auto}
      #tab-create .song-facts{gap:5px}
      #tab-create .song-facts span{padding:5px 8px;font-size:.58rem}
      #tab-create .creator-heading-actions .reset-button span{display:none}
      #tab-create .direction-essentials,#tab-create .genre-direction{padding:13px}
      #tab-create .direction-essentials .create-live-controls{grid-template-columns:1fr;gap:10px}
      #tab-create .direction-essentials .create-live-select{grid-column:1}
      #tab-create .generation-actions-bar{
        position:sticky;z-index:170;bottom:calc(92px + var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px)));
        padding:8px;border:1px solid rgba(157,111,255,.26);border-radius:16px;background:rgba(10,10,16,.94);
        box-shadow:0 16px 38px rgba(0,0,0,.42);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px)
      }
      #tab-create .generation-new{min-height:70px}
      #tab-create .generation-similar{min-height:50px}
      #tab-create .generation-similar .action-icon,#tab-create .generation-similar .action-copy small,#tab-create .generation-similar .action-copy em,#tab-create .generation-similar kbd{display:none}
      #tab-create .generation-similar .action-copy strong{font-size:.78rem}
    }
  `;
  document.head.append(style);
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
  injectStyles();
}

applyCreateWorkflowPhase1();
