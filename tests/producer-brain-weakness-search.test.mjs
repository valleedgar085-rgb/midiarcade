import assert from "node:assert/strict";
import test from "node:test";
import * as engine from "../src/music-engine.js";

const INPUT = {
  seed: "adaptive-contract-3",
  key: "Eb",
  scale: "dorian",
  tempo: 124,
  bars: 8,
  energy: 0.76,
  complexity: 0.68,
  variation: 0.62,
  swing: 0.2,
  humanize: 0.25,
};

function composedExpansionCandidates(song) {
  const search = song.meta.scoreDetails.candidateSearch;
  const composed = song.meta.scoreDetails.candidateScores.filter(({ repairGroup }) => !repairGroup);
  return composed.slice(search.baseCandidateCount, search.baseCandidateCount + search.expandedBy);
}

function assertRoutedExpansionMatchesFocus(song, label) {
  const search = song.meta.scoreDetails.candidateSearch;
  const focusedRoutes = new Set(search.focusHistory.map(({ route }) => route).filter(Boolean));
  const expansionCandidates = composedExpansionCandidates(song);
  assert.ok(focusedRoutes.size > 0, `${label} fixture must expose at least one routed focus`);
  assert.ok(expansionCandidates.length > 0, `${label} fixture must expose adaptive expansion`);
  assert.ok(
    expansionCandidates.every(({ compositionRoute }) => focusedRoutes.has(compositionRoute)),
    `${label} should route every post-base audition through a diagnosed focus route`,
  );
}

test("Producer Brain v2 steers adaptive expansion toward the critic's current weakness", () => {
  const first = engine.generateNew(INPUT);
  const repeated = engine.generateNew(INPUT);
  const search = first.meta.scoreDetails.candidateSearch;

  assert.deepEqual(first, repeated, "weakness-aware search must remain deterministic");
  assert.equal(search.adaptive, true);
  assert.equal(search.weaknessAwareSearch, true);
  assert.ok(search.expandedBy > 0, "fixture must exercise adaptive expansion");
  assert.ok(search.focusGroup, "expanded search should publish a critic dependency group");
  assert.ok(search.focusDimension, "expanded search should publish the weakest critic dimension");
  assert.ok(search.focusHistory.length >= 1, "expanded search should retain bounded focus diagnostics");
  assert.ok(search.focusHistory.length <= 4, "focus diagnostics must stay bounded");

  assertRoutedExpansionMatchesFocus(first, "generateNew");
});

test("explicit composition routes and weakness-search opt-outs remain authoritative", () => {
  const explicitRoute = engine.generateNew({ ...INPUT, compositionRoute: "harmony-first" });
  const explicitComposed = explicitRoute.meta.scoreDetails.candidateScores.filter(({ repairGroup }) => !repairGroup);
  assert.ok(explicitComposed.every(({ compositionRoute }) => compositionRoute === "harmony-first"));

  const optedOut = engine.generateNew({ ...INPUT, weaknessAwareSearch: false });
  const search = optedOut.meta.scoreDetails.candidateSearch;
  assert.equal(search.adaptive, true);
  assert.equal(search.weaknessAwareSearch, false);
  assert.equal(search.focusGroup, null);
  assert.deepEqual(search.focusHistory, []);
});

test("generateSimilar preserves deterministic weakness-aware route steering and diagnostics", () => {
  const source = engine.generateNew({
    ...INPUT,
    seed: "weakness-similar-source",
    candidateCount: 1,
    adaptiveCandidates: false,
    targetedRepair: false,
  });
  const relatedInput = {
    ...INPUT,
    seed: "adaptive-contract-3",
    similarity: 0.82,
    targetedRepair: false,
  };
  const related = engine.generateSimilar(source, relatedInput);
  const repeated = engine.generateSimilar(source, relatedInput);
  const search = related.meta.scoreDetails.candidateSearch;

  assert.deepEqual(related, repeated, "generateSimilar weakness-aware expansion must remain deterministic");
  assert.equal(search.adaptive, true);
  assert.equal(search.weaknessAwareSearch, true);
  assert.ok(search.expandedBy > 0, "pinned generateSimilar fixture must exercise adaptive expansion");
  assert.ok(search.focusGroup);
  assert.ok(search.focusDimension);
  assert.ok(search.focusHistory.length >= 1 && search.focusHistory.length <= 4);

  assertRoutedExpansionMatchesFocus(related, "generateSimilar");
});

test("generateSimilar keeps explicit routes and weakness-search opt-outs authoritative", () => {
  const source = engine.generateNew({
    ...INPUT,
    seed: "weakness-similar-controls-source",
    candidateCount: 1,
    adaptiveCandidates: false,
    targetedRepair: false,
  });

  const explicitRoute = engine.generateSimilar(source, {
    ...INPUT,
    seed: "weakness-similar-explicit-route",
    compositionRoute: "harmony-first",
    targetedRepair: false,
  });
  const explicitComposed = explicitRoute.meta.scoreDetails.candidateScores.filter(({ repairGroup }) => !repairGroup);
  assert.ok(explicitComposed.every(({ compositionRoute }) => compositionRoute === "harmony-first"));

  const optedOut = engine.generateSimilar(source, {
    ...INPUT,
    seed: "weakness-similar-opt-out",
    weaknessAwareSearch: false,
    targetedRepair: false,
  });
  const search = optedOut.meta.scoreDetails.candidateSearch;
  assert.equal(search.adaptive, true);
  assert.equal(search.weaknessAwareSearch, false);
  assert.equal(search.focusGroup, null);
  assert.deepEqual(search.focusHistory, []);
});

test("song-level weakness search diversifies repeated routes without increasing the candidate budget", () => {
  const input = {
    genre: "house",
    seed: "global-search-02:house:balanced",
    bars: 8,
    energy: 0.55,
    complexity: 0.55,
    targetedRepair: false,
  };
  const first = engine.generateNew(input);
  const repeated = engine.generateNew(input);
  const search = first.meta.scoreDetails.candidateSearch;
  const diversified = search.focusHistory.filter(({ diversified }) => diversified);

  assert.deepEqual(first, repeated, "search diversification must remain deterministic");
  assert.ok(search.expandedBy > 0, "fixture must exercise adaptive expansion");
  assert.ok(diversified.length > 0, "fixture must exercise a diversified search focus");
  assert.ok(diversified.every(({ primaryGroup, group }) => primaryGroup && primaryGroup !== group));
  assert.ok(diversified.every(({ primaryDimension }) => typeof primaryDimension === "string" && primaryDimension.length > 0));
  assert.ok(first.meta.scoreDetails.candidatesEvaluated <= 7, "default search diversity must not increase candidate count");
  assertRoutedExpansionMatchesFocus(first, "diversified generateNew");
});
