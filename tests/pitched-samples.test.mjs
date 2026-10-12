import test from "node:test";
import assert from "node:assert/strict";
import { PITCHED_SAMPLE_MANIFEST, selectPitchedSample, preloadPitchedSamples, schedulePitchedSample, pitchedSampleLevelCompensation } from "../src/core/pitched-samples.js";

test("unmapped bass and drums always retain synth fallback", () => {
  assert.equal(selectPitchedSample("bass", 48), null);
  assert.equal(selectPitchedSample("chords", 60)?.rootPitch, 60);
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

test("CC0 piano keyzones have valid local sample paths", () => {
  for (const pitch of [48, 53, 60, 65, 72, 77]) {
    const entry = selectPitchedSample("chords", pitch);
    assert.equal(entry?.rootPitch, pitch);
    assert.ok(entry.path.endsWith(`piano-${pitch}.wav`));
  }
});

test("sample level matching boosts quiet notes but attenuates strong recordings", () => {
  const sample = (amplitude) => {
    const data = new Float32Array(22050).fill(amplitude);
    return { sampleRate: 22050, getChannelData: () => data };
  };
  const quiet = sample(0.035);
  const moderate = sample(0.15);
  const hot = sample(0.8);
  assert.equal(pitchedSampleLevelCompensation(quiet), 1.8);
  assert.ok(pitchedSampleLevelCompensation(moderate) < 1);
  assert.ok(pitchedSampleLevelCompensation(hot) < pitchedSampleLevelCompensation(moderate));
  // Existing decoded audio is analyzed only once, avoiding per-note scans.
  const level = pitchedSampleLevelCompensation(quiet);
  quiet.getChannelData = () => { throw new Error("buffer rescanned"); };
  assert.equal(pitchedSampleLevelCompensation(quiet), level);
});

test("sample level matching safely handles missing, silent and undecodable audio", () => {
  assert.equal(pitchedSampleLevelCompensation(null), 1);
  assert.equal(pitchedSampleLevelCompensation({ getChannelData: () => new Float32Array(32), sampleRate: 22050 }), 1);
  assert.equal(pitchedSampleLevelCompensation({ getChannelData: () => { throw new Error("unavailable"); } }), 1);
});

test("sampled piano schedules a bounded gain and smooth release", () => {
  const commands = [];
  const source = {
    playbackRate: { setValueAtTime: (rate, time) => commands.push(["rate", rate, time]) },
    connect: (node) => node,
    start: (time) => commands.push(["start", time]),
    stop: (time) => commands.push(["stop", time]),
  };
  const gain = {
    gain: {
      setValueAtTime: (value, time) => commands.push(["set", value, time]),
      exponentialRampToValueAtTime: (value, time) => commands.push(["ramp", value, time]),
    },
    connect: (node) => node,
  };
  const context = {
    createBufferSource: () => source,
    createGain: () => gain,
  };
  const audio = {
    duration: 2.5,
    sampleRate: 22050,
    getChannelData: () => new Float32Array(22050).fill(0.05),
  };
  const nodes = new Set();
  const scheduled = schedulePitchedSample(
    context, audio, { pitch: 60, duration: 1, velocity: 90, mixGain: 1 }, 60, 3, {}, nodes,
  );
  assert.equal(scheduled, source);
  assert.ok(nodes.has(source));
  assert.ok(nodes.has(gain));
  const peak = commands.find((entry) => entry[0] === "ramp" && entry[1] > 0.001);
  assert.ok(peak[1] > 0.3 && peak[1] <= 0.48);
  const releaseStart = commands.find((entry) => entry[0] === "set" && entry[1] === peak[1]);
  const stop = commands.find((entry) => entry[0] === "stop");
  assert.ok(stop[1] > releaseStart[2] + 0.06, "release must be audible and bounded");
  assert.ok(stop[1] < 4.3, "note must not ring long after requested duration");
  assert.equal(schedulePitchedSample(
    context, { duration: 0.03 }, { pitch: 60 }, 60, 3, {}, nodes,
  ), null, "too-short buffer falls back to the synth");
});
