import test from "node:test";
import assert from "node:assert/strict";
import {
  drumSampleRole,
  normalizeSampleManifest,
  resolve808SampleEntry,
  resolveDrumSampleEntry,
  resolveSampleUrl,
} from "../src/core/sample-one-shots.js";

test("maps General MIDI drum pitches to one-shot roles", () => {
  assert.equal(drumSampleRole(36), "kick");
  assert.equal(drumSampleRole(38), "snare");
  assert.equal(drumSampleRole(39), "clap");
  assert.equal(drumSampleRole(42), "hat");
  assert.equal(drumSampleRole(46), "openHat");
  assert.equal(drumSampleRole(49), "cymbal");
  assert.equal(drumSampleRole(45), "tom");
});

test("sample choice is deterministic for the same musical event", () => {
  const manifest = normalizeSampleManifest({
    id: "test-pack",
    roles: {
      kick: ["kick-a.wav", "kick-b.wav", "kick-c.wav"],
    },
  });
  const first = resolveDrumSampleEntry(manifest, 36, "bar-2-beat-1");
  const second = resolveDrumSampleEntry(manifest, 36, "bar-2-beat-1");
  assert.deepEqual(first, second);
});

test("tuned 808 selection prefers the nearest root note", () => {
  const manifest = normalizeSampleManifest({
    id: "test-808s",
    roles: {
      bass808: [
        { path: "808-c.wav", rootMidi: 36 },
        { path: "808-e.wav", rootMidi: 40 },
        { path: "808-g.wav", rootMidi: 43 },
      ],
    },
  });
  assert.equal(resolve808SampleEntry(manifest, 41, "x").path, "808-e.wav");
  assert.equal(resolve808SampleEntry(manifest, 44, "x").path, "808-g.wav");
});

test("sample paths resolve relative to the manifest", () => {
  const url = resolveSampleUrl(
    "./assets/one-shots/midi-arcade-pack-1/manifest.json",
    "kicks/kick-01.wav",
    "https://example.test/app/index.html",
  );
  assert.equal(url, "https://example.test/app/assets/one-shots/midi-arcade-pack-1/kicks/kick-01.wav");
});
