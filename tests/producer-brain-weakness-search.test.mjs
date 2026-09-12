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

  const focusedRoutes = new Set(search.focusHistory.map(({ route }) => route).filter(Boolean));
  const composedCandidates = first.meta.scoreDetails.candidateScores.filter(({ repairGroup }) => !repairGroup);
  const expansionCandidates = composedCandidates.slice(
    search.baseCandidateCount,
    search.baseCandidateCount + search.expandedBy,
  );
  if (focusedRoutes.size) {
    assert.ok(
      expansionCandidates.some(({ compositionRoute }) => focusedRoutes.has(compositionRoute)),
      "at least one extra audition should follow a critic-selected composition route",
    );
  }
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
