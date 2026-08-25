import assert from "node:assert/strict";
import test from "node:test";
import {
  encodeMidi,
  evaluateSongCandidate,
  generateNew,
  generateSimilar,
  GENRE_PROFILES,
} from "../src/music-engine.js";

const VOCAL_GENRES = new Set(["rap", "hipHop", "trap", "drill", "rnbSoul", "neoSoul", "pop", "reggaeton", "afrobeats"]);
const REQUIRED_PHASES = [7, 8, 9, 39, 41, 42, 44, 46, 47, 48, 51, 52, 66, 67, 68, 69, 70, 71, 72, 75, 76];

function mod(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function assertHardSongContract(song) {
  assert.equal(song.schema, "midi-arcade/song@1");
  assert.equal(song.tracks.length, 6);
  assert.deepEqual(song.generationPhases.map(({ phase }) => phase), REQUIRED_PHASES);
  assert.ok(
    song.generationPhases.every(({ status }) =>
      ["complete", "passed", "best-available", "awaiting-critic"].includes(status)),
  );
  assert.ok(Object.values(song.finalMaster.checks).every(Boolean));
  assert.ok(Object.values(song.finalAssembly.checks).every(Boolean));
  assert.ok(song.finalMaster.metrics.peakVelocity <= 120);
  assert.equal(song.vocalSpace.enabled, VOCAL_GENRES.has(song.genre));

  const scale = new Set(song.meta.scaleIntervals.map((interval) => mod(song.meta.keyPc + interval, 12)));
  const totalBeats = song.meta.totalBeats;
  for (const track of song.tracks) {
    let previousStart = -Infinity;
    const lastByPitch = new Map();
    for (const note of track.notes) {
      assert.ok(Number.isFinite(note.pitch) && Number.isFinite(note.start) && Number.isFinite(note.duration));
      assert.ok(Number.isInteger(note.pitch) && note.pitch >= 0 && note.pitch <= 127);
      assert.ok(note.start >= 0 && note.start >= previousStart);
      assert.ok(note.duration >= 0.02 && note.start + note.duration <= totalBeats + 1e-6);
      assert.ok(Number.isInteger(note.velocity) && note.velocity >= 1 && note.velocity <= 120);
      if (track.id !== "drums") {
        assert.ok(scale.has(mod(note.pitch, 12)), `${song.genre}/${track.id} emitted an out-of-scale pitch`);
        const previous = lastByPitch.get(note.pitch);
        if (previous) assert.ok(previous.start + previous.duration <= note.start + 1e-6);
        lastByPitch.set(note.pitch, note);
      }
      previousStart = note.start;
    }
  }
  const melody = song.tracks.find((track) => track.id === "melody")?.notes ?? [];
  const counterpoint = song.tracks.find((track) => track.id === "counterpoint")?.notes ?? [];
  for (const note of counterpoint) {
    const maskingLead = melody.find((lead) => (
      note.start < lead.start + lead.duration
      && lead.start < note.start + note.duration
      && [0, 1, 6, 11].includes(mod(Math.abs(note.pitch - lead.pitch), 12))
    ));
    assert.equal(maskingLead, undefined, `${song.genre} counterpoint must leave consonant space around the lead`);
  }
}

test("adversarial genre matrix survives extreme controls without breaking musical invariants", () => {
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
    assertHardSongContract(song);
    const evaluation = evaluateSongCandidate(song);
    assert.ok(evaluation.score >= 45 && evaluation.score <= 100);
    assert.ok(Object.values(evaluation.subscores).every((score) => score >= 0 && score <= 100));
  });
});

test("twelve-generation Similar chain cannot drift off-scale, lose lineage, or collapse novelty", () => {
  let song = generateNew({ genre: "rap", seed: "chain-root", bars: 12, candidateCount: 1 });
  const fingerprints = new Set([JSON.stringify(song.meta.ideaFingerprint)]);
  for (let revision = 1; revision <= 12; revision += 1) {
    const parent = song;
    song = generateSimilar(parent, {
      seed: `chain-step-${revision}`,
      candidateCount: 1,
      recentSongs: [parent],
    });
    assert.equal(song.parentId, parent.id);
    assert.equal(song.revision, revision);
    assert.equal(song.genre, "rap");
    assertHardSongContract(song);
    fingerprints.add(JSON.stringify(song.meta.ideaFingerprint));
  }
  assert.ok(fingerprints.size >= 10, "a long Similar chain should retain DNA without collapsing into duplicates");
});

test("dense maximum-length output remains bounded and encodes deterministic multitrack MIDI", () => {
  const song = generateNew({
    genre: "drumBass",
    seed: "maximum-density-export",
    bars: 64,
    energy: 1,
    complexity: 1,
    variation: 1,
    evolution: 1,
    surprise: 1,
    drumFills: 1,
    tripletAmount: 1,
    rollAmount: 1,
    candidateCount: 1,
    tracks: Object.fromEntries(["drums", "bass", "chords", "melody", "counterpoint", "pad"].map((id) => [
      id,
      { density: 1, variation: 1, velocity: 1, gate: 1 },
    ])),
  });
  assertHardSongContract(song);
  const first = encodeMidi(song);
  const second = encodeMidi(song);
  assert.deepEqual(first, second);
  assert.equal(String.fromCharCode(...first.slice(0, 4)), "MThd");
  const text = new TextDecoder("latin1").decode(first);
  assert.equal(text.split("MTrk").length - 1, 7);
  assert.ok(first.length > 20_000 && first.length < 5_000_000);
});

test("malformed public inputs normalize safely or fail with a precise contract error", () => {
  const normalized = generateNew({
    genre: "__unknown__",
    key: "__bad__",
    scale: "__bad__",
    tempo: Number.POSITIVE_INFINITY,
    bars: Number.NaN,
    tracks: { melody: null, drums: { density: "not-a-number", octave: 999 } },
    candidateCount: 1,
  });
  assertHardSongContract(normalized);
  assert.throws(
    () => generateSimilar(null),
    /generateSimilar requires a generated song JSON object/,
  );
  assert.throws(
    () => encodeMidi(null),
    /song|MIDI/i,
  );
});

test("final mastering restores melody and counterpoint space after late performance polish", () => {
  const song = generateNew({
    genre: "country",
    seed: "calibration-a:country",
    bars: 8,
    candidateCount: 1,
  });
  const evaluation = evaluateSongCandidate(song);
  const melody = song.tracks.find((track) => track.id === "melody").notes;
  const counterpoint = song.tracks.find((track) => track.id === "counterpoint").notes;
  const dissonant = counterpoint.filter((note) => melody.some((lead) => (
    note.start < lead.start + lead.duration
    && lead.start < note.start + note.duration
    && [0, 1, 6, 11].includes(Math.abs(note.pitch - lead.pitch) % 12)
  )));
  assert.equal(dissonant.length, 0, "late counterpoint must not mask the lead with unisons, semitones, or tritones");
  assert.ok(evaluation.subscores.separation >= 80);
  assert.ok(song.finalMaster.repairs.leadDissonancesCleared > 0);
});
