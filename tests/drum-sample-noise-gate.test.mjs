import test from "node:test";
import assert from "node:assert/strict";

import { drumSampleEnvelope } from "../src/core/preview-drums.js";

test("real Hip-Hop drum samples gate noisy tails by drum role", () => {
  const closedHat = drumSampleEnvelope({ kind: "hat", duration: 0.05 }, 1.2);
  const openHat = drumSampleEnvelope({ kind: "open-hat", duration: 0.28 }, 1.2);
  const snare = drumSampleEnvelope({ kind: "snare", duration: 0.18 }, 1.2);
  const kick = drumSampleEnvelope({ kind: "kick", kickDecay: 0.29 }, 1.2);

  assert.ok(closedHat.duration <= 0.065);
  assert.ok(openHat.duration <= 0.3);
  assert.ok(snare.duration <= 0.24);
  assert.ok(kick.duration <= 0.46);
  assert.ok(closedHat.releaseStart < closedHat.duration);
  assert.ok(snare.releaseStart < snare.duration);
  assert.ok(kick.releaseStart > closedHat.releaseStart);
});

test("sample gate never extends a short clean source", () => {
  const sourceDuration = 0.042;
  const envelope = drumSampleEnvelope({ kind: "hat", duration: 0.05 }, sourceDuration);
  assert.equal(envelope.duration, sourceDuration);
});
