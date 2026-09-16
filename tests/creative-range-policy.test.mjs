import assert from "node:assert/strict";
import test from "node:test";

import { CREATIVE_RANGE_VALUES, normalizeCreativeRange } from "../src/core/creative-range-policy.js";

test("Creative Range accepts only the three explicit deterministic strategy modes", () => {
  assert.deepEqual(CREATIVE_RANGE_VALUES, ["familiar", "fresh", "wild"]);
  assert.equal(normalizeCreativeRange("familiar"), "familiar");
  assert.equal(normalizeCreativeRange(" Fresh "), "fresh");
  assert.equal(normalizeCreativeRange("WILD"), "wild");
});

test("Creative Range remains neutral until a producer explicitly opts in", () => {
  for (const value of [undefined, null, "", "auto", "default", "chaos"]) {
    assert.equal(normalizeCreativeRange(value), null);
  }
});
