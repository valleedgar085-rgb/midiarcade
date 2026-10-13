import assert from "node:assert/strict";
import test from "node:test";

import { createSqliteGenerationStore } from "../src/core/sqlite-generation-store.js";
import { createGenerationPersistenceService } from "../src/core/generation-persistence-service.js";

function fakeConnection({ failOn = null } = {}) {
  const calls = [];
  let userVersion = 0;
  const fail = (name, statement = "") => {
    if (failOn && (failOn === name || String(statement).includes(failOn))) {
      throw new Error(`forced failure: ${failOn}`);
    }
  };
  return {
    calls,
    async query(statement) {
      calls.push(["query", statement]);
      fail("query", statement);
      return { values: [{ user_version: userVersion }] };
    },
    async execute(statement, transaction) {
      calls.push(["execute", statement, transaction]);
      fail("execute", statement);
      const match = String(statement).match(/PRAGMA user_version = (\d+)/);
      if (match) userVersion = Number(match[1]);
      return { changes: { changes: 0 } };
    },
    async run(statement, values, transaction) {
      calls.push(["run", statement, values, transaction]);
      fail("run", statement);
      return { changes: { changes: 1 } };
    },
    async beginTransaction() {
      calls.push(["begin"]);
      fail("begin");
    },
    async commitTransaction() {
      calls.push(["commit"]);
      fail("commit");
    },
    async rollbackTransaction() {
      calls.push(["rollback"]);
    },
  };
}

function song() {
  return {
    id: "song-a",
    seed: "seed-a",
    meta: { genre: "hipHop", bars: 4 },
    songBlueprint: { id: "bp-a", narrative: { label: "lift" } },
    grooveConductor: { version: 4, subdivision: 0.25, bars: [{ bar: 0 }] },
    harmony: [{ start: 0, chord: "Am9" }],
    structure: [{ id: "intro", startBar: 0, endBar: 3 }],
    tracks: [{
      role: "bass",
      notes: [{ start: 0, duration: 1, pitch: 40, velocity: 96 }],
    }],
  };
}

test("sqlite store initializes schema once and transactionally saves a generation snapshot", async () => {
  const connection = fakeConnection();
  const store = createSqliteGenerationStore({ connection });
  const service = createGenerationPersistenceService({
    store,
    clock: () => new Date("2026-09-24T03:00:00.000Z"),
    engineVersion: "1.2.2",
  });

  const first = await service.saveCommitted({
    kind: "new",
    song: song(),
    config: { seed: "seed-a", genre: "hipHop", bars: 4 },
  });
  assert.equal(first.ok, true);
  assert.equal(first.counts.sections, 1);
  assert.equal(first.counts.tracks, 1);
  assert.equal(first.counts.musicalEvents, 1);

  const schemaExecs = connection.calls.filter(([kind, statement]) =>
    kind === "execute" && String(statement).includes("CREATE TABLE IF NOT EXISTS generation_runs"));
  assert.equal(schemaExecs.length, 1);
  assert.ok(connection.calls.some(([kind]) => kind === "begin"));
  assert.ok(connection.calls.some(([kind]) => kind === "commit"));
  assert.ok(!connection.calls.some(([kind]) => kind === "rollback"));

  await service.saveCommitted({
    kind: "similar",
    song: { ...song(), id: "song-b" },
    config: { seed: "seed-b", genre: "hipHop", bars: 4 },
  });
  const schemaExecsAfter = connection.calls.filter(([kind, statement]) =>
    kind === "execute" && String(statement).includes("CREATE TABLE IF NOT EXISTS generation_runs"));
  assert.equal(schemaExecsAfter.length, 1);
});

test("sqlite store rolls back the whole generation when a child write fails", async () => {
  const connection = fakeConnection({ failOn: "INSERT INTO tracks" });
  const store = createSqliteGenerationStore({ connection });
  const service = createGenerationPersistenceService({ store });

  const result = await service.saveCommitted({
    song: song(),
    config: { seed: "rollback-seed" },
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "write-failed");
  assert.ok(connection.calls.some(([kind]) => kind === "rollback"));
  assert.ok(!connection.calls.some(([kind]) => kind === "commit"));
});

test("persistence failure is reported without changing the generated song", async () => {
  const original = song();
  const before = structuredClone(original);
  const store = {
    async saveGenerationSnapshot() {
      throw new Error("disk unavailable");
    },
  };
  let observed = null;
  const service = createGenerationPersistenceService({
    store,
    onError(error, context) {
      observed = { error: error.message, context };
    },
  });

  const result = await service.saveCommitted({
    song: original,
    config: { seed: "safe-failure" },
  });

  assert.equal(result.ok, false);
  assert.equal(result.reason, "write-failed");
  assert.deepEqual(original, before);
  assert.equal(observed.error, "disk unavailable");
});
