import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const app = source("src/app.js");
const html = source("index.html");
const css = source("src/ui/shape-workspace.css");

test("Mix and Shape open one canonical, history-safe piano roll", () => {
  const open = app.match(/export function openPianoRoll\([\s\S]*?\n}\n/)?.[0] ?? "";
  assert.match(open, /switchWorkspace\("arrange"\)/);
  assert.match(open, /focusSongSection\(/);
  assert.match(open, /openEditor: true/);
  assert.doesNotMatch(app, /function renderPianoRollGrid\(/);
  assert.doesNotMatch(app, /function handlePianoRollCellClick\(/);
  assert.doesNotMatch(html, /id="pianoRollModal"/);
  assert.match(html, /id="pianoRollGrid"/);
});

test("Select, Draw, Erase are touch-accessible tools without another editing authority", () => {
  assert.match(html, /id="editorToolControl"/);
  for (const value of ["select", "draw", "erase"]) assert.match(html, new RegExp(`value="${value}"`));
  assert.match(app, /editorTool === "draw"[\s\S]*?addEditorNote\(event\)/);
  assert.match(app, /editorTool === "erase"[\s\S]*?eraseEditorNote\(/);
  assert.match(app, /hasPianoRollOnset\(/);
  assert.match(app, /pianoRollPointToNote\(/);
  assert.match(app, /#pianoRollGrid"\)\.addEventListener\("dblclick"/);
  assert.doesNotMatch(app, /#pianoRollGrid"\)\.addEventListener\("pointerup"/);
  assert.match(css, /\.editor-mode-select select[\s\S]*?min-height: 48px/);
});

test("Draw and Erase preserve Undo and never silently save an alternative song", () => {
  const mutation = app.slice(app.indexOf("function addEditorNote(event)"), app.indexOf("let sectionEditorInteractionsBound"));
  assert.match(mutation, /resolvePendingShapeDirectorCandidate\(/);
  assert.equal((mutation.match(/pushHistory\(\)/g) || []).length, 2);
  assert.equal((mutation.match(/finishEditorMutation\(/g) || []).length, 2);
  assert.match(mutation, /state\.editorSelection\.delete\(id\)/);
});
