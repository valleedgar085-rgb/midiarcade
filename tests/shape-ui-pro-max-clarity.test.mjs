import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { SHAPE_QUICK_DIRECTIONS, SHAPE_CHANGE_SIZES } from "../src/core/shape-director-policy.js";

const src = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const html = src("index.html");
const app = src("src/app.js");
const css = src("src/ui/shape-workspace.css");
const shapeMarkup = html.slice(html.indexOf('id="tab-arrange"'), html.indexOf('id="tab-mix"'));

test("Shape's eleven directions have clear words without changing IDs or number of controls", () => {
  assert.deepEqual(Object.entries(SHAPE_QUICK_DIRECTIONS).map(([id, item]) => [id, item.label]), [
    ["moreBounce", "Better Groove"], ["harder", "More Punch"],
    ["simpler", "Simplify"], ["busier", "Add Notes"],
    ["moreEmotional", "More Feeling"], ["moreSpace", "Make Space"],
    ["catchier", "Catchier Hook"], ["darker", "Deeper Sound"],
    ["brighter", "Brighter Sound"], ["buildUp", "Build Energy"],
    ["calmDown", "Dial It Back"],
  ]);
  assert.deepEqual(Object.values(SHAPE_CHANGE_SIZES).map((entry) => entry.label),
    ["Small", "Medium", "Large"]);
  assert.ok(SHAPE_CHANGE_SIZES.touchUp.rewriteBudget < SHAPE_CHANGE_SIZES.reshape.rewriteBudget);
  assert.ok(SHAPE_CHANGE_SIZES.reshape.rewriteBudget < SHAPE_CHANGE_SIZES.transform.rewriteBudget);
});

test("Shape presents a plain-language choose-change-compare flow", () => {
  assert.match(shapeMarkup, /1 · Choose a part/);
  assert.match(shapeMarkup, /2 · Choose a change/);
  assert.match(shapeMarkup, /3 · LISTEN AND COMPARE/);
  assert.match(shapeMarkup, /id="shapeDirectorDirections" role="group" aria-label="Choose a musical change"/);
  assert.match(shapeMarkup, /Suggested for this part/);
  assert.match(shapeMarkup, /id="shapeInspectorInsights" role="list"/);
  assert.match(shapeMarkup, /data-shape-discard>Keep Original/);
  assert.match(shapeMarkup, /data-shape-accept>Use This Change/);
  assert.match(shapeMarkup, /<summary>Change settings/);
  assert.match(shapeMarkup, /APPLY TO/);
  assert.match(shapeMarkup, /CHANGE STRENGTH/);
  assert.match(shapeMarkup, /Open Piano Roll/);
  assert.match(shapeMarkup, /data-editor-action="quantize">Fix Timing/);
  assert.match(shapeMarkup, /data-editor-action="humanize">Natural Timing/);
  assert.match(shapeMarkup, /data-editor-action="select-all">Select All Notes/);
  assert.match(app, /data-shape-audition="before">Original/);
  assert.match(app, /data-shape-audition="after">Preview/);
  assert.match(app, /setShapeActionCopy\(button, entry/);
  assert.match(app, /aria-label", direction\.label \+ "\. " \+ hint\.textContent/);
  assert.match(app, /button\.hidden = panel\.dataset\.shapeMore !== "true"/);
});

test("Shape action cards are responsive, touch-safe and accessible", () => {
  assert.match(css, /#tab-arrange \.shape-director-directions > button\[data-shape-direction\][\s\S]*?min-height: 78px/);
  assert.match(css, /#tab-arrange \.shape-director-directions > button\[hidden\] \{ display: none !important; \}/);
  assert.match(css, /#tab-arrange \.shape-director-candidate\[hidden\] \{ display: none !important; \}/);
  assert.match(css, /\.shape-director-directions > button\.is-selected/);
  assert.match(css, /@media \(max-width: 740px\)/);
  assert.match(css, /@media \(max-width: 380px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /@media \(forced-colors: active\)/);
  assert.match(css, /:focus-visible/);
});

test("UI simplification keeps existing Shape event bindings and progressive disclosure", () => {
  for (const binding of [
    "shapeDirectorPanel", "shapeDirectorDirections", "shapeDirectorCandidate",
    "shapeDirectorAudition", "shapeDirectorSize", "shapeDirectorTarget",
    "shapeDirectorCompose", "shapeDirectorStatus",
  ]) assert.ok(shapeMarkup.includes('id="' + binding + '"'), binding);
  for (const action of ["catchier", "moreBounce", "moreSpace", "busier"]) {
    assert.ok(SHAPE_QUICK_DIRECTIONS[action], action);
  }
  assert.match(app, /createShapeCandidate\(state\.song, intent/);
  assert.match(app, /data-shape-more/);
  assert.match(app, /Show fewer changes/);
  assert.match(app, /See all changes/);
  assert.match(app, /director\.transaction/);
  assert.match(app, /setShapeActionCopy\(button, entry\.direction\)/);
  assert.match(app, /button\.dataset\.shapeDirection/);
});
