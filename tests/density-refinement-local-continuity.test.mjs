import assert from "node:assert/strict";
import test from "node:test";

import { createDensityRefinementCandidates } from "../src/core/density-refinement.js";

function sourceSong() {
  return {
    id: "local-density-priority",
    meta: { bars: 4, beatsPerBar: 4, totalBeats: 16 },
    structure: [
      { id: "verse-1", name: "verse", startBeat: 0, endBeat: 8, bars: 2 },
      { id: "chorus-1", name: "chorus", startBeat: 8, endBeat: 16, bars: 2 },
    ],
    tracks: [
      { id: "drums", notes: [] },
      {
        id: "bass",
        notes: [0, 1, 2, 3, 4, 5, 6, 7].map((start, index) => ({
          id: `b${index}`, start, pitch: 36, duration: 0.5, velocity: 88,
        })),
      },
      {
        id: "chords",
        notes: [
          { id: "dense-a", start: 0, pitch: 60, duration: 4, velocity: 78 },
          { id: "dense-b", start: 4, pitch: 64, duration: 4, velocity: 78 },
          { id: "thin-a", start: 8, pitch: 62, duration: 4, velocity: 78 },
        ],
      },
      { id: "counterpoint", notes: [] },
      { id: "pad", notes: [] },
      { id: "melody", notes: [{ id: "lead-a", start: 1, pitch: 72, duration: 0.5, velocity: 90 }] },
    ],
  };
}

test("density repair spends its first articulation on the locally thinnest section", () => {
  const candidates = createDensityRefinementCandidates(sourceSong(), { densityTarget: 12 });
  assert.ok(candidates.length > 0);

  const light = candidates[0];
  const chordIds = light.song.tracks
    .find((track) => track.id === "chords")
    .notes
    .map((note) => note.id);

  assert.ok(chordIds.some((id) => id.startsWith("thin-a:density-")));
  assert.ok(chordIds.includes("dense-a"));
  assert.ok(chordIds.includes("dense-b"));
  assert.ok(light.weakestSectionNotesPerBarAfter > light.weakestSectionNotesPerBarBefore);
});
