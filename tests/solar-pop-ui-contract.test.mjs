import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(new URL("../src/ui/solar-pop.css", import.meta.url), "utf8");
const build = fs.readFileSync(new URL("../scripts/build.js", import.meta.url), "utf8");
const buildQuality = fs.readFileSync(new URL("../scripts/check-build-quality.js", import.meta.url), "utf8");

test("Figma Studio preserves its dark palette as explicit local design tokens", () => {
  for (const token of [
    "--figma-bg:#0d0e11",
    "--figma-surface:#15171c",
    "--figma-surface-2:#1c1f26",
    "--figma-border:#262a33",
    "--figma-orange:#ff5500",
    "--figma-text:#f3f4f6",
    "--figma-muted:#9ca3af",
  ]) assert.match(css, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(css, /https?:\/\//, "Solar Pop must remain local-first and must not depend on expiring Figma assets");
});

test("Figma Studio themes the existing Create Shape Mix Finish shell rather than replacing behavior", () => {
  for (const selector of ["#tab-create", "#tab-arrange", "#tab-mix", "#tab-finish", ".transport", ".topbar", ".tab-nav"]) {
    assert.ok(css.includes(selector), `${selector} should participate in the Solar Pop system`);
  }
  assert.match(css, /#tab-create \.song-showcase/);
  assert.match(css, /#preGenSection \.generation-actions-bar/);
  assert.match(css, /#tab-arrange \.shape-stage/);
  assert.match(css, /#tab-arrange \.shape-director-panel/);
  assert.match(css, /@media\(max-width:680px\)/);
  assert.match(css, /@media\(orientation:landscape\) and \(max-height:720px\)/);
});

test("Figma Studio ships after existing workspace CSS in web and Android builds", () => {
  assert.match(build, /src', 'ui', 'solar-pop\.css'/);
  assert.match(build, /path\.join\(wwwDir, 'solar-pop\.css'\)/);
  assert.match(build, /href=\"\.\/shape-director\.css\"><link rel=\"stylesheet\" href=\"\.\/solar-pop\.css\"/);
  assert.match(build, /androidPublicDir[\s\S]*?wwwDir, 'solar-pop\.css'/);
});

test("Figma Studio adds a per-file cap with an updated base stylesheet allowance", () => {
  assert.match(buildQuality, /"www\/solar-pop\.css": 16 \* 1024/);
  assert.match(buildQuality, /"www\/styles\.css": 160 \* 1024/);
  assert.match(buildQuality, /aggregateCssBudget = \(150 \+ 16 \+ 16\) \* 1024/);
  assert.match(buildQuality, /aggregateCssBytes > aggregateCssBudget/);
});

test("Create uses the Figma orange action hierarchy without Solar Pop decoration", () => {
  assert.match(css, /#tab-create \.song-showcase\{[\s\S]*?var\(--figma-surface\)/);
  assert.match(css, /#preGenSection \.generation-new\{[\s\S]*?var\(--figma-orange\)/);
  assert.doesNotMatch(css, /#f23846/);
});


test("Create keeps the Figma desktop and phone hierarchy", () => {
  assert.match(css, /#tab-create>\.create-console\{display:grid;grid-template-columns:minmax\(0,1\.1fr\) minmax\(320px,\.9fr\);gap:20px\}/);
  assert.match(css, /@media\(max-width:680px\)[\s\S]*?#tab-create>\.create-console\{display:flex;gap:16px\}/);
});
