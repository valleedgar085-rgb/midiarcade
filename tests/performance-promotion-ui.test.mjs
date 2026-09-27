// Phase 1C Android validation.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const controls = fs.readFileSync(new URL("../src/ui/performance-promotion-controls.js", import.meta.url), "utf8");
const controller = fs.readFileSync(new URL("../src/ui/performance-promotion-controller.js", import.meta.url), "utf8");
const candidate = fs.readFileSync(new URL("../src/core/performance-candidate.js", import.meta.url), "utf8");

test("performance promotion remains explicit, gated, and undoable", () => {
  assert.doesNotMatch(html, /id="performanceAbValidate"/);
  assert.match(controls, /id="performanceAbValidate"/);
  assert.match(controls, /id="performanceAbAccept"[^>]*disabled/);
  assert.match(controls, /id="performanceAbReject"[^>]*disabled/);

  assert.match(app, /import\("\.\/ui\/performance-promotion-controls\.js"\)/);
  assert.match(app, /import\("\.\/ui\/performance-promotion-controller\.js"\)/);
  assert.doesNotMatch(app, /from "\.\/core\/performance-candidate\.js"/);
  assert.match(app, /this\.performanceCandidate = null/);
  assert.match(app, /player\.performanceCandidate = null/);

  assert.match(controller, /createPerformanceCandidate\(state\.song/);
  assert.match(controller, /transaction\.validation\?\.valid/);
  assert.match(controller, /const snapshot = createHistorySnapshot\(\)/);
  assert.match(controller, /pushHistory\(snapshot\)/);
  assert.match(controller, /appStore\.transaction\("performance:accept"/);
  assert.match(controller, /draft\.song = accepted/);
  assert.match(controller, /scheduleSessionSave\(\)/);
  assert.match(controller, /player\.auditionPerformanceAB\("current"\)/);

  assert.match(candidate, /acceptedBy: "explicit-user-action"/);
  assert.match(candidate, /status: "accepted"/);
});

test("validated B auditions the exact promotable candidate before acceptance", () => {
  assert.match(controller, /player\.performanceCandidate = transaction/);
  assert.match(controller, /humanize: transaction\.selectedHumanize/);
  assert.match(controller, /player\.auditionSong\(transaction\.after/);
  assert.match(controller, /Gauntlet \+ ensemble PASS|did not pass promotion/);
});
