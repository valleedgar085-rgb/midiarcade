import assert from "node:assert/strict";
import test from "node:test";

import {
  attachGenerationRepairAuthority,
  authorizeQualityStage,
  decideGenerationRepairAuthority,
  qualityStageAuthority,
  resolveEnsembleCoherenceRepairHint,
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


test("quality specialist admission follows the diagnosed mutation owner", () => {
  const authority = decideGenerationRepairAuthority("new", {
    shouldRetry: false,
    focusDimension: "registerHealth",
    focusGroup: "motif",
  }, {});
  assert.equal(authority.mutationOwner, "register");
  assert.equal(authorizeQualityStage("registerHealthRefinement", authority).allowed, true);
  assert.equal(authorizeQualityStage("groovePocket", authority).allowed, false);
  assert.equal(authorizeQualityStage("transitionFxRefinement", authority).allowed, true);
});


test("section coherence failures route to one bounded ensemble specialist without granting regeneration", () => {
  const hint = resolveEnsembleCoherenceRepairHint({
    sectionFailures: [
      { sectionId: "verse-2", failures: ["melody-counterline", "density-balance"] },
    ],
  });

  assert.equal(hint.available, true);
  assert.equal(hint.owner, "ensemble");
  assert.equal(hint.specialist, "ensemble-specialist");
  assert.equal(hint.sectionId, "verse-2");
  assert.equal(hint.relationship, "melody-counterline");
  assert.deepEqual(hint.allowedMutations, ["timing", "topology"]);
  assert.equal("allowsFullRegeneration" in hint, false);
});

test("section coherence repair hint fails closed when the final audit has no actionable section failure", () => {
  const hint = resolveEnsembleCoherenceRepairHint({ sectionFailures: [] });
  assert.equal(hint.available, false);
  assert.equal(hint.owner, null);
  assert.deepEqual(hint.allowedMutations, []);
});
