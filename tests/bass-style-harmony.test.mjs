import assert from "node:assert/strict";
import test from "node:test";

import { evaluateSongReleaseGate, generateNew } from "../src/music-engine.js";

function harmonyAt(song, beat) {
  return song.harmony.find((event) => (
    beat >= event.start - 1e-6 && beat < event.start + event.duration - 1e-6
  )) ?? song.harmony.at(-1);
}

test("genre bass writing rotates distinct section-level timing and pitch personalities", () => {
  for (const genre of ["neoSoul", "rnbSoul", "hipHop", "funk", "jazz", "popRadio"]) {
    const config = {
      genre,
      bars: 32,
      seed: `bass-style-check-${genre}`,
      candidateCount: 1,
      adaptiveCandidates: false,
      professionalUpgrade: true,
    };
    const song = generateNew(config);
    assert.deepEqual(song, generateNew(config), `${genre} bass-style routing must stay deterministic`);
    const bass = song.tracks.find((track) => track.id === "bass")?.notes ?? [];
    const styles = new Set(bass.map(({ bassStyle }) => bassStyle).filter(Boolean));
    assert.ok(styles.size >= 2, `${genre} should use at least two bass personalities across a full song`);
    assert.ok(
      [...styles].every((style) => ["pedal", "rootFifth", "pulse", "syncopated", "walking", "octave", "melodic"].includes(style)),
      `${genre} emitted an unknown bass personality`,
    );
    assert.equal(evaluateSongReleaseGate(song).passed, true, `${genre} bass variation must remain release-safe`);
  }
});

test("walking and melodic bass movement remains harmonized to the sounding chord", () => {
  for (const genre of ["neoSoul", "rnbSoul", "funk", "jazz", "popRadio"]) {
    const song = generateNew({
      genre,
      bars: 24,
      seed: `harmonic-anchor-check-${genre}`,
      candidateCount: 1,
      adaptiveCandidates: false,
      professionalUpgrade: true,
    });
    const movement = song.tracks
      .find(({ id }) => id === "bass")?.notes
      .filter(({ bassStyle, bassGrooveRole }) => ["walking", "melodic"].includes(bassStyle) && bassGrooveRole !== "pickup") ?? [];
    assert.ok(movement.length >= 2, `${genre} should expose harmonized walking or melodic bass movement`);
    const chordTones = movement.filter((note) => harmonyAt(song, note.start).tones.includes(note.pitch % 12));
    assert.ok(chordTones.length / movement.length >= 0.75, `${genre} moving bass should strongly favor chord tones`);
    assert.equal(evaluateSongReleaseGate(song).passed, true, `${genre} bass harmonization must remain release-safe`);
  }
});
