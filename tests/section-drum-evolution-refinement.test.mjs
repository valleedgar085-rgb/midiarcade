import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  applySectionDrumEvolutionRefinement,
  MAX_SECTION_DRUM_EDITS,
  SECTION_DRUM_EVOLUTION_VERSION,
} from "../src/core/section-drum-evolution-refinement.js";

function fixtureSong(genre = "trap") {
  const notes = [];
  for (let bar = 0; bar < 22; bar += 1) {
    notes.push({ pitch: 36, start: bar * 4, duration: 0.08, velocity: 100 });
    notes.push({ pitch: 38, start: bar * 4 + 2, duration: 0.08, velocity: 104 });
    for (let step = 0; step < 8; step += 1) {
      notes.push({ pitch: 42, start: bar * 4 + step * 0.5, duration: 0.05, velocity: 72 });
    }
  }
  const structure = [
    { id: "intro-1", name: "intro", startBeat: 0, endBeat: 16, bars: 4 },
    { id: "verse-1", name: "verse", startBeat: 16, endBeat: 32, bars: 4 },
    { id: "chorus-1", name: "chorus", startBeat: 32, endBeat: 48, bars: 4 },
    { id: "verse-2", name: "verse", startBeat: 48, endBeat: 64, bars: 4 },
    { id: "pre-2", name: "prechorus", startBeat: 64, endBeat: 72, bars: 2 },
    { id: "chorus-2", name: "chorus", startBeat: 72, endBeat: 88, bars: 4 },
  ];
  return {
    id: `section-drums-${genre}`,
    genre,
    bars: 22,
    bpm: genre === "trap" ? 140 : 94,
    key: "A",
    scale: "minor",
    structure,
    sections: structuredClone(structure),
    tracks: [
      { id: "drums", type: "drums", channel: 9, notes },
      { id: "bass", type: "bass", channel: 0, notes: [] },
      { id: "chords", type: "chords", channel: 1, notes: [] },
      { id: "melody", type: "melody", channel: 2, notes: [] },
    ],
    idea: { rhythmicFeatures: ["Half-time pocket"] },
    meta: { genre, beatsPerBar: 4, scoreDetails: {} },
  };
}

function evaluation(score = 92) {
  return {
    score,
    diagnostics: { scaleFit: 1 },
    subscores: {
      groove: 92,
      performance: 91,
      repetition: 90,
      phraseResolution: 90,
      density: 91,
      memory: 90,
      motif: 90,
      separation: 92,
    },
  };
}

const acceptEvaluators = Object.freeze({
  evaluateCandidate: () => evaluation(),
  evaluateReleaseGate: () => ({ passed: true }),
});

function evolutionNotes(song) {
  return song.tracks
    .find((track) => track.id === "drums")
    .notes
    .filter((note) => String(note.rhythmicFeature ?? "").startsWith("section-"));
}

test("section drum evolution is deterministic, bounded, and develops later sections", () => {
  const song = fixtureSong("trap");
  const config = {
    genre: "trap",
    seed: "phase9i-section-proof",
    evolution: 0.92,
    drumFills: 0.9,
    energy: 0.9,
  };
  const first = applySectionDrumEvolutionRefinement(song, config, acceptEvaluators);
  const second = applySectionDrumEvolutionRefinement(song, config, acceptEvaluators);

  assert.equal(first.diagnostics.version, SECTION_DRUM_EVOLUTION_VERSION);
  assert.equal(first.diagnostics.accepted, true);
  assert.deepEqual(first, second);
  assert.notEqual(first.song, song);
  assert.ok(first.diagnostics.edits >= 3);
  assert.ok(first.diagnostics.edits <= MAX_SECTION_DRUM_EDITS);
  assert.ok(first.diagnostics.editTypes.includes("kick-response"));
  assert.ok(first.diagnostics.editTypes.includes("ghost-snare"));
  assert.ok(first.diagnostics.editTypes.includes("transition-pickup"));
  assert.ok(first.diagnostics.sections.some((entry) => entry.sectionId === "verse-2"));
  assert.ok(first.diagnostics.sections.some((entry) => entry.sectionId === "chorus-2"));
  assert.ok(evolutionNotes(first.song).every((note) => note.sectionId));
  assert.ok(first.song.idea.rhythmicFeatures.includes("Section-aware drum evolution"));
});

test("Evolution=0 remains a hard off switch", () => {
  const song = fixtureSong("rap");
  const result = applySectionDrumEvolutionRefinement(song, {
    genre: "rap",
    seed: "phase9i-off-proof",
    evolution: 0,
    drumFills: 1,
    energy: 1,
  }, acceptEvaluators);

  assert.equal(result.song, song);
  assert.equal(result.diagnostics.accepted, false);
  assert.equal(result.diagnostics.reason, "evolution-off");
  assert.equal(evolutionNotes(result.song).length, 0);
});

test("Drum Fills=0 suppresses transition pickups without disabling section responses", () => {
  const song = fixtureSong("hipHop");
  const result = applySectionDrumEvolutionRefinement(song, {
    genre: "hipHop",
    seed: "phase9i-fills-off",
    evolution: 0.9,
    drumFills: 0,
    energy: 0.82,
  }, acceptEvaluators);

  assert.equal(result.diagnostics.accepted, true);
  assert.ok(result.diagnostics.editTypes.includes("kick-response"));
  assert.ok(result.diagnostics.editTypes.includes("ghost-snare"));
  assert.equal(result.diagnostics.editTypes.includes("transition-pickup"), false);
});

test("non-family genres remain untouched", () => {
  const song = fixtureSong("house");
  const result = applySectionDrumEvolutionRefinement(song, {
    genre: "house",
    seed: "phase9i-house-proof",
    evolution: 1,
    drumFills: 1,
  }, acceptEvaluators);

  assert.equal(result.song, song);
  assert.equal(result.diagnostics.reason, "genre-not-eligible");
});

test("release and protected-dimension regressions fail closed", () => {
  const song = fixtureSong("rap");
  const config = {
    genre: "rap",
    seed: "phase9i-fail-closed",
    evolution: 0.9,
    drumFills: 0.8,
    energy: 0.84,
  };

  const releaseRejected = applySectionDrumEvolutionRefinement(song, config, {
    evaluateCandidate: () => evaluation(),
    evaluateReleaseGate: () => ({ passed: false }),
  });
  assert.equal(releaseRejected.song, song);
  assert.equal(releaseRejected.diagnostics.reason, "release-gate");

  let calls = 0;
  const protectedRejected = applySectionDrumEvolutionRefinement(song, config, {
    evaluateCandidate: () => {
      calls += 1;
      const value = evaluation();
      if (calls > 1) value.subscores.groove -= 2;
      return value;
    },
    evaluateReleaseGate: () => ({ passed: true }),
  });
  assert.equal(protectedRejected.song, song);
  assert.equal(protectedRejected.diagnostics.reason, "protected-dimension-regression");
});

test("section drum refinement contains no unseeded randomness", async () => {
  const source = await readFile(new URL("../src/core/section-drum-evolution-refinement.js", import.meta.url), "utf8");
  assert.equal(source.includes("Math.random"), false);
  assert.equal(source.includes("crypto.random"), false);
});
