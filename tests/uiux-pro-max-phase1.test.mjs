import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const app = source("src/app.js");
const css = source("src/ui/uiux-pro-max-phase1.css");
const deckCss = source("src/ui/create-knob-deck.css");
const build = source("scripts/build.js");

test("Pro Max polish reuses the current Create controls and keeps the deck directly after the song", () => {
  const presentation = source("src/ui/create-workflow-phase1.js");
  assert.match(presentation, /slot\.insertAdjacentElement\("afterend", deck\)/);
  assert.match(presentation, /deck\.append\(controls\)/);
  assert.match(deckCss, /#tab-create\s*>\s*\.home-command\s*\{\s*display:\s*none\s*!important/);
  assert.match(css, /#tab-create \.create-performance-deck \.create-live-controls/);
  assert.match(css, /grid-template-columns:\s*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /#tab-create \.create-performance-deck \.auto-control-button/);
});

test("Mix offers Level and Pan first and retains Velocity and Gate within the existing advanced drawer", () => {
  const primary = app.match(/<div class="track-expression-grid mix-primary-balance"[^>]*>([\s\S]*?)<\/div>/)?.[1];
  const advanced = app.match(/<section class="track-control-group performance-group"[^>]*>([\s\S]*?)<\/section>/)?.[1];
  assert.ok(primary, "primary Mix controls must exist");
  assert.ok(advanced, "advanced Mix performance group must exist");
  for (const name of ["volume", "pan"]) assert.ok(primary.includes(`data-control="${name}"`), `${name} belongs in primary Mix`);
  for (const name of ["velocity", "gate"]) assert.ok(advanced.includes(`data-control="${name}"`), `${name} must remain editable`);
  assert.doesNotMatch(primary, /data-control="(?:velocity|gate)"/);
  assert.doesNotMatch(advanced, /data-control="pan"/);
  for (const name of ["volume", "pan", "velocity", "gate"]) {
    assert.equal(app.split(`data-control="${name}"`).length - 1, 1, `${name} should retain one authoritative slider`);
  }
  assert.match(app, /data-action="mute"[^>]+aria-pressed/);
  assert.match(app, /data-action="solo"[^>]+aria-pressed/);
});

test("Mobile touch/navigation polish remains workspace-scoped and supports accessibility", () => {
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /\.tab-btn:focus-visible/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /safe-area-inset-bottom/);
  assert.match(css, /#tab-arrange \.section-editor\.is-open/);
  assert.match(css, /#tab-mix \.track-card \.mix-primary-balance/);
  assert.match(css, /max-width:\s*340px/);
});

test("Build bundles scoped Pro Max styles into the existing last CSS asset for web and Android", () => {
  assert.match(build, /'create-knob-deck\.css', 'uiux-pro-max-phase1\.css'/);
  assert.match(build, /createKnobDeckStyles\.code/);
  assert.match(build, /path\.join\(wwwDir, 'create-knob-deck\.css'\)/);
  assert.match(build, /androidPublicDir, 'create-knob-deck\.css'/);
  assert.doesNotMatch(build, /href="\.\/uiux-pro-max-phase1\.css"/);
  assert.match(build, /entryPoints:\s*\{/);
});
