import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { previewAudioLatencyHint, previewGraphBudget, previewRuntimeProfile, previewVoiceFeatures } from "../src/core/preview-performance.js";
import { PREVIEW_TRANSITION, clickSafeStopTime, previewNoteAttack, rampAudioParamValue } from "../src/core/preview-audio.js";

test("Phase 7 keeps Android playback inside a cheaper DSP graph", () => {
  const android = previewRuntimeProfile({ userAgent: "Mozilla/5.0 (Linux; Android 14)", hardwareConcurrency: 8, deviceMemory: 8 });
  const desktop = previewRuntimeProfile({ userAgent: "Mozilla/5.0 (X11; Linux x86_64)", hardwareConcurrency: 12, deviceMemory: 16 });
  const androidBudget = previewGraphBudget(android);
  const desktopBudget = previewGraphBudget(desktop);
  assert.equal(androidBudget.saturation, false);
  assert.equal(previewAudioLatencyHint(android), "balanced");
  assert.equal(previewAudioLatencyHint(desktop), "interactive");
  assert.ok(android.maxScheduledVoices <= 32);
  assert.ok(androidBudget.reverbSeconds <= 0.9);
  assert.ok(androidBudget.reverbSeconds < desktopBudget.reverbSeconds);
  assert.ok(androidBudget.reverbChannels < desktopBudget.reverbChannels);
  assert.ok(androidBudget.delayFeedback <= 0.08);
  assert.ok(androidBudget.delayFeedback < desktopBudget.delayFeedback);
  assert.ok(androidBudget.sendFloor >= 0.07);
  assert.ok(androidBudget.sendFloor > desktopBudget.sendFloor);
  assert.deepEqual(previewVoiceFeatures("bass", android), { layer: false, transient: false, sub: true });
  assert.deepEqual(previewVoiceFeatures("melody", android), { layer: true, transient: false, sub: false });
});

test("Samsung Android tablets stay on the constrained click-safe preview profile", () => {
  const samsungTablet = previewRuntimeProfile({
    userAgent: "Mozilla/5.0 (Linux; Android 16; SM-X210 Build/UP1A.231005.007)",
    hardwareConcurrency: 8,
    deviceMemory: 8,
  });
  const budget = previewGraphBudget(samsungTablet);

  assert.equal(samsungTablet.mode, "constrained");
  assert.equal(previewAudioLatencyHint(samsungTablet), "balanced");
  assert.equal(samsungTablet.maxScheduledVoices, 32);
  assert.equal(budget.masterFadeSeconds, 0.04);
  assert.equal(budget.saturation, false);
  assert.equal(budget.preserveKickClick, false);
  assert.equal(budget.preserveSnareSnap, false);
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

test("Phase 7 suspends hidden playback cleanly and recovers interrupted Android audio", () => {
  const appSource = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(appSource, /document\.visibilityState === "hidden"/);
  assert.match(appSource, /this\.position = this\.currentSongTime\(\)/);
  assert.match(appSource, /this\.clearTimers\(\)/);
  assert.match(appSource, /this\.clearScheduledAudio\(\)/);
  assert.match(appSource, /this\.context\.suspend\(\)\.catch/);
  assert.match(appSource, /\["suspended", "interrupted"\]\.includes\(this\.context\?\.state\)/);
  assert.match(appSource, /recoverAudioContext\(this\.context\)/);
});

test("Phase 7 uses longer click-safe release windows", () => {
  assert.ok(PREVIEW_TRANSITION.minimumNoteAttackSeconds >= 0.005);
  assert.ok(PREVIEW_TRANSITION.stopSeconds >= 0.025);
  assert.ok(PREVIEW_TRANSITION.sourceTailSeconds >= 0.01);
});

test("click-safe note attacks clamp abrupt starts without slowing intentional envelopes", () => {
  assert.equal(previewNoteAttack(0), PREVIEW_TRANSITION.minimumNoteAttackSeconds);
  assert.equal(previewNoteAttack(Number.NaN), PREVIEW_TRANSITION.minimumNoteAttackSeconds);
  assert.equal(previewNoteAttack(0.001), PREVIEW_TRANSITION.minimumNoteAttackSeconds);
  assert.equal(previewNoteAttack(0.08), 0.08);
});

test("click-safe stop ramps hold the live gain and leave source-tail time before teardown", () => {
  const calls = [];
  const parameter = {
    value: 0.8,
    cancelAndHoldAtTime(time) {
      calls.push(["hold", time]);
    },
    exponentialRampToValueAtTime(value, time) {
      calls.push(["exponential", value, time]);
    },
  };

  const ramp = rampAudioParamValue(
    parameter,
    0,
    10,
    PREVIEW_TRANSITION.stopSeconds,
  );

  assert.deepEqual(calls[0], ["hold", 10]);
  assert.equal(calls[1][0], "exponential");
  assert.equal(calls[1][1], 0.0001);
  assert.ok(Math.abs(calls[1][2] - (10 + PREVIEW_TRANSITION.stopSeconds)) < 1e-9);
  assert.ok(Math.abs(ramp.endTime - (10 + PREVIEW_TRANSITION.stopSeconds)) < 1e-9);

  const activeStop = clickSafeStopTime(4, 3);
  assert.ok(
    Math.abs(activeStop - (4 + PREVIEW_TRANSITION.stopSeconds + PREVIEW_TRANSITION.sourceTailSeconds)) < 1e-9,
  );
  assert.equal(
    clickSafeStopTime(4, 4 + PREVIEW_TRANSITION.stopSeconds + 0.001),
    4,
    "voices that have not started yet should be canceled immediately instead of creating a tail",
  );
});


test("local browser profiles and scratch output cannot return to the repository", () => {
  const ignore = fs.readFileSync(new URL("../.gitignore", import.meta.url), "utf8");
  assert.match(ignore, /^tmp\/$/m);
  assert.equal(fs.existsSync(new URL("../tmp/edge-cdp-profile", import.meta.url)), false);
});
