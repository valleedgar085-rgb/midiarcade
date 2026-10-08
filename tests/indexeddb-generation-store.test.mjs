import assert from "node:assert/strict";
import test from "node:test";

import { createIndexedDbGenerationStore } from "../src/core/indexeddb-generation-store.js";

function fakeDatabase(records) {
  return {
    transaction(storeName, mode) {
      assert.equal(storeName, "generationSnapshots");
      assert.equal(mode, "readwrite");
      const transaction = {
        error: null,
        oncomplete: null,
        onerror: null,
        onabort: null,
        objectStore() {
          return {
            put(record) {
              records.set(record.runId, structuredClone(record));
              queueMicrotask(() => transaction.oncomplete?.());
            },
          };
        },
      };
      return transaction;
    },
  };
}

test("IndexedDB generation store persists a complete snapshot behind the shared store interface", async () => {
  const records = new Map();
  const store = createIndexedDbGenerationStore({
    databaseProvider: () => fakeDatabase(records),
    clock: () => 12345,
  });
  const snapshot = {
    run: { id: "run-1", songId: "song-1" },
    sections: [{ id: "s1" }],
    tracks: [{ id: "t1" }],
    musicalEvents: [{ id: "e1" }],
  };

  const result = await store.saveGenerationSnapshot(snapshot);

  assert.deepEqual(result, {
    ok: true,
    runId: "run-1",
    counts: { sections: 1, tracks: 1, musicalEvents: 1 },
  });
  assert.equal(records.get("run-1").songId, "song-1");
  assert.equal(records.get("run-1").savedAt, 12345);
  assert.deepEqual(records.get("run-1").snapshot, snapshot);
});
