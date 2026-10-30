import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  auditMidiExportParity,
  createMidiExportProjection,
  encodeMidi,
  encodeMidiVerified,
  generateNew,
} from "../src/music-engine.js";
import { prepareMidiExport } from "../src/core/export-profile.js";

function performedAuthoritySong() {
  return {
    id: "daw-handoff-performed-authority",
    title: "DAW Handoff Proof",
    genre: "pop",
    meta: {
      tempo: 120,
      ppq: 480,
      totalBeats: 4,
      beatsPerBar: 4,
      timeSignature: [4, 4],
      key: "C",
      keyPc: 0,
      scale: "major",
      scaleIntervals: [0, 2, 4, 5, 7, 9, 11],
    },
    structure: [],
    harmony: [],
    tracks: [{
      id: "melody",
      name: "Melody",
      channel: 2,
      program: 80,
      settings: {},
      automation: [],
      notes: [{
        id: "performed-note",
        start: 0,
        duration: 2,
        pitch: 60,
        velocity: 40,
        performed: {
          startBeat: 1.25,
          durationBeats: 0.5,
          renderedMidiPitch: 72,
          velocity: 100,
          articulation: "accent",
          microtimingMs: -8,
        },
      }],
    }],
  };
}

function findSequence(bytes, sequence) {
  outer: for (let index = 0; index <= bytes.length - sequence.length; index += 1) {
    for (let offset = 0; offset < sequence.length; offset += 1) {
      if (bytes[index + offset] !== sequence[offset]) continue outer;
    }
    return index;
  }
  return -1;
}

test("DAW handoff projection uses finalized performed-note values exactly once", () => {
  const source = performedAuthoritySong();
  const before = structuredClone(source);
  const projection = createMidiExportProjection(source);
  const note = projection.tracks[0].notes[0];

  assert.equal(projection.authority, "midi-export-projection-v1");
  assert.equal(projection.ppq, 480);
  assert.equal(note.pitch, 72);
  assert.equal(note.onTick, 600);
  assert.equal(note.offTick, 840);
  assert.equal(note.velocity, 100);
  assert.equal(note.channel, 2);

  const verified = encodeMidiVerified(source);
  assert.equal(verified.audit.passed, true);
  assert.equal(verified.audit.authority, "midi-export-parity-v1");
  assert.equal(verified.audit.sourceNoteCount, 1);
  assert.equal(verified.audit.exportedNoteCount, 1);
  assert.deepEqual(source, before, "export projection and verification must not mutate the committed song");
});

test("prepared full-song and selected-track exports round-trip with deterministic parity", () => {
  const source = generateNew({
    genre: "hipHop",
    seed: "daw-handoff-roundtrip",
    bars: 8,
    candidateCount: 1,
  });
  const before = structuredClone(source);
  const prepared = prepareMidiExport(source, { profile: "full", timing: "performance" });

  const first = encodeMidiVerified(prepared.song, prepared.options);
  const repeated = encodeMidiVerified(prepared.song, prepared.options);
  assert.equal(first.audit.passed, true);
  assert.deepEqual(first.projection, repeated.projection);
  assert.deepEqual(Array.from(first.bytes), Array.from(repeated.bytes));

  const stemPrepared = prepareMidiExport(source, {
    profile: "selected",
    selectedTrackId: "melody",
    timing: "performance",
  });
  const stem = encodeMidiVerified(stemPrepared.song, stemPrepared.options);
  assert.equal(stem.audit.passed, true);
  assert.equal(stem.projection.tracks.length, 1);
  assert.equal(stem.projection.tracks[0].id, "melody");

  assert.deepEqual(source, before, "DAW preparation and parity verification must leave the accepted song unchanged");
});

test("tight timing is audited against the authorized prepared export state, not raw committed timing", () => {
  const source = performedAuthoritySong();
  delete source.tracks[0].notes[0].performed;
  source.tracks[0].notes[0].start = 0.13;
  source.tracks[0].notes[0].duration = 0.61;
  source.tracks[0].notes[0].pitch = 72;
  source.tracks[0].notes[0].velocity = 100;
  const before = structuredClone(source);

  const prepared = prepareMidiExport(source, { timing: "tight" });
  assert.notEqual(prepared.song.tracks[0].notes[0].start, source.tracks[0].notes[0].start);
  const verified = encodeMidiVerified(prepared.song, prepared.options);

  assert.equal(verified.audit.passed, true);
  assert.deepEqual(source, before);
});

test("nested same-pitch notes with the inner note ending first preserve event multiplicity", () => {
  const source = performedAuthoritySong();
  source.tracks[0].notes = [
    {
      id: "outer",
      pitch: 72,
      start: 0,
      duration: 2,
      velocity: 96,
    },
    {
      id: "inner",
      pitch: 72,
      start: 0.5,
      duration: 0.5,
      velocity: 104,
    },
  ];

  const projection = createMidiExportProjection(source);
  assert.deepEqual(
    projection.tracks[0].notes.map((note) => ({
      pitch: note.pitch,
      onTick: note.onTick,
      offTick: note.offTick,
      velocity: note.velocity,
    })),
    [
      { pitch: 72, onTick: 0, offTick: 960, velocity: 96 },
      { pitch: 72, onTick: 240, offTick: 480, velocity: 104 },
    ],
  );

  const verified = encodeMidiVerified(source);
  assert.equal(verified.audit.passed, true, JSON.stringify(verified.audit.mismatches));
  assert.equal(verified.audit.sourceNoteCount, 2);
  assert.equal(verified.audit.exportedNoteCount, 2);
  assert.equal(verified.audit.mismatchCount, 0);
});

test("parity audit identifies an exact pitch corruption in serialized MIDI", () => {
  const source = performedAuthoritySong();
  const bytes = encodeMidi(source);
  const corrupted = new Uint8Array(bytes);
  const status = 0x90 | 2;
  const sequenceIndex = findSequence(corrupted, [status, 72, 100]);
  assert.ok(sequenceIndex >= 0, "fixture must contain the performed note-on event");
  corrupted[sequenceIndex + 1] = 73;

  const audit = auditMidiExportParity(source, corrupted);
  assert.equal(audit.passed, false);
  assert.ok(
    audit.mismatches.some((entry) => entry.type === "PITCH_MISMATCH"
      && entry.expected?.pitch === 72
      && entry.actual?.pitch === 73),
    JSON.stringify(audit.mismatches),
  );
});

test("parity audit rejects musical notes placed on conductor track 0", () => {
  const source = performedAuthoritySong();
  const bytes = encodeMidi(source);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const conductorChunkOffset = 14;
  assert.equal(String.fromCharCode(...bytes.slice(conductorChunkOffset, conductorChunkOffset + 4)), "MTrk");
  const conductorLength = view.getUint32(conductorChunkOffset + 4);
  const conductorDataStart = conductorChunkOffset + 8;
  const conductorDataEnd = conductorDataStart + conductorLength;
  const eot = bytes.slice(conductorDataEnd - 4, conductorDataEnd);
  assert.deepEqual(Array.from(eot), [0x00, 0xff, 0x2f, 0x00]);

  const injectedEvents = new Uint8Array([
    0x00, 0x90, 60, 100,
    0x00, 0x80, 60, 0,
  ]);
  const corrupted = new Uint8Array(bytes.length + injectedEvents.length);
  corrupted.set(bytes.slice(0, conductorDataEnd - 4), 0);
  corrupted.set(injectedEvents, conductorDataEnd - 4);
  corrupted.set(bytes.slice(conductorDataEnd - 4), conductorDataEnd - 4 + injectedEvents.length);
  const corruptedView = new DataView(corrupted.buffer, corrupted.byteOffset, corrupted.byteLength);
  corruptedView.setUint32(conductorChunkOffset + 4, conductorLength + injectedEvents.length);

  const audit = auditMidiExportParity(source, corrupted);
  assert.equal(audit.passed, false);
  assert.ok(
    audit.mismatches.some((entry) => entry.type === "CONDUCTOR_NOTE_EVENT"),
    JSON.stringify(audit.mismatches),
  );
});

for (const { label, sequence, offset, replacement, type } of [
  { label: "tempo", sequence: [0xff, 0x51, 3, 7, 0xa1, 0x20], offset: 5, replacement: 0x21, type: "TEMPO_MISMATCH" },
  { label: "meter", sequence: [0xff, 0x58, 4, 4, 2, 24, 8], offset: 3, replacement: 3, type: "TIME_SIGNATURE_MISMATCH" },
  { label: "key", sequence: [0xff, 0x59, 2, 0, 0], offset: 3, replacement: 1, type: "KEY_SIGNATURE_MISMATCH" },
  { label: "program", sequence: [0xc2, 80], offset: 1, replacement: 81, type: "PROGRAM_MISMATCH" },
]) {
  test(`parity audit detects serialized ${label} drift even when every note is intact`, () => {
    const source = performedAuthoritySong();
    const corrupted = new Uint8Array(encodeMidi(source));
    const index = findSequence(corrupted, sequence);
    assert.ok(index >= 0, `${label} fixture must be present`);
    corrupted[index + offset] = replacement;
    const audit = auditMidiExportParity(source, corrupted);
    assert.equal(audit.passed, false, `${label} corruption must not pass note-only validation`);
    assert.ok(audit.mismatches.some((entry) => entry.type === type), JSON.stringify(audit.mismatches));
  });
}

test("parity audit detects a shortened conductor end without changing any note events", () => {
  const source = performedAuthoritySong();
  const corrupted = new Uint8Array(encodeMidi(source));
  // The last conductor event is the key signature at tick 0. EOT is at 1920.
  const index = findSequence(corrupted, [0x8f, 0x00, 0xff, 0x2f, 0]);
  assert.ok(index >= 0);
  corrupted[index] = 0x8e;
  const audit = auditMidiExportParity(source, corrupted);
  assert.equal(audit.passed, false);
  assert.ok(audit.mismatches.some((entry) => entry.type === "END_OF_TRACK_MISMATCH"));
});

test("odd-meter conductor timing and every musical track survive a verified export", () => {
  for (const meter of [[5, 8], [7, 8], [9, 8], [13, 16]]) {
    const source = performedAuthoritySong();
    source.meta.timeSignature = meter;
    source.meta.beatsPerBar = meter[0] * 4 / meter[1];
    source.meta.totalBeats = source.meta.beatsPerBar * 3;
    const verified = encodeMidiVerified(source);
    assert.deepEqual(verified.projection.conductor.timeSignature.slice(0, 2), [meter[0], Math.log2(meter[1])]);
    assert.equal(verified.projection.endTick, Math.round(source.meta.totalBeats * 480));
    assert.equal(verified.audit.passed, true);
  }
});

test("odd-meter section labels derive quarter-note beats when legacy metadata omits beatsPerBar", () => {
  const song = performedAuthoritySong();
  song.meta.timeSignature = [7, 8];
  song.meta.totalBeats = 10.5;
  delete song.meta.beatsPerBar;
  song.structure = [{ id: "return", name: "chorus", startBeat: 7, bars: 1 }];
  const verified = encodeMidiVerified(song);
  assert.deepEqual(verified.projection.conductor.markers, [{ tick: 3360, text: "01 CHORUS · bars 3-3" }]);
});

test("MIDI parser cannot borrow a truncated meta payload from the next track", () => {
  const song = performedAuthoritySong();
  const bytes = new Uint8Array(encodeMidi(song));
  const view = new DataView(bytes.buffer);
  const conductorLength = view.getUint32(18);
  view.setUint32(18, conductorLength - 1);
  assert.throws(() => auditMidiExportParity(song, bytes), /truncated/);
});

test("section marker corruption is rejected independently of note parity", () => {
  const song = performedAuthoritySong();
  song.structure = [{ id: "hook", name: "chorus", startBar: 0, startBeat: 0, bars: 1 }];
  const bytes = new Uint8Array(encodeMidi(song));
  const index = findSequence(bytes, new TextEncoder().encode("01 CHORUS"));
  assert.ok(index >= 0);
  bytes[index + 1] = "2".charCodeAt(0);
  const audit = auditMidiExportParity(song, bytes);
  assert.equal(audit.passed, false);
  assert.ok(audit.mismatches.some((entry) => entry.type === "SECTION_MARKER_MISMATCH"));
});

test("app export path uses verified MIDI bytes before browser or Android handoff", () => {
  const source = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(source, /const verifiedExport = encodeMidiVerified\(prepared\.song, prepared\.options\)/);
  assert.match(source, /const payload = verifiedExport\.bytes instanceof Uint8Array/);
  assert.doesNotMatch(source, /const bytes = encodeMidi\(prepared\.song, prepared\.options\)/);
});
