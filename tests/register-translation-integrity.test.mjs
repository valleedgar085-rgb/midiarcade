import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { encodeMidi, generateNew } from "../src/music-engine.js";
import { canonicalMidiPitch, midiPitchToFrequency } from "../src/core/pitch-contract.js";
import { refineRoleRegisters } from "../src/core/role-register-refinement.js";
import { roleRegisterWindow } from "../src/core/role-register-policy.js";

function pitchClass(pitch) {
  return ((Math.round(Number(pitch)) % 12) + 12) % 12;
}

function includesBytes(bytes, sequence) {
  outer: for (let index = 0; index <= bytes.length - sequence.length; index += 1) {
    for (let offset = 0; offset < sequence.length; offset += 1) {
      if (bytes[index + offset] !== sequence[offset]) continue outer;
    }
    return true;
  }
  return false;
}

test("preview and MIDI export share one canonical rendered-pitch authority", () => {
  const appSource = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const engineSource = fs.readFileSync(new URL("../src/music-engine.js", import.meta.url), "utf8");

  assert.match(appSource, /pitch:\s*canonicalMidiPitch\(notePitch\(note\)\)/);
  assert.match(appSource, /const targetFrequency = midiPitchToFrequency\(event\.pitch\)/);
  assert.doesNotMatch(appSource, /clamp\(event\.pitch,\s*24,\s*108\)/);
  assert.match(engineSource, /const pitch = canonicalMidiPitch\(note\.pitch\)/);

  assert.equal(canonicalMidiPitch(12), 12);
  assert.equal(canonicalMidiPitch(120), 120);
  assert.equal(midiPitchToFrequency(69), 440);
  assert.ok(midiPitchToFrequency(12) < midiPitchToFrequency(24));
  assert.ok(midiPitchToFrequency(120) > midiPitchToFrequency(108));
});

test("MIDI export preserves rendered low and high note numbers instead of preview-style octave clamping", () => {
  const song = {
    title: "Pitch Parity",
    bpm: 120,
    key: "C",
    mode: "major",
    meta: {
      tempo: 120,
      key: "C",
      keyPc: 0,
      scale: "major",
      scaleIntervals: [0, 2, 4, 5, 7, 9, 11],
      timeSignature: [4, 4],
      bars: 1,
      beatsPerBar: 4,
      totalBeats: 4,
      ppq: 480,
    },
    structure: [],
    harmony: [],
    tracks: [{
      id: "melody",
      name: "Melody",
      channel: 0,
      program: 80,
      settings: {
        volume: 1,
        velocity: 1,
        gate: 1,
        pan: 0,
        reverb: 0,
        mute: false,
        solo: false,
      },
      notes: [
        { pitch: 12, start: 0, duration: 0.5, velocity: 100 },
        { pitch: 120, start: 1, duration: 0.5, velocity: 101 },
      ],
      automation: [],
    }],
  };

  const bytes = encodeMidi(song);
  assert.ok(includesBytes(bytes, [0x90, 12, 100]), "low rendered MIDI note must export as note 12");
  assert.ok(includesBytes(bytes, [0x90, 120, 101]), "high rendered MIDI note must export as note 120");
});

test("role-register refinement is octave-only and moves fatigue-prone parts into professional windows", () => {
  const tracks = [
    { id: "bass", notes: [{ pitch: 24, start: 0, duration: 1, velocity: 90 }] },
    { id: "chords", notes: [{ pitch: 91, start: 0, duration: 1, velocity: 78 }] },
    { id: "melody", notes: [{ pitch: 96, start: 0, duration: 0.5, velocity: 88 }] },
    { id: "counterpoint", notes: [{ pitch: 95, start: 1, duration: 0.5, velocity: 74 }] },
    { id: "pad", notes: [{ pitch: 91, start: 0, duration: 2, velocity: 64 }] },
  ];
  const structure = [{ id: "verse-1", startBeat: 0, endBeat: 4, intent: { role: "develop" } }];
  const before = new Map(tracks.map((track) => [track.id, track.notes[0].pitch]));

  const result = refineRoleRegisters(tracks, structure);
  assert.equal(result.report.after.hardViolations, 0);
  assert.ok(result.report.corrections >= 5);
  for (const track of result.tracks) {
    const window = roleRegisterWindow(track.id);
    assert.ok(window);
    for (const note of track.notes) {
      assert.ok(note.pitch >= window.min && note.pitch <= window.max, `${track.id} must stay inside its role window`);
      assert.equal(pitchClass(note.pitch), pitchClass(before.get(track.id)), `${track.id} correction must preserve pitch class`);
    }
  }
  assert.ok(result.tracks.find((track) => track.id === "bass").notes[0].pitch >= 35);
  assert.ok(result.tracks.find((track) => track.id === "melody").notes[0].pitch <= 84);
});

test("raising bass body never sacrifices the seven-semitone harmony separation contract", () => {
  const tracks = [
    { id: "bass", notes: [{ pitch: 34, start: 0, duration: 2, velocity: 90 }] },
    { id: "chords", notes: [{ pitch: 48, start: 0, duration: 2, velocity: 78 }] },
  ];
  const result = refineRoleRegisters(tracks, [{ id: "verse-1", startBeat: 0, endBeat: 4 }]);
  const bass = result.tracks.find((track) => track.id === "bass").notes[0];
  const chord = result.tracks.find((track) => track.id === "chords").notes[0];
  assert.ok(bass.pitch >= 35, "bass should move into its preferred body range");
  assert.ok(chord.pitch - bass.pitch >= 7, "harmony must remain at least seven semitones above sounding bass");
  assert.ok(result.report.separationCorrections >= 1);
  assert.equal(pitchClass(bass.pitch), pitchClass(34));
  assert.equal(pitchClass(chord.pitch), pitchClass(48));
});

test("default Trap output no longer hides the bass an extra octave below its rendered MIDI register", { timeout: 120_000 }, () => {
  const song = generateNew({
    genre: "trap",
    seed: "fl-studio-register-parity",
    bars: 16,
    professionalUpgrade: true,
    candidateCount: 1,
  });
  const bass = song.tracks.find((track) => track.id === "bass")?.notes ?? [];
  assert.ok(bass.length > 0);
  assert.ok(Math.min(...bass.map((note) => note.pitch)) >= 35, "Trap bass body should not fall below the preferred professional floor");
  assert.equal(song.registerIntegrity?.after?.hardViolations, 0);
  assert.equal(song.tonalIntegrity?.after?.scaleFit, 1);
});
