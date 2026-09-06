// Phase 3 permanent regression coverage for groove intelligence and compatibility contracts.
import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateSongCandidate,
  evaluateSongReleaseGate,
  generateNew,
  generateSimilar,
} from "../src/music-engine.js";

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
    .join("|"));
}

function beatPhase(value) {
  return ((value % 1) + 1) % 1;
}

function phaseDelta(left, right) {
  const difference = Math.abs(left - right);
  return Math.min(difference, 1 - difference);
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
    assert.ok(developed.every((note) => note.velocity >= 1 && note.velocity <= 120));
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
    const adjacentCopies = signatures.slice(1).filter((signature, index) => signature && signatures[index] && signature === signatures[index]);

    assert.ok(recalls.length > 0, `${genre} should retain at least one canonical groove-memory recall`);
    assert.ok(recalls.every((note) => note.connectionId), `${genre} recalled groove notes must retain target-section interlock metadata`);
    assert.ok(recalls.every((note) => note.velocity <= 120), `${genre} recalled groove notes must honor the engine velocity ceiling`);
    assert.equal(adjacentCopies.length, 0, `${genre} must not create adjacent cloned drum bars`);
    assert.deepEqual(song.finalAssembly?.checks, {
      sectionCoverage: true,
      featuredLaneCoverage: true,
      transitionCoverage: true,
    }, `${genre} final assembly safety must remain complete`);
    assert.equal(release.passed, true, `${genre} must remain release-safe after groove-memory recall`);
  }
});

test("targeted Similar drum rerolls preserve the retained Trap bass contract through critic repair", () => {
  const current = generateNew({
    genre: "trap",
    scale: "harmonicMinor",
    seed: "phase3-targeted-base",
    bars: 8,
    density: 0.8,
    variation: 0.58,
    humanize: 0,
  });
  const bass = current.tracks.find((track) => track.id === "bass");
  assert.ok(bass?.notes.length);

  const rerolled = generateSimilar(current, {
    seed: "phase3-targeted-drums",
    targetTrack: "drums",
    contextTracks: { bass },
  });
  const kicks = rerolled.tracks.find((track) => track.id === "drums")?.notes
    .filter((note) => note.pitch === 36) ?? [];
  const interaction = bass.notes.filter((note) => kicks.some((kick) => (
    phaseDelta(beatPhase(note.start), beatPhase(kick.start)) <= 0.250001
  ))).length / bass.notes.length;

  assert.ok(interaction >= 0.85, `retained bass interaction fell to ${interaction}`);
});

test("phase 3 clone detection preserves empty bar positions", () => {
  const song = {
    bars: 3,
    meta: { beatsPerBar: 4 },
    tracks: [{
      id: "drums",
      notes: [
        { pitch: 36, start: 0 },
        { pitch: 36, start: 8 },
      ],
    }],
  };
  const signatures = criticBarSignatures(song);
  assert.deepEqual(signatures, ["36:0", "", "36:0"]);
  const adjacentCopies = signatures.slice(1).filter((signature, index) => (
    signature && signatures[index] && signature === signatures[index]
  ));
  assert.equal(adjacentCopies.length, 0);
});

test("phase 3 reports the post-groove final rhythm lock", () => {
  const song = generateNew({
    genre: "techno",
    seed: "phase3-final-rhythm-lock-report",
    bars: 16,
    candidateCount: 1,
  });
  assert.deepEqual(
    song.finalMaster?.repairs?.finalRhythmLock,
    song.finalRhythmLock?.repairs,
    "final master diagnostics must describe the same post-groove lock exposed by the song",
  );
});
