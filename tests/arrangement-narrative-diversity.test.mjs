import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_ARRANGEMENT_CANDIDATES,
  selectNarrativelyDistinctArrangements,
} from "../src/core/arrangement-candidates.js";

function option(orderKey, family, narrativeOrderKey, narrativeScore, attemptIndex) {
  return {
    orderKey,
    evolution: { family },
    narrativeOrderKey,
    narrativeScore,
    attemptIndex,
  };
}

test("three-candidate audition represents distinct arrangement stories, not three near-duplicates", () => {
  const discovered = [
    option("a", "hook-first", "intro>chorus>verse>chorus>outro", 10, 0),
    option("b", "hook-first", "intro>chorus>verse>bridge>outro", 9.9, 1),
    option("c", "hook-first", "intro>chorus>verse>chorus>outro", 9.8, 2),
    option("d", "verse-driven", "intro>verse>verse>chorus>outro", 9.5, 3),
    option("e", "bridge-payoff", "intro>verse>bridge>chorus>outro", 9.2, 4),
  ];
  const before = structuredClone(discovered);
  const chosen = selectNarrativelyDistinctArrangements(discovered);
  assert.equal(chosen.length, MAX_ARRANGEMENT_CANDIDATES);
  assert.deepEqual(chosen.map(({ orderKey }) => orderKey), ["a", "d", "e"]);
  assert.equal(new Set(chosen.map(({ evolution }) => evolution.family)).size, 3);
  assert.equal(new Set(chosen.map(({ narrativeOrderKey }) => narrativeOrderKey)).size, 3);
  assert.deepEqual(discovered, before, "selection cannot mutate the discovered candidates");
  assert.deepEqual(selectNarrativelyDistinctArrangements(discovered), chosen, "selection is deterministic");
});

test("role-level diversity takes priority when several families sound structurally identical", () => {
  const candidates = [
    option("a", "hook-first", "intro>chorus>verse>outro", 10, 0),
    option("b", "verse-driven", "intro>chorus>verse>outro", 9.9, 1),
    option("c", "hook-first", "intro>verse>chorus>outro", 9.8, 2),
    option("d", "bridge-payoff", "intro>bridge>chorus>outro", 9.5, 3),
  ];
  assert.deepEqual(
    selectNarrativelyDistinctArrangements(candidates).map(({ orderKey }) => orderKey),
    ["a", "c", "d"],
    "audition different song-form stories before a second copy of the same section-role order",
  );
});

test("bounded shortlist retains strongest-first order, honors small limits, and safely uses fewer than three", () => {
  const discovered = [
    option("a", "verse-driven", "intro>verse>chorus>outro", 9, 0),
    option("b", "verse-driven", "intro>chorus>verse>outro", 8, 1),
    option("c", "verse-driven", "intro>bridge>chorus>outro", 7, 2),
    option("d", "verse-driven", "intro>chorus>bridge>outro", 6, 3),
  ];
  assert.deepEqual(selectNarrativelyDistinctArrangements(discovered, 1).map(({ orderKey }) => orderKey), ["a"]);
  assert.deepEqual(selectNarrativelyDistinctArrangements(discovered, 2).map(({ orderKey }) => orderKey), ["a", "b"]);
  assert.deepEqual(selectNarrativelyDistinctArrangements(discovered, 999).map(({ orderKey }) => orderKey), ["a", "b", "c"]);
  assert.deepEqual(selectNarrativelyDistinctArrangements(discovered.slice(0, 1)).map(({ orderKey }) => orderKey), ["a"]);
  assert.deepEqual(selectNarrativelyDistinctArrangements([]), []);
  const unsorted = [discovered[2], discovered[0], discovered[1]];
  assert.deepEqual(selectNarrativelyDistinctArrangements(unsorted).map(({ orderKey }) => orderKey), ["a", "b", "c"]);
});

test("same-score narratives use original attempt index for deterministic ordering", () => {
  const options = [
    option("third", "hook-first", "intro>chorus>verse", 8, 3),
    option("first", "verse-driven", "intro>verse>chorus", 8, 1),
    option("second", "bridge-payoff", "intro>bridge>chorus", 8, 2),
  ];
  assert.deepEqual(selectNarrativelyDistinctArrangements(options).map(({ orderKey }) => orderKey), ["first", "second", "third"]);
});
