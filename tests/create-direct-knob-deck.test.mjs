import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { createDefaultAutoControls } from "../src/core/auto-control-policy.js";
import { decodePersistedSession, GENERATION_PREFERENCE_IDS } from "../src/core/session-runtime.js";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const presentation = source("src/ui/create-workflow-phase1.js");
const app = source("src/app.js");
const css = source("src/ui/create-knob-deck.css");
const html = source("index.html");

test("Create shows a direct control deck beneath the song without a second opening card", () => {
  assert.match(presentation, /slot\.insertAdjacentElement\("afterend", deck\)/);
  assert.match(presentation, /deck\.append\(controls\)/);
  assert.match(css, /#tab-create\s*>\s*\.home-command\s*\{\s*display:\s*none\s*!important/);
  assert.match(css, /#tab-create\s+\.create-performance-deck\s*\{/);
  assert.match(css, /border:\s*1\.5px solid/);
  assert.ok(html.indexOf('id="heroPanel"') < html.indexOf('id="preGenSection"'));
});

test("main knobs keep original control identity; Syncopation and Drum Fills mount exactly once", () => {
  for (const id of ["tempoControl", "energyControl", "complexityControl", "variationControl", "evolutionControl", "swingControl", "humanizeControl"]) {
    assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1);
    assert.match(presentation, new RegExp(`["']${id}["']`));
  }
  for (const id of ["syncopationControl", "drumFillsControl"]) {
    assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 0, "runtime control must not increase protected static HTML");
    assert.match(presentation, new RegExp(`["']${id}["']`));
    assert.ok(GENERATION_PREFERENCE_IDS.includes(id), `${id} must survive a session restore`);
    assert.ok(createDefaultAutoControls().has(id), `${id} must default to Auto`);
    assert.match(app, new RegExp(`state\\.autoControls\\.has\\("${id}"\\)`));
  }
});

test("legacy persisted sessions retain auto behavior for newly introduced rhythm knobs", () => {
  const result = decodePersistedSession({
    status: "ready",
    value: { schema: 3, autoControls: [], generationPreferences: { energyControl: "65" } },
  }, { schema: 3, trackOrder: ["drums"] });
  assert.equal(result.status, "ready");
  assert.equal(result.value.autoControls.has("syncopationControl"), true);
  assert.equal(result.value.autoControls.has("drumFillsControl"), true);
  const manual = decodePersistedSession({
    status: "ready",
    value: {
      schema: 3, autoControls: [],
      generationPreferences: { syncopationControl: "72", drumFillsControl: "24" },
    },
  }, { schema: 3, trackOrder: ["drums"] });
  assert.equal(manual.status, "ready");
  assert.equal(manual.value.autoControls.has("syncopationControl"), false);
  assert.equal(manual.value.autoControls.has("drumFillsControl"), false);
});
