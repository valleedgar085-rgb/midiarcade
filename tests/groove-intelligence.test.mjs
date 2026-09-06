// Phase 3 permanent regression coverage for groove intelligence and compatibility contracts.
import test from "node:test";
import assert from "node:assert/strict";
import { evaluateSongCandidate, evaluateSongReleaseGate, generateNew } from "../src/music-engine.js";

const TARGET_GENRES = ["rnbSoul", "techno", "trap", "drumBass", "reggaeton", "afrobeats"];
const GROOVE_MEMORY_GENRES = [...TARGET_GENRES, "house"];

function drumSignature(song) {
  const drums = song.tracks.find((track) => track.id === "drums")?.notes ?? [];
  return drums.map(({ pitch, start, velocity }) => [pitch, start, velocity]);
}

function criticBarSignatures(song) {
  const drums = song.tracks.find((track) => track.id === "drums")?.notes ?? [];
  const barBeats = song.meta?.beatsPerBar ?? 4;
  return Array.from({ length: song.bars }, (_, bar) => drums
    .filter((note) => Math.floor(note.start / barBeats) === bar)
    .map((note) => `${note.pitch}:${Math.round((((note.start % barBeats) + barBeats) % barBeats + Number.EPSILON) * 1e6) / 1e6}`)
    .join("|"))
    .filter(Boolean);
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

test("phase 3 groove memory preserves transition contracts and avoids adjacent clone bars", () => {
  for (const genre of GROOVE_MEMORY_GENRES) {
    const song = generateNew({ genre, seed: `quality-lab-01:${genre}`, bars: 16, candidateCount: 1 });
    const evaluation = evaluateSongCandidate(song);
    const release = evaluateSongReleaseGate(song, evaluation);
    const drums = song.tracks.find((track) => track.id === "drums")?.notes ?? [];
    const recalls = drums.filter((note) => note.grooveMemoryRecall);
    const signatures = criticBarSignatures(song);
    const adjacentCopies = signatures.slice(1).filter((signature, index) => signature === signatures[index]);

    assert.ok(recalls.length > 0, `${genre} should retain at least one canonical groove-memory recall`);
    assert.equal(adjacentCopies.length, 0, `${genre} must not create adjacent cloned drum bars`);
    assert.deepEqual(song.finalAssembly?.checks, {
      sectionCoverage: true,
      featuredLaneCoverage: true,
      transitionCoverage: true,
    }, `${genre} final assembly safety must remain complete`);
    assert.equal(release.passed, true, `${genre} must remain release-safe after groove-memory recall`);
  }
});
