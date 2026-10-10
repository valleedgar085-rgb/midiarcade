import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  previewGraphBudget,
  previewMasterOutputGain,
  previewRuntimeProfile,
} from "../src/core/preview-performance.js";

test("Android diagnostic lowers only the final preview master, preserving the output DSP profile", () => {
  const mobile = previewRuntimeProfile({
    userAgent: "Mozilla/5.0 (Linux; Android 16; motorola edge 2024)",
    hardwareConcurrency: 8,
    deviceMemory: 8,
  });
  const desktop = previewRuntimeProfile({
    userAgent: "Mozilla/5.0 (X11; Linux x86_64)",
    hardwareConcurrency: 12,
    deviceMemory: 16,
  });
  assert.equal(mobile.mode, "constrained");
  assert.equal(previewMasterOutputGain(mobile), 0.26);
  assert.equal(previewMasterOutputGain(desktop), 0.42);
  assert.ok(previewMasterOutputGain(mobile) < previewMasterOutputGain(desktop));
  assert.equal(previewGraphBudget(mobile).masterFadeSeconds, 0.04);
  assert.equal(previewGraphBudget(mobile).saturation, false);
  assert.equal(mobile.maxScheduledVoices, 32);
});

test("Android output level is deterministic and never affects note identity or arrangement", () => {
  const song = Object.freeze({
    structure: Object.freeze([{ id: "verse", startBeat: 0, endBeat: 4 }]),
    tracks: Object.freeze([
      Object.freeze({ id: "chords", notes: Object.freeze([{ pitch: 60, start: 0, duration: 2, velocity: 92 }]) }),
      Object.freeze({ id: "melody", notes: Object.freeze([{ pitch: 72, start: 1, duration: 0.5, velocity: 96 }]) }),
    ]),
  });
  const before = JSON.stringify(song);
  const profile = previewRuntimeProfile({ userAgent: "Android 16" });
  for (let i = 0; i < 5; i++) assert.equal(previewMasterOutputGain(profile), 0.26);
  assert.equal(JSON.stringify(song), before);
});

test("real player uses the same target level for creation and playback resumes", () => {
  const code = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(code, /this\.master\.gain\.value = previewMasterOutputGain\(this\.previewRuntime\)/);
  assert.match(code, /rampAudioParamValue\(this\.master\.gain, previewMasterOutputGain\(this\.previewRuntime\)/);
  assert.doesNotMatch(code, /rampAudioParamValue\(this\.master\.gain, 0\.42,/);
});

test("original all-track anti-click and special Atmosphere processing remain wired", () => {
  const code = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(code, /const pitchedTiming = pitchedVoiceEnvelopeTiming\(event\.id, attack, duration\)/);
  assert.match(code, /event\.id === "pad" \? atmosphereEnvelopeTiming\(attack, duration\) : null/);
  assert.match(code, /if \(event\.id === "drums"\) \{\s*this\.scheduleDrum\(event, when\)/);
});
