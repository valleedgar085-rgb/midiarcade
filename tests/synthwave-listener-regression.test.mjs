import assert from "node:assert/strict";
import test from "node:test";

import { evaluateSongCandidate, generateNew } from "../src/music-engine.js";

test("listener regression: synthwave opening has identity, tonal center, and section movement", { timeout: 120_000 }, () => {
  const song = generateNew({
    genre: "synthwave",
    seed: "arcade-mukinfyv-1-zoei6i",
    bars: 32,
    thinkingDepth: "deep",
    adaptiveCandidates: true,
    weaknessAwareSearch: true,
    targetedRepair: true,
  });

  const evaluation = evaluateSongCandidate(song);
  const sectionOutcome = song.meta?.sectionOutcome ?? {};

  assert.equal(sectionOutcome.passed, true, JSON.stringify(sectionOutcome));
  assert.ok(
    Number(sectionOutcome.openingContrast ?? 0) >= 0.08,
    `intro should lead into a meaningfully different section: ${JSON.stringify(sectionOutcome)}`,
  );
  assert.ok(
    Number(sectionOutcome.medianContrast ?? 0) >= 0.09,
    `most section changes should carry real movement: ${JSON.stringify(sectionOutcome)}`,
  );
  assert.ok(
    Number(evaluation.diagnostics?.selectedTonicAlignment ?? 0) >= 0.45,
    `song should clearly point back to the selected key center: ${JSON.stringify(evaluation.diagnostics)}`,
  );
  assert.ok(
    Number(evaluation.diagnostics?.strongChordFit ?? 0) >= 0.6,
    `strong melody notes should agree with the active chords: ${JSON.stringify(evaluation.diagnostics)}`,
  );
});
