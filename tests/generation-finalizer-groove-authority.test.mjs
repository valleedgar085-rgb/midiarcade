import assert from "node:assert/strict";
import test from "node:test";

import { finalizeGeneratedSong } from "../src/core/generation-finalizer.js";

function songFixture() {
  return {
    id: "groove-authority-finalizer",
    seed: "groove-authority-finalizer",
    meta: { beatsPerBar: 4, bars: 2, totalBeats: 8 },
    grooveConductor: {
      version: 5,
      grooveDNA: { id: "groove-dna-v1", grammarId: "hip-hop-pocket" },
      bars: [
        { bar: 0, anchors: [0, 2.75], snarePulses: [1, 3], hatPulses: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], spaces: [1.25] },
        { bar: 1, anchors: [0, 1.5, 3.25], snarePulses: [1, 3], hatPulses: [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5], spaces: [2.25] },
      ],
    },
    tracks: [
      {
        id: "drums",
        notes: [
          { pitch: 36, start: 0, duration: 0.08, velocity: 100, grooveSource: "hip-hop-pocket.kick" },
          { pitch: 38, start: 1, duration: 0.08, velocity: 94, grooveSource: "hip-hop-pocket.snare" },
          { pitch: 42, start: 1.5, duration: 0.05, velocity: 74, grooveSource: "hip-hop-pocket.hat" },
          { pitch: 36, start: 6.75, duration: 0.08, velocity: 96, grooveSource: "hip-hop-pocket.kick" },
        ],
      },
      {
        id: "bass",
        notes: [
          { pitch: 36, start: 0.5, duration: 0.5, velocity: 88, grooveSource: "hip-hop-pocket.bass" },
          { pitch: 39, start: 3.25, duration: 0.5, velocity: 84, grooveSource: "hip-hop-pocket.bass" },
        ],
      },
    ],
  };
}

function rhythmSignature(song) {
  return song.tracks.map((track) => ({
    id: track.id,
    notes: track.notes.map(({ pitch, start, duration, velocity, grooveSource }) => ({
      pitch, start, duration, velocity, grooveSource,
    })),
  }));
}

test("generation finalizer never rewrites Groove DNA rhythm", () => {
  const source = songFixture();
  const before = rhythmSignature(source);
  const result = finalizeGeneratedSong(source, { kind: "new" });

  assert.deepEqual(rhythmSignature(result.song), before);
  assert.strictEqual(result.song, source);
  assert.equal(result.diagnostics.rhythmAuthority, "groove-dna");
  assert.equal(result.diagnostics.rhythmChanged, false);
  assert.equal("snareBounce" in result.diagnostics, false);
  assert.equal("sectionDrumEvolution" in result.diagnostics, false);
});


test("Similar finalization may continue production lineage but cannot rewrite generated rhythm", () => {
  const source = songFixture();
  source.id = "source-lineage-song";
  source.variationSet = {
    id: "family-fire",
    element: { id: "fire", label: "Fire", intensity: 0.8 },
    moodIntent: { id: "lift", label: "Lift" },
  };
  for (const track of source.tracks) {
    track.program = track.id === "drums" ? 0 : 33;
    track.settings = {
      program: track.program,
      volume: 0.7,
      velocity: 0.8,
      reverb: 0.3,
      cutoff: 7000,
      resonance: 0.2,
      gate: 0.9,
    };
  }

  const candidate = songFixture();
  candidate.id = "generated-similar-song";
  candidate.tracks.find((track) => track.id === "bass").notes.push({
    pitch: 41,
    start: 5.5,
    duration: 0.25,
    velocity: 82,
    grooveSource: "hip-hop-pocket.bass",
  });
  for (const track of candidate.tracks) {
    track.program = track.id === "drums" ? 8 : 39;
    track.settings = {
      program: track.program,
      volume: 0.62,
      velocity: 0.74,
      reverb: 0.2,
      cutoff: 6200,
      resonance: 0.15,
      gate: 0.84,
    };
  }

  const sourceBefore = rhythmSignature(source);
  const generatedBefore = rhythmSignature(candidate);
  const result = finalizeGeneratedSong(candidate, {
    kind: "similar",
    sourceSong: source,
  });

  assert.deepEqual(rhythmSignature(result.song), generatedBefore);
  assert.deepEqual(rhythmSignature(source), sourceBefore);
  assert.equal(result.song.elementLineage.parentSongId, source.id);
  assert.equal(result.song.elementLineage.element.id, "fire");
  assert.equal(result.diagnostics.rhythmAuthority, "groove-dna");
});
