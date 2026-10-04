import test from "node:test";
import assert from "node:assert/strict";
import {
  loopHeadHorizonSeconds,
  wrappedLoopPosition,
} from "../src/core/preview-loop-timing.js";

test("loop head horizon opens only when lookahead crosses the boundary", () => {
  assert.equal(loopHeadHorizonSeconds({
    timelineNowSeconds: 9.5,
    horizonSeconds: 9.9,
    durationSeconds: 10,
  }), null);

  assert.ok(Math.abs(loopHeadHorizonSeconds({
    timelineNowSeconds: 9.8,
    horizonSeconds: 10.18,
    durationSeconds: 10,
  }) - 0.18) < 1e-9);
});

test("loop head horizon never reaches beyond one cycle", () => {
  assert.equal(loopHeadHorizonSeconds({
    timelineNowSeconds: 9.9,
    horizonSeconds: 25,
    durationSeconds: 10,
  }), 10);
});

test("wrapped loop position preserves boundary overflow", () => {
  assert.ok(Math.abs(wrappedLoopPosition(10.03, 10) - 0.03) < 1e-9);
  assert.ok(Math.abs(wrappedLoopPosition(21.25, 10) - 1.25) < 1e-9);
});
