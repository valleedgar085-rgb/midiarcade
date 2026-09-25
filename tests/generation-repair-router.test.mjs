import assert from "node:assert/strict";
import test from "node:test";

import {
  attachGenerationRepairAuthority,
  decideGenerationRepairAuthority,
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
