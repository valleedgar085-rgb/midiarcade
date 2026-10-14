import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { SHAPE_QUICK_DIRECTIONS, SHAPE_CHANGE_SIZES } from "../src/core/shape-director-policy.js";

const src = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const html = src("index.html");
const app = src("src/app.js");
const css = src("src/ui/shape-workspace.css");
const shape = html.slice(html.indexOf('id="tab-arrange"'), html.indexOf('id="tab-mix"'));

test("Shape keeps simple musical labels and the unchanged rewrite budgets", () => {
  assert.deepEqual(Object.entries(SHAPE_QUICK_DIRECTIONS).map(([id, value]) => [id, value.label]), [
    ["moreBounce", "Better Groove"], ["harder", "More Punch"],
    ["simpler", "Simplify"], ["busier", "Add Notes"],
    ["moreEmotional", "More Feeling"], ["moreSpace", "Make Space"],
    ["catchier", "Catchier Hook"], ["darker", "Deeper Sound"],
    ["brighter", "Brighter Sound"], ["buildUp", "Build Energy"],
    ["calmDown", "Dial It Back"],
  ]);
  assert.deepEqual(Object.values(SHAPE_CHANGE_SIZES).map((v) => v.label), ["Small", "Medium", "Large"]);
  assert.ok(SHAPE_CHANGE_SIZES.touchUp.rewriteBudget < SHAPE_CHANGE_SIZES.reshape.rewriteBudget);
  assert.ok(SHAPE_CHANGE_SIZES.reshape.rewriteBudget < SHAPE_CHANGE_SIZES.transform.rewriteBudget);
});

test("new map, part studio and piano roll are three distinct preserved workspaces", () => {
  assert.match(shape, /id="arrangementTitle">Shape Studio/);
  assert.match(shape, /id="shapeMapWorkspace"/);
  assert.match(shape, /class="shape-part-content" id="sectionShaperContent" hidden/);
  assert.match(shape, /class="shape-open-editor" type="button" data-section-action="edit"/);
  assert.match(shape, /class="shape-song-timeline"/);
  assert.match(shape, /id="timeline"/);
  assert.match(shape, /id="sectionEditor"/);
  const timeline = shape.indexOf('id="timeline"');
  const studio = shape.indexOf('id="shapeDirectorPanel"');
  const editor = shape.indexOf('id="sectionEditor"');
  assert.ok(timeline < studio && studio < editor);
  assert.match(css, /\.has-section-focus \.shape-map-column/);
  assert.match(css, /\.section-editor\.is-open/);
  assert.match(css, /\[hidden\]\[hidden\]/);
});

test("main loop is selection, quick change, listen to Original/Preview, accept or reject", () => {
  assert.match(shape, /1 · Choose a part/);
  assert.match(shape, /2 · Choose a change/);
  assert.match(shape, /3 · LISTEN AND COMPARE/);
  assert.match(shape, /id="shapeDirectorDirections" role="group" aria-label="Choose a musical change"/);
  assert.match(shape, /data-shape-discard>Keep Original/);
  assert.match(shape, /data-shape-accept>Use This Change/);
  assert.match(app, /data-shape-audition="before">Original/);
  assert.match(app, /data-shape-audition="after">Preview/);
  assert.match(app, /createShapeCandidate\(state\.song, intent/);
  assert.match(app, /setShapeActionCopy\(button, entry\.direction\)/);
  assert.match(app, /button\.hidden = panel\.dataset\.shapeMore !== "true"/);
  assert.match(app, /Show fewer changes/);
  assert.match(app, /See all changes/);
});

test("help and immediate edits are deliberately separated from non-destructive previews", () => {
  const inspector = shape.indexOf('id="shapeInspector"');
  const directions = shape.indexOf('id="shapeDirectorDirections"');
  const candidate = shape.indexOf('id="shapeDirectorCandidate"');
  const editor = shape.indexOf('id="sectionEditor"');
  assert.ok(directions < candidate && candidate < inspector && inspector < editor);
  assert.match(shape, /<details class="shape-inspector shape-advice-panel"/);
  assert.match(shape, /<summary><span><strong>Why these changes\?/);
  assert.match(shape, /id="shapeInspectorInsights" role="list"/);
  assert.match(shape, /class="shape-advanced-rack"/);
  assert.match(shape, /class="shape-extra-feel"/);
  assert.match(shape, /These controls edit the song immediately\. Use Undo/);
  assert.match(shape, /data-section-macro="density"/);
  assert.match(shape, /data-section-bars/);
  assert.match(shape, /class="shape-new-idea"/);
  assert.match(shape, /class="section-actions-menu"/);
  assert.match(shape, /id="shapeDirectorTarget"/);
  assert.match(shape, /id="shapeDirectorSize"/);
  assert.match(shape, /data-shape-preserve="rhythm"/);
});

test("all canonical event targets and legacy piano roll actions survive the rebuild", () => {
  for (const id of [
    "shapeDirectorPanel", "shapeDirectorDirections", "shapeDirectorCandidate",
    "shapeDirectorAudition", "shapeDirectorTarget", "shapeDirectorSize",
    "shapeDirectorCompose", "shapeDirectorStatus", "sectionShaper",
    "sectionShaperContent", "sectionShaperEmpty", "sectionShaperPlay",
    "timeline", "timelineRuler", "editorShapeTools", "shapeInspectorScope",
    "shapeInspectorInsights", "sectionShaperStatus", "sectionEditor",
  ]) assert.equal(shape.split('id="' + id + '"').length - 1, 1, id);
  for (const action of ["select-all", "quantize", "humanize", "shorter", "longer", "duplicate", "delete"]) {
    assert.ok(shape.includes('data-editor-action="' + action + '"'), action);
  }
  assert.match(app, /sectionEditorOpen/);
  assert.match(app, /editorShapeTools/);
  assert.match(app, /renderShapeDirector\(section\)/);
});

test("new stylesheet is fully Shape-scoped, readable, responsive and touch-safe", () => {
  assert.match(css, /#tab-arrange \{/);
  assert.match(css, /--shape-accent:/);
  assert.match(css, /#tab-arrange \.shape-stage/);
  assert.match(css, /grid-template-columns:minmax\(0,1\.35fr\) minmax\(360px,\.86fr\)/);
  assert.match(css, /min-height:71px/);
  assert.match(css, /min-height:48px/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /@media\(max-width:1080px\)/);
  assert.match(css, /@media\(max-width:640px\)/);
  assert.match(css, /@media\(max-width:360px\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /@media\(forced-colors:active\)/);
});
