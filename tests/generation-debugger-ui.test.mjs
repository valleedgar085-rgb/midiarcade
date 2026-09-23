import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("generation debugger exposes the existing flight recorder without changing engine authority", () => {
  assert.doesNotMatch(html, /id="debuggerButton"/, "debug controls stay out of the static button budget");
  assert.match(html, /id="debuggerDialog"/);
  assert.doesNotMatch(html, /id="copyDebuggerReport"/, "debug actions are injected at runtime");
  assert.match(app, /function ensureGenerationDebuggerControls\(\)/);
  assert.match(app, /button\.id = "debuggerButton"/);
  assert.match(app, /copy\.id = "copyDebuggerReport"/);
  assert.match(app, /generationExecutor\.diagnosticsSnapshot\(\)/);
  assert.match(app, /generationExecutor\.clearDiagnostics\(\)/);
  assert.match(app, /function openGenerationDebugger\(\)/);
  assert.match(css, /\.debugger-dialog/);
  assert.match(css, /\.debugger-stage-list/);
});
