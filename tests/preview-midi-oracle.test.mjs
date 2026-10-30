import assert from "node:assert/strict";
import test from "node:test";
import { auditPreviewMidiEvents } from "../scripts/lib/preview-midi-oracle.mjs";

function fixture() {
  const song = { meta: { tempo: 120, ppq: 480, totalBeats: 4 }, tracks: [{ id: "melody", channel: 0, program: 80, settings: {},
    notes: [{ id: "n", start: 0.5, duration: 1, pitch: 60, velocity: 90 }] }] };
  const events = [{ id: "melody", program: 80, pitch: 60, baseVelocity: 90, velocity: 45, time: 0.25, duration: 0.5 }];
  return { song, events };
}

test("preview oracle compares MIDI velocity before intentional CC11 gain", () => {
  const { song, events } = fixture();
  assert.equal(auditPreviewMidiEvents(song, events).passed, true);
});

for (const field of ["pitch", "baseVelocity", "program", "time", "duration"]) {
  test(`preview oracle detects ${field} drift and note multiplicity`, () => {
    const { song, events } = fixture();
    events[0][field] += 1;
    assert.equal(auditPreviewMidiEvents(song, events).passed, false);
    assert.equal(auditPreviewMidiEvents(song, []).passed, false);
    const original = fixture();
    assert.equal(auditPreviewMidiEvents(original.song, [...original.events, ...original.events]).passed, false);
  });
}

test("preview minimum envelope is explicit and does not conceal longer note edits", () => {
  const { song, events } = fixture();
  song.tracks[0].notes[0].duration = 0.02;
  events[0].duration = 0.03;
  const report = auditPreviewMidiEvents(song, events);
  assert.equal(report.passed, true);
  assert.equal(report.minimumEnvelopeNotes, 1);
  events[0].duration = 0.2;
  assert.equal(auditPreviewMidiEvents(song, events).passed, false);
});

test("nonfinite and nonpositive preview durations cannot pass comparison", () => {
  for (const duration of [NaN, Infinity, undefined, 0, -1]) {
    const { song, events } = fixture();
    events[0].duration = duration;
    assert.equal(auditPreviewMidiEvents(song, events).passed, false);
  }
});
