import assert from "node:assert/strict";
import test from "node:test";

import { prepareMidiExport, resolveMidiExportProfile } from "../src/core/export-profile.js";

const SONG = {
  meta: { totalBeats: 4 },
  structure: [{ id: "verse", startBeat: 0, endBeat: 4 }],
  tracks: [
    { id: "drums", notes: [{ pitch: 36, start: 0.12, duration: 0.8, velocity: 90 }] },
    { id: "bass", notes: [{ pitch: 36, start: 0.13, duration: 3.1, velocity: 88 }] },
    { id: "chords", notes: [{ pitch: 60, start: 0, duration: 4, velocity: 80 }] },
    { id: "melody", automation: [
      { type: "cc", controller: 64, beat: 0, value: 127 },
      { type: "cc", controller: 64, beat: 3.5, value: 0 },
      { type: "cc", controller: 11, beat: 0, value: 127 },
    ], notes: [
      { pitch: 64, start: 0.13, duration: 2.8, velocity: 80 },
      { pitch: 64, start: 0.14, duration: 0.3, velocity: 96 },
      { pitch: 67, start: 2, duration: 2, velocity: 84 },
    ] },
    { id: "counterpoint", notes: [{ pitch: 67, start: 0.63, duration: 2.4, velocity: 72 }] },
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
  assert.equal(prepared.song.tracks.find((track) => track.id === "melody").notes.length, 2);
  assert.equal(prepared.song.tracks.find((track) => track.id === "melody").notes[0].start, 0.25);
  assert.equal(prepared.song.tracks.find((track) => track.id === "melody").notes[0].velocity, 96);
  assert.deepEqual(source, SONG, "export preparation must never edit the working song");
});

test("performance export bounds long generated notes and removes generated sustain", () => {
  const prepared = prepareMidiExport(SONG, { timing: "performance" });
  const byId = Object.fromEntries(prepared.song.tracks.map((track) => [track.id, track]));

  assert.ok(byId.drums.notes.every((note) => note.duration <= 0.45));
  assert.ok(byId.bass.notes.every((note) => note.duration <= 1.5));
  assert.ok(byId.chords.notes.every((note) => note.duration <= 2.5));
  assert.ok(byId.melody.notes.every((note) => note.duration <= 1.5));
  assert.ok(byId.counterpoint.notes.every((note) => note.duration <= 1.25));
  assert.ok(byId.pad.notes.every((note) => note.duration <= 3));
  assert.ok(byId.melody.automation.every((event) => event.controller !== 64));
  assert.equal(prepared.song.meta.exportArticulation.safeNoteLengths, true);
  assert.equal(prepared.song.meta.exportArticulation.duplicateRetriggersCollapsed, true);
  assert.equal(prepared.song.meta.exportArticulation.generatedSustainNormalized, true);
});

test("near-duplicate notes collapse, real same-pitch retriggers separate, and sustain preservation is explicit", () => {
  const source = structuredClone(SONG);
  source.tracks.find((track) => track.id === "melody").notes = [
    { pitch: 64, start: 0.1, duration: 2.2, velocity: 80 },
    { pitch: 64, start: 0.11, duration: 0.4, velocity: 96 },
    { pitch: 64, start: 0.8, duration: 1.8, velocity: 88 },
  ];
  const prepared = prepareMidiExport(source, { timing: "performance", preserveSustain: true });
  const melody = prepared.song.tracks.find((track) => track.id === "melody");
  assert.equal(melody.notes.length, 2, "near-identical same-pitch onsets should keep only the stronger note");
  const first = melody.notes[0];
  const second = melody.notes[1];
  assert.equal(first.velocity, 96);
  assert.ok(first.start + first.duration <= second.start - 0.039, "same-pitch note-off must occur before a real retrigger");
  assert.ok(melody.automation.some((event) => event.controller === 64));
  assert.equal(prepared.song.meta.exportArticulation.generatedSustainNormalized, false);
});

test("selected export rejects a missing instrument instead of creating an empty file", () => {
  assert.throws(() => prepareMidiExport(SONG, { profile: "selected" }), /Select an instrument/);
  assert.throws(() => prepareMidiExport(SONG, { profile: "selected", selectedTrackId: "missing" }), /Select an instrument/);
});
