import assert from "node:assert/strict";
import test from "node:test";

import { resolveAutoScale } from "../src/core/scale-intent.js";
import { normalizeConfig } from "../src/music-engine.js";

test("Auto scale is deterministic and responds to musical intent", () => {
  const bright = resolveAutoScale({
    candidates: ["major", "minor"], seed: "scale-intent-bright", genre: "pop", chordPath: "pop",
    energy: 0.86, complexity: 0.18, surprise: 0.08, mood: "intense",
  });
  const dark = resolveAutoScale({
    candidates: ["major", "minor"], seed: "scale-intent-dark", genre: "hipHop", chordPath: "soul",
    energy: 0.28, complexity: 0.72, surprise: 0.62, mood: "calm",
  });
  assert.equal(bright, "major");
  assert.equal(dark, "minor");
  assert.equal(resolveAutoScale({
    candidates: ["major", "minor"], seed: "scale-intent-bright", genre: "pop", chordPath: "pop",
    energy: 0.86, complexity: 0.18, surprise: 0.08, mood: "intense",
  }), bright);
});

test("Explicit scale remains authoritative while Auto uses the intent resolver", () => {
  const explicit = normalizeConfig({ seed: "scale-intent-explicit", genre: "hipHop", mode: "dorian", scaleSelection: "explicit" });
  const automatic = normalizeConfig({
    seed: "scale-intent-explicit", genre: "hipHop", mode: "auto", scaleSelection: "auto",
    energy: 0.72, complexity: 0.64, surprise: 0.4,
  });
  assert.equal(explicit.scale, "dorian");
  assert.equal(explicit.scaleSelection, "explicit");
  assert.equal(automatic.scaleSelection, "auto");
  assert.ok(automatic.scaleIntervals.length > 0);
});
