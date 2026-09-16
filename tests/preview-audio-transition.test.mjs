import assert from "node:assert/strict";
import test from "node:test";

import {
  holdAudioParamValue,
  rampAudioParamValue,
} from "../src/core/preview-audio.js";

function parameter({ value = 0.42, nativeHold = true } = {}) {
  const calls = [];
  const param = {
    value,
    cancelScheduledValues(time) { calls.push(["cancel", time]); },
    setValueAtTime(next, time) { calls.push(["set", next, time]); this.value = next; },
    exponentialRampToValueAtTime(next, time) { calls.push(["exp", next, time]); },
    linearRampToValueAtTime(next, time) { calls.push(["linear", next, time]); },
    setTargetAtTime(next, time, constant) { calls.push(["target", next, time, constant]); },
  };
  if (nativeHold) param.cancelAndHoldAtTime = (time) => calls.push(["hold", time]);
  return { param, calls };
}

test("click-safe master ramps hold the rendered value before scheduling a transition", () => {
  const { param, calls } = parameter({ value: 0.42, nativeHold: true });
  const result = rampAudioParamValue(param, 0.0001, 10, 0.04);

  assert.deepEqual(calls, [
    ["hold", 10],
    ["exp", 0.0001, 10.04],
  ]);
  assert.deepEqual(result, {
    startValue: 0.42,
    targetValue: 0.0001,
    endTime: 10.04,
  });
});

test("older Web Audio implementations fall back to cancel plus current-value re-anchor", () => {
  const { param, calls } = parameter({ value: 0.31, nativeHold: false });
  const held = holdAudioParamValue(param, 4.5);

  assert.equal(held, 0.31);
  assert.deepEqual(calls, [
    ["cancel", 4.5],
    ["set", 0.31, 4.5],
  ]);
});

test("resume ramps never hard-reset an already-audible master to silence", () => {
  const { param, calls } = parameter({ value: 0.27, nativeHold: true });
  rampAudioParamValue(param, 0.42, 7, 0.04);

  assert.deepEqual(calls, [
    ["hold", 7],
    ["exp", 0.42, 7.04],
  ]);
  assert.equal(calls.some((call) => call[0] === "set" && call[1] === 0.0001), false);
});
