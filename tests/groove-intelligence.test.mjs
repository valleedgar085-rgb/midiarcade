import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSongCandidate, generateNew } from "../src/music-engine.js";

const TARGET_GENRES = ["rnbSoul", "techno", "trap", "drumBass", "reggaeton", "afrobeats"];

function drumSignature(song) {
  const drums = song.tracks.find((track) => track.id === "drums")?.notes ?? [];
  return drums.map(({ pitch, start, velocity }) => [pitch, start, velocity]);
}

test("phase 3 groove intelligence is deterministic and leaves bounded genre-native development", () => {
  for (const genre of TARGET_GENRES) {
    const options = { genre, seed: `phase3-groove-test:${genre}`, bars: 16, candidateCount: 1 };
    const first = generateNew(options);
    const second = generateNew(options);
    assert.deepEqual(drumSignature(first), drumSignature(second), `${genre} drums must remain deterministic`);

    const drums = first.tracks.find((track) => track.id === "drums")?.notes ?? [];
    const developed = drums.filter((note) => note.rhythmicFeature === "phase3-groove-development");
    assert.ok(developed.length >= 4, `${genre} should develop multiple bars without flooding the groove`);
    assert.ok(developed.length <= 20, `${genre} development must remain bounded`);
    assert.ok(developed.every((note) => note.velocity >= 1 && note.velocity <= 127));
  }
});

test("phase 3 target genres keep a healthy drum-variety floor without weakening critic validity", () => {
  for (const genre of TARGET_GENRES) {
    const song = generateNew({ genre, seed: `phase3-quality-test:${genre}`, bars: 16, candidateCount: 1 });
    const evaluation = evaluateSongCandidate(song);
    assert.ok(evaluation.subscores.drumVariety >= 72, `${genre} drum variety fell to ${evaluation.subscores.drumVariety}`);
    assert.ok(Number.isFinite(evaluation.score) && evaluation.score > 0);
  }
});
