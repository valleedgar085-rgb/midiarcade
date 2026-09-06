import test from "node:test";
import assert from "node:assert/strict";
import { generateNew } from "../src/music-engine.js";

test("Song DNA preserves New-idea replay rejection while remaining deterministic", () => {
  const input = {
    genre: "pop",
    seed: "phase4-dna-novelty-guard",
    bars: 16,
    candidateCount: 1,
  };
  const previous = generateNew(input);
  const request = { ...input, recentSongs: [previous] };
  const first = generateNew(request);
  const repeated = generateNew(request);

  assert.deepEqual(first, repeated, "novelty fallback must remain deterministic");
  assert.notDeepEqual(first.meta.ideaFingerprint, previous.meta.ideaFingerprint);
  assert.equal(first.meta.novelty.backToBackRepeat, false);
  assert.ok(first.meta.novelty.immediateSimilarity < 0.9);
  assert.ok(first.meta.scoreDetails.candidatesEvaluated >= 2);
  assert.ok(first.songDNA?.id);
  assert.notEqual(first.songDNA.id, previous.songDNA.id);
});
