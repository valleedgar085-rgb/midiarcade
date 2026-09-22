import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  absoluteGroovePulses,
  grooveLaneForTrack,
  nearestGroovePulse,
  trackGroovePulses,
} from "../src/core/groove-contract.js";

const conductor = {
  bars: [
    {
      bar: 0,
      anchors: [0, 2],
      bassPulses: [0.5, 2.5],
      chordPulses: [1, 3],
      leadPulses: [0.75, 2.75],
      counterPulses: [1.5, 3.5],
    },
    {
      bar: 1,
      anchors: [0, 2],
      bassPulses: [0.25, 2.25],
      chordPulses: [1, 3],
      leadPulses: [0.5, 2.5],
      counterPulses: [1.5, 3.5],
    },
  ],
};

test("track groove lanes resolve to one shared conductor vocabulary", () => {
  assert.equal(grooveLaneForTrack("drums"), "anchors");
  assert.equal(grooveLaneForTrack("bass"), "bassPulses");
  assert.equal(grooveLaneForTrack("chords"), "chordPulses");
  assert.equal(grooveLaneForTrack("melody"), "leadPulses");
  assert.equal(grooveLaneForTrack("counterpoint"), "counterPulses");
  assert.equal(grooveLaneForTrack("pad"), "chordPulses");
});

test("absolute groove pulses preserve lane identity across bar boundaries", () => {
  assert.deepEqual(
    absoluteGroovePulses(conductor, "bassPulses", 0, 8, 4),
    [0.5, 2.5, 4.25, 6.25],
  );
  assert.deepEqual(
    trackGroovePulses(conductor, "melody", 4, 8, 4),
    [4.5, 6.5],
  );
});

test("nearest groove pulse respects a bounded magnetization radius", () => {
  assert.deepEqual(
    nearestGroovePulse(conductor, "chordPulses", 0.92, 4, 0.12),
    { beat: 1, snapped: true, lane: "chordPulses", distance: 0.08 },
  );
  assert.deepEqual(
    nearestGroovePulse(conductor, "chordPulses", 0.5, 4, 0.12),
    { beat: 0.5, snapped: false, lane: "chordPulses", distance: 0.5 },
  );
});

test("professional arpeggios remain inside the shared chord groove contract", async () => {
  const source = await readFile(new URL("../src/music-engine.js", import.meta.url), "utf8");
  const branch = source.match(/style\.chordMotion === "arpeggio"[\s\S]*?continue;/)?.[0] ?? "";
  assert.match(branch, /config\.professionalUpgrade[\s\S]*?magnetizeBeatToGroove\([\s\S]*?"chordPulses"/);
  assert.match(branch, /rhythmicFeature: "groove-magnet"/);
});
