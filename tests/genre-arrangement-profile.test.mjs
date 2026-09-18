import assert from "node:assert/strict";
import test from "node:test";

import {
  genreArrangementProfile,
  legatoIntervalBias,
  progressionGoalsFor,
} from "../src/core/genre-arrangement-profile.js";
import { generateNew, normalizeConfig } from "../src/music-engine.js";

test("genre arrangement profiles expose rhythm, phrase, harmony, and layering structure", () => {
  const profile = genreArrangementProfile("rnbSoul");
  assert.equal(profile.id, "rnb");
  assert.ok(Array.isArray(profile.phraseBars) && profile.phraseBars.length > 0);
  assert.ok(Array.isArray(profile.rhythmTemplates) && profile.rhythmTemplates.every((template) => Array.isArray(template.steps)));
  assert.ok(Array.isArray(profile.optionalLayers) && profile.optionalLayers.length > 0);
  const goals = progressionGoalsFor(profile, "bridge", "neutral");
  assert.ok(goals.some((goal) => goal.id === "ii-V-I") || goals.some((goal) => goal.id === "modal-interchange"));
});

test("normalizeConfig carries arrangement profile phrase and layering mode", () => {
  const house = normalizeConfig({ genre: "house", seed: "profile-phrase", layeringMode: "high", professionalUpgrade: true });
  assert.equal(house.arrangementProfileId, "edm");
  assert.equal(house.phraseBars, 8);
  assert.equal(house.arrangementLayers.enabled, true);
  assert.equal(house.arrangementLayers.mode, "high");

  const off = normalizeConfig({ genre: "ambient", seed: "profile-off", layeringMode: "off", professionalUpgrade: true });
  assert.equal(off.arrangementLayers.enabled, false);
  assert.equal(off.arrangementLayers.density, 0);
});

test("optional arrangement layers are probabilistic and disabled when requested", () => {
  const baseInput = {
    genre: "ambient",
    seed: "layering-check",
    bars: 24,
    variation: 0.66,
    energy: 0.58,
    professionalUpgrade: true,
  };
  const disabled = generateNew({ ...baseInput, layeringMode: "off" });
  const enabledA = generateNew({ ...baseInput, layeringMode: "high" });
  const enabledB = generateNew({ ...baseInput, layeringMode: "high" });

  assert.equal(disabled.arrangementLayers.enabled, false);
  assert.equal(disabled.arrangementLayers.triggers, 0);
  assert.equal(disabled.tracks.flatMap((track) => track.notes).some((note) => note.arrangementLayer), false);

  assert.equal(enabledA.arrangementLayers.enabled, true);
  assert.ok(enabledA.arrangementLayers.triggers > 0);
  assert.ok(enabledA.tracks.flatMap((track) => track.notes).some((note) => note.arrangementLayer));
  assert.equal(enabledA.arrangementLayers.triggers, enabledB.arrangementLayers.triggers);
  assert.ok(enabledA.arrangementLayers.triggers < baseInput.bars * 3);
});

test("optional pad layers preserve at least seven semitones above overlapping bass", () => {
  const song = generateNew({
    genre: "ambient",
    seed: "layer-separation",
    bars: 24,
    variation: 0.72,
    energy: 0.64,
    professionalUpgrade: true,
    layeringMode: "high",
    tracks: {
      bass: { octave: 3, density: 0.92, variation: 0.68 },
    },
  });
  const bass = song.tracks.find((track) => track.id === "bass")?.notes ?? [];
  const padLayers = (song.tracks.find((track) => track.id === "pad")?.notes ?? []).filter((note) => note.arrangementLayer);
  assert.ok(padLayers.length > 0, "expected deterministic pad layers for the seeded check");
  for (const note of padLayers) {
    const soundingBass = bass.filter((bassNote) => (
      note.start < bassNote.start + bassNote.duration
      && bassNote.start < note.start + note.duration
    ));
    if (!soundingBass.length) continue;
    const bassCeiling = Math.max(...soundingBass.map((bassNote) => bassNote.pitch));
    assert.ok(note.pitch >= Math.max(48, bassCeiling + 7), `pad layer ${note.arrangementLayer} must clear the bass by 7 semitones`);
  }
});

test("step bias rewards stepwise legato motion and penalizes larger connected leaps", () => {
  const stepwiseBias = legatoIntervalBias(0.82, 1);
  const mediumLeapBias = legatoIntervalBias(0.82, 3);
  const largeLeapBias = legatoIntervalBias(0.82, 5);
  assert.ok(stepwiseBias > mediumLeapBias);
  assert.ok(mediumLeapBias > largeLeapBias);
  assert.ok(largeLeapBias < 0, "large connected leaps should reduce legato probability");
});
