import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

import {
  PREVIEW_TRANSITION,
  clickSafePreviewStartTime,
} from "../src/core/preview-audio.js";
import {
  drumSampleEnvelope,
  scheduleDrumSampleVoice,
} from "../src/core/preview-drums.js";

test("near-due Android preview notes receive scheduling headroom without changing future groove timing", () => {
  const now = 12.5;
  const lead = PREVIEW_TRANSITION.minimumScheduleLeadSeconds;
  assert.ok(lead >= 0.02 && lead <= 0.04);
  assert.equal(clickSafePreviewStartTime(now, now), now + lead);
  assert.equal(clickSafePreviewStartTime(now, now - 0.07), now + lead);
  assert.equal(clickSafePreviewStartTime(now, now + 0.001), now + lead);
  assert.equal(clickSafePreviewStartTime(now, now + 0.25), now + 0.25);
  assert.equal(clickSafePreviewStartTime(now, now + 0.25), clickSafePreviewStartTime(now, now + 0.25));
});

test("same-beat drum and synth hits share exact scheduled onset inside a batch", () => {
  const capturedNow = 30.125;
  const songOffset = 4.5;
  const eventTimes = [songOffset, songOffset, songOffset, songOffset + 0.125];
  const times = eventTimes.map((eventTime) => (
    clickSafePreviewStartTime(capturedNow, capturedNow + Math.max(0, eventTime - songOffset))
  ));
  assert.equal(times[0], times[1]);
  assert.equal(times[1], times[2]);
  assert.ok(times[3] > times[2], "next subdivision must keep its intended groove placement");
});

test("bundled drum samples use short anti-click attack and audible release window", () => {
  for (const character of [
    { kind: "kick", kickDecay: 0.34 },
    { kind: "snare", duration: 0.18 },
    { kind: "hat", duration: 0.055 },
    { kind: "open-hat", duration: 0.27 },
  ]) {
    const env = drumSampleEnvelope(character, 0.8);
    assert.ok(env.attack >= 0.003, `${character.kind} attack is too abrupt`);
    assert.ok(env.attack < env.releaseStart, `${character.kind} release overlaps attack`);
    assert.ok(env.duration - env.releaseStart >= 0.008, `${character.kind} should fade to silence before source end`);
    assert.ok(env.duration <= 0.46);
  }
});

test("sample Web Audio calls start from silence and fade to floor before source stop", () => {
  const actions = [];
  const gainParam = {
    setValueAtTime(value, at) { actions.push(["set", value, at]); },
    exponentialRampToValueAtTime(value, at) { actions.push(["ramp", value, at]); },
  };
  const source = {
    buffer: null,
    connect(next) { return next; },
    start(when) { actions.push(["start", when]); },
    stop(when) { actions.push(["stop", when]); },
  };
  const gainNode = {
    gain: gainParam,
    connect(next) { return next; },
  };
  const context = {
    createBufferSource() { return source; },
    createGain() { return gainNode; },
  };
  const sample = { duration: 0.28 };
  const when = 13.4;
  const actual = scheduleDrumSampleVoice(
    context, sample, { kind: "snare", duration: 0.17, amplitude: 1 },
    0.65, when, {}, new Set(),
  );
  assert.strictEqual(actual, source);
  assert.strictEqual(source.buffer, sample);
  assert.equal(actions[0][0], "set");
  assert.equal(actions[0][1], 0.0001);
  assert.equal(actions[1][0], "ramp");
  assert.ok(actions[1][2] - when >= 0.003);
  assert.deepEqual(actions.map(([verb]) => verb), ["set", "ramp", "set", "ramp", "start", "stop"]);
  assert.equal(actions[3][1], 0.0001);
  assert.ok(actions[3][2] < actions[5][1], "silence must be reached before source stop");
});

test("real PreviewPlayer captures one clock and does not schedule imminent notes directly in the past", () => {
  const code = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(code, /const scheduleNow = this\.context\.currentTime/);
  assert.match(code, /clickSafePreviewStartTime\(scheduleNow, desiredWhen\)/);
  assert.doesNotMatch(code, /const when = this\.context\.currentTime \+ Math\.max\(0, event\.time - currentSongTime\)/);
});
