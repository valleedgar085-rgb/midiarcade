import test from "node:test";
import assert from "node:assert/strict";

import {
  applySnareBounceRefinement,
  MAX_SNARE_BOUNCE_FIGURES,
  SNARE_BOUNCE_REFINEMENT_VERSION,
} from "../src/core/snare-bounce-refinement.js";

function fixtureSong(genre = "trap") {
  const notes = [];
  for (let bar = 0; bar < 16; bar += 1) {
    notes.push({ pitch: 36, start: bar * 4, duration: 0.08, velocity: 100 });
    notes.push({ pitch: 38, start: bar * 4 + 2, duration: 0.08, velocity: 104 });
    for (let step = 0; step < 8; step += 1) {
      notes.push({ pitch: 42, start: bar * 4 + step * 0.5, duration: 0.05, velocity: 72 });
    }
  }
  return {
    id: `fixture-${genre}`,
    genre,
    bars: 16,
    bpm: genre === "trap" ? 140 : 94,
    key: "A",
    scale: "minor",
    tracks: [
      { id: "drums", type: "drums", channel: 9, notes },
      { id: "bass", type: "bass", channel: 0, notes: [] },
      { id: "chords", type: "chords", channel: 1, notes: [] },
      { id: "melody", type: "melody", channel: 2, notes: [] },
    ],
    idea: { rhythmicFeatures: ["Half-time pocket"] },
    meta: { genre, scoreDetails: {} },
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

function bounceNotes(song) {
  return song.tracks
    .find((track) => track.id === "drums")
    .notes
    .filter((note) => String(note.rhythmicFeature ?? "").startsWith("bounce-snare"));
}

test("snare bounce is deterministic, sparse, and uses a lower alternate snare voice", () => {
  const song = fixtureSong("trap");
  const config = {
    genre: "trap",
    seed: "phase9h-bounce-proof",
    bars: 16,
    rollAmount: 1,
    drumFills: 1,
    energy: 0.94,
    complexity: 0.9,
  };
  const first = applySnareBounceRefinement(song, config, acceptEvaluators);
  const second = applySnareBounceRefinement(song, config, acceptEvaluators);

  assert.equal(first.diagnostics.version, SNARE_BOUNCE_REFINEMENT_VERSION);
  assert.equal(first.diagnostics.accepted, true);
  assert.deepEqual(first, second);
  assert.notEqual(first.song, song);
  assert.ok(first.diagnostics.figures >= 1);
  assert.ok(first.diagnostics.figures <= MAX_SNARE_BOUNCE_FIGURES);
  assert.ok(first.diagnostics.lowerVoiceHits >= 1);
  assert.ok(bounceNotes(first.song).some((note) => note.pitch === 40 && note.snareVoice === "lower"));
  assert.ok(first.song.idea.rhythmicFeatures.includes("Bounce snare pickups"));
});

test("Roll=0 remains a hard off switch for bounce snare generation", () => {
  const song = fixtureSong("trap");
  const result = applySnareBounceRefinement(song, {
    genre: "trap",
    seed: "phase9h-off-proof",
    bars: 16,
    rollAmount: 0,
    drumFills: 1,
    energy: 1,
    complexity: 1,
  }, acceptEvaluators);

  assert.equal(result.song, song);
  assert.equal(result.diagnostics.accepted, false);
  assert.equal(bounceNotes(result.song).length, 0);
});

test("non-family genres remain untouched", () => {
  const song = fixtureSong("house");
  const result = applySnareBounceRefinement(song, {
    genre: "house",
    seed: "phase9h-house-proof",
    rollAmount: 1,
    drumFills: 1,
  }, acceptEvaluators);

  assert.equal(result.song, song);
  assert.equal(result.diagnostics.reason, "genre-not-eligible");
});

test("release or protected-dimension regressions fail closed to the original song", () => {
  const song = fixtureSong("rap");
  const config = {
    genre: "rap",
    seed: "phase9h-fail-closed",
    bars: 16,
    rollAmount: 1,
    drumFills: 1,
    energy: 0.9,
    complexity: 0.86,
  };

  const releaseRejected = applySnareBounceRefinement(song, config, {
    evaluateCandidate: () => evaluation(),
    evaluateReleaseGate: () => ({ passed: false }),
  });
  assert.equal(releaseRejected.song, song);
  assert.equal(releaseRejected.diagnostics.reason, "release-gate");

  let calls = 0;
  const protectedRejected = applySnareBounceRefinement(song, config, {
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
