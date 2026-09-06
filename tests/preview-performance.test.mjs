import test from "node:test";
import assert from "node:assert/strict";
import {
  previewGraphBudget,
  previewRuntimeProfile,
  previewVoiceFeatures,
  previewVoicePriority,
  selectPreviewVoiceVictim,
} from "../src/core/preview-performance.js";

test("Android preview uses a smaller low-latency scheduling graph with next-beat cushion", () => {
  const profile = previewRuntimeProfile({
    userAgent: "Mozilla/5.0 (Linux; Android 14)",
    hardwareConcurrency: 8,
    deviceMemory: 8,
  });
  assert.equal(profile.mode, "constrained");
  assert.equal(profile.scheduleIntervalMs, 45);
  assert.equal(profile.lookAheadSeconds, 0.55);
  assert.ok(profile.lookAheadSeconds >= 0.5, "constrained scheduling must still pre-queue the next half-second beat");
  assert.equal(profile.maxScheduledVoices, 48);
  assert.ok(profile.maxScheduledVoices <= 48, "Android must keep the preview graph inside the constrained voice budget");
});

test("constrained Android DSP budget removes expensive graph layers without muting ambience", () => {
  const profile = previewRuntimeProfile({ userAgent: "Android" });
  const budget = previewGraphBudget(profile);
  assert.equal(budget.saturation, false);
  assert.equal(budget.oversample, "none");
  assert.ok(budget.reverbSeconds <= 1.2);
  assert.equal(budget.reverbChannels, 1);
  assert.ok(budget.reverbReturnScale < 1);
  assert.ok(budget.delayFeedback < 0.18);
  assert.ok(budget.delayReturnScale < 1);
  assert.equal(budget.preserveKickClick, false);
  assert.equal(budget.preserveSnareSnap, false);
  assert.equal(budget.filterMotion, false);
  assert.ok(budget.sendFloor >= 0.04);
  assert.ok(budget.masterFadeSeconds >= 0.025);
});

test("desktop preview keeps the full synthesis and DSP profile", () => {
  const profile = previewRuntimeProfile({ userAgent: "Mozilla/5.0 (X11; Linux x86_64)", hardwareConcurrency: 12, deviceMemory: 16 });
  const budget = previewGraphBudget(profile);
  assert.equal(profile.mode, "full");
  assert.equal(profile.lookAheadSeconds, 0.85);
  assert.equal(profile.maxScheduledVoices, 96);
  assert.equal(budget.saturation, true);
  assert.equal(budget.oversample, "4x");
  assert.equal(budget.reverbSeconds, 2.2);
  assert.equal(budget.reverbChannels, 2);
  assert.equal(budget.filterMotion, true);
});

test("constrained preview preserves lead and bass body while removing transient multipliers", () => {
  const profile = previewRuntimeProfile({ userAgent: "Android" });
  assert.deepEqual(previewVoiceFeatures("melody", profile), { layer: true, transient: false, sub: false });
  assert.deepEqual(previewVoiceFeatures("bass", profile), { layer: true, transient: false, sub: true });
  assert.deepEqual(previewVoiceFeatures("chords", profile), { layer: false, transient: false, sub: false });
  assert.deepEqual(previewVoiceFeatures("pad", profile), { layer: false, transient: false, sub: false });
});

test("voice priority protects the beat and lead before pad tails", () => {
  assert.ok(previewVoicePriority("drums") > previewVoicePriority("pad"));
  assert.ok(previewVoicePriority("melody") > previewVoicePriority("counterpoint"));
  assert.equal(previewVoicePriority("melody", true), previewVoicePriority("melody") + 2);
});

test("voice stealing discards a future low-priority voice before audible voices", () => {
  const voices = [
    { priority: 7, startedAt: 9.9, cleaned: false, id: "active-drums" },
    { priority: 6, startedAt: 9.95, cleaned: false, id: "active-lead" },
    { priority: 2, startedAt: 10.35, cleaned: false, id: "future-pad-near" },
    { priority: 2, startedAt: 10.7, cleaned: false, id: "future-pad-far" },
  ];
  const victim = selectPreviewVoiceVictim(voices, { now: 10, maxVoices: 3 });
  assert.equal(victim.id, "future-pad-far");
});
