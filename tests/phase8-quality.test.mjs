import test from "node:test";
import assert from "node:assert/strict";
import { resumePreviewEvent, shouldDeferPreviewEvent } from "../src/core/preview-continuity.js";
import { musicalIdentity, musicalIdentitySimilarity, scoreCandidateChoice } from "../src/core/candidate-choice.js";
import { createGenerationExecutor } from "../src/core/generation-executor.js";
import { generateNew, evaluateSongReleaseGate } from "../src/music-engine.js";

test("resumed notes interpolate expression, retain pitch, and do not replay the full note", () => {
  const event = { id: "pad", pitch: 60, time: 1, duration: 8, glideDuration: 0.2, expressionCurve: [{ offset: 0, value: 1 }, { offset: 8, value: 0.6 }] };
  const result = resumePreviewEvent(event, 5);
  assert.equal(result.pitch, 60);
  assert.equal(result.duration, 4);
  assert.equal(result.glideDuration, 0);
  assert.equal(result.expressionCurve[0].value, 0.8);
  assert.deepEqual(result.expressionCurve[1], { offset: 4, value: 0.6 });
  assert.equal(event.duration, 8, "source composition must not be mutated");
  assert.equal(resumePreviewEvent(event, 10), null);
  assert.equal(resumePreviewEvent({ ...event, id: "drums" }, 5), null);
});

test("voice pressure only defers future notes; due beats are still scheduled", () => {
  const profile = { maxScheduledVoices: 48, scheduleIntervalMs: 45 };
  assert.equal(shouldDeferPreviewEvent(2.5, 2, 48, profile), true);
  assert.equal(shouldDeferPreviewEvent(2.04, 2, 48, profile), false);
  assert.equal(shouldDeferPreviewEvent(2.5, 2, 47, profile), false);
});

test("musical identity ignores transposition/timbre and recognizes genuinely different phrases", () => {
  const make = (pitches) => ({ tracks: [{ id: "melody", notes: pitches.map((pitch, index) => ({ pitch, start: index / 2, duration: 0.4 })) }] });
  const original = make([60, 64, 62, 67, 60, 64, 62, 67]);
  const transposed = make([62, 66, 64, 69, 62, 66, 64, 69]);
  assert.equal(musicalIdentitySimilarity(musicalIdentity(original), musicalIdentity(transposed)), 1);
  assert.equal(musicalIdentitySimilarity(musicalIdentity(original), musicalIdentity(make([60, 62, 64, 65, 67, 65, 64, 60]))), 0);
});

test("chooser prefers distinct, harmonically coherent ideas over near-identical phrases", () => {
  const evaluation = { score: 93, subscores: { harmonic: 97, phraseResolution: 88 } };
  const balance = { balanceScore: 82, creativeFloor: 75 };
  const repeated = scoreCandidateChoice(evaluation, balance, { compared: 2, score: 50, musicalSimilarity: 0.95 }, "new");
  const fresh = scoreCandidateChoice(evaluation, balance, { compared: 2, score: 50, musicalSimilarity: 0.1 }, "new");
  assert.ok(fresh > repeated);
  const unresolved = scoreCandidateChoice({ ...evaluation, subscores: { harmonic: 70, phraseResolution: 60 } }, balance, { compared: 2, score: 50, musicalSimilarity: 0.1 }, "new");
  assert.ok(fresh > unresolved);
});

test("worker failure never reruns heavy generation on the UI when fallback is disabled", async () => {
  let fallbackCalls = 0;
  const listeners = new Map();
  const executor = createGenerationExecutor({
    allowFallback: false,
    workerFactory: () => ({
      addEventListener: (type, fn) => listeners.set(type, fn), terminate() {},
      postMessage: () => queueMicrotask(() => listeners.get("error")()),
    }),
    fallback: () => { fallbackCalls += 1; },
  });
  await assert.rejects(executor.run("new"), /previous song is safe/);
  assert.equal(fallbackCalls, 0);
  assert.equal(executor.activeRequests, 0);
});

test("cancel rejects the owning request, ignores late replies and permits a fresh worker", async () => {
  const workers = [];
  const progress = [];
  const executor = createGenerationExecutor({
    allowFallback: false, fallback() { throw new Error("UI fallback forbidden"); },
    onProgress: (value) => progress.push(value),
    workerFactory: () => {
      const listeners = new Map();
      const worker = { listeners, addEventListener: (type, fn) => listeners.set(type, fn), postMessage(message) { this.message = message; }, terminate() {} };
      workers.push(worker);
      return worker;
    },
  });
  const first = executor.run("new");
  const rejected = assert.rejects(first, /canceled/);
  await assert.rejects(executor.run("new"), /already running/);
  executor.cancel();
  await rejected;
  const second = executor.run("new");
  const old = workers[0];
  old.listeners.get("message")({ data: { requestId: old.message.requestId, ok: true, result: "old" } });
  assert.equal(executor.activeRequests, 1);
  const current = workers[1];
  current.listeners.get("message")({ data: { requestId: current.message.requestId, type: "progress", progress: { completed: 2 } } });
  assert.deepEqual(progress, [{ completed: 2 }]);
  assert.equal(executor.activeRequests, 1, "progress must not consume the response slot");
  current.listeners.get("message")({ data: { requestId: current.message.requestId, ok: true, result: "new" } });
  assert.equal(await second, "new");
  executor.dispose();
});

test("candidate progress is real, bounded and leaves deterministic composition untouched", () => {
  const events = [];
  const config = { seed: "phase8-progress", bars: 8, genre: "trap", key: "D", scale: "minor", candidateCount: 3 };
  const song = generateNew(config, { onProgress: (progress) => events.push(progress) });
  assert.deepEqual(events.map((event) => event.completed), [1, 2, 3]);
  assert.deepEqual(song, generateNew(config));
  assert.ok(evaluateSongReleaseGate(song).passed);
  const broken = structuredClone(song);
  // D minor excludes D#/Eb. Final-check metadata is intentionally left intact.
  broken.tracks.find((track) => track.id === "melody").notes[0].pitch = 63;
  const gate = evaluateSongReleaseGate(broken, song.meta.scoreDetails);
  assert.ok(gate.failures.includes("scale-safety"));
});
