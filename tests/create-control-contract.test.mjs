import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  applyCreateControlContract,
  CREATE_CONTROL_CONTRACT,
  CREATE_CONTROL_IDS,
  createControlHelp,
} from "../src/ui/create-control-contract.js";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const createPresentation = fs.readFileSync(new URL("../src/ui/create-workflow-phase1.js", import.meta.url), "utf8");

const EXPECTED_CREATE_IDS = [
  "renameButton",
  "showcasePlayButton",
  "showcaseSimilarButton",
  "tasteRating",
  "guidedModeButton",
  "workflowAction",
  "resetControlsButton",
  "artistModeButton",
  "genreControl",
  "secondaryGenreControl",
  "tempoControl",
  "energyControl",
  "complexityControl",
  "barsControl",
  "grooveControl",
  "keyControl",
  "keyTransposeDown",
  "keyTransposeUp",
  "modeControl",
  "chordPathControl",
  "newRecipeButton",
  "swingControl",
  "humanizeControl",
  "tripletControl",
  "rollControl",
  "variationControl",
  "evolutionControl",
  "surpriseControl",
  "generateNew",
  "generateSimilar",
];

const RANGE_IDS = [
  "tempoControl",
  "energyControl",
  "complexityControl",
  "swingControl",
  "humanizeControl",
  "tripletControl",
  "rollControl",
  "variationControl",
  "evolutionControl",
  "surpriseControl",
];

const ACTION_IDS = [
  "renameButton",
  "showcasePlayButton",
  "showcaseSimilarButton",
  "guidedModeButton",
  "workflowAction",
  "resetControlsButton",
  "artistModeButton",
  "keyTransposeDown",
  "keyTransposeUp",
  "newRecipeButton",
  "generateNew",
  "generateSimilar",
];

test("Create control contract covers every first-class Create control exactly once", () => {
  assert.deepEqual(CREATE_CONTROL_IDS, EXPECTED_CREATE_IDS);
  assert.equal(Object.isFrozen(CREATE_CONTROL_CONTRACT), true);
  for (const id of CREATE_CONTROL_IDS) {
    assert.equal((html.match(new RegExp(`id=["']${id}["']`, "g")) || []).length, 1, `${id} must exist exactly once in Create`);
  }
});

test("every Create contract entry has producer-facing copy and a wiring expectation", () => {
  const allowedIntents = new Set(["current-song", "learning", "guidance", "direction", "essentials", "advanced", "generate"]);
  const allowedEvents = new Set(["click", "change", "input"]);
  for (const [id, contract] of Object.entries(CREATE_CONTROL_CONTRACT)) {
    assert.match(contract.label, /\S/, `${id} needs a visible label`);
    assert.ok(contract.help.length >= 45, `${id} help should explain musical consequences, not just repeat the label`);
    assert.ok(allowedIntents.has(contract.intent), `${id} needs a valid intent group`);
    assert.ok(allowedEvents.has(contract.event), `${id} needs a valid event expectation`);
    assert.deepEqual(createControlHelp({ id, dataset: {} }), [contract.label, contract.help]);
  }
});

test("all Create generation ranges use the shared live input wiring", () => {
  const liveRangeBlock = app.match(/const liveRangeIds = \[[\s\S]*?\];[\s\S]*?for \(const id of liveRangeIds\)[\s\S]*?addEventListener\("input"/);
  assert.ok(liveRangeBlock, "Create generation ranges must share one input wiring path");
  for (const id of RANGE_IDS) {
    assert.match(liveRangeBlock[0], new RegExp(`"${id}"`), `${id} must participate in live range wiring`);
    assert.equal(CREATE_CONTROL_CONTRACT[id].event, "input");
  }
});

test("every first-class Create action is present in runtime wiring and classified as a click", () => {
  for (const id of ACTION_IDS) {
    assert.match(app, new RegExp(id), `${id} must be referenced by the runtime`);
    assert.equal(CREATE_CONTROL_CONTRACT[id].event, "click", `${id} must declare click wiring`);
  }
  assert.match(app, /showcasePlayButton[\s\S]*?player\.toggle\(\)/);
  assert.match(app, /showcaseSimilarButton[\s\S]*?runGeneration\("songVariations"\)/);
  assert.match(app, /keyTransposeDown[\s\S]*?transposeKey\(-1\)/);
  assert.match(app, /keyTransposeUp[\s\S]*?transposeKey\(1\)/);
  assert.match(app, /newRecipeButton[\s\S]*?chooseRecipe/);
});

test("Create presentation applies the contract after moving controls into their final layout", () => {
  const essentials = createPresentation.indexOf("moveGenerationEssentials(rootDocument, createPanel)");
  const advanced = createPresentation.indexOf("consolidateAdvancedDirection(rootDocument, createPanel)");
  const contract = createPresentation.indexOf("applyCreateControlContract(rootDocument, createPanel)");
  assert.ok(essentials > 0 && advanced > essentials && contract > advanced);
  assert.match(createPresentation, /import \{ applyCreateControlContract \} from "\.\/create-control-contract\.js"/);
});

test("Element buttons have distinct contextual help instead of generic variation copy", () => {
  assert.deepEqual(createControlHelp({ dataset: { songVariation: "0" } })[0], "Fire");
  assert.deepEqual(createControlHelp({ dataset: { songVariation: "1" } })[0], "Electric");
  assert.deepEqual(createControlHelp({ dataset: { songVariation: "2" } })[0], "Drip");
  assert.match(createControlHelp({ dataset: { songVariation: "0" } })[1], /impact|punch|groove/i);
  assert.match(createControlHelp({ dataset: { songVariation: "1" } })[1], /motion|syncopation|hook/i);
  assert.match(createControlHelp({ dataset: { songVariation: "2" } })[1], /space|harmony|flow/i);
});

test("Create contract stays import-safe without browser globals", () => {
  assert.equal(applyCreateControlContract(undefined, undefined), false);
  assert.equal(createControlHelp(null), null);
});
