import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/ui/shape-director.css", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

test("Shape Director exposes scope, strength, directions, locks and A/B commit controls", () => {
  assert.match(html, /id="shapeDirectorPanel"[\s\S]*?id="shapeDirectorTarget"[\s\S]*?id="shapeDirectorSize"/);
  assert.match(html, /id="shapeDirectorCompose"[\s\S]*?data-shape-compose/);
  assert.match(html, /id="shapeDirectorDirections"/);
  assert.doesNotMatch(html, /data-shape-direction=/);
  assert.match(app, /Object\.values\(SHAPE_QUICK_DIRECTIONS\)[\s\S]*?data-shape-direction/);
  assert.match(html, /data-shape-preserve="melody"[\s\S]*?data-shape-preserve="instrument"/);
  assert.match(html, /id="shapeDirectorAudition"[\s\S]*?data-shape-discard[\s\S]*?data-shape-accept/);
  assert.doesNotMatch(html, /data-shape-audition=/);
  assert.match(app, /shapeDirectorAudition[\s\S]*?data-shape-audition="before"[\s\S]*?data-shape-audition="after"/);
});

test("Shape Director runtime remains candidate-first and history-safe", () => {
  assert.match(app, /createShapeIntent[\s\S]*?createShapeCandidate/);
  assert.match(app, /function prepareShapeDirectorCandidate[\s\S]*?transaction\.status !== "candidate"/);
  assert.match(app, /function prepareBlueprintCompositionCandidate[\s\S]*?generationExecutor\.run\("compositionCandidate"/);
  assert.match(app, /acceptShapeDirectorCandidate[\s\S]*?acceptCompositionCandidate\(transaction\)/);
  assert.match(app, /function auditionShapeDirector[\s\S]*?auditionShapeCandidate/);
  assert.match(app, /function acceptShapeDirectorCandidate[\s\S]*?pushHistory[\s\S]*?transaction\.after/);
  assert.match(app, /function discardShapeDirectorCandidate[\s\S]*?transaction\.before/);
});

test("Shape keeps audition options grouped and makes direct note editing prominent", () => {
  assert.match(html, /id="shapeDirectorDirections"[\s\S]*?id="shapeDirectorCandidate"[\s\S]*?class="shape-change-options"/);
  assert.match(html, /<details class="shape-change-options">[\s\S]*?id="shapeDirectorTarget"[\s\S]*?id="shapeDirectorSize"/);
  assert.match(html, /<details class="shape-new-idea">[\s\S]*?id="shapeDirectorCompose"/);
  assert.match(html, /id="shapeDirectorTitle">2 · Choose a change/);
  assert.match(html, /id="shapeNoteDetail">[\s\S]*?Piano roll · Edit notes/);
  const editor = html.slice(html.indexOf('id="sectionEditor"'), html.indexOf('id="tab-mix"'));
  assert.ok(editor.indexOf('id="shapeNoteDetail"') < editor.indexOf('id="editorShapeTools"'), "focused direct note editor comes before optional audition tools");
});

test("Shape Director is touch friendly and landscape aware", () => {
  assert.match(css, /\.shape-director-directions button\{[\s\S]*?min-height:36px/);
  assert.match(css, /@media\(max-width:680px\)[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:680px\)[\s\S]*?min-height:42px/);
  assert.match(css, /@media\(orientation:landscape\) and \(max-height:720px\)[\s\S]*?\.shape-director-panel/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});

test("Blueprint Composer is a distinct touch-safe Shape action", () => {
  assert.match(css, /\.shape-blueprint-compose\{[\s\S]*?min-height:46px/);
  assert.match(css, /\.shape-blueprint-compose:disabled/);
  assert.match(app, /director\.target === "notes"[\s\S]*?Select an instrument first/);
});
