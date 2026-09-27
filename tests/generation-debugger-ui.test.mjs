import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const promotionControls = fs.readFileSync(new URL("../src/ui/performance-promotion-controls.js", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

test("generation debugger exposes the existing flight recorder without changing engine authority", () => {
  assert.doesNotMatch(html, /id="debuggerButton"/, "debug controls stay out of the static button budget");
  assert.match(html, /id="debuggerDialog"/);
  assert.doesNotMatch(html, /id="copyDebuggerReport"/, "debug actions are injected at runtime");
  assert.match(app, /function ensureGenerationDebuggerControls\(\)/);
  assert.match(app, /button\.id = "debuggerButton"/);
  assert.match(app, /copy\.id = "copyDebuggerReport"/);
  assert.match(promotionControls, /id="performanceAbLab"/);
  assert.match(promotionControls, /id="performanceAbCurrent"/);
  assert.match(promotionControls, /id="performanceAbPerformed"/);
  assert.match(promotionControls, /id="performanceAbValidate"/);
  assert.match(promotionControls, /id="performanceAbAccept"[^>]*disabled/);
  assert.match(promotionControls, /id="performanceAbReject"[^>]*disabled/);
  assert.match(promotionControls, /id="performanceAbEnd"/);
  assert.match(app, /auditionPerformanceAB\(mode/);
  assert.match(app, /createPerformanceAuditionSong\(song/);
  assert.match(app, /import\("\.\/ui\/performance-promotion-controller\.js"\)/);
  assert.match(app, /performanceDebuggerAction\("validate"\)/);
  assert.match(app, /performanceDebuggerAction\("accept"\)/);
  assert.match(app, /performanceDebuggerAction\("reject"\)/);
  assert.match(app, /generationExecutor\.diagnosticsSnapshot\(\)/);
  assert.match(app, /generationExecutor\.clearDiagnostics\(\)/);
  assert.match(app, /async function openGenerationDebugger\(\)/);
  assert.match(app, /import\("\.\/ui\/performance-promotion-controls\.js"\)/);
  assert.match(css, /\.debugger-dialog/);
  assert.match(css, /\.debugger-stage-list/);
  assert.match(css, /\.performance-ab-lab/);
});
