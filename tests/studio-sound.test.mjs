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

test("higher velocities add bounded brightness without changing note events", () => {
  for (const id of ["bass", "chords"]) {
    const soft = studioSoundHarmonics(id, { enabled: true, velocity: 30 });
    const loud = studioSoundHarmonics(id, { enabled: true, velocity: 120 });
    assert.ok(loud[3] > soft[3]);
    assert.equal(loud[1], soft[1]);
  }
});

test("bass upper-register harmonics are gently reduced", () => {
  const low = studioSoundHarmonics("bass", { enabled: true, pitch: 36 });
  const high = studioSoundHarmonics("bass", { enabled: true, pitch: 72 });
  assert.ok(low[4] > high[4]);
});

test("invalid velocity and pitch use deterministic safe defaults", () => {
  const invalid = studioSoundHarmonics("chords", { enabled: true, velocity: NaN, pitch: NaN });
  const normal = studioSoundHarmonics("chords", { enabled: true, velocity: 90, pitch: 60 });
  assert.deepEqual([...invalid], [...normal]);
});
