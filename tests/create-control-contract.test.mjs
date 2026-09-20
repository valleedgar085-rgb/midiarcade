import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  applyCreateControlContract,
  CREATE_CONTROL_CONTRACT,
  CREATE_CONTROL_IDS,
  CREATE_SELECTOR_CONTRACT,
  createControlHelp,
} from "../src/ui/create-control-contract.js";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const createPresentation = fs.readFileSync(new URL("../src/ui/create-workflow-phase1.js", import.meta.url), "utf8");
const createStart = html.lastIndexOf("<div", html.indexOf('id="tab-create"'));
const createEnd = html.indexOf("<!-- ARRANGE TAB -->", createStart);
const createHtml = html.slice(createStart, createEnd);

const EXPECTED_CREATE_IDS = [
  "renameButton",
  "showcasePlayButton",
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
  "creativeRangeControl",
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
  "trapIntroModeControl",
  "surpriseControl",
  "generateNew",
  "generateSimilar",
];

const EXPECTED_SELECTOR_KEYS = [
  "workflow-step-direct",
  "workflow-step-listen",
  "workflow-step-shape",
  "workflow-step-export",
  "song-insight-toggle",
  "workflow-guide-toggle",
  "song-shape-toggle",
  "recipe-toggle",
  "fine-tune-toggle",
];

const RUNTIME_CREATE_IDS = ["creativeRangeControl"];
const STATIC_CREATE_IDS = EXPECTED_CREATE_IDS.filter((id) => !RUNTIME_CREATE_IDS.includes(id));

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

const CHANGE_IDS = [
  "tasteRating",
  "genreControl",
  "secondaryGenreControl",
  "barsControl",
  "grooveControl",
  "creativeRangeControl",
  "keyControl",
  "modeControl",
  "chordPathControl",
  "trapIntroModeControl",
];

function makeControl(id = "", dataset = {}) {
  const attributes = new Map();
  return {
    id,
    dataset: { ...dataset },
    textContent: "",
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    closest() { return this; },
  };
}

test("Create control contract covers every first-class Create control exactly once", () => {
  assert.deepEqual(CREATE_CONTROL_IDS, EXPECTED_CREATE_IDS);
  assert.equal(Object.isFrozen(CREATE_CONTROL_CONTRACT), true);
  for (const id of STATIC_CREATE_IDS) {
    assert.equal((createHtml.match(new RegExp(`id=["']${id}["']`, "g")) || []).length, 1, `${id} must exist exactly once in static Create HTML`);
  }
  for (const id of RUNTIME_CREATE_IDS) {
    assert.equal((createHtml.match(new RegExp(`id=["']${id}["']`, "g")) || []).length, 0, `${id} must stay out of protected initial HTML`);
    assert.equal((createPresentation.match(new RegExp(`id=["']${id}["']`, "g")) || []).length, 1, `${id} must be mounted exactly once by Create presentation`);
  }
});

test("selector contract covers workflow steps and every Create disclosure", () => {
  assert.equal(Object.isFrozen(CREATE_SELECTOR_CONTRACT), true);
  assert.deepEqual(CREATE_SELECTOR_CONTRACT.map(({ key }) => key), EXPECTED_SELECTOR_KEYS);
  assert.equal(new Set(CREATE_SELECTOR_CONTRACT.map(({ key }) => key)).size, CREATE_SELECTOR_CONTRACT.length, "selector contract keys must stay unique");
  assert.equal(new Set(CREATE_SELECTOR_CONTRACT.map(({ selector }) => selector)).size, CREATE_SELECTOR_CONTRACT.length, "selector contract selectors must stay unique");

  for (let step = 1; step <= 4; step += 1) {
    assert.equal((createHtml.match(new RegExp(`data-workflow-step=["']${step}["']`, "g")) || []).length, 1, `workflow step ${step} must stay unique`);
  }
  assert.equal((createHtml.match(/<summary\b/g) || []).length, 5, "every Create disclosure must remain in the selector contract budget");
});

test("every interactive Create element is contract-covered so new controls fail closed", () => {
  const interactiveTags = [...createHtml.matchAll(/<(button|input|select|summary)\b[^>]*>/g)].map((match) => match[0]);
  const idTags = interactiveTags.filter((tag) => /\bid=["'][^"']+["']/.test(tag));
  const variationTags = interactiveTags.filter((tag) => /\bdata-song-variation=["']/.test(tag));
  const workflowStepTags = interactiveTags.filter((tag) => /\bdata-workflow-step=["']/.test(tag));
  const summaryTags = interactiveTags.filter((tag) => /^<summary\b/.test(tag));

  assert.equal(idTags.length, STATIC_CREATE_IDS.length, "every static ID-based Create interactive must be declared in CREATE_CONTROL_CONTRACT");
  for (const tag of idTags) {
    const id = tag.match(/\bid=["']([^"']+)["']/)?.[1];
    assert.ok(CREATE_CONTROL_IDS.includes(id), `${id} is interactive but missing from CREATE_CONTROL_CONTRACT`);
  }

  assert.equal(variationTags.length, 3, "Fire, Electric and Drip must remain three explicit Element choices");
  assert.equal(workflowStepTags.length, 4, "all four workflow-step buttons must be covered");
  assert.equal(summaryTags.length, 5, "all five Create disclosures must be covered");
  assert.equal(workflowStepTags.length + summaryTags.length, CREATE_SELECTOR_CONTRACT.length, "selector contract must cover every non-ID structural interactive");
  assert.equal(interactiveTags.length, STATIC_CREATE_IDS.length + CREATE_SELECTOR_CONTRACT.length + variationTags.length, "adding any static Create interactive requires an explicit contract entry");
  assert.deepEqual(RUNTIME_CREATE_IDS, ["creativeRangeControl"], "runtime-mounted Create controls must remain an explicit, narrow exception");
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
  for (const contract of CREATE_SELECTOR_CONTRACT) {
    assert.match(contract.label, /\S/, `${contract.key} needs a visible label`);
    assert.ok(contract.help.length >= 45, `${contract.key} help should explain consequences`);
    assert.ok(allowedIntents.has(contract.intent), `${contract.key} needs a valid intent group`);
    assert.equal(contract.event, "click", `${contract.key} must declare click wiring`);
    assert.deepEqual(createControlHelp({ id: "", dataset: { createControl: contract.key } }), [contract.label, contract.help]);
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
  assert.match(app, /keyTransposeDown[\s\S]*?transposeKey\(-1\)/);
  assert.match(app, /keyTransposeUp[\s\S]*?transposeKey\(1\)/);
  assert.match(app, /newRecipeButton[\s\S]*?chooseRecipe/);
});

test("every change-driven Create control is represented by runtime change wiring", () => {
  for (const id of CHANGE_IDS) {
    assert.match(app, new RegExp(id), `${id} must be referenced by runtime change wiring`);
    assert.equal(CREATE_CONTROL_CONTRACT[id].event, "change", `${id} must declare change wiring`);
  }
  assert.match(app, /tasteRating[\s\S]*?addEventListener\("change"/);
  assert.match(app, /genreControl[\s\S]*?addEventListener\("change"/);
  assert.match(app, /secondaryGenreControl[\s\S]*?addEventListener\("change"/);
  assert.match(app, /creativeRangeControl[\s\S]*?addEventListener\("change"/);
  assert.match(app, /barsControl[\s\S]*?grooveControl[\s\S]*?addEventListener\("change"/);
  assert.match(app, /keyControl[\s\S]*?modeControl[\s\S]*?chordPathControl[\s\S]*?addEventListener\("change"/);
});

test("workflow-step buttons have explicit runtime click wiring", () => {
  assert.match(app, /\$\$\('\[data-workflow-step\]'\)\.forEach\(\(button\) => button\.addEventListener\("click"/);
  for (let step = 1; step <= 4; step += 1) {
    const contract = CREATE_SELECTOR_CONTRACT.find(({ key }) => key === ["", "workflow-step-direct", "workflow-step-listen", "workflow-step-shape", "workflow-step-export"][step]);
    assert.equal(contract?.event, "click");
  }
});

test("contract application wires IDs, selectors and Element buttons through one delegated help path", () => {
  const idControls = Object.fromEntries(CREATE_CONTROL_IDS.map((id) => [id, makeControl(id)]));
  const selectorControls = new Map(CREATE_SELECTOR_CONTRACT.map((contract) => [contract.selector, [makeControl()]]));
  const elementControls = [0, 1, 2].map((index) => makeControl("", { songVariation: String(index) }));
  const listeners = new Map();
  const panel = {
    dataset: {},
    querySelector(selector) {
      return selector.startsWith("#") ? idControls[selector.slice(1)] ?? null : null;
    },
    querySelectorAll(selector) {
      if (selector === "[data-song-variation]") return elementControls;
      return selectorControls.get(selector) ?? [];
    },
    addEventListener(eventName, handler) { listeners.set(eventName, handler); },
  };
  const title = { textContent: "" };
  const text = { textContent: "" };
  const rootDocument = {
    querySelector(selector) {
      if (selector === "#tab-create") return panel;
      if (selector === "#contextHelpTitle") return title;
      if (selector === "#contextHelpText") return text;
      return null;
    },
  };

  assert.equal(applyCreateControlContract(rootDocument, panel), true);
  const expectedCount = CREATE_CONTROL_IDS.length + CREATE_SELECTOR_CONTRACT.length + elementControls.length;
  assert.equal(panel.dataset.createContractCount, String(expectedCount));
  assert.equal(panel.dataset.createContractWired, "true");
  assert.deepEqual([...listeners.keys()], ["focusin", "pointerover", "input", "change", "click"]);

  for (const id of CREATE_CONTROL_IDS) {
    assert.equal(idControls[id].dataset.createControl, id);
    assert.equal(idControls[id].dataset.createEvent, CREATE_CONTROL_CONTRACT[id].event);
  }
  for (const contract of CREATE_SELECTOR_CONTRACT) {
    const [control] = selectorControls.get(contract.selector);
    assert.equal(control.dataset.createControl, contract.key);
    assert.equal(control.dataset.createEvent, "click");
  }
  assert.deepEqual(elementControls.map((control) => control.dataset.createControl), ["element-0", "element-1", "element-2"]);

  const workflowControl = selectorControls.get('[data-workflow-step="1"]')[0];
  listeners.get("click")({ target: workflowControl });
  assert.equal(panel.dataset.createLastControl, "workflow-step-direct");
  assert.equal(title.textContent, "Workflow step: Direct");
  assert.match(text.textContent, /musical intent/i);
});

test("Create presentation applies the contract after moving controls into their final layout", () => {
  const calls = createPresentation.match(/mountCreativeRangeControl\(rootDocument, createPanel\);[\s\S]*?upgradeStaticCreateCopy\(rootDocument, createPanel\);[\s\S]*?moveGenerationEssentials\(rootDocument, createPanel\);[\s\S]*?consolidateAdvancedDirection\(rootDocument, createPanel\);[\s\S]*?moveOptionalGuide\(createPanel\);[\s\S]*?applyCreateControlContract\(rootDocument, createPanel\);/);
  assert.ok(calls, "Create contract must run after all control-moving presentation transforms");
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
