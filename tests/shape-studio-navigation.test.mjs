import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) => fs.readFileSync(new URL("../" + path, import.meta.url), "utf8");
const markup = source("index.html").split('id="tab-arrange"')[1].split('id="tab-mix"')[0];
const app = source("src/app.js");
const styles = source("src/ui/shape-workspace.css");

test("Shape has an explicit, accessible section and instrument picker", () => {
  assert.match(markup, /id="shapeSectionPicker" aria-label="Section to shape"/);
  assert.match(markup, /id="shapeTrackPicker" aria-label="Instrument to shape"/);
  assert.match(markup, /id="shapePickPartButton">Open Part Studio/);
  assert.match(markup, /id="shapeMapWorkspace"/);
  assert.match(styles, /\.shape-part-picker/);
  assert.match(styles, /#tab-arrange #shapePickPartButton[\s\S]*?min-height:50px/);
});

test("tapping an instrument clip goes to Part Studio instead of the Piano Roll", () => {
  const binding = app.slice(app.indexOf('function bindTimelineInteractions('),
    app.indexOf('function renderArrangementInsights('));
  assert.match(binding, /focusSongSection\(clip\.dataset\.section, clip\.dataset\.editorTrack, \{[\s\S]*?openEditor: false/);
  assert.doesNotMatch(binding, /openEditor: Boolean\(clip\.dataset\.editorTrack\)/);
  assert.match(app, /focusSongSection\(sectionSelect\.value, trackSelect\.value, \{ openEditor: false, scroll: true \}\)/);
  assert.match(app, /function renderShapePartPicker\(sections\)/);
});

test("the quick picker is populated from real sections and tracks and never alters MIDI", () => {
  const start = app.indexOf("function renderShapePartPicker(sections) {");
  const end = app.indexOf("function renderTimeline()", start);
  const code = app.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(code, /sections\.map\(\(section\) =>/);
  assert.match(code, /TRACK_ORDER\.map\(\(id\) =>/);
  assert.match(code, /escapeHtml\(section\.id\)/);
  assert.match(code, /escapeHtml\(section\.name\)/);
  assert.match(code, /submit\.addEventListener\("click"/);
  assert.match(code, /showToast\("Choose a section first/);
  assert.match(code, /submit\.disabled = sections\.length === 0 \|\| state\.isGenerating/);
  assert.doesNotMatch(code, /pushHistory|state\.song\s*=|createShapeCandidate|generateNew\(/);
});

test("Piano Roll remains a distinct explicit edit mode with Back to Song Map", () => {
  assert.match(markup, /data-section-action="edit"/);
  assert.match(markup, /id="editorCloseButton"[^>]*>Back to Song Map/);
  assert.match(styles, /#tab-arrange\.has-section-focus \.shape-stage \{display:none!important\}/);
  assert.match(styles, /#tab-arrange \.section-editor\.is-open/);
  assert.match(app, /focusSongSection\(sectionId, track = state\.editorTrack, \{ openEditor = false, scroll = false \} = \{\}\)/);
});
