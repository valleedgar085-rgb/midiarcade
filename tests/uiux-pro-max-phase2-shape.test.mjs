import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const html = source("index.html");
const app = source("src/app.js");
const css = source("src/ui/shape-workspace.css");
const build = source("scripts/build.js");

test("Shape reveals the original piano roll ahead of optional auditions", () => {
  const editor = html.slice(html.indexOf('id="sectionEditor"'), html.indexOf('id="tab-mix"'));
  assert.ok(editor.length > 0);
  assert.ok(editor.indexOf('id="editorSectionSwitch"') < editor.indexOf('id="editorTrackTabs"'));
  assert.ok(editor.indexOf('id="editorTrackTabs"') < editor.indexOf('id="shapeNoteDetail"'));
  assert.ok(editor.indexOf('id="shapeNoteDetail"') < editor.indexOf('id="editorShapeTools"'));
  assert.equal((html.match(/id="shapeNoteDetail"/g) || []).length, 1);
  assert.equal((html.match(/id="editorShapeTools"/g) || []).length, 1);
  assert.match(html, /Piano roll · Edit notes/);
  assert.match(html, /id="sectionEditorTitle" aria-live="polite"/);
});

test("Selecting an instrument clip opens the existing note editor, not a new editing authority", () => {
  const focus = app.match(/export function focusSongSection\([\s\S]*?\n}\n/)?.[0] ?? "";
  const timeline = app.match(/function bindTimelineInteractions\([\s\S]*?\n}\n/)?.[0] ?? app;
  assert.match(focus, /state\.sectionEditorOpen = Boolean\(openEditor\)/);
  assert.match(focus, /if \(openEditor && \$\("#shapeNoteDetail"\)\) \$\("#shapeNoteDetail"\)\.open = true/);
  assert.match(focus, /renderSectionEditor\(\)/);
  assert.match(timeline, /openEditor: Boolean\(clip\.dataset\.editorTrack\)/);
  assert.match(app, /\(open \? \$\("#editorShapeTools"\) : \$\("#sectionShaperContent"\)\)\?\.append\(panel\)/);
});

test("Shape instrument tabs support keyboard roving focus and announce the selected track", () => {
  const tabs = app.match(/\$\("#editorTrackTabs"\)\.innerHTML = TRACK_ORDER\.map\([\s\S]*?\)\.join\("("|'')\);/)?.[0] ?? app;
  assert.match(tabs, /aria-selected="\$\{id === state\.editorTrack\}"/);
  assert.match(tabs, /tabindex="\$\{id === state\.editorTrack \? 0 : -1\}"/);
  assert.match(tabs, /aria-label="Edit \$\{trackMeta\.name\} notes"/);
  const binding = app.match(/function bindSectionEditorInteractions\([\s\S]*?function renderSectionEditor/)?.[0] ?? "";
  for (const key of ["ArrowLeft", "ArrowRight", "Home", "End"]) assert.ok(binding.includes(`"${key}"`));
  assert.match(binding, /event\.preventDefault\(\)/);
  assert.match(binding, /tabs\[nextIndex\]\.click\(\)/);
  assert.match(binding, /\?\.focus\(\)/);
});

test("Shape visual improvements remain scoped and ship through the existing stylesheet", () => {
  assert.match(css, /UI\/UX Pro Max Phase 2/);
  assert.match(css, /\.editor-track-tab\[aria-selected="true"\]/);
  assert.match(css, /\.shape-note-detail\[open\]/);
  assert.match(css, /min-height:\s*48px/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
  assert.match(css, /forced-colors:\s*active/);
  assert.match(build, /'midnight-studio\.css', 'shape-workspace\.css'/);
  assert.match(build, /androidPublicDir, 'midnight-studio\.css'/);
});
