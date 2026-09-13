import assert from "node:assert/strict";
import test from "node:test";
import { applyElementSoundProfile } from "../src/core/elemental-sound-profile.js";

const TRACKS = ["drums", "bass", "chords", "melody", "counterpoint", "pad"];

function fixture() {
  return {
    id: "source",
    meta: { key: "A", mode: "minor", tempo: 96 },
    tracks: TRACKS.map((id, index) => ({
      id,
      program: 80 + index,
      settings: {
        volume: 0.76,
        velocity: 1,
        reverb: 0.28,
        cutoff: 7600,
        resonance: 0.22,
        gate: 0.92,
      },
      notes: [{ pitch: id === "drums" ? 36 : 48 + index * 3, start: 0, duration: 1, velocity: 96 }],
    })),
  };
}

function signature(song, id) {
  const settings = song.tracks.find((track) => track.id === id).settings;
  return [settings.volume, settings.velocity, settings.reverb, settings.cutoff, settings.resonance, settings.gate]
    .map((value) => Number(Number(value).toFixed(4)));
}

test("Fire, Electric and Drip produce clearly different bounded tone signatures", () => {
  const fire = applyElementSoundProfile(structuredClone(fixture()), "fire", 0.9);
  const electric = applyElementSoundProfile(structuredClone(fixture()), "electric", 0.9);
  const drip = applyElementSoundProfile(structuredClone(fixture()), "drip", 0.9);

  for (const id of TRACKS) {
    assert.notDeepEqual(signature(fire, id), signature(electric, id), `${id} Fire and Electric must not collapse to one tone`);
    assert.notDeepEqual(signature(electric, id), signature(drip, id), `${id} Electric and Drip must not collapse to one tone`);
    assert.notDeepEqual(signature(fire, id), signature(drip, id), `${id} Fire and Drip must not collapse to one tone`);
  }

  assert.ok(fire.tracks.find((track) => track.id === "bass").settings.cutoff > electric.tracks.find((track) => track.id === "bass").settings.cutoff * 0.85);
  assert.ok(electric.tracks.find((track) => track.id === "melody").settings.resonance > fire.tracks.find((track) => track.id === "melody").settings.resonance);
  assert.ok(drip.tracks.find((track) => track.id === "pad").settings.reverb > electric.tracks.find((track) => track.id === "pad").settings.reverb);
  assert.ok(drip.tracks.find((track) => track.id === "melody").settings.gate > fire.tracks.find((track) => track.id === "melody").settings.gate);
});

test("elemental tone shaping never rewrites musical notes or identity", () => {
  const source = fixture();
  const originalNotes = structuredClone(source.tracks.map((track) => track.notes));
  const shaped = applyElementSoundProfile(source, "electric", 1);

  assert.deepEqual(shaped.tracks.map((track) => track.notes), originalNotes);
  assert.deepEqual(shaped.meta, { key: "A", mode: "minor", tempo: 96 });
  assert.deepEqual(shaped.elementSound, { version: 1, id: "electric", intensity: 1 });

  for (const track of shaped.tracks) {
    assert.ok(track.settings.volume >= 0 && track.settings.volume <= 1);
    assert.ok(track.settings.velocity >= 0.1 && track.settings.velocity <= 1.5);
    assert.ok(track.settings.reverb >= 0 && track.settings.reverb <= 1);
    assert.ok(track.settings.cutoff >= 1000 && track.settings.cutoff <= 14000);
    assert.ok(track.settings.resonance >= 0 && track.settings.resonance <= 1);
    assert.ok(track.settings.gate >= 0.08 && track.settings.gate <= 1.5);
  }
});
