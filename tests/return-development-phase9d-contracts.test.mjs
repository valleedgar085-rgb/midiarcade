import assert from "node:assert/strict";
import test from "node:test";

import { createReturnDevelopmentCandidates } from "../src/core/return-development.js";

function makePhase9DContractSong() {
  return {
    genre: "pop",
    bars: 2,
    meta: {
      beatsPerBar: 4,
      totalBeats: 8,
      keyPc: 0,
      scaleIntervals: [0, 2, 4, 5, 7, 9, 11],
    },
    motifs: {
      melody: { lengthBeats: 4 },
    },
    songBlueprint: {
      qualityTargets: { repetition: 0.62 },
    },
    structure: [
      { id: "chorus-a", name: "chorus", startBeat: 0, endBeat: 4 },
      { id: "chorus-b", name: "chorus", startBeat: 4, endBeat: 8 },
    ],
    memoryMap: [
      { sectionId: "chorus-b", originSectionId: "chorus-a", relationship: "return" },
    ],
    harmony: [
      { start: 0, duration: 8, tones: [0, 4, 7] },
    ],
    orchestrationMatrix: [
      { sectionId: "chorus-b", featuredTrack: "drums", featureOccurrence: 1 },
    ],
    tracks: [
      {
        id: "melody",
        notes: [
          { id: "m0", start: 0, pitch: 60, duration: 0.25, velocity: 90 },
          { id: "m1", start: 1, pitch: 64, duration: 0.25, velocity: 90 },
          { id: "m2", start: 2, pitch: 67, duration: 0.25, velocity: 90 },
          { id: "m3", start: 4, pitch: 60, duration: 0.25, velocity: 90 },
          { id: "m4", start: 5.25, pitch: 64, duration: 0.25, velocity: 90 },
          { id: "m5", start: 6.5, pitch: 61, duration: 0.25, velocity: 119 },
        ],
      },
      {
        id: "drums",
        notes: [
          { id: "d0", start: 4, pitch: 36, duration: 0.25, velocity: 119, motifHandoffRole: "melody-to-drums" },
          { id: "d1", start: 5, pitch: 38, duration: 0.25, velocity: 118 },
        ],
      },
    ],
  };
}

test("Phase 9D contracts prove cadence, recall, and drum spotlight edits without exceeding headroom", () => {
  const song = makePhase9DContractSong();
  const before = structuredClone(song);
  const candidates = createReturnDevelopmentCandidates(song, { returnDevelopment: true });

  assert.deepEqual(song, before, "contract fixture must remain immutable");

  const cadence = candidates.find(({ id }) => id === "cadence-payoff");
  assert.ok(cadence, "cadence-payoff must make an observable edit on the deterministic fixture");
  const cadenceEdits = cadence.song.tracks.find((track) => track.id === "melody")?.notes
    ?.filter((note) => note.returnDevelopmentRole === "cadence-payoff") ?? [];
  assert.equal(cadenceEdits.length, cadence.changedNotes, "cadence changedNotes must correspond to tagged cadence edits");
  assert.ok(cadenceEdits.length >= 1, "cadence subpass must actually edit");
  assert.ok(cadenceEdits.every((note) => note.velocity <= 120), "cadence payoff must preserve the final-master velocity cap");

  const recall = candidates.find(({ id }) => id === "rhythmic-recall");
  assert.ok(recall, "rhythmic-recall must make an observable edit on the deterministic fixture");
  const recallEdits = recall.song.tracks.find((track) => track.id === "melody")?.notes
    ?.filter((note) => note.returnDevelopmentRole === "rhythmic-recall") ?? [];
  assert.equal(recallEdits.length, recall.changedNotes, "recall changedNotes must correspond to tagged recall edits");
  assert.ok(recallEdits.length >= 1, "recall subpass must actually edit");

  const evolution = candidates.find(({ id }) => id === "return-evolution");
  assert.ok(evolution, "return-evolution must remain available for the coordinated spotlight contract");
  const drumSpotlight = evolution.song.tracks.find((track) => track.id === "drums")?.notes
    ?.filter((note) => note.returnDevelopmentSpotlightRole === "feature-drums") ?? [];
  assert.equal(drumSpotlight.length, 2, "native drum spotlight owner must receive the bounded two-note reinforcement");
  assert.ok(drumSpotlight.every((note) => note.velocity <= 120), "spotlight accents must preserve the final-master velocity cap");
  assert.deepEqual(
    song.tracks.find((track) => track.id === "drums")?.notes.map((note) => note.velocity),
    [119, 118],
    "spotlight candidate creation must not mutate source drum velocities",
  );
});
