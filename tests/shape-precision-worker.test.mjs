import assert from "node:assert/strict";
import test from "node:test";
import { Worker } from "node:worker_threads";
import { createGenerationExecutor } from "../src/core/generation-executor.js";
import { createAppGenerationFallback } from "../src/core/app-generation-fallback.js";
import { createShapeCandidate } from "../src/core/shape-director-engine.js";

test("precision Shape worker and real app fallback return the same uncommitted replayable transaction", async () => {
  const sourceSong = { id: "worker-precision", meta: { beatsPerBar: 4, totalBeats: 8 },
    structure: [{ id: "verse", startBeat: 0, endBeat: 8, bars: 2 }],
    tracks: [{ id: "drums", notes: [{ start: 0.5, pitch: 42, velocity: 80, duration: 0.1 }] }] };
  const payload = { sourceSong, intent: { selection: { target: "track", sectionId: "verse", trackId: "drums" }, direction: "hatAccents" }, seed: "worker-seed" };
  const original = structuredClone(payload);
  let persistence = 0;
  const fallback = createAppGenerationFallback({ generationRunner: { generate() { throw new Error("Not a new song"); } } });
  const worker = new Worker(new URL("../scripts/lib/generation-matrix-worker.mjs", import.meta.url));
  const executor = createGenerationExecutor({ fallback, persistGeneration: () => { persistence += 1; }, workerFactory: () => ({
    addEventListener(type, fn) { worker.on(type, type === "message" ? (data) => fn({ data }) : fn); },
    postMessage(message) { worker.postMessage(message); }, terminate() { void worker.terminate(); },
  }) });
  try {
    const direct = createShapeCandidate(sourceSong, payload.intent, { seed: payload.seed });
    const actual = await executor.run("shapeCandidate", payload);
    assert.equal(executor.usingWorker, true);
    assert.equal(actual.status, "candidate");
    assert.deepEqual(actual.transaction, direct);
    assert.deepEqual(await fallback("shapeCandidate", payload), actual);
    assert.deepEqual((await executor.run("shapeCandidate", payload)).transaction, direct);
    assert.deepEqual(payload, original);
    assert.equal(persistence, 0, "auditions cannot persist as accepted generations");
    assert.equal(executor.diagnosticsSnapshot().at(-1).status, "candidate");
  } finally {
    executor.dispose();
    await worker.terminate();
  }
});
