import assert from "node:assert/strict";
import test from "node:test";
import { clamp, finite } from "../src/utils.js";

test("clamp returns value unchanged when within bounds", () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(0, 0, 10), 0);
  assert.equal(clamp(10, 0, 10), 10);
});

test("clamp clamps to min when value is below range", () => {
  assert.equal(clamp(-5, 0, 10), 0);
  assert.equal(clamp(-Infinity, 0, 127), 0);
});

test("clamp clamps to max when value is above range", () => {
  assert.equal(clamp(200, 0, 127), 127);
  assert.equal(clamp(Infinity, 0, 100), 100);
});

test("clamp handles fractional values correctly", () => {
  assert.equal(clamp(0.5, 0, 1), 0.5);
  assert.equal(clamp(1.5, 0, 1), 1);
  assert.equal(clamp(-0.1, 0, 1), 0);
});

test("finite returns the numeric value for valid numbers", () => {
  assert.equal(finite(42), 42);
  assert.equal(finite(0), 0);
  assert.equal(finite(-7.5), -7.5);
  assert.equal(finite("120"), 120);
});

test("finite returns fallback for non-finite inputs", () => {
  assert.equal(finite(NaN, 99), 99);
  assert.equal(finite(Infinity, 99), 99);
  assert.equal(finite(-Infinity, 99), 99);
  assert.equal(finite(undefined, 99), 99);
  assert.equal(finite("not-a-number", 99), 99);
});

test("finite uses 0 as default fallback", () => {
  assert.equal(finite(NaN), 0);
  assert.equal(finite(undefined), 0);
});

test("finite coerces null to 0 (Number(null) === 0 is finite)", () => {
  assert.equal(finite(null), 0);
  assert.equal(finite(null, 99), 0);
});
