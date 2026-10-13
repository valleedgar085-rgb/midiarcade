import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createWorkspaceController } from "../src/ui/workspace-controller.js";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const html = read("index.html");
const app = read("src/app.js");
const css = read("src/ui/uiux-pro-max-phase1.css");
const build = read("scripts/build.js");
const finish = html.slice(html.indexOf('id="tab-finish" data-workspace-panel='),html.indexOf("</main>"));

test("Finish prioritizes real MIDI export selectors without adding another export button", () => {
  assert.ok(finish.indexOf('id="exportProfileControl"') < finish.indexOf('id="finishFacts"'));
  assert.ok(finish.indexOf('id="exportTimingControl"') < finish.indexOf('id="finishFacts"'));
  assert.ok(finish.indexOf('id="finishFacts"') < finish.indexOf('id="saveCoverButton"'));
  for (const id of ["exportProfileControl","exportTimingControl","exportProfileSummary","finishFacts","finishCoverImage"]) {
    assert.equal((html.match(new RegExp(`id="${id}"`,"g")) || []).length,1);
  }
  assert.equal((html.match(/id="exportButton"/g) || []).length,1);
  assert.match(finish,/Ready for your DAW/);
});

test("Finish tells users MIDI is not recorded audio and announces the current export package", () => {
  const render = app.match(/function renderExportSetup\(\)\s*\{[\s\S]*?\n}\n/)?.[0] ?? "";
  assert.match(render,/DAW-ready default · Full song/);
  assert.match(render,/finish-export-help/);
  assert.match(render,/not recorded audio/);
  assert.match(render,/\$\("#exportButton"\)\?\.setAttribute/);
  assert.match(render,/trackCount === 1 \? "" : "s"/);
  assert.match(render,/setup\.timing === "tight"/);
  assert.match(app,/prepareMidiExport\(clone, currentExportSetup\(\)\)/);
});

test("Workspace navigation supports both keyboard selection and inactive-panel isolation", () => {
  function elem(dataset) {
    const attrs = new Map(), listeners = {}, classes = new Set();
    return {
      dataset, hidden: false, inert: false, tabIndex: 0, attrs, listeners, classes,
      classList: { toggle(key,enabled) { if (enabled) classes.add(key); else classes.delete(key); } },
      setAttribute(key,value) { attrs.set(key,String(value)); },
      addEventListener(key,handler) { listeners[key]=handler; },
      focus() { this.focused=true; },
    };
  }
  const ids=["create","arrange","mix","finish"];
  const buttons=ids.map(workspace=>elem({workspace}));
  const panels=ids.map(workspacePanel=>elem({workspacePanel}));
  const root={querySelectorAll(selector){return selector==="[data-workspace]"?buttons:panels;}};
  const changes=[];
  const controller=createWorkspaceController({root,onChange:(next)=>changes.push(next)});
  controller.bind();
  let prevented=0;
  buttons[0].listeners.keydown({key:"End",preventDefault(){prevented++;}});
  assert.equal(controller.activeWorkspace,"finish");
  assert.equal(prevented,1);
  assert.equal(buttons[3].attrs.get("aria-selected"),"true");
  assert.equal(buttons[3].tabIndex,0);
  assert.equal(panels[3].hidden,false);
  assert.equal(panels[0].inert,true);
  buttons[3].listeners.keydown({key:"Home",preventDefault(){prevented++;}});
  assert.equal(controller.activeWorkspace,"create");
  buttons[0].listeners.keydown({key:"ArrowRight",preventDefault(){prevented++;}});
  assert.equal(controller.activeWorkspace,"arrange");
  assert.equal(panels[1].hidden,false);
  assert.equal(buttons[1].focused,true);
  assert.deepEqual(changes,["finish","create","arrange"]);
});

test("Phase 4 navigation and Finish styles remain scoped and bundled into Android", () => {
  assert.match(css,/UI\/UX Pro Max Phase 4/);
  assert.match(css,/#tab-finish \.export-setup-controls/);
  assert.match(css,/#tab-finish \.export-profile-summary \.finish-export-help/);
  assert.match(css,/#tabNavShell \.tab-btn:focus-visible/);
  assert.match(css,/@media \(max-width: 420px\)/);
  assert.match(css, /orientation: landscape/);
  assert.match(css,/prefers-reduced-motion: reduce/);
  assert.match(build,/'create-knob-deck\.css', 'uiux-pro-max-phase1\.css'/);
  assert.match(build,/androidPublicDir, 'create-knob-deck\.css'/);
});
