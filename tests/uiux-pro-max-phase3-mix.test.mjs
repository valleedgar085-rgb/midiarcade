import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const html = read("index.html");
const app = read("src/app.js");
const css = read("src/ui/uiux-pro-max-phase1.css");
const build = read("scripts/build.js");
const mix = html.slice(html.indexOf('id="tab-mix" data-workspace-panel='), html.indexOf('id="tab-finish" data-workspace-panel='));
const rack = app.match(/function renderTrackRack\(\)\s*\{[\s\S]*?\n}\n/)?.[0] ?? "";

test("Mix brings the channel rack before the optional Smart Mix and Character Shaper", () => {
  const pos = (id) => mix.indexOf(`id="${id}"`);
  assert.ok(pos("mixOverview") >= 0, "Mix overview remains visible");
  assert.ok(pos("mixOverview") < pos("trackRack"));
  assert.ok(pos("trackRack") < mix.indexOf('<details class="mix-studio-tools">'));
  assert.ok(mix.indexOf('<details class="mix-studio-tools">') < pos("smartMixConsole"));
  assert.ok(pos("smartMixConsole") < pos("attitudeStrip"));
  assert.match(mix, /<summary><strong>Advanced mix<\/strong>/);
  for (const id of ["trackRack", "smartMixConsole", "attitudeStrip", "mixEnhanceToggle", "spotlightTrackControl"]) {
    assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1, `${id} retains its single original control`);
  }
});

test("Each instrument has plainly labeled Mute / Solo plus primary Level / Pan", () => {
  const primary = rack.match(/<div class="track-expression-grid mix-primary-balance"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? "";
  const advanced = rack.slice(rack.indexOf('<details class="track-expression track-shaping">'));
  for (const id of ["volume", "pan"]) assert.ok(primary.includes(`data-control="${id}"`));
  for (const id of ["velocity", "gate", "density", "variation", "program", "reverb"]) {
    assert.ok(advanced.includes(`data-control="${id}"`), `${id} stays available within advanced instrument controls`);
  }
  for (const id of ["volume", "pan", "velocity", "gate"]) {
    assert.equal((rack.match(new RegExp(`data-control="${id}"`, "g")) || []).length, 1);
  }
  assert.match(rack, /data-action="mute"[^>]*aria-pressed="\$\{muted\}"[^>]*>Mute<\/button>/);
  assert.match(rack, /data-action="solo"[^>]*aria-pressed="\$\{solo\}"[^>]*>Solo<\/button>/);
});

test("Mixer rerenders preserve the user's expanded channel drawer", () => {
  assert.match(rack, /const expandedIds = new Set\(\[\.\.\.rack\.querySelectorAll\("\.track-card"\)\]/);
  assert.match(rack, /card\.querySelector\("details\.track-shaping"\)\?\.open/);
  assert.match(rack, /if \(details && expandedIds\.has\(card\.dataset\.track\)\) details\.open = true/);
  assert.match(app, /function handleTrackAction\(id, action\)[\s\S]*?state\.muted[\s\S]*?renderTrackRack\(\)/);
  assert.match(app, /function handleTrackControlCommit\(id, control\)/);
});

test("Phase 3 stays responsive and accessible while reusing the already-bundled CSS", () => {
  assert.match(css, /UI\/UX Pro Max Phase 3/);
  assert.match(css, /#tab-mix \.mix-studio-tools > summary:focus-visible/);
  assert.match(css, /#tab-mix \.track-card \.track-primary-actions \.track-toggle\[aria-pressed="true"\]/);
  assert.match(css, /#tab-mix \.track-card\.is-muted/);
  assert.match(css, /min-height: 48px/);
  assert.match(css, /@media \(min-width: 760px\)/);
  assert.match(css, /@media \(max-width: 360px\)/);
  assert.match(css, /prefers-reduced-motion: reduce/);
  assert.match(build, /'create-knob-deck\.css', 'uiux-pro-max-phase1\.css'/);
  assert.match(build, /androidPublicDir, 'create-knob-deck\.css'/);
});
