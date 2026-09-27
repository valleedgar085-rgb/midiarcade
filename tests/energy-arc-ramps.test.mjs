import test from "node:test";
import assert from "node:assert/strict";
import { applyMultiBarEnergyRamps } from "../src/core/density-refinement.js";

test("applyMultiBarEnergyRamps scales note velocities upward across song progress and assigns section payoff role", () => {
  const song = {
    meta: { totalBeats: 16, beatsPerBar: 4 },
    tracks: [
      {
        id: "melody",
        notes: [
          { start: 0, pitch: 60, velocity: 80 },
          { start: 8, pitch: 64, velocity: 80 },
          { start: 15, pitch: 67, velocity: 80 },
        ],
      },
    ],
  };

  const updated = applyMultiBarEnergyRamps(song, { startEnergy: 0.5, endEnergy: 1.0 });
  const notes = updated.tracks[0].notes;

  assert.ok(notes[0].velocity < notes[1].velocity);
  assert.ok(notes[1].velocity < notes[2].velocity);
  assert.equal(notes[2].energyRampRole, "section-payoff-ramp");
});
