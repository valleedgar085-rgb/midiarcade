import assert from "node:assert/strict";
import test from "node:test";

import { createGenerationExecutor } from "../src/core/generation-executor.js";

function variation(id) {
  return { id, tracks: [], meta: { scoreDetails: { releaseGate: { passed: true } } } };
}

test("song variation authority retries one incomplete set with a deterministic derived seed", async () => {
  const calls = [];
  const executor = createGenerationExecutor({
    fallback(kind, payload) {
      calls.push({ kind, seed: payload?.config?.seed });
      if (calls.length === 1) {
        return { status: "committed", variations: [variation("a"), variation("b")] };
      }
      return { status: "committed", variations: [variation("c"), variation("d"), variation("e")] };
    },
  });

  const result = await executor.run("songVariations", {
    sourceSong: { id: "source-song" },
    config: { seed: "family-seed", genre: "pop" },
  });

  assert.equal(calls.length, 2);
  assert.equal(calls[0].kind, "songVariations");
  assert.equal(calls[0].seed, "family-seed");
  assert.equal(calls[1].seed, "family-seed:variation-set-retry:1");
  assert.equal(result.variations.length, 3);
  assert.deepEqual(result.variations.map(({ id }) => id), ["c", "d", "e"]);
});

test("complete song variation set does not consume the retry budget", async () => {
  let calls = 0;
  const executor = createGenerationExecutor({
    fallback() {
      calls += 1;
      return { status: "committed", variations: [variation("a"), variation("b"), variation("c")] };
    },
  });

  const result = await executor.run("songVariations", {
    sourceSong: { id: "source-song" },
    config: { seed: "complete-seed", genre: "house" },
  });

  assert.equal(calls, 1);
  assert.equal(result.variations.length, 3);
});

test("variation authority still fails closed when both bounded sets are incomplete", async () => {
  let calls = 0;
  const executor = createGenerationExecutor({
    fallback() {
      calls += 1;
      return calls === 1
        ? { status: "committed", variations: [variation("a")] }
        : { status: "committed", variations: [variation("b"), variation("c")] };
    },
  });

  const result = await executor.run("songVariations", {
    sourceSong: { id: "source-song" },
    config: { seed: "unsafe-family", genre: "neoSoul" },
  });

  assert.equal(calls, 2, "variation authority must remain bounded to one whole-set retry");
  assert.equal(result.variations.length, 2);
  assert.deepEqual(result.variations.map(({ id }) => id), ["b", "c"]);
});
