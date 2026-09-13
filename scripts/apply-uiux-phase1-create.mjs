import fs from "node:fs";

const indexPath = new URL("../index.html", import.meta.url);
const stylesPath = new URL("../styles.css", import.meta.url);
let html = fs.readFileSync(indexPath, "utf8");
let css = fs.readFileSync(stylesPath, "utf8");

const marker = "/* UIUX PHASE 1: CREATE WORKFLOW HIERARCHY */";
if (css.includes(marker)) {
  console.log("UI/UX Phase 1 Create workflow already applied.");
  process.exit(0);
}

function requireText(source, text, label) {
  if (!source.includes(text)) throw new Error(`Missing ${label}`);
}

requireText(html, '<p class="eyebrow"><span></span> NOW PLAYING &amp; CREATING</p>', "Now Playing eyebrow");
html = html.replace(
  '<p class="eyebrow"><span></span> NOW PLAYING &amp; CREATING</p>',
  '<p class="eyebrow"><span></span> NOW PLAYING</p>',
);

requireText(html, '<h2 id="homeCommandTitle">Turn a direction into a complete song.</h2>', "Create intro title");
html = html.replace(
  '<h2 id="homeCommandTitle">Turn a direction into a complete song.</h2>',
  '<h2 id="homeCommandTitle">Listen. Direct. Generate.</h2>',
);
html = html.replace(
  '<p>Start simple. Choose a genre, leave anything uncertain on Auto, and shape the result after it plays.</p>',
  '<p>Hear what you have, change only what matters, then ask the Producer Brain for the next direction.</p>',
);
html = html.replace(
  '<li><b>01</b><span><strong>Direct</strong><small>Set the musical intent</small></span></li>\n              <li><b>02</b><span><strong>Generate</strong><small>Compose the full band</small></span></li>\n              <li><b>03</b><span><strong>Shape</strong><small>Edit only what matters</small></span></li>',
  '<li><b>01</b><span><strong>Listen</strong><small>Know the current song</small></span></li>\n              <li><b>02</b><span><strong>Direct</strong><small>Set the next direction</small></span></li>\n              <li><b>03</b><span><strong>Generate</strong><small>Create the next song</small></span></li>',
);

const controlsStart = html.indexOf('              <div class="create-live-controls" aria-label="Quick song controls">');
const controlsEnd = html.indexOf('              <div class="showcase-actions" aria-label="Current song actions">', controlsStart);
if (controlsStart < 0 || controlsEnd < 0) throw new Error("Could not isolate Create generation controls");
let controlsBlock = html.slice(controlsStart, controlsEnd);
html = html.slice(0, controlsStart) + html.slice(controlsEnd);
controlsBlock = controlsBlock
  .replace('aria-label="Quick song controls"', 'aria-label="Generation essentials"')
  .replace('Updates current playback when the genre matches', 'Sets the speed for the next generation')
  .replace('Calm to electric', 'Sets the intensity of the next generation')
  .replace('Simple to intricate', 'Sets how busy the next generation becomes');

const directionInsert = '                </div>\n                <details class="shape-controls">';
requireText(html, directionInsert, "direction essentials insertion point");
const essentials = `                </div>\n                <section class="direction-essentials" aria-labelledby="directionEssentialsTitle">\n                  <header class="direction-essentials-heading">\n                    <span><small>ESSENTIALS</small><strong id="directionEssentialsTitle">Feel &amp; length</strong></span>\n                    <p>These settings shape the next generation. The song playing above stays your reference.</p>\n                  </header>\n${controlsBlock}                </section>\n                <details class="shape-controls">`;
html = html.replace(directionInsert, essentials);

html = html.replace(
  '<h2 id="directionTitle">Direct the next idea</h2>\n                <p class="section-description">Choose the genre here. Tempo, energy, complexity, length and groove now stay beside the song you are hearing.</p>',
  '<h2 id="directionTitle">Direct the next idea</h2>\n                <p class="section-description">Choose a genre and shape the essentials. Everything deeper is optional.</p>',
);

// Move the optional workflow guide below the primary creation flow so it never interrupts Now Playing → Direction → Generate.
const workflowStart = html.indexOf('          <details class="workflow-panel panel" id="workflowPanel"');
const creatorStart = html.indexOf('          <section class="song-creator-panel panel" id="preGenSection"', workflowStart);
if (workflowStart < 0 || creatorStart < 0) throw new Error("Could not isolate optional workflow guide");
const workflowBlock = html.slice(workflowStart, creatorStart);
html = html.slice(0, workflowStart) + html.slice(creatorStart);
const createClose = '          </section>\n          </div>\n        </div>\n\n        <!-- ARRANGE TAB -->';
requireText(html, createClose, "Create workspace closing anchor");
html = html.replace(
  createClose,
  `          </section>\n\n${workflowBlock}          </div>\n        </div>\n\n        <!-- ARRANGE TAB -->`,
);

const cssPatch = `

${marker}
/* Phase 1 is intentionally structural: quieter surfaces, one obvious creation path. */
#tab-create{
  --create-section-gap:18px;
}
#tab-create .home-command{
  grid-template-columns:minmax(0,1fr) auto;
  align-items:center;
  gap:24px;
  margin-bottom:var(--create-section-gap);
  padding:16px 18px;
  border:1px solid rgba(255,255,255,.07);
  border-radius:16px;
  background:rgba(255,255,255,.018);
  box-shadow:none;
}
#tab-create .home-command h2{
  margin-top:3px;
  font-size:clamp(1.2rem,2vw,1.65rem);
}
#tab-create .home-command>div>p:not(.eyebrow){
  max-width:62ch;
  margin-top:5px;
  color:var(--text-3);
  font-size:.78rem;
}
#tab-create .home-path{
  display:flex;
  align-items:center;
  gap:6px;
}
#tab-create .home-path li{
  min-width:118px;
  padding:8px 10px;
  border:1px solid transparent;
  border-radius:11px;
  background:rgba(255,255,255,.02);
}
#tab-create .home-path li:first-child{
  border-color:rgba(45,212,191,.2);
  background:rgba(45,212,191,.05);
}
#tab-create .song-showcase{
  border-color:rgba(255,255,255,.12);
  box-shadow:0 24px 64px rgba(0,0,0,.34);
}
#tab-create .song-showcase .showcase-copy>.eyebrow{
  color:var(--teal);
}
#tab-create .song-showcase .showcase-copy>.eyebrow span{
  background:var(--teal);
  box-shadow:0 0 10px rgba(45,212,191,.45);
}
#tab-create .showcase-actions{
  margin-top:16px;
}
#tab-create .taste-actions{
  opacity:.78;
}
#tab-create .dna-integrated-card{
  border-color:rgba(255,255,255,.07);
  background:rgba(255,255,255,.014);
}
#tab-create .song-creator-panel{
  margin-top:var(--create-section-gap);
  border-color:rgba(157,111,255,.24);
  background:linear-gradient(180deg,rgba(157,111,255,.045),rgba(255,255,255,.018));
}
#tab-create .creator-heading{
  align-items:flex-start;
  padding-bottom:14px;
  border-bottom:1px solid rgba(255,255,255,.065);
}
#tab-create .creator-grid{
  grid-template-columns:minmax(0,1fr);
  gap:14px;
}
#tab-create .creator-main-controls{
  display:grid;
  gap:14px;
}
#tab-create .genre-direction{
  padding:16px;
  border:1px solid rgba(157,111,255,.22);
  border-radius:16px;
  background:rgba(157,111,255,.055);
}
#tab-create .genre-select-control>span{
  color:#fff;
}
#tab-create .direction-essentials{
  padding:16px;
  border:1px solid rgba(255,255,255,.085);
  border-radius:16px;
  background:rgba(255,255,255,.025);
}
#tab-create .direction-essentials-heading{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:18px;
  margin-bottom:14px;
}
#tab-create .direction-essentials-heading span small{
  display:block;
  color:var(--teal);
  font:800 .58rem var(--font-data);
  letter-spacing:.14em;
}
#tab-create .direction-essentials-heading span strong{
  display:block;
  margin-top:2px;
  font-family:var(--font-display);
  font-size:1rem;
}
#tab-create .direction-essentials-heading p{
  max-width:48ch;
  color:var(--text-3);
  font-size:.72rem;
  line-height:1.45;
  text-align:right;
}
#tab-create .direction-essentials .create-live-controls{
  margin:0;
  padding:0;
  border:0;
  background:none;
}
#tab-create .shape-controls,
#tab-create .creator-recipe-side{
  border-color:rgba(255,255,255,.07);
  background:rgba(255,255,255,.012);
}
#tab-create .creator-recipe-side{
  margin-top:0;
}
#tab-create .generation-intent{
  margin-top:16px;
  border-color:rgba(255,255,255,.08);
  background:rgba(255,255,255,.02);
}
#tab-create .generation-actions-bar{
  grid-template-columns:minmax(0,1.45fr) minmax(260px,.75fr);
  gap:10px;
  margin-top:10px;
  padding-top:12px;
  border-top:1px solid rgba(255,255,255,.07);
}
#tab-create .generation-new{
  min-height:88px;
  border-color:rgba(157,111,255,.52);
  background:linear-gradient(135deg,rgba(124,58,237,.82),rgba(157,111,255,.68));
  box-shadow:0 18px 38px rgba(76,29,149,.22);
}
#tab-create .generation-new:hover{
  border-color:rgba(255,255,255,.32);
  box-shadow:0 20px 46px rgba(124,58,237,.32);
}
#tab-create .generation-new .action-copy small,
#tab-create .generation-new .action-copy strong,
#tab-create .generation-new .action-copy em{
  color:#fff;
}
#tab-create .generation-similar{
  min-height:88px;
  border-color:rgba(255,255,255,.1);
  background:rgba(255,255,255,.025);
  box-shadow:none;
}
#tab-create .generation-similar .action-copy small,
#tab-create .generation-similar .action-copy em{
  color:var(--text-3);
}
#tab-create #workflowPanel{
  margin-top:14px;
  border-color:rgba(255,255,255,.06);
  background:rgba(255,255,255,.01);
  opacity:.9;
}

@media(max-width:800px){
  #tab-create .home-command{
    grid-template-columns:1fr;
    gap:10px;
    padding:13px 14px;
  }
  #tab-create .home-path{
    display:grid;
    grid-template-columns:repeat(3,1fr);
  }
  #tab-create .home-path li{
    min-width:0;
  }
  #tab-create .direction-essentials-heading{
    align-items:flex-start;
    flex-direction:column;
    gap:4px;
  }
  #tab-create .direction-essentials-heading p{
    text-align:left;
  }
  #tab-create .generation-actions-bar{
    grid-template-columns:1fr;
  }
  #tab-create .generation-similar{
    min-height:62px;
  }
}

@media(max-width:600px){
  .topbar .session-status,
  .topbar #undoButton,
  .topbar #redoButton,
  .topbar .guide-button,
  .topbar .version-chip{
    display:none!important;
  }
  .topbar{
    padding-inline:12px;
  }
  .topbar .topbar-actions{
    margin-left:auto;
  }
  .topbar .menu-button b{
    display:none;
  }
  .topbar .menu-button{
    min-width:44px;
    justify-content:center;
    padding-inline:10px;
  }
  #tab-create .home-command>div>p:not(.eyebrow),
  #tab-create .home-path small{
    display:none;
  }
  #tab-create .home-command h2{
    font-size:1.15rem;
  }
  #tab-create .home-path li{
    padding:7px 8px;
  }
  #tab-create .home-path li b{
    font-size:.55rem;
  }
  #tab-create .home-path li strong{
    font-size:.68rem;
  }
  #tab-create .song-showcase{
    padding:14px;
  }
  #tab-create .showcase-art{
    max-width:360px;
    margin-inline:auto;
  }
  #tab-create .song-facts{
    gap:5px;
  }
  #tab-create .song-facts span{
    padding:5px 8px;
    font-size:.58rem;
  }
  #tab-create .creator-heading-actions .reset-button span{
    display:none;
  }
  #tab-create .direction-essentials,
  #tab-create .genre-direction{
    padding:13px;
  }
  #tab-create .direction-essentials .create-live-controls{
    grid-template-columns:1fr;
    gap:10px;
  }
  #tab-create .direction-essentials .create-live-select{
    grid-column:1;
  }
  #tab-create .generation-actions-bar{
    position:sticky;
    z-index:170;
    bottom:calc(92px + var(--safe-area-inset-bottom, env(safe-area-inset-bottom,0px)));
    padding:8px;
    border:1px solid rgba(157,111,255,.26);
    border-radius:16px;
    background:rgba(10,10,16,.94);
    box-shadow:0 16px 38px rgba(0,0,0,.42);
    -webkit-backdrop-filter:blur(18px);
    backdrop-filter:blur(18px);
  }
  #tab-create .generation-new{
    min-height:70px;
  }
  #tab-create .generation-similar{
    min-height:50px;
  }
  #tab-create .generation-similar .action-icon,
  #tab-create .generation-similar .action-copy small,
  #tab-create .generation-similar .action-copy em,
  #tab-create .generation-similar kbd{
    display:none;
  }
  #tab-create .generation-similar .action-copy strong{
    font-size:.78rem;
  }
}
`;

css += cssPatch;
fs.writeFileSync(indexPath, html);
fs.writeFileSync(stylesPath, css);
console.log("Applied UI/UX Phase 1 Create workflow hierarchy.");
