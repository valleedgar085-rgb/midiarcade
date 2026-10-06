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

test("app export path uses verified MIDI bytes before browser or Android handoff", () => {
  const source = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(source, /const verifiedExport = encodeMidiVerified\(prepared\.song, prepared\.options\)/);
  assert.match(source, /const payload = verifiedExport\.bytes instanceof Uint8Array/);
  assert.doesNotMatch(source, /const bytes = encodeMidi\(prepared\.song, prepared\.options\)/);
});
