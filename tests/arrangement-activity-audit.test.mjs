import assert from "node:assert/strict";
import test from "node:test";
import { evaluateArrangementActivityContrast } from "../scripts/lib/arrangement-activity.mjs";

const section = (id, startBeat) => ({
  id, name: id, startBeat, endBeat: startBeat + 8, bars: 2,
});
const note = (start, velocity = 84, duration = 0.4) => ({
  pitch: 60, start, duration, velocity,
});
function fixture(secondAttackCounts = 2) {
  return {
    meta: { beatsPerBar: 4 },
    structure: [section("verse-1", 0), section("chorus-1", 8)],
    tracks: [
      {
        id: "drums",
        notes: [
          note(0), note(4),
          ...Array.from({ length: secondAttackCounts }, (_, i) =>
            note(8 + (i * 8 / secondAttackCounts), 84)),
        ],
      },
      {
        id: "bass",
        notes: [note(0, 70, 2), note(4, 70, 2),
          note(8, 70, 2), note(12, 70, 2)],
      },
      {
        id: "chords",
        notes: [note(0, 78, 2), note(4, 78, 2),
          note(8, 78, 2), note(12, 78, 2)],
      },
    ],
  };
}

test("identical section instrument rosters and similar activity produce zero contrast", () => {
  const song = fixture();
  const original = structuredClone(song);
  const report = evaluateArrangementActivityContrast(song);
  assert.equal(report.status, "evaluated");
  assert.equal(report.meanActivityContrast, 0);
  assert.equal(report.transitions[0].rosterChange, 0);
  assert.deepEqual(song, original, "measurement must never mutate source notes");
  assert.deepEqual(report, evaluateArrangementActivityContrast(song));
});

test("same instruments but chorus's increased attacks count as musical movement", () => {
  const base = evaluateArrangementActivityContrast(fixture());
  const varied = evaluateArrangementActivityContrast(fixture(8));
  assert.equal(base.transitions[0].rosterChange, 0);
  assert.equal(varied.transitions[0].rosterChange, 0);
  assert.ok(varied.meanActivityContrast > base.meanActivityContrast);
  assert.ok(varied.transitions[0].byTrack.drums > 0);
  assert.equal(varied.transitions[0].byTrack.bass, 0);
});

test("a sustained note across a section boundary remains active without a new attack", () => {
  const song = {
    meta: { beatsPerBar: 4 },
    structure: [section("bridge", 0), section("outro", 8)],
    tracks: [{ id: "pad", notes: [note(6, 72, 4)] }],
  };
  const report = evaluateArrangementActivityContrast(song);
  assert.equal(report.sections[1].lanes.pad.active, true);
  assert.equal(report.sections[1].lanes.pad.attacks, 0);
  assert.ok(report.sections[1].lanes.pad.coverage > 0);
  assert.equal(report.transitions[0].rosterChange, 0);
});

test("empty and single-section songs return unavailable contrast, not failed quality", () => {
  const empty = evaluateArrangementActivityContrast({ structure: [], tracks: [] });
  assert.equal(empty.status, "insufficient-sections");
  assert.equal(empty.meanActivityContrast, null);
  assert.deepEqual(empty.transitions, []);
  const one = evaluateArrangementActivityContrast({
    meta: { beatsPerBar: 4 },
    structure: [section("intro", 0)],
    tracks: [{ id: "melody", notes: [note(2)] }],
  });
  assert.equal(one.status, "insufficient-sections");
  assert.equal(one.meanActivityContrast, null);
});
