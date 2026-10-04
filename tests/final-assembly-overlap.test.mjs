import assert from "node:assert/strict";
import test from "node:test";

import { generateNew, GENRE_PROFILES } from "../src/music-engine.js";

function assertNoSamePitchOverlaps(song) {
  for (const track of song.tracks) {
    if (track.id === "drums") continue;
    const lastByPitch = new Map();
    for (const note of track.notes) {
      const previous = lastByPitch.get(note.pitch);
      if (previous) {
        assert.ok(
          previous.start + previous.duration <= note.start + 1e-6,
          `${song.genre}/${track.id} pitch ${note.pitch} overlaps at beat ${note.start}`,
        );
      }
      lastByPitch.set(note.pitch, note);
    }
  }
}

test("final assembly leaves no same-pitch overlaps across adversarial genre outputs", { timeout: 120_000 }, () => {
  const keys = ["C", "F#", "Bb", "Db"];
  const scales = ["major", "minor", "dorian", "phrygian", "harmonicMinor", "minorPentatonic"];

  Object.keys(GENRE_PROFILES).forEach((genre, index) => {
    const high = index % 2 === 0;
    const song = generateNew({
      genre,
      seed: `adversarial:${genre}`,
      key: keys[index % keys.length],
      scale: scales[index % scales.length],
      bars: high ? 999 : -20,
      energy: high ? 50 : -50,
      complexity: high ? 50 : -50,
      variation: high ? 50 : -50,
      surprise: high ? 50 : -50,
      swing: high ? 50 : -50,
      humanize: high ? 50 : -50,
      tripletAmount: high ? 50 : -50,
      rollAmount: high ? 50 : -50,
      candidateCount: 1,
    });
    assertNoSamePitchOverlaps(song);
  });
});
