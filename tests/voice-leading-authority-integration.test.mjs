import assert from "node:assert/strict";
import test from "node:test";

import * as engine from "../src/music-engine.js";

function chordPitchSignature(song) {
  const track = song.tracks.find((entry) => entry.id === "chords");
  return (track?.notes ?? []).map((note) => [
    Number(note.start.toFixed(4)),
    note.pitch,
    Number(note.duration.toFixed(4)),
  ]);
}

test("generated harmony keeps smooth deterministic voice leading across representative genres", () => {
  const cases = [
    ["jazz", "C", "dorian"],
    ["neoSoul", "F#", "minor"],
    ["country", "G", "major"],
    ["house", "A", "minor"],
  ];

  let commonTones = 0;
  for (const [genre, key, scale] of cases) {
    const config = {
      genre,
      key,
      scale,
      seed: `whole-voicing-${genre}`,
      bars: 12,
      energy: 0.72,
      complexity: 0.76,
      variation: 0.62,
      candidateCount: 1,
      professionalUpgrade: true,
    };
    const first = engine.generateNew(config);
    const second = engine.generateNew(config);

    assert.equal(first.voiceLeading?.phase, 46);
    assert.equal(first.voiceLeading?.status, "complete");
    assert.equal(first.voiceLeading?.scalePreserved, true);
    assert.ok(
      first.voiceLeading.averageVoiceMotion <= 7,
      `${genre} average voice motion was ${first.voiceLeading.averageVoiceMotion}`,
    );
    assert.deepEqual(chordPitchSignature(first), chordPitchSignature(second));
    commonTones += first.voiceLeading.commonTonesHeld;
  }

  assert.ok(commonTones > 0, "voice leading should retain common tones across the matrix");
});
