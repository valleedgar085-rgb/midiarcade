import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("generation debugger exposes the existing flight recorder without changing engine authority", () => {
  assert.match(html, /id="debuggerButton"/);
  assert.match(html, /id="debuggerDialog"/);
  assert.match(html, /id="copyDebuggerReport"/);
  assert.match(app, /generationExecutor\.diagnosticsSnapshot\(\)/);
  assert.match(app, /generationExecutor\.clearDiagnostics\(\)/);
  assert.match(app, /function openGenerationDebugger\(\)/);
  assert.match(css, /\.debugger-dialog/);
  assert.match(css, /\.debugger-stage-list/);
});
