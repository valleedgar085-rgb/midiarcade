import assert from "node:assert/strict";
import test from "node:test";
import {
  sanitizePersistedTrackSettings,
  sanitizeTasteProfile,
  validPersistedSong,
} from "../src/core/session-contract.js";

const TRACK_ORDER = ["drums", "bass"];
const DEFAULTS = {
  drums: {
    density: 68, variation: 36, octave: 0, program: 0, volume: 0.8, velocity: 1,
    pan: 0, reverb: 0.2, cutoff: 8000, resonance: 0.2, gate: 0.9,
    humanize: 0.7, feel: 0.7, waveform: "triangle", synthCutoff: 3500,
    synthResonance: 1.2, attack: 0.01, release: 0.25, detune: 0, attitude: "neutral",
  },
  bass: {
    density: 58, variation: 44, octave: 0, program: 32, volume: 0.82, velocity: 1,
    pan: 0, reverb: 0.1, cutoff: 6500, resonance: 0.2, gate: 0.9,
    humanize: 0.7, feel: 0.7, waveform: "triangle", synthCutoff: 2500,
    synthResonance: 1.1, attack: 0.01, release: 0.2, detune: 0, attitude: "neutral",
  },
};

function song() {
  return {
    meta: { totalBeats: 16, tempo: 96 },
    tracks: [
      { id: "drums", notes: [{ pitch: 36, start: 0, duration: 0.25, velocity: 110 }] },
      { id: "bass", notes: [{ pitch: 40, start: 0, duration: 1, velocity: 96 }] },
    ],
    sections: [{ id: "verse", start: 0, bars: 4 }],
  };
}

test("persisted song validation enforces track identity and MIDI bounds", () => {
  assert.equal(validPersistedSong(song(), { trackOrder: TRACK_ORDER }), true);

  const duplicate = song();
  duplicate.tracks[1].id = "drums";
  assert.equal(validPersistedSong(duplicate, { trackOrder: TRACK_ORDER }), false);

  const badPitch = song();
  badPitch.tracks[1].notes[0].pitch = 200;
  assert.equal(validPersistedSong(badPitch, { trackOrder: TRACK_ORDER }), false);

  const oversized = song();
  oversized.meta.totalBeats = 5000;
  assert.equal(validPersistedSong(oversized, { trackOrder: TRACK_ORDER }), false);
});

test("persisted track settings clamp unsafe values without mutating defaults", () => {
  const before = structuredClone(DEFAULTS);
  const result = sanitizePersistedTrackSettings({
    drums: {
      density: 400,
      octave: -9,
      volume: 3,
      velocity: 0,
      waveform: "noise",
      attitude: "power",
      synthCutoff: 99999,
    },
  }, { defaults: DEFAULTS, trackOrder: TRACK_ORDER });

  assert.deepEqual(DEFAULTS, before);
  assert.equal(result.drums.density, 100);
  assert.equal(result.drums.octave, -2);
  assert.equal(result.drums.volume, 1);
  assert.equal(result.drums.velocity, 0.1);
  assert.equal(result.drums.waveform, "triangle");
  assert.equal(result.drums.attitude, "power");
  assert.equal(result.drums.synthCutoff, 14000);
  assert.deepEqual(result.bass, DEFAULTS.bass);
});

test("taste sanitization filters unknown genres and bounds retained history", () => {
  const songRatings = Object.fromEntries(Array.from({ length: 70 }, (_, index) => [
    `song-${index}`,
    index % 2 ? "like" : "reject",
  ]));
  const result = sanitizeTasteProfile({
    ratings: -4,
    likes: 7,
    genreVotes: { hipHop: 4, invented: 99 },
    songRatings,
  }, { genreIds: ["hipHop", "trap"] });

  assert.equal(result.ratings, 0);
  assert.equal(result.likes, 7);
  assert.deepEqual(result.genreVotes, { hipHop: 4 });
  assert.equal(Object.keys(result.songRatings).length, 64);
  assert.equal(Object.hasOwn(result.songRatings, "song-0"), false);
  assert.equal(Object.hasOwn(result.songRatings, "song-69"), true);
});
