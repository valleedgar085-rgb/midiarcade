import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  atmosphereEnvelopeTiming,
  pitchedVoiceEnvelopeTiming,
  previewNoteEnvelope,
} from "../src/core/preview-audio.js";

const PITCHED_TRACKS = ["bass", "chords", "melody", "counterpoint"];

test("bass, chords, melody, counterpoint keep filter automation chronological on short notes", () => {
  for (const id of PITCHED_TRACKS) {
    for (const attack of [0.006, 0.012, 0.035, 0.075, 0.22, 0.6]) {
      for (const duration of [0.04, 0.075, 0.125, 0.25, 0.5, 2]) {
        const timing = pitchedVoiceEnvelopeTiming(id, attack, duration);
        assert.ok(timing.attack >= 0.009, `${id}: non-click-safe attack`);
        assert.ok(timing.attack < duration, `${id}: gain attack must finish before note ends`);
        assert.ok(timing.filterPeakSeconds > timing.attack);
        assert.ok(timing.filterRestSeconds > timing.filterPeakSeconds,
          `${id}: filter rest must follow peak, not reverse in Web Audio`);
        // Note release is at least 40 ms by the existing preview contract.
        assert.ok(timing.filterRestSeconds < duration + 0.04,
          `${id}: rest must happen while the voice is still sounding`);
        assert.deepEqual(timing, pitchedVoiceEnvelopeTiming(id, attack, duration));
      }
    }
  }
});

test("long pitched notes preserve expressive attacks and natural filter travel", () => {
  for (const id of PITCHED_TRACKS) {
    const timing = pitchedVoiceEnvelopeTiming(id, 0.18, 2.5);
    assert.equal(timing.attack, 0.18);
    assert.ok(timing.filterPeakSeconds >= 0.20);
    assert.ok(timing.filterRestSeconds > 2.0);
  }
});

test("Atmosphere and drum tracks are excluded from the new pitched correction", () => {
  assert.equal(pitchedVoiceEnvelopeTiming("pad", 0.42, 0.12), null);
  assert.equal(pitchedVoiceEnvelopeTiming("drums", 0.002, 0.08), null);
  assert.equal(pitchedVoiceEnvelopeTiming("unknown", 0.01, 0.5), null);
  const pad = atmosphereEnvelopeTiming(0.42, 0.12);
  assert.deepEqual(pad, {
    attack: 0.054,
    filterPeakSeconds: 0.074,
    filterRestSeconds: 0.099,
  });
});

test("pitched preview anti-click timing doesn't change MIDI note start, duration, pitch or velocity", () => {
  const note = Object.freeze({ start: 6.75, duration: 0.125, pitch: 74, velocity: 92 });
  for (const id of PITCHED_TRACKS) {
    const envelope = previewNoteEnvelope({ trackId: id, duration: note.duration, release: 0.2, reverb: 0.1 });
    const timing = pitchedVoiceEnvelopeTiming(id, 0.2, envelope.duration);
    assert.equal(envelope.duration, note.duration);
    assert.ok(timing.filterRestSeconds < envelope.duration + envelope.release);
    assert.deepEqual(note, { start: 6.75, duration: 0.125, pitch: 74, velocity: 92 });
  }
});

test("actual PreviewPlayer applies pitched fix and retains the verified Atmosphere branch", () => {
  const app = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  assert.match(app, /event\.id === "pad" \? atmosphereEnvelopeTiming\(attack, duration\) : null/);
  assert.match(app, /const pitchedTiming = pitchedVoiceEnvelopeTiming\(event\.id, attack, duration\)/);
  assert.match(app, /atmosphereTiming\?\.attack \?\? pitchedTiming\?\.attack \?\? attack/);
  assert.match(app, /filter\.frequency\.exponentialRampToValueAtTime\(filterPeak, when \+ \(atmosphereTiming\?\.filterPeakSeconds \?\? pitchedTiming\?\.filterPeakSeconds/);
  assert.match(app, /filter\.frequency\.exponentialRampToValueAtTime\(filterRest, when \+ \(atmosphereTiming\?\.filterRestSeconds \?\? pitchedTiming\?\.filterRestSeconds/);
});
