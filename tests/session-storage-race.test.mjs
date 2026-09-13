import assert from "node:assert/strict";
import test from "node:test";
import { createSessionStorage } from "../src/core/session-storage.js";

test("discarding a corrupt session invalidates older pending autosaves", () => {
  const values = new Map();
  const backing = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
  const options = {
    key: "midi-arcade/session-race-test",
    schema: 2,
    storageProvider: () => backing,
  };

  const olderRuntime = createSessionStorage(options);
  const recoveringRuntime = createSessionStorage(options);
  assert.equal(olderRuntime.save({ schema: 2, song: { id: "old" } }).ok, true);

  assert.equal(recoveringRuntime.discard(), true);
  assert.equal(values.has(options.key), false);

  const staleWrite = olderRuntime.save({ schema: 2, song: null });
  assert.deepEqual(staleWrite, { ok: false, reason: "stale-session" });
  assert.equal(values.has(options.key), false, "an older autosave must not repopulate discarded storage");

  assert.equal(recoveringRuntime.save({ schema: 2, song: { id: "healthy" } }).ok, true);
  assert.equal(JSON.parse(values.get(options.key)).song.id, "healthy");
});
