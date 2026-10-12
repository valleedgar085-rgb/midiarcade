import test from "node:test";
import assert from "node:assert/strict";
import { PITCHED_SAMPLE_MANIFEST, selectPitchedSample, preloadPitchedSamples, schedulePitchedSample } from "../src/core/pitched-samples.js";

test("no sample assets means synth fallback for all tracks", () => {
  assert.equal(selectPitchedSample("bass", 48), null);
  assert.equal(selectPitchedSample("chords", 60), null);
  assert.equal(selectPitchedSample("drums", 36), null);
  assert.deepEqual(PITCHED_SAMPLE_MANIFEST.bass, []);
});

test("sample selection is bounded, deterministic, and path constrained", () => {
  const manifest = { bass: [
    { path: "./assets/audio/instruments/bass/c3.wav", rootPitch: 48 },
    { path: "./assets/audio/instruments/bass/c4.wav", rootPitch: 60 },
    { path: "https://untrusted.example/bass.wav", rootPitch: 54 },
  ] };
  assert.equal(selectPitchedSample("bass", 50, manifest)?.rootPitch, 48);
  assert.equal(selectPitchedSample("bass", 58, manifest)?.rootPitch, 60);
  assert.equal(selectPitchedSample("bass", 72, manifest), null);
});

test("preload caches successful decodes and missing samples as null", async () => {
  let calls = 0;
  const manifest = { bass: [{ path: "./assets/audio/instruments/bass/c3.wav", rootPitch: 48 }] };
  const cache = new Map();
  await preloadPitchedSamples({ decodeAudioData: async () => ({ duration: 1 }) }, manifest, cache, async () => {
    calls += 1;
    return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) };
  });
  await preloadPitchedSamples({ decodeAudioData: async () => ({ duration: 1 }) }, manifest, cache, async () => { throw Error("unexpected"); });
  assert.equal(calls, 1);
  assert.equal(cache.size, 1);
});

test("sample scheduling returns null without a loaded buffer", () => {
  assert.equal(schedulePitchedSample({}, null, { pitch: 60 }, 60, 0, {}, new Set()), null);
});
