import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_REFERENCE_STRENGTH,
  normalizeReferenceProfile,
  referenceStageEnergyNudge,
  resolveReferenceInfluence,
} from "../src/core/reference-profile-engine.js";
import {
  generateNew,
  normalizeConfig,
} from "../src/music-engine.js";

const HIP_HOP_REFERENCE = Object.freeze({
  version: 1,
  id: "test-hiphop-reference",
  genre: "hipHop",
  sourceCount: 8,
  confidence: 0.94,
  traits: {
    syncopation: 0.72,
    swing: 0.3,
    humanize: 0.32,
    phraseBars: 4,
    density: 0.54,
    bassActivity: 0.78,
    bassLock: 0.84,
    melodySpace: 0.78,
    supportRestraint: 0.72,
    introRestraint: 0.9,
    payoffLift: 0.86,
    transitionBreath: 0.74,
  },
  stylePreferences: {
    drumGroove: { backbeat: 0.9, halfTime: 0.45 },
    bassGroove: { syncopated: 0.88, rootFifth: 0.5 },
    chordMotion: { sustained: 0.82, offbeat: 0.42 },
  },
});

test("reference profiles normalize to bounded metadata-only musical traits", () => {
  const profile = normalizeReferenceProfile({
    ...HIP_HOP_REFERENCE,
    traits: {
      ...HIP_HOP_REFERENCE.traits,
      syncopation: 4,
      payoffLift: -2,
    },
    stylePreferences: {
      ...HIP_HOP_REFERENCE.stylePreferences,
      bassGroove: { syncopated: 0.8, inventedMode: 1 },
    },
  }, { genre: "hipHop" });

  assert.equal(profile.version, 1);
  assert.equal(profile.genre, "hipHop");
  assert.equal(profile.traits.syncopation, 1);
  assert.equal(profile.traits.payoffLift, 0);
  assert.equal(profile.stylePreferences.bassGroove.syncopated, 0.8);
  assert.equal(profile.stylePreferences.bassGroove.inventedMode, undefined);
  assert.equal("audio" in profile, false);
});

test("reference influence is soft-bounded and disabled for a different genre", () => {
  const influence = resolveReferenceInfluence({
    referenceProfile: HIP_HOP_REFERENCE,
    referenceStrength: 1,
  }, {
    genre: "hipHop",
    defaults: { syncopation: 0.54, swing: 0.22, humanize: 0.32, phraseBars: 4 },
  });
  assert.equal(influence.active, true);
  assert.equal(influence.strength, MAX_REFERENCE_STRENGTH);
  assert.ok(influence.controls.syncopation > 0.54);
  assert.ok(influence.controls.syncopation < HIP_HOP_REFERENCE.traits.syncopation);
  assert.ok(referenceStageEnergyNudge(influence, "payoff") > 0);
  assert.ok(referenceStageEnergyNudge(influence, "establish") < 0);

  const mismatch = resolveReferenceInfluence({
    referenceProfile: HIP_HOP_REFERENCE,
  }, {
    genre: "house",
    defaults: { syncopation: 0.48, swing: 0.08, humanize: 0.12, phraseBars: 4 },
  });
  assert.equal(mismatch.active, false);
  assert.equal(mismatch.reason, "genre-mismatch");
});

test("explicit user controls remain authoritative over reference defaults", () => {
  const config = normalizeConfig({
    seed: "reference-explicit-control",
    genre: "hipHop",
    key: "F#",
    scale: "minor",
    groove: "laidback",
    syncopation: 0.19,
    swing: 0.11,
    humanize: 0.17,
    phraseBars: 6,
    referenceProfile: HIP_HOP_REFERENCE,
    referenceStrength: 0.35,
  });

  assert.equal(config.key, "F#");
  assert.equal(config.scale, "minor");
  assert.equal(config.groove, "laidback");
  assert.equal(config.syncopation, 0.19);
  assert.equal(config.swing, 0.11);
  assert.equal(config.humanize, 0.17);
  assert.equal(config.phraseBars, 6);
  assert.equal(config.referenceInfluence.active, true);
  assert.equal(config.referenceInfluence.explicit.syncopation, true);
  assert.ok(config.referenceInfluence.protectedAuthorities.includes("groove-pocket"));
});

test("reference profile nudges genre defaults when controls remain on Auto/default", () => {
  const baseline = normalizeConfig({
    seed: "reference-default-nudge",
    genre: "hipHop",
    professionalUpgrade: true,
  });
  const referenced = normalizeConfig({
    seed: "reference-default-nudge",
    genre: "hipHop",
    professionalUpgrade: true,
    referenceProfile: HIP_HOP_REFERENCE,
    referenceStrength: 0.35,
  });

  assert.equal(referenced.referenceInfluence.active, true);
  assert.ok(referenced.syncopation > baseline.syncopation);
  assert.ok(referenced.swing > baseline.swing);
  assert.equal(referenced.key, baseline.key);
  assert.equal(referenced.scale, baseline.scale);
  assert.equal(referenced.groove, baseline.groove);
});

test("generated songs expose reference provenance and remain deterministic", () => {
  const input = {
    seed: "reference-live-generation",
    genre: "hipHop",
    bars: 16,
    professionalUpgrade: true,
    candidateCount: 1,
    referenceProfile: HIP_HOP_REFERENCE,
    referenceStrength: 0.3,
  };
  const first = generateNew(input);
  const second = generateNew(input);

  assert.deepEqual(first, second);
  assert.equal(first.referenceProfile?.authority, "reference-profile-engine-v1");
  assert.equal(first.referenceProfile?.id, HIP_HOP_REFERENCE.id);
  assert.equal(first.referenceProfile?.genre, "hipHop");
  assert.equal(first.referenceProfile?.sourceCount, 8);
  assert.ok(first.referenceProfile?.confidenceWeight > 0);
  assert.ok(first.referenceProfile?.protectedAuthorities.includes("structure-director"));
  assert.ok(first.songBlueprint?.structureDirector);
});
