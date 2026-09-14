import assert from "node:assert/strict";
import test from "node:test";

import { prepareMidiExport, resolveMidiExportProfile } from "../src/core/export-profile.js";
import { encodeMidi } from "../src/music-engine.js";

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

function readU32(bytes, offset) {
  return (((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
}

function readVlq(bytes, offset) {
  let value = 0;
  let cursor = offset;
  while (cursor < bytes.length) {
    const byte = bytes[cursor++];
    value = (value << 7) | (byte & 0x7f);
    if (!(byte & 0x80)) break;
  }
  return { value, offset: cursor };
}

function midiTrackPayloads(bytes) {
  const tracks = [];
  let offset = 14;
  while (offset + 8 <= bytes.length) {
    const type = String.fromCharCode(...bytes.slice(offset, offset + 4));
    const length = readU32(bytes, offset + 4);
    if (type !== "MTrk") throw new Error(`Unexpected MIDI chunk ${type}`);
    tracks.push(bytes.slice(offset + 8, offset + 8 + length));
    offset += 8 + length;
  }
  return tracks;
}

function channelEvents(trackBytes) {
  const events = [];
  let offset = 0;
  let tick = 0;
  let runningStatus = null;
  while (offset < trackBytes.length) {
    const delta = readVlq(trackBytes, offset);
    tick += delta.value;
    offset = delta.offset;
    let status = trackBytes[offset++];
    if (status < 0x80) {
      offset -= 1;
      status = runningStatus;
    } else if (status < 0xf0) {
      runningStatus = status;
    }
    if (status === 0xff) {
      offset += 1;
      const length = readVlq(trackBytes, offset);
      offset = length.offset + length.value;
      continue;
    }
    if (status === 0xf0 || status === 0xf7) {
      const length = readVlq(trackBytes, offset);
      offset = length.offset + length.value;
      runningStatus = null;
      continue;
    }
    const type = status & 0xf0;
    const dataLength = type === 0xc0 || type === 0xd0 ? 1 : 2;
    const data = [...trackBytes.slice(offset, offset + dataLength)];
    offset += dataLength;
    events.push({ tick, status, type, data });
  }
  return events;
}

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
  assert.equal(prepared.song.meta.exportArticulation.postEncoderLengtheningBlocked, true);
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

test("final encoded MIDI cannot re-lengthen a safe melody note through gate or phrase scaling", () => {
  const source = {
    meta: {
      totalBeats: 8,
      tempo: 96,
      key: "C",
      keyPc: 0,
      scale: "major",
      timeSignature: [4, 4],
      beatsPerBar: 4,
      ppq: 480,
    },
    title: "Export Safety",
    genre: "pop",
    structure: [{ id: "verse", name: "Verse", startBeat: 0, endBeat: 8, startBar: 0, bars: 2 }],
    harmony: [],
    tracks: [{
      id: "melody",
      name: "Melody",
      channel: 2,
      program: 80,
      settings: { gate: 1.5, velocity: 0.92, volume: 0.86, pan: 0, reverb: 0.2, cutoff: 8000, resonance: 0.2 },
      automation: [{ type: "cc", controller: 64, beat: 0, value: 127 }],
      notes: [{
        pitch: 72,
        start: 1,
        duration: 4,
        velocity: 96,
        phrasePerformanceDurationScale: 1.28,
      }],
    }],
  };
  const prepared = prepareMidiExport(source, { profile: "selected", selectedTrackId: "melody" });
  const bytes = encodeMidi(prepared.song, prepared.options);
  const tracks = midiTrackPayloads(bytes);
  assert.equal(tracks.length, 2, "selected export should contain conductor + melody");
  const events = channelEvents(tracks[1]);
  const noteOn = events.find((event) => event.type === 0x90 && event.data[0] === 72 && event.data[1] > 0);
  const noteOff = events.find((event) => event.type === 0x80 && event.data[0] === 72);
  assert.ok(noteOn && noteOff, "encoded melody must contain matching note-on and note-off");
  assert.ok(noteOff.tick - noteOn.tick <= Math.round(1.5 * 480), "final MIDI note must stay within the melody export cap");
  assert.ok(!events.some((event) => event.type === 0xb0 && event.data[0] === 64 && event.data[1] > 0), "safe export must not write sustain-on CC64");
});

test("selected export rejects a missing instrument instead of creating an empty file", () => {
  assert.throws(() => prepareMidiExport(SONG, { profile: "selected" }), /Select an instrument/);
  assert.throws(() => prepareMidiExport(SONG, { profile: "selected", selectedTrackId: "missing" }), /Select an instrument/);
});
