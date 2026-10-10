import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";

import { atmosphereEnvelopeTiming, pitchedVoiceEnvelopeTiming } from "../src/core/preview-audio.js";

test("Chords and Melody keep small mobile preview clicks below their onset envelope", () => {
  for (const trackId of ["chords", "melody"]) {
    const minimum = trackId === "chords" ? 0.02 : 0.016;
    for (const duration of [0.04, 0.075, 0.125, 0.25, 0.5, 1, 2]) {
      for (const programmedAttack of [0.002, 0.006, 0.012, 0.04, 0.35]) {
        const timing = pitchedVoiceEnvelopeTiming(trackId, programmedAttack, duration);
        assert.ok(timing.attack >= minimum - 1e-9);
        assert.ok(timing.attack < duration);
        assert.ok(timing.filterPeakSeconds > timing.attack);
        assert.ok(timing.filterRestSeconds >= timing.filterPeakSeconds + 0.024 - 1e-9);
        assert.ok(timing.filterRestSeconds < duration + 0.04);
        assert.deepEqual(timing, pitchedVoiceEnvelopeTiming(trackId, programmedAttack, duration));
      }
    }
  }
});

test("the previous clean Bass and Counterpoint envelopes remain identical", () => {
  for (const [trackId, floor] of [["bass", 0.009], ["counterpoint", 0.01]]) {
    for (const duration of [0.04, 0.08, 0.2, 0.75, 2]) {
      for (const requestedAttack of [0.006, 0.012, 0.075, 0.4]) {
        const attack = Math.min(Math.max(floor, requestedAttack), Math.max(floor, duration * 0.42));
        const filterPeakSeconds = Math.max(0.024, attack + 0.022);
        const filterRestSeconds = Math.max(filterPeakSeconds + 0.014, duration * 0.82);
        assert.deepEqual(pitchedVoiceEnvelopeTiming(trackId, requestedAttack, duration), {
          attack,
          filterPeakSeconds,
          filterRestSeconds,
        });
      }
    }
  }
});

test("Atmosphere and percussion stay on their already-clean synthesis contracts", () => {
  const pad = atmosphereEnvelopeTiming(0.42, 0.12);
  assert.deepEqual(pad, { attack: 0.054, filterPeakSeconds: 0.074, filterRestSeconds: 0.099 });
  assert.equal(pitchedVoiceEnvelopeTiming("pad", 0.42, 0.12), null);
  assert.equal(pitchedVoiceEnvelopeTiming("drums", 0.002, 0.04), null);
});

test("foreground anti-click adjustment changes no song MIDI pitch, beat, or velocity", () => {
  const original = Object.freeze({ start: 3.25, duration: 0.125, pitch: 72, velocity: 93 });
  const before = JSON.stringify(original);
  const timings = ["chords", "melody"].map(id=>pitchedVoiceEnvelopeTiming(id, 0.006, original.duration));
  assert.ok(timings.every(timing=>timing.attack > 0));
  assert.equal(JSON.stringify(original), before);
});

test("production player continues routing only pitched tracks through the existing helper", () => {
  const source = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(source, /pitchedVoiceEnvelopeTiming\(event\.id, attack, duration\)/);
  assert.match(source, /event\.id === "pad" \? atmosphereEnvelopeTiming\(attack, duration\) : null/);
  assert.match(source, /if \(event\.id === "drums"\) \{\s*this\.scheduleDrum\(event, when\)/);
});
