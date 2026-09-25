import assert from "node:assert/strict";
import test from "node:test";

import {
  attachGenerationRepairAuthority,
  decideGenerationRepairAuthority,
  qualityStageAuthority,
  resolveWeaknessAuthority,
} from "../src/core/generation-repair-router.js";

test("repair router gives a critic-focused reroute exclusive full-regeneration authority", () => {
  const authority = decideGenerationRepairAuthority("new", {
    shouldRetry: true,
    reason: "critic-focus-retry",
    focusRoute: "groove-first",
    focusDimension: "groove",
    focusGroup: "groove",
  }, {});

  assert.equal(authority.mode, "composition-reroute");
  assert.equal(authority.focusRoute, "groove-first");
  assert.equal(authority.allowsFullRegeneration, true);
  assert.equal(authority.allowsSurgicalPostprocess, true);
});

test("repair router fails closed to surgical postprocess when a full reroute is not authorized", () => {
  const authority = decideGenerationRepairAuthority("similar", {
    shouldRetry: true,
    focusRoute: "groove-first",
  }, { compositionRoute: "hook-first" });
  assert.equal(authority.mode, "surgical-postprocess");
  assert.equal(authority.allowsFullRegeneration, false);

  const config = { seed: "router-proof" };
  const attached = attachGenerationRepairAuthority(config, authority);
  assert.equal(config.generationRepairAuthority, undefined);
  assert.equal(attached.generationRepairAuthority.mode, "surgical-postprocess");
});


test("shared repair router maps critic weaknesses to one specialist owner", () => {
  const cases = [
    ["groove", "groove-specialist", "groove"],
    ["registerHealth", "register-specialist", "register"],
    ["harmonic", "harmony-specialist", "harmony"],
    ["phraseResolution", "phrase-specialist", "phrase"],
    ["separation", "ensemble-specialist", "ensemble"],
  ];
  for (const [dimension, specialist, owner] of cases) {
    const authority = resolveWeaknessAuthority({ weakestDimension: dimension });
    assert.equal(authority.specialist, specialist);
    assert.equal(authority.owner, owner);
  }
});

test("quality stages declare their mutation owners through the same router", () => {
  assert.deepEqual(qualityStageAuthority("registerHealthRefinement").owners, ["register"]);
  assert.deepEqual(qualityStageAuthority("groovePocket").owners, ["groove"]);
  assert.deepEqual(qualityStageAuthority("phraseResolutionRefinement").owners, ["phrase", "harmony"]);
  assert.equal(qualityStageAuthority("transitionFxRefinement").automationOnly, true);
});
