import test from "node:test";
import assert from "node:assert/strict";

import {
  applyTrapStagedBuildRefinement,
  MAX_TRAP_STAGED_VELOCITY_EDITS,
  TRAP_STAGED_BUILD_VERSION,
} from "../src/core/trap-staged-build-refinement.js";

function fixtureSong() {
  const notes = [];
  for (let bar = 0; bar < 16; bar += 1) {
    notes.push({ pitch: 36, start: bar * 4, duration: 0.08, velocity: 100 });
    notes.push({ pitch: 38, start: bar * 4 + 2, duration: 0.08, velocity: 100 });
    for (let step = 0; step < 8; step += 1) {
      notes.push({ pitch: 42, start: bar * 4 + step * 0.5, duration: 0.05, velocity: 72 });
    }
  }
  const structure = [
    { id: "intro-1", name: "intro", startBeat: 0, endBeat: 16, bars: 4 },
    { id: "verse-1", name: "verse", startBeat: 16, endBeat: 32, bars: 4 },
    { id: "pre-1", name: "prechorus", startBeat: 32, endBeat: 48, bars: 4 },
    { id: "chorus-1", name: "chorus", startBeat: 48, endBeat: 64, bars: 4 },
  ];
  return {
    id: "trap-staged-build",
    genre: "trap",
    structure,
    tracks: [{ id: "drums", type: "drums", notes }],
    meta: { genre: "trap", beatsPerBar: 4, scoreDetails: {} },
  };
}

const config = {
  genre: "trap",
  seed: "trap-staged-build-proof",
  trapStagedBuild: true,
  energy: 0.72,
  evolution: 0.62,
  complexity: 0.68,
};

function evaluate(song) {
  const changed = song.tracks[0].notes.some((note) => note.stagedBuildMuted);
  return {
    score: changed ? 94 : 92,
    subscores: {
      groove: changed ? 92 : 90,
      performance: 91,
      repetition: 90,
      phraseResolution: 90,
      density: changed ? 90 : 89,
      memory: 90,
      motif: 90,
      separation: 92,
    },
    diagnostics: { scaleFit: 1 },
  };
}

const accept = Object.freeze({
  evaluateCandidate: evaluate,
  evaluateReleaseGate: () => ({ passed: true }),
});

test("Trap staged build is deterministic, sparse early, and fuller at the hook", () => {
  const source = fixtureSong();
  const first = applyTrapStagedBuildRefinement(source, config, accept);
  const second = applyTrapStagedBuildRefinement(source, config, accept);

  assert.equal(first.diagnostics.version, TRAP_STAGED_BUILD_VERSION);
  assert.equal(first.diagnostics.accepted, true);
  assert.deepEqual(first, second);
  assert.notStrictEqual(first.song, source);
  assert.ok(first.diagnostics.edits > 0);
  assert.ok(first.diagnostics.edits <= MAX_TRAP_STAGED_VELOCITY_EDITS);
  assert.ok(first.diagnostics.sections.includes("intro-1"));

  const notes = first.song.tracks[0].notes;
  const introMuted = notes.filter((note) => note.stagedBuildMuted && note.start < 16).length;
  const chorusMuted = notes.filter((note) => note.stagedBuildMuted && note.start >= 48).length;
  assert.ok(introMuted > chorusMuted);

  assert.equal(notes.length, source.tracks[0].notes.length);
  assert.deepEqual(
    notes.map(({ pitch, start, duration }) => ({ pitch, start, duration })),
    source.tracks[0].notes.map(({ pitch, start, duration }) => ({ pitch, start, duration })),
  );
});

test("Trap staged build is opt-in and Evolution=0 is a hard off switch", () => {
  const source = fixtureSong();
  const disabled = applyTrapStagedBuildRefinement(source, { ...config, trapStagedBuild: false }, accept);
  assert.strictEqual(disabled.song, source);
  assert.equal(disabled.diagnostics.reason, "disabled");

  const off = applyTrapStagedBuildRefinement(source, { ...config, evolution: 0 }, accept);
  assert.strictEqual(off.song, source);
  assert.equal(off.diagnostics.reason, "evolution-off");
});

test("Trap staged build rejects a critic regression and leaves the source intact", () => {
  const source = fixtureSong();
  const result = applyTrapStagedBuildRefinement(source, config, {
    evaluateCandidate: (song) => {
      const changed = song.tracks[0].notes.some((note) => note.stagedBuildMuted);
      return {
        score: changed ? 70 : 90,
        subscores: Object.fromEntries([
          "groove", "performance", "repetition", "phraseResolution",
          "density", "memory", "motif", "separation",
        ].map((key) => [key, changed ? 60 : 90])),
        diagnostics: { scaleFit: 1 },
      };
    },
    evaluateReleaseGate: () => ({ passed: true }),
  });

  assert.strictEqual(result.song, source);
  assert.equal(result.diagnostics.accepted, false);
  assert.equal(result.diagnostics.reason, "protected-dimension-regression");
});
