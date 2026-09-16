import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const css = fs.readFileSync(new URL("../src/ui/solar-pop.css", import.meta.url), "utf8");
const build = fs.readFileSync(new URL("../scripts/build.js", import.meta.url), "utf8");
const buildQuality = fs.readFileSync(new URL("../scripts/check-build-quality.js", import.meta.url), "utf8");

test("Solar Pop preserves the Figma palette as explicit local design tokens", () => {
  for (const token of [
    "--solar-ink:#1a1a2e",
    "--solar-cream:#fff8f0",
    "--solar-coral:#ff4f4f",
    "--solar-yellow:#ffd60a",
    "--solar-orange:#ff9f1c",
    "--solar-pink:#ff6b8b",
    "--solar-cyan:#2bc0d2",
    "--solar-muted:#8e8ea8",
  ]) assert.match(css, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(css, /https?:\/\//, "Solar Pop must remain local-first and must not depend on expiring Figma assets");
});

test("Solar Pop themes the existing Create Shape Mix Finish shell rather than replacing behavior", () => {
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

test("Solar Pop ships after existing workspace CSS in web and Android builds", () => {
  assert.match(build, /src', 'ui', 'solar-pop\.css'/);
  assert.match(build, /path\.join\(wwwDir, 'solar-pop\.css'\)/);
  assert.match(build, /href=\"\.\/shape-director\.css\"><link rel=\"stylesheet\" href=\"\.\/solar-pop\.css\"/);
  assert.match(build, /androidPublicDir[\s\S]*?wwwDir, 'solar-pop\.css'/);
});

test("Solar Pop adds a per-file cap without increasing the prior aggregate CSS ceiling", () => {
  assert.match(buildQuality, /"www\/solar-pop\.css": 16 \* 1024/);
  assert.match(buildQuality, /aggregateCssBudget = \(150 \+ 16 \+ 16\) \* 1024/);
  assert.match(buildQuality, /aggregateCssBytes > aggregateCssBudget/);
});