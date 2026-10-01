import assert from "node:assert/strict";
import test from "node:test";

import { createGenerationExecutor, withCommittedMelodySectionMemoryDiagnostics } from "../src/core/generation-executor.js";

test("committed melody memory refresh replaces stale returned diagnostics without dropping other fields", () => {
  const stale = { status: "evaluated", passed: false, score: 44, reason: "stale" };
  const committed = { status: "evaluated", passed: true, score: 82, reason: "memory-development-coherent" };
  const result = {
    song: { id: "committed-song" },
    outputQualityDiagnostics: {
      melodySectionMemoryAudit: stale,
      melodyPhraseRefinement: { accepted: true },
    },
  };

  const refreshed = withCommittedMelodySectionMemoryDiagnostics(result, committed);

  assert.notEqual(refreshed, result);
  assert.equal(refreshed.song, result.song);
  assert.deepEqual(refreshed.outputQualityDiagnostics.melodySectionMemoryAudit, committed);
  assert.deepEqual(
    refreshed.outputQualityDiagnostics.melodyPhraseRefinement,
    result.outputQualityDiagnostics.melodyPhraseRefinement,
  );
  assert.deepEqual(result.outputQualityDiagnostics.melodySectionMemoryAudit, stale);
});

test("committed melody memory refresh is a no-op when no final report exists", () => {
  const result = { song: { id: "song" }, outputQualityDiagnostics: {} };
  assert.equal(withCommittedMelodySectionMemoryDiagnostics(result, null), result);
});

test("executor preserves a result without melody while recording the unavailable audit", async () => {
  const result = { status: "committed", song: { id: "no-melody", tracks: [] } };
  const executor = createGenerationExecutor({ fallback: () => result });

  const committed = await executor.run("new", { config: { seed: "no-melody" } });

  assert.equal(committed, result);
  assert.equal(Object.hasOwn(result, "outputQualityDiagnostics"), false);
  const finalStage = executor.diagnosticsSnapshot().at(-1).stages.find((stage) => stage.stage === "finalize");
  assert.equal(finalStage.detail.melodySectionMemoryAudit.status, "unavailable");
  assert.equal(finalStage.detail.melodySectionMemoryAudit.reason, "missing-melody");
  executor.dispose();
});


test("committed melody memory refresh preserves exact legacy result identity when diagnostics were never exposed", () => {
  const committed = { status: "evaluated", passed: true, score: 82, reason: "memory-development-coherent" };
  const legacy = { status: "committed", song: { id: "legacy-stable-result" } };

  const refreshed = withCommittedMelodySectionMemoryDiagnostics(legacy, committed);

  assert.equal(refreshed, legacy);
  assert.equal(refreshed.outputQualityDiagnostics, undefined);
});
