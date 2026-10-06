import test from "node:test";
import assert from "node:assert/strict";

import { drumSampleEnvelope } from "../src/core/preview-drums.js";

const hat = Object.freeze({ kind: "hat", duration: 0.05 });
const kick = Object.freeze({ kind: "kick", duration: 0.2, kickDecay: 0.22 });

test("Android-safe drum sample attack is lengthened without exceeding short-note duration", () => {
  const desktop = drumSampleEnvelope(hat, 0.08, { minimumAttackSeconds: 0.002 });
  const android = drumSampleEnvelope(hat, 0.08, { minimumAttackSeconds: 0.0045 });

  assert.ok(android.attack > desktop.attack);
  assert.ok(android.attack >= 0.004);
  assert.ok(android.attack < android.duration);
});

test("sample envelope remains bounded for longer kick tails", () => {
  const envelope = drumSampleEnvelope(kick, 0.5, { minimumAttackSeconds: 0.0045 });
  assert.ok(envelope.attack >= 0.004);
  assert.ok(envelope.releaseStart >= envelope.attack);
  assert.ok(envelope.releaseStart < envelope.duration);
  assert.ok(envelope.duration <= 0.46);
});
