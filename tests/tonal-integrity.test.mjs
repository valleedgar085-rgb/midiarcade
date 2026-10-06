import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeTonalIntegrity,
  evaluateTonalLicense,
  refineTonalIntegrity,
} from "../src/core/tonal-integrity.js";
import { generateNew } from "../src/music-engine.js";

function baseTrack(id, notes) {
  return { id, notes: notes.map((note) => ({ duration: 0.5, velocity: 90, ...note })) };
}

test("tonal integrity snaps literal scale escapes and only resolves harsh strong color tones", () => {
  const tracks = [
    baseTrack("drums", [{ pitch: 36, start: 0 }]),
    baseTrack("bass", [{ pitch: 36, start: 0, duration: 1 }]),
    baseTrack("chords", [
      { pitch: 60, start: 0, duration: 4 },
      { pitch: 64, start: 0, duration: 4 },
      { pitch: 67, start: 0, duration: 4 },
    ]),
    baseTrack("melody", [
      { pitch: 61, start: 0, duration: 0.4 },
      { pitch: 65, start: 1, duration: 1 },
      { pitch: 62, start: 2, duration: 0.8 },
      { pitch: 65, start: 3, duration: 1, plannedTension: 0.9 },
    ]),
    baseTrack("counterpoint", [
      { pitch: 71, start: 1, duration: 0.9 },
    ]),
    baseTrack("pad", [{ pitch: 60, start: 0, duration: 4 }]),
  ];
  const harmony = [{ start: 0, duration: 4, rootPc: 0, tones: [0, 4, 7] }];
  const meta = { keyPc: 0, scaleIntervals: [0, 2, 4, 5, 7, 9, 11], beatsPerBar: 4 };
  const structure = [{ id: "verse-1", startBeat: 0, endBeat: 4 }];

  const first = refineTonalIntegrity(tracks, harmony, meta, structure);
  const second = refineTonalIntegrity(tracks, harmony, meta, structure);
  assert.deepEqual(first, second, "tonal repair must remain deterministic");

  const melody = first.tracks.find((track) => track.id === "melody").notes;
  const counterpoint = first.tracks.find((track) => track.id === "counterpoint").notes;
  assert.equal(melody[0].pitch, 60, "C# must snap into the active C-major pitch collection");
  assert.equal(melody[1].pitch, 64, "long strong F over C major should resolve to the nearest chord tone E");
  assert.equal(melody[2].pitch, 62, "a whole-step color tone should remain available");
  assert.equal(melody[3].pitch, 65, "explicit high-tension notes must remain untouched");
  assert.equal(counterpoint[0].pitch, 72, "long strong B against a plain C triad should resolve to C");
  assert.equal(first.report.after.scaleFit, 1);
  assert.equal(first.report.after.harshStrongNotes, 0);
  assert.ok(first.report.scaleCorrections >= 1);
  assert.ok(first.report.chordCorrections >= 2);
});

test("Hip-Hop strong melodic attacks resolve to the active chord without changing passing tones", () => {
  const tracks = [baseTrack("melody", [
    { pitch: 62, start: 0, duration: 0.4, phraseAnchor: true },
    { pitch: 62, start: 0.5, duration: 0.4 },
  ])];
  const harmony = [{ start: 0, duration: 4, rootPc: 0, tones: [0, 4, 7] }];
  const meta = {
    genre: "hipHop",
    keyPc: 0,
    scaleIntervals: [0, 2, 4, 5, 7, 9, 11],
    beatsPerBar: 4,
  };
  const structure = [{ id: "verse-1", startBeat: 0, endBeat: 4 }];

  const result = refineTonalIntegrity(tracks, harmony, meta, structure);
  const melody = result.tracks[0].notes;
  assert.ok([0, 4, 7].includes(melody[0].pitch % 12));
  assert.equal(melody[1].pitch, 62, "offbeat passing color should remain intact");
  assert.equal(result.report.chordCorrections, 1);
});

test("tonal analysis independently reports the selected and detected tonal center", () => {
  const tracks = [
    baseTrack("melody", [
      { pitch: 67, start: 0, duration: 0.5 },
      { pitch: 60, start: 3.5, duration: 0.5 },
      { pitch: 60, start: 7.5, duration: 0.5 },
    ]),
    baseTrack("bass", [
      { pitch: 36, start: 0, duration: 4 },
      { pitch: 36, start: 4, duration: 4 },
    ]),
  ];
  const harmony = [
    { start: 0, duration: 4, rootPc: 0, tones: [0, 4, 7] },
    { start: 4, duration: 4, rootPc: 0, tones: [0, 4, 7] },
  ];
  const meta = { keyPc: 0, scaleIntervals: [0, 2, 4, 5, 7, 9, 11], beatsPerBar: 4 };
  const structure = [
    { id: "verse-1", startBeat: 0, endBeat: 4 },
    { id: "chorus-1", startBeat: 4, endBeat: 8 },
  ];
  const report = analyzeTonalIntegrity(tracks, harmony, meta, structure);
  assert.equal(report.selectedKeyPc, 0);
  assert.equal(report.detectedTonicPc, 0);
  assert.ok(report.selectedTonicAlignment >= 0.99);
  assert.equal(report.scaleFit, 1);
});

test("generated songs carry a final tonal-integrity audit without weakening release safety", { timeout: 120_000 }, () => {
  for (const genre of ["trap", "hipHop", "pop", "neoSoul", "jazz", "afrobeats"]) {
    const song = generateNew({
      genre,
      seed: `tonal-integrity-${genre}`,
      bars: 16,
      professionalUpgrade: true,
      variation: 0.76,
      complexity: 0.72,
      surprise: 0.48,
    });
    assert.ok(song.tonalIntegrity, `${genre} should expose tonal-integrity diagnostics`);
    assert.equal(song.tonalIntegrity.after.scaleFit, 1, `${genre} final notes must remain scale-safe`);
    assert.equal(song.producerPass.checks.finalScaleSafety, true, `${genre} must pass the final scale guard`);
    assert.equal(song.meta.qualityGate.scaleSafe, true, `${genre} release scale contract must remain intact`);
  }
});


test("tonal repair never creates overlapping unisons inside a pitched track", () => {
  const tracks = [
    baseTrack("melody", [
      { pitch: 64, start: 0, duration: 1.5 },
      { pitch: 65, start: 1, duration: 1 },
    ]),
  ];
  const harmony = [{ start: 0, duration: 4, rootPc: 0, tones: [0, 4, 7] }];
  const meta = { keyPc: 0, scaleIntervals: [0, 2, 4, 5, 7, 9, 11], beatsPerBar: 4 };
  const structure = [{ id: "verse-1", startBeat: 0, endBeat: 4 }];

  const result = refineTonalIntegrity(tracks, harmony, meta, structure);
  const melody = result.tracks[0].notes;
  assert.equal(melody[0].pitch, 64);
  assert.notEqual(melody[1].pitch, 64, "repair must not retune an overlapping note onto an occupied pitch");
  const byPitch = new Map();
  for (const note of melody) {
    const previous = byPitch.get(note.pitch);
    if (previous) assert.ok(previous.start + previous.duration <= note.start + 1e-6);
    byPitch.set(note.pitch, note);
  }
});


test("borrowed chord tones stay licensed only when the active chord proves them", () => {
  const tracks = [baseTrack("melody", [
    { pitch: 68, start: 0, duration: 1, tonalLicense: "borrowedChordTone" },
  ])];
  const harmony = [{
    start: 0,
    duration: 4,
    rootPc: 5,
    tones: [5, 8, 0],
    borrowed: true,
  }];
  const meta = { keyPc: 0, scaleIntervals: [0, 2, 4, 5, 7, 9, 11], beatsPerBar: 4 };

  const result = refineTonalIntegrity(tracks, harmony, meta, []);
  const melody = result.tracks[0].notes[0];

  assert.equal(melody.pitch, 68);
  assert.equal(melody.tonalIntegrityLicense, "borrowedChordTone");
  assert.equal(result.report.licensedPreserved, 1);
  assert.equal(result.report.after.literalScaleFit, 0);
  assert.equal(result.report.after.scaleFit, 1);
  assert.equal(result.report.after.licensedColorNotes, 1);
  assert.equal(result.report.after.unsafeScaleNotes, 0);
});

test("secondary-dominant evidence can license a non-diatonic chord tone", () => {
  const note = { pitch: 61, start: 0, duration: 0.5, tonalLicense: "secondaryDominantTone" };
  const chord = {
    rootPc: 9,
    tones: [9, 1, 4, 7],
    secondaryDominant: true,
  };
  const meta = { keyPc: 0, scaleIntervals: [0, 2, 4, 5, 7, 9, 11] };

  const license = evaluateTonalLicense(note, null, chord, meta);
  assert.equal(license.valid, true);
  assert.equal(license.reason, "secondary-dominant-evidence");

  const result = refineTonalIntegrity(
    [baseTrack("melody", [note])],
    [{ start: 0, duration: 4, ...chord }],
    meta,
    [],
  );
  assert.equal(result.tracks[0].notes[0].pitch, 61);
  assert.equal(result.report.licensedPreserved, 1);
});

test("short chromatic approaches are preserved only when they resolve by semitone", () => {
  const meta = { keyPc: 0, scaleIntervals: [0, 2, 4, 5, 7, 9, 11], beatsPerBar: 4 };
  const harmony = [{ start: 0, duration: 4, rootPc: 0, tones: [0, 4, 7] }];
  const validTracks = [baseTrack("melody", [
    { pitch: 61, start: 0.5, duration: 0.25, tonalLicense: "chromaticApproach" },
    { pitch: 62, start: 0.75, duration: 0.5 },
  ])];

  const valid = refineTonalIntegrity(validTracks, harmony, meta, []);
  assert.equal(valid.tracks[0].notes[0].pitch, 61);
  assert.equal(valid.tracks[0].notes[0].tonalIntegrityLicense, "chromaticApproach");
  assert.equal(valid.report.licensedPreserved, 1);

  const invalidTracks = [baseTrack("melody", [
    { pitch: 61, start: 0.5, duration: 0.25, tonalLicense: "chromaticApproach" },
    { pitch: 64, start: 0.75, duration: 0.5 },
  ])];
  const invalid = refineTonalIntegrity(invalidTracks, harmony, meta, []);
  assert.notEqual(invalid.tracks[0].notes[0].pitch, 61);
  assert.equal(invalid.report.licensedPreserved, 0);
  assert.ok(invalid.report.scaleCorrections >= 1);
});

test("a fake borrowed-tone label cannot bypass tonal safety", () => {
  const tracks = [baseTrack("melody", [
    { pitch: 61, start: 0, duration: 0.4, tonalLicense: "borrowedChordTone" },
  ])];
  const harmony = [{ start: 0, duration: 4, rootPc: 0, tones: [0, 4, 7] }];
  const meta = { keyPc: 0, scaleIntervals: [0, 2, 4, 5, 7, 9, 11], beatsPerBar: 4 };

  const result = refineTonalIntegrity(tracks, harmony, meta, []);
  assert.notEqual(result.tracks[0].notes[0].pitch, 61);
  assert.equal(result.report.licensedPreserved, 0);
  assert.equal(result.report.after.scaleFit, 1);
  assert.equal(result.report.after.unsafeScaleNotes, 0);
});
