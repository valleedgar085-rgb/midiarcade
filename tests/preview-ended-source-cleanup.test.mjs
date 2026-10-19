import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { pendingPreviewVoiceSources } from "../src/core/preview-audio.js";

test("ended oscillator layers are excluded from voice-steal stop accounting", () => {
  const main = { name: "main oscillator" };
  const transient = { name: "completed transient" };
  const layer = { name: "active layer" };
  const voice = {
    sources: new Set([main, transient, layer]),
    endedSources: new Set([transient]),
  };

  assert.deepEqual(pendingPreviewVoiceSources(voice), [main, layer]);
  assert.equal(voice.sources.size, 3, "selection must not mutate tracked voice sources");
  assert.equal(voice.endedSources.size, 1);
});

test("all-finished voices need no additional stop callbacks", () => {
  const a = { name: "a" };
  const b = { name: "b" };
  const voice = { sources: new Set([a, b]), endedSources: new Set([a, b]) };
  assert.deepEqual(pendingPreviewVoiceSources(voice), []);
  assert.deepEqual(pendingPreviewVoiceSources({ sources: new Set(), endedSources: new Set() }), []);
  assert.deepEqual(pendingPreviewVoiceSources(null), []);
});

test("PreviewPlayer waits only for source layers that have not yet ended", () => {
  const source = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const cleanup = source.split("  cleanupScheduledVoice(voice, stopSources = true) {")[1]?.split("\n  enforceScheduledVoiceLimit() {")[0];
  assert.ok(cleanup, "real audio cleanup method must exist");
  assert.match(cleanup, /pendingPreviewVoiceSources\(voice\)/);
  assert.match(cleanup, /let remainingSources = pendingSources\.length/);
  assert.match(cleanup, /for \(const source of pendingSources\)/);
  assert.match(cleanup, /if \(remainingSources <= 0\) finalize\(\)/);
});
