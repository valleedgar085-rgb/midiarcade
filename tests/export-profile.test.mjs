import assert from "node:assert/strict";
import test from "node:test";

import { prepareMidiExport, resolveMidiExportProfile } from "../src/core/export-profile.js";

const SONG = {
  meta: { totalBeats: 4 },
  tracks: [
    { id: "drums", notes: [{ pitch: 36, start: 0.12, duration: 0.22, velocity: 90 }] },
    { id: "bass", notes: [{ pitch: 36, start: 0.13, duration: 0.61, velocity: 88 }] },
    { id: "chords", notes: [{ pitch: 60, start: 0, duration: 1, velocity: 80 }] },
    { id: "melody", notes: [
      { pitch: 64, start: 0.13, duration: 0.44, velocity: 80 },
      { pitch: 64, start: 0.14, duration: 0.3, velocity: 96 },
    ] },
    { id: "counterpoint", notes: [{ pitch: 67, start: 0.63, duration: 0.4, velocity: 72 }] },
    { id: "pad", notes: [{ pitch: 55, start: 0, duration: 4, velocity: 64 }] },
  ],
};

test("export profiles resolve stable DAW track groups", () => {
  assert.equal(resolveMidiExportProfile("full").trackIds, null);
  assert.deepEqual(resolveMidiExportProfile("rhythm").trackIds, ["drums", "bass"]);
  assert.deepEqual(resolveMidiExportProfile("harmony").trackIds, ["chords", "pad"]);
  assert.deepEqual(resolveMidiExportProfile("leads").trackIds, ["melody", "counterpoint"]);
  assert.deepEqual(resolveMidiExportProfile("selected", "bass").trackIds, ["bass"]);
  assert.equal(resolveMidiExportProfile("invalid").id, "full");
});

test("tight export quantizes a clone, removes duplicate onsets, and preserves the source", () => {
  const source = structuredClone(SONG);
  const prepared = prepareMidiExport(source, { profile: "leads", timing: "tight" });
  assert.deepEqual(prepared.options.trackIds, ["melody", "counterpoint"]);
  assert.deepEqual(prepared.options.alwaysIncludeTrackIds, ["melody", "counterpoint"]);
  assert.equal(prepared.song.tracks.find((track) => track.id === "melody").notes.length, 1);
  assert.equal(prepared.song.tracks.find((track) => track.id === "melody").notes[0].start, 0.25);
  assert.equal(prepared.song.tracks.find((track) => track.id === "melody").notes[0].velocity, 96);
  assert.deepEqual(source, SONG, "export preparation must never edit the working song");
});

test("selected export rejects a missing instrument instead of creating an empty file", () => {
  assert.throws(() => prepareMidiExport(SONG, { profile: "selected" }), /Select an instrument/);
  assert.throws(() => prepareMidiExport(SONG, { profile: "selected", selectedTrackId: "missing" }), /Select an instrument/);
});

