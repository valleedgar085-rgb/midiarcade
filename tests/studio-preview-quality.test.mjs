import assert from "node:assert/strict";
import test from "node:test";
import { previewAudioLatencyHint, previewGraphBudget, previewRuntimeProfile, previewVoiceFeatures } from "../src/core/preview-performance.js";
import { createInitialAppState } from "../src/core/app-store.js";
import { createPersistedSessionSnapshot, decodePersistedSession } from "../src/core/session-runtime.js";

const phone = { userAgent: "Android 16", hardwareConcurrency: 8, deviceMemory: 8 };

test("Studio sound is explicit and keeps the Android scheduler and voice ceiling", () => {
  const automatic = previewRuntimeProfile(phone);
  const studio = previewRuntimeProfile({ ...phone, quality: "studio" });
  assert.equal(previewGraphBudget(automatic).reverbChannels, 1);
  assert.equal(previewGraphBudget(studio).reverbChannels, 2);
  assert.equal(previewGraphBudget(studio).reverbSeconds, 2.2);
  assert.equal(previewGraphBudget(studio).saturation, true);
  assert.equal(studio.maxScheduledVoices, automatic.maxScheduledVoices);
  assert.equal(studio.maxScheduledVoices, 32);
  assert.equal(studio.lookAheadSeconds, automatic.lookAheadSeconds);
  assert.equal(previewAudioLatencyHint(studio), "balanced");
  assert.ok(previewGraphBudget(studio).masterFadeSeconds >= previewGraphBudget(automatic).masterFadeSeconds);
  assert.deepEqual(previewVoiceFeatures("chords", studio), { layer: true, transient: true, sub: true });
});

test("unknown and legacy sound preferences retain the approved Auto sound", () => {
  const automatic = previewRuntimeProfile(phone);
  for (const quality of [undefined, null, "", "full", "untrusted", {}, 1]) {
    const profile = previewRuntimeProfile({ ...phone, quality });
    assert.deepEqual(previewGraphBudget(profile), previewGraphBudget(automatic));
    assert.deepEqual(previewVoiceFeatures("bass", profile), previewVoiceFeatures("bass", automatic));
  }
});

test("sound choice survives restart as a preference, not composition or MIDI data", () => {
  const state = createInitialAppState();
  assert.equal(state.previewQuality, "auto");
  state.previewQuality = "studio";
  const snapshot = createPersistedSessionSnapshot(state, { schema: 2 });
  assert.equal(snapshot.previewQuality, "studio");
  assert.equal("song" in snapshot, false);
  assert.equal("previewQuality" in snapshot.generationPreferences, false);
  const decoded = decodePersistedSession({ status: "ready", value: snapshot }, { schema: 2 });
  assert.equal(decoded.value.previewQuality, "studio");
  for (const previewQuality of [undefined, "other", {}, 7]) {
    const restored = decodePersistedSession({ status: "ready", value: { schema: 2, previewQuality } }, { schema: 2 });
    assert.equal(restored.value.previewQuality, "auto");
  }
});
