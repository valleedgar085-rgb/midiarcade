import assert from "node:assert/strict";
import test from "node:test";

import {
  attachGenerationRepairAuthority,
  authorizeQualityStage,
  decideGenerationRepairAuthority,
  qualityStageAuthority,
  resolveEnsembleCoherenceRepairHint,
  resolveFinalEnsembleRepairPlan,
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


test("final ensemble repair plan returns at most two bounded subtractive-first directives", () => {
  const report = {
    sectionFailures: [
      { sectionId: "verse-1", failures: ["density-balance", "melody-counterline"] },
    ],
    macroDiagnostics: {
      payoffPairs: [
        { fromSectionId: "pre-1", toSectionId: "chorus-1", healthy: false },
      ],
      transitions: [
        { fromSectionId: "verse-1", toSectionId: "pre-1", hardReset: true, staged: false },
      ],
    },
  };

  const plan = resolveFinalEnsembleRepairPlan(report);
  assert.equal(plan.version, 2);
  assert.equal(plan.available, true);
  assert.equal(plan.owner, "ensemble");
  assert.equal(plan.specialist, "ensemble-specialist");
  assert.equal(plan.allowsFullRegeneration, false);
  assert.equal(plan.policy, "bounded-subtractive-first");
  assert.equal(plan.directives.length, 2);
  assert.equal(plan.directives[0].relationship, "density-balance");
  assert.equal(plan.directives[0].preferredAction, "subtract-support-before-adding-notes");
  assert.ok(plan.directives.every((directive) => directive.allowedMutations.length > 0));
});

test("final ensemble repair plan stays inert when the committed ensemble is coherent", () => {
  const plan = resolveFinalEnsembleRepairPlan({
    sectionFailures: [],
    macroDiagnostics: { payoffPairs: [], transitions: [] },
  });
  assert.equal(plan.available, false);
  assert.equal(plan.allowsFullRegeneration, false);
  assert.equal(plan.allowsSurgicalPostprocess, false);
  assert.deepEqual(plan.directives, []);
});


test("ensemble coherence hint keeps the main bounded-routing contract", () => {
  const hint = resolveEnsembleCoherenceRepairHint({
    sectionFailures: [
      { sectionId: "verse-2", failures: ["melody-counterline", "density-balance"] },
    ],
    macroDiagnostics: { payoffPairs: [], transitions: [] },
  });

  assert.equal(hint.available, true);
  assert.equal(hint.owner, "ensemble");
  assert.equal(hint.specialist, "ensemble-specialist");
  assert.equal(hint.sectionId, "verse-2");
  assert.equal(hint.relationship, "melody-counterline");
  assert.deepEqual(hint.allowedMutations, ["timing", "topology"]);
  assert.equal("allowsFullRegeneration" in hint, false);
});

test("ensemble coherence hint fails closed when no actionable failure remains", () => {
  const hint = resolveEnsembleCoherenceRepairHint({
    sectionFailures: [],
    macroDiagnostics: { payoffPairs: [], transitions: [] },
  });

  assert.equal(hint.available, false);
  assert.equal(hint.owner, null);
  assert.deepEqual(hint.allowedMutations, []);
});
