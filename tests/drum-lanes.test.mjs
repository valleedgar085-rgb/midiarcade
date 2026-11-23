import assert from "node:assert/strict";
import test from "node:test";
import { drumLaneOverview, renderDrumLaneOverview } from "../src/ui/drum-lanes.js";

test("drum lanes show actual first-bar notes and retain stacked hits and velocity", () => {
  const notes = [
    { pitch: 36, start: 8, velocity: 96 },
    { pitch: 38, start: 9.016, velocity: 105 },
    { pitch: 42, start: 8.25, velocity: 1 },
    { pitch: 46, start: 8.375, velocity: 73 },
    { pitch: 39, start: 10, velocity: 82 },
    { pitch: 51, start: 11.75, velocity: 66 },
    { pitch: 36, start: 12, velocity: 100 },
  ];
  const before = structuredClone(notes);
  const view = drumLaneOverview(notes, { start: 8, beatsPerBar: 4 });
  assert.equal(view.steps, 16);
  assert.equal(view.lanes.find(x => x.id === "kick").hits, 1);
  assert.equal(view.lanes.find(x => x.id === "snare").cells[4].hits, 1);
  const hats = view.lanes.find(x => x.id === "hats");
  assert.equal(hats.hits, 2);
  assert.equal(hats.cells[1].velocity, 1, "velocity 1 is quiet MIDI, never full scale");
  assert.equal(hats.cells[2].velocity, 73);
  assert.deepEqual(notes, before, "the overview is a reader, not a generator or quantizer");
});

test("timing offsets at a bar boundary remain in their own displayed bar", () => {
  const notes = [{ pitch: 36, start: 7.99, velocity: 90 }, { pitch: 42, start: 8, velocity: 80 }, { pitch: 42, start: 11.99, velocity: 70 }];
  const view = drumLaneOverview(notes, { start: 8, beatsPerBar: 4 });
  assert.equal(view.lanes.find(x => x.id === "kick").hits, 0);
  assert.equal(view.lanes.find(x => x.id === "hats").hits, 2);
  assert.equal(view.lanes.find(x => x.id === "hats").cells[15].hits, 1);
});

test("short meters, invalid notes, and empty patterns have honest accessible output", () => {
  const notes = [{ pitch: NaN, start: 0, velocity: 80 }, { pitch: 36, start: NaN, velocity: 80 }, { pitch: 38, start: 1, velocity: 0 }];
  const view = drumLaneOverview(notes, { start: 0, beatsPerBar: 3 });
  assert.equal(view.steps, 12);
  assert.equal(view.lanes.reduce((sum, x) => sum + x.hits, 0), 0);
  const html = renderDrumLaneOverview(view, { bar: 1 });
  assert.match(html, /Bar 1/);
  assert.match(html, /Read-only/);
  assert.match(html, /Kick: 0 hits/);
  assert.doesNotMatch(html, /<button|<canvas|Math\.random/);
});
