import assert from "node:assert/strict";
import test from "node:test";
import { createAppGenerationFallback } from "../src/core/app-generation-fallback.js";

test("app generation fallback preserves runner semantics for new and similar", async () => {
  const calls = [];
  const generationRunner = {
    generate(kind, payload) {
      calls.push([kind, payload]);
      return Promise.resolve({ status: "committed", song: { id: `${kind}-song` } });
    },
  };
  const fallback = createAppGenerationFallback({
    generationRunner,
    runRequest() {
      throw new Error("variation API should not run for new/similar");
    },
  });

  assert.deepEqual(await fallback("new", { config: { seed: "one" } }), {
    status: "committed",
    song: { id: "new-song" },
  });
  assert.deepEqual(await fallback("similar", { sourceSong: { id: "source" }, config: { seed: "two" } }), {
    status: "committed",
    song: { id: "similar-song" },
  });
  assert.deepEqual(calls, [
    ["new", { sourceSong: undefined, config: { seed: "one" } }],
    ["similar", { sourceSong: { id: "source" }, config: { seed: "two" } }],
  ]);
});

test("app generation fallback sends variation requests through the shared API", async () => {
  const requests = [];
  const fallback = createAppGenerationFallback({
    generationRunner: { generate() { throw new Error("runner should not handle variations"); } },
    runRequest(kind, payload) {
      requests.push([kind, payload]);
      return kind === "sectionVariations"
        ? { status: "committed", options: [{ id: "section-a" }] }
        : { status: "committed", variations: [{ id: "song-a" }] };
    },
  });

  const sectionPayload = { sourceSong: { id: "source" }, sectionId: "chorus", input: { intensity: 0.8 } };
  const songPayload = { sourceSong: { id: "source" }, config: { seed: "variation" } };
  assert.deepEqual(await fallback("sectionVariations", sectionPayload), {
    status: "committed",
    options: [{ id: "section-a" }],
  });
  assert.deepEqual(await fallback("songVariations", songPayload), {
    status: "committed",
    variations: [{ id: "song-a" }],
  });
  assert.deepEqual(requests, [
    ["sectionVariations", sectionPayload],
    ["songVariations", songPayload],
  ]);
});

test("app generation fallback rejects malformed dependencies", () => {
  assert.throws(() => createAppGenerationFallback(), /generation runner/);
  assert.throws(() => createAppGenerationFallback({ generationRunner: { generate() {} }, runRequest: null }), /generation request function/);
});
