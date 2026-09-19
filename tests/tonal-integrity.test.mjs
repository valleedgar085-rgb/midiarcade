import assert from "node:assert/strict";
import test from "node:test";

import { analyzeTonalIntegrity, refineTonalIntegrity } from "../src/core/tonal-integrity.js";
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
