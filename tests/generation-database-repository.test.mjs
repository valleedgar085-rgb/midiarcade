import assert from "node:assert/strict";
import test from "node:test";

import { createGenerationDatabaseRepository } from "../src/core/generation-database-repository.js";

const RECORD = {
  schema: "midi-arcade/generation-record@1",
  song: { id: "song-1" },
  generationRun: { id: "run-1" },
};

test("generation database repository fails closed when native SQLite is unavailable", async () => {
  const repository = createGenerationDatabaseRepository({ pluginProvider: () => null });
  assert.equal(repository.available, false);
  assert.deepEqual(await repository.persist(RECORD), { ok: false, reason: "unavailable" });
  assert.deepEqual(await repository.recentRuns(), []);
  assert.deepEqual(await repository.recentDebuggerEvents(), []);
});

test("generation database repository persists canonical records through the native plugin", async () => {
  const calls = [];
  const repository = createGenerationDatabaseRepository({
    pluginProvider: () => ({
      async persistGeneration(payload) {
        calls.push(payload);
        return { ok: true, songId: "song-1", generationRunId: "run-1" };
      },
      async recentRuns({ limit }) {
        return { runs: [{ id: "run-1", limit }] };
      },
      async recentDebuggerEvents({ limit }) {
        return { events: [{ id: 1, generation_run_id: "run-1", limit }] };
      },
    }),
  });
  assert.equal(repository.available, true);
  assert.deepEqual(await repository.persist(RECORD), {
    ok: true,
    reason: null,
    songId: "song-1",
    generationRunId: "run-1",
  });
  assert.deepEqual(calls, [{ record: RECORD }]);
  assert.deepEqual(await repository.recentRuns(999), [{ id: "run-1", limit: 100 }]);
  assert.deepEqual(await repository.recentDebuggerEvents(999), [
    { id: 1, generation_run_id: "run-1", limit: 100 },
  ]);
});

test("native persistence failures are reported without throwing away the accepted song", async () => {
  const errors = [];
  const repository = createGenerationDatabaseRepository({
    pluginProvider: () => ({
      async persistGeneration() {
        throw new Error("sqlite unavailable");
      },
    }),
    onError(error) {
      errors.push(error.message);
    },
  });
  const result = await repository.persist(RECORD);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "native-error");
  assert.deepEqual(errors, ["sqlite unavailable"]);
});
