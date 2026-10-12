import test from "node:test";
import assert from "node:assert/strict";
import { studioSoundHarmonics } from "../src/core/studio-sound.js";

test("studio sound is disabled by default and never changes drums", () => {
  assert.equal(studioSoundHarmonics("bass"), null);
  assert.equal(studioSoundHarmonics("drums", { enabled: true }), null);
  assert.equal(studioSoundHarmonics("pad", { enabled: true }), null);
});

test("pitched studio harmonics are deterministic and finite", () => {
  for (const id of ["bass", "chords", "melody", "counterpoint"]) {
    const a = studioSoundHarmonics(id, { enabled: true });
    const b = studioSoundHarmonics(id, { enabled: true });
    assert.deepEqual([...a], [...b]);
    assert.equal(a[0], 0);
    assert.ok([...a].every(Number.isFinite));
    assert.ok(a[1] > a[2]);
  }
});

test("brightness is clamped and invalid values fall back safely", () => {
  assert.deepEqual(
    [...studioSoundHarmonics("bass", { enabled: true, brightness: -5 })],
    [...studioSoundHarmonics("bass", { enabled: true, brightness: 0 })],
  );
  assert.ok(studioSoundHarmonics("bass", { enabled: true, brightness: NaN })[1] > 0);
});
