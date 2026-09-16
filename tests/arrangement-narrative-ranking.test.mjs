import assert from "node:assert/strict";
import test from "node:test";

import {
  createArrangementCandidates,
  MAX_ARRANGEMENT_CANDIDATES,
} from "../src/core/arrangement-candidates.js";
import { generateNew } from "../src/music-engine.js";

const CASES = [
  ["pop", "arrangement-rank-pop"],
  ["hipHop", "arrangement-rank-hiphop"],
  ["house", "arrangement-rank-house"],
  ["loFiHipHop", "arrangement-rank-lofi"],
];

test("arrangement discovery ranks narrative shape before exposing the bounded critic pool", () => {
  for (const [genre, seed] of CASES) {
    const song = generateNew({ genre, seed, bars: 16, candidateCount: 1 });
    const config = {
      genre,
      bars: 16,
      seed: `${seed}:evolution`,
      arrangementEvolution: true,
    };
    const first = createArrangementCandidates(song, config);
    const repeated = createArrangementCandidates(song, config);

    assert.deepEqual(
      repeated.map(({ orderKey, narrativeScore, attemptIndex }) => [orderKey, narrativeScore, attemptIndex]),
      first.map(({ orderKey, narrativeScore, attemptIndex }) => [orderKey, narrativeScore, attemptIndex]),
      `${genre} ranking must remain deterministic`,
    );
    assert.ok(first.length <= MAX_ARRANGEMENT_CANDIDATES);
    for (let index = 1; index < first.length; index += 1) {
      assert.ok(
        first[index - 1].narrativeScore >= first[index].narrativeScore,
        `${genre} candidates must be ordered strongest narrative-first`,
      );
    }
    for (const candidate of first) {
      const diagnostics = candidate.song.outputQualityEvolution?.arrangement?.audition;
      assert.equal(diagnostics?.narrativeScore, candidate.narrativeScore);
      assert.ok(diagnostics?.discoveredCandidates >= first.length);
      assert.ok(candidate.candidateIndex < MAX_ARRANGEMENT_CANDIDATES);
    }
  }
});
