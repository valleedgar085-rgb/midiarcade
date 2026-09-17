import assert from "node:assert/strict";
import test from "node:test";
import {
  applySoundCatcherRefinement,
} from "../src/core/sound-catcher-refinement.js";
import {
  applySongOutputQualityPostprocess,
  applyResultOutputQualityPostprocess,
} from "../src/core/output-quality-postprocess.js";

function songFixture() {
  return {
    meta: { genre: "trap", beatsPerBar: 4 },
    tracks: [
      {
        id: "melody",
        notes: [
          { pitch: 72, start: 0.08, duration: 0.4, velocity: 90 },
          { pitch: 74, start: 1.54, duration: 0.4, velocity: 90 },
          { pitch: 76, start: 3.42, duration: 0.4, velocity: 90 },
          { pitch: 79, start: 4.55, duration: 0.4, velocity: 90 },
          { pitch: 76, start: 7.35, duration: 0.4, velocity: 90 },
        ],
      },
    ],
  };
}

const config = {
  genre: "trap",
  soundCatcherRefinement: true,
  rollAmount: 0.45,
  drumFills: 0.4,
};

function evaluator(song) {
  const notes = song.tracks[0].notes;
  const changed = notes.some((note, index) => note.start !== songFixture().tracks[0].notes[index].start);
  return {
    score: changed ? 95 : 94,
    subscores: {
      groove: changed ? 90 : 88,
      performance: 90,
      repetition: 86,
      phraseResolution: 88,
      density: 86,
      memory: 88,
      motif: 90,
      separation: 88,
    },
    diagnostics: { scaleFit: 1 },
  };
}

function release() {
  return { passed: true };
}

test("Sound Catcher timing is deterministic, bounded, and melody-only", () => {
  const first = applySoundCatcherRefinement(songFixture(), config, {
    evaluateCandidate: evaluator,
    evaluateReleaseGate: release,
  });
  const second = applySoundCatcherRefinement(songFixture(), config, {
    evaluateCandidate: evaluator,
    evaluateReleaseGate: release,
  });

  assert.deepEqual(first.song, second.song);
  assert.equal(first.diagnostics.accepted, true);
  assert.ok(first.diagnostics.changedNotes > 0);
  assert.ok(first.song.tracks[0].notes.every((note, index) =>
    Math.abs(note.start - songFixture().tracks[0].notes[index].start) <= 0.18));
  assert.deepEqual(
    first.song.tracks[0].notes.map(({ pitch, duration, velocity }) => ({ pitch, duration, velocity })),
    songFixture().tracks[0].notes.map(({ pitch, duration, velocity }) => ({ pitch, duration, velocity })),
  );
});

test("Sound Catcher preserves zero-off controls and rejects critic regressions", () => {
  const source = songFixture();
  const off = applySoundCatcherRefinement(source, { ...config, rollAmount: 0 }, {
    evaluateCandidate: evaluator,
    evaluateReleaseGate: release,
  });
  assert.strictEqual(off.song, source);
  assert.equal(off.diagnostics.reason, "no-safe-catcher-opportunity");

  const rejected = applySoundCatcherRefinement(source, config, {
    evaluateCandidate: () => ({
      score: 70,
      subscores: Object.fromEntries([
        "groove", "performance", "repetition", "phraseResolution",
        "density", "memory", "motif", "separation",
      ].map((key) => [key, 60])),
      diagnostics: { scaleFit: 1 },
    }),
    evaluateReleaseGate: release,
  });
  assert.strictEqual(rejected.song, source);
  assert.equal(rejected.diagnostics.accepted, false);
});

test("output postprocess only runs Sound Catcher when explicitly enabled", () => {
  const source = songFixture();
  const untouched = applyResultOutputQualityPostprocess(
    { song: source },
    {},
    { evaluateCandidate: evaluator, evaluateReleaseGate: release },
  );
  assert.strictEqual(untouched.song, source);

  const processed = applySongOutputQualityPostprocess(source, config, {
    evaluateCandidate: evaluator,
    evaluateReleaseGate: release,
  });
  assert.equal(processed.soundCatcherDiagnostics.accepted, true);
  assert.notStrictEqual(processed.song, source);
});
