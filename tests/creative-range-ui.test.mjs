import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const presentation = fs.readFileSync(new URL("../src/ui/create-workflow-phase1.js", import.meta.url), "utf8");
const sessionRuntime = fs.readFileSync(new URL("../src/core/session-runtime.js", import.meta.url), "utf8");

test("Create mounts one neutral-by-default Creative Range selector without growing initial HTML", () => {
  const block = presentation.match(/function mountCreativeRangeControl[\s\S]*?function moveGenerationEssentials/)?.[0] ?? "";
  assert.equal((html.match(/creativeRangeControl/g) || []).length, 0, "Creative Range must not consume the protected initial HTML budget");
  assert.equal((block.match(/id="creativeRangeControl"/g) || []).length, 1);
  assert.match(block, /<option value="" selected>Default · existing behavior<\/option>/);
  for (const value of ["familiar", "fresh", "wild"]) {
    assert.equal((block.match(new RegExp(`value="${value}"`, "g")) || []).length, 1);
  }
  assert.match(presentation, /mountCreativeRangeControl\(rootDocument, createPanel\);[\s\S]*?applyCreateControlContract\(rootDocument, createPanel\);/);
});

test("buildConfig omits Creative Range unless the selected value is valid", () => {
  const buildConfig = app.match(/export function buildConfig[\s\S]*?const GENERATION_SETTING_IDS/)?.[0] ?? "";
  assert.match(buildConfig, /normalizeCreativeRange\(\$\("#creativeRangeControl"\)\?\.value\)/);
  assert.match(buildConfig, /\.\.\.\(creativeRange \? \{ creativeRange \} : \{\}\)/);
  assert.doesNotMatch(buildConfig, /creativeRange:\s*["']fresh["']/);
});

test("Creative Range participates in staged direction, reset, change wiring and session restore", () => {
  assert.match(app, /GENERATION_SETTING_IDS[\s\S]*?creativeRangeControl/);
  assert.match(app, /creativeRangeControl[\s\S]*?addEventListener\("change"/);
  assert.match(app, /resetControlsButton[\s\S]*?creativeRangeControl\"\)\.value = \"\"/);
  assert.match(sessionRuntime, /GENERATION_PREFERENCE_IDS[\s\S]*?creativeRangeControl/);
});
