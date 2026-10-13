import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createDirectionStatus } from "../src/ui/create-direction-status.js";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("Create direction status accurately distinguishes live Tempo and staged controls", () => {
  assert.deepEqual(createDirectionStatus(), {
    label: "READY TO GENERATE",
    state: "ready",
    hint: "Choose your direction, then generate a song.",
  });
  assert.deepEqual(createDirectionStatus({ hasSong: true, sameGenre: true, staged: false }), {
    label: "DIRECTION READY",
    state: "ready",
    hint: "Manual Tempo changes this playing song; other controls shape the next generation.",
  });
  assert.deepEqual(createDirectionStatus({ hasSong: true, sameGenre: true, staged: true }), {
    label: "CHANGES STAGED",
    state: "staged",
    hint: "Manual Tempo changes this playing song; other controls shape the next generation.",
  });
  assert.deepEqual(createDirectionStatus({ hasSong: true, sameGenre: false, staged: true }), {
    label: "CHANGES STAGED",
    state: "staged",
    hint: "You are staging a new genre. The current song remains unchanged until you generate.",
  });
});

test("Create shows an accessible direction status and keeps existing live-Tempo authority", () => {
  const presentation = source("src/ui/create-workflow-phase1.js");
  const app = source("src/app.js");
  const html = source("index.html");
  assert.match(presentation, /class="create-deck-hint"/);
  assert.match(presentation, /class="create-deck-state" role="status" aria-live="polite"/);
  assert.doesNotMatch(presentation, /Changes are staged until you generate/);
  assert.match(app, /import \{ createDirectionStatus \} from "\.\/ui\/create-direction-status\.js"/);
  assert.match(app, /createDirectionStatus\(\{/);
  assert.match(app, /deckBadge\.textContent = direction\.label/);
  assert.match(app, /deckHint\.textContent = direction\.hint/);
  assert.match(app, /commitTempoToSong\(nextTempo\)/);
  assert.match(app, /if \(player\.playing\) player\.restart\(\)/);
  assert.match(html, /Manual Tempo changes this song when the genre matches/);
});

test("Auto button accessibility reflects the action the button will perform", () => {
  const app = source("src/app.js");
  assert.match(app, /button\.setAttribute\("aria-pressed", String\(active\)\)/);
  assert.match(app, /Switch \$\{controlName\} to manual control/);
  assert.match(app, /Let MIDI Arcade choose \$\{controlName\} automatically/);
  assert.match(app, /state\.autoControls\.has\(key\) \? state\.autoControls\.delete\(key\) : state\.autoControls\.add\(key\)/);
});

test("mobile Create deck retains keyboard visibility and minimum actionable touch areas", () => {
  const css = source("src/ui/create-knob-deck.css");
  assert.match(css, /\.create-performance-deck \.auto-control-button\{min-height:44px/);
  assert.match(css, /\.create-performance-deck \.create-live-select select\{min-height:44px/);
  assert.match(css, /\.create-performance-deck input:focus-visible/);
  assert.match(css, /@media\(max-width:340px\)/);
  assert.match(css, /@media\(forced-colors:active\)/);
});
