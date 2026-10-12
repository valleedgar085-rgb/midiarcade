import assert from "node:assert/strict";
import test from "node:test";

import { createAppGenerationFallback } from "../src/core/app-generation-fallback.js";
import { runGenerationRequest } from "../src/core/generation-api.js";
import { createGenerationExecutor } from "../src/core/generation-executor.js";
import { createGenerationRunner } from "../src/core/generation-runner.js";
import { generateNew, generateSimilar } from "../src/music-engine.js";

function createFallback() {
  return createAppGenerationFallback({
    generationRunner: createGenerationRunner({
      generateNew,
      generateSimilar,
      validate: (song) => Array.isArray(song?.tracks) && song.tracks.length > 0,
    }),
  });
}

function createInProcessWorker() {
  const listeners = new Map();
  return {
    addEventListener(type, handler) { listeners.set(type, handler); },
    postMessage(message) {
      queueMicrotask(() => {
        try {
          const result = runGenerationRequest(message.kind, structuredClone(message.payload));
          listeners.get("message")?.({
            data: { requestId: message.requestId, ok: true, result: structuredClone(result) },
          });
        } catch (error) {
          listeners.get("message")?.({
            data: { requestId: message.requestId, ok: false, error: error?.message },
          });
        }
      });
    },
    terminate() {},
  };
}

function musicalSnapshot(song) {
  return {
    structure: song.structure,
    harmony: song.harmony,
    tracks: song.tracks,
    grooveConductor: song.grooveConductor,
  };
}

test("seeded compositions retain identical musical state across worker and fallback paths", async () => {
  const config = {
    seed: "professionalization-worker-fallback-parity-v1",
    genre: "pop",
    bars: 8,
    energy: 0.64,
    complexity: 0.56,
    variation: 0.48,
    evolution: 0.6,
  };
  const workerExecutor = createGenerationExecutor({
    fallback: createFallback(),
    workerFactory: createInProcessWorker,
  });
  const fallbackExecutor = createGenerationExecutor({
    fallback: createFallback(),
    workerFactory: () => { throw new Error("Web Workers unavailable"); },
  });

  try {
    const workerResult = await workerExecutor.run("new", { config });
    const fallbackResult = await fallbackExecutor.run("new", { config });
    assert.equal(workerResult.status, "committed");
    assert.equal(fallbackResult.status, "committed");
    assert.equal(workerExecutor.usingWorker, true);
    assert.equal(fallbackExecutor.usingWorker, false);
    assert.deepEqual(musicalSnapshot(workerResult.song), musicalSnapshot(fallbackResult.song));
  } finally {
    workerExecutor.dispose();
    fallbackExecutor.dispose();
  }
});
