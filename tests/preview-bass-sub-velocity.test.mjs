import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { bassSubVelocityGain } from "../src/core/preview-audio.js";

test("bass sub scales smoothly with velocity and retains low-note warmth", () => {
  assert.ok(bassSubVelocityGain(1) >= 0.7);
  assert.ok(bassSubVelocityGain(30) < bassSubVelocityGain(90));
  assert.ok(bassSubVelocityGain(90) < bassSubVelocityGain(127));
  assert.equal(bassSubVelocityGain(127), 1);
  assert.equal(bassSubVelocityGain(200), 1);
  assert.ok(Number.isFinite(bassSubVelocityGain(NaN)));
  assert.ok(Number.isFinite(bassSubVelocityGain(undefined)));
});

test("sub scaling is confined to preview bass and keeps MIDI untouched", () => {
  const source = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(source, /voice\.subLevel \* \(event\.id === "bass" \? bassSubVelocityGain\(event\.velocity\) : 1\)/);
});
