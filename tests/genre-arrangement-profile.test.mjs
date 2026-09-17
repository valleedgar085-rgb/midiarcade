import assert from "node:assert/strict";
import test from "node:test";

import {
  genreArrangementProfile,
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
