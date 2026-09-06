import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { previewGraphBudget, previewRuntimeProfile } from "../src/core/preview-performance.js";
import { PREVIEW_TRANSITION } from "../src/core/preview-audio.js";

test("Phase 7 keeps Android playback inside a cheaper DSP graph", () => {
  const android = previewRuntimeProfile({ userAgent: "Mozilla/5.0 (Linux; Android 14)", hardwareConcurrency: 8, deviceMemory: 8 });
  const desktop = previewRuntimeProfile({ userAgent: "Mozilla/5.0 (X11; Linux x86_64)", hardwareConcurrency: 12, deviceMemory: 16 });
  const androidBudget = previewGraphBudget(android);
  const desktopBudget = previewGraphBudget(desktop);
  assert.equal(androidBudget.saturation, false);
  assert.ok(androidBudget.reverbSeconds < desktopBudget.reverbSeconds);
  assert.ok(androidBudget.reverbChannels < desktopBudget.reverbChannels);
  assert.ok(androidBudget.delayFeedback < desktopBudget.delayFeedback);
  assert.ok(androidBudget.sendFloor > desktopBudget.sendFloor);
});

test("Phase 7 wires runtime graph budgets into the real PreviewPlayer", () => {
  const appSource = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(appSource, /previewGraphBudget/);
  assert.match(appSource, /this\.previewBudget = previewGraphBudget\(this\.previewRuntime\)/);
  assert.match(appSource, /this\.previewBudget\.saturation/);
  assert.match(appSource, /this\.previewBudget\.reverbSeconds/);
  assert.match(appSource, /this\.previewBudget\.reverbChannels/);
  assert.match(appSource, /this\.previewBudget\.sendFloor/);
  assert.match(appSource, /this\.previewBudget\.filterMotion/);
  assert.match(appSource, /this\.previewBudget\.preserveKickClick/);
  assert.match(appSource, /this\.previewBudget\.preserveSnareSnap/);
});

test("Phase 7 uses longer click-safe release windows", () => {
  assert.ok(PREVIEW_TRANSITION.stopSeconds >= 0.025);
  assert.ok(PREVIEW_TRANSITION.sourceTailSeconds >= 0.01);
});

test("local browser profiles and scratch output cannot return to the repository", () => {
  const ignore = fs.readFileSync(new URL("../.gitignore", import.meta.url), "utf8");
  assert.match(ignore, /^tmp\/$/m);
  assert.equal(fs.existsSync(new URL("../tmp/edge-cdp-profile", import.meta.url)), false);
});
