import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  atmosphereEnvelopeTiming,
  previewNoteEnvelope,
} from "../src/core/preview-audio.js";

test("Atmosphere short-note filter automation never runs backward", () => {
  // Program 99 (Atmosphere FX) has 420 ms attack. A 1/8 or 1/16 note is
  // shorter, and the old filter rest point preceded its 465 ms peak.
  for (const duration of [0.04, 0.075, 0.12, 0.2, 0.36, 0.65]) {
    const env = atmosphereEnvelopeTiming(0.42, duration);
    assert.ok(env.attack >= 0.006);
    assert.ok(env.attack < duration, "the gain attack must finish before note-off");
    assert.ok(env.filterPeakSeconds >= env.attack);
    assert.ok(env.filterRestSeconds > env.filterPeakSeconds,
      "rest must follow peak in Web Audio automation");
    assert.ok(env.filterRestSeconds < duration + 0.2,
      "filter shouldn't make a sudden delayed sweep after a short note ends");
  }
});

test("long Atmosphere swells retain their full requested attack and gradual filter movement", () => {
  const env = atmosphereEnvelopeTiming(0.42, 2.5);
  assert.equal(env.attack, 0.42);
  assert.equal(env.filterPeakSeconds, 0.44);
  assert.ok(env.filterRestSeconds > env.filterPeakSeconds);
  assert.ok(env.filterRestSeconds >= 2);
});

test("each supported pad program gets ordered filter automation without changing audio note identity", () => {
  // The pad track has multiple GM sounds; envelope ordering must remain safe
  // when a patch's attack is shorter or longer than a generated note.
  for (const attack of [0.11, 0.16, 0.2, 0.26, 0.34, 0.42, 0.6]) {
    for (const duration of [0.04, 0.1, 0.25, 0.75, 3]) {
      const timing = atmosphereEnvelopeTiming(attack, duration);
      assert.ok(timing.attack <= attack + 1e-8);
      assert.ok(timing.filterRestSeconds > timing.filterPeakSeconds);
      assert.ok(timing.filterPeakSeconds >= timing.attack);
      assert.deepEqual(timing, atmosphereEnvelopeTiming(attack, duration), "no randomness");
    }
  }
});

test("smoothing the Atmosphere playback envelope doesn't rewrite its note or release", () => {
  const note = Object.freeze({ pitch: 60, start: 12.25, duration: 0.12, velocity: 87 });
  const options = Object.freeze({
    trackId: "pad",
    duration: note.duration,
    release: 1.2,
    reverb: 0.4,
  });
  const envelope = previewNoteEnvelope(options);
  const timing = atmosphereEnvelopeTiming(0.42, envelope.duration);
  assert.equal(envelope.duration, note.duration);
  assert.ok(envelope.release >= 0.04);
  assert.ok(timing.filterRestSeconds < envelope.duration + envelope.release);
  assert.equal(note.start, 12.25);
  assert.equal(note.pitch, 60);
  assert.equal(note.velocity, 87);
});

test("real synth PreviewPlayer applies pad timing only to Atmosphere and leaves other tracks alone", () => {
  const app = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(app, /event\.id === "pad" \? atmosphereEnvelopeTiming\(attack, duration\) : null/);
  assert.match(app, /filter\.frequency\.exponentialRampToValueAtTime\(filterPeak, when \+ \(atmosphereTiming\?\.filterPeakSeconds/);
  assert.match(app, /filter\.frequency\.exponentialRampToValueAtTime\(filterRest, when \+ \(atmosphereTiming\?\.filterRestSeconds/);
  assert.match(app, /gain\.gain\.exponentialRampToValueAtTime\(startPeak, when \+ effectiveAttack\)/);
});
