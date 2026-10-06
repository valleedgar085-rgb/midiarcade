import test from "node:test";
import assert from "node:assert/strict";
import { createPreviewWakeScheduler } from "../src/core/preview-scheduler.js";

test("preview scheduler uses worker wake-ups when available", () => {
  const messages = [];
  const worker = {
    onmessage: null,
    onerror: null,
    postMessage(message) { messages.push(message); },
    terminate() { messages.push({ type: "terminated" }); },
  };
  let ticks = 0;
  const scheduler = createPreviewWakeScheduler({
    intervalMs: 31,
    workerUrl: new URL("https://example.test/preview-scheduler-worker"),
    workerFactory: () => worker,
    onTick: () => { ticks += 1; },
  });

  assert.equal(scheduler.start(), "worker");
  assert.deepEqual(messages[0], { type: "start", intervalMs: 31 });

  worker.onmessage({ data: { type: "tick" } });
  assert.equal(ticks, 1);

  scheduler.stop();
  assert.equal(scheduler.running, false);
  assert.equal(scheduler.mode, "idle");
  assert.deepEqual(messages.slice(-2), [{ type: "stop" }, { type: "terminated" }]);
});

test("preview scheduler fallback is wake-up only and stops cleanly", () => {
  const queued = [];
  const cleared = [];
  let ticks = 0;
  const scheduler = createPreviewWakeScheduler({
    intervalMs: 20,
    workerUrl: null,
    onTick: () => { ticks += 1; },
    setTimeoutFn: (callback, delay) => {
      const token = { callback, delay };
      queued.push(token);
      return token;
    },
    clearTimeoutFn: (token) => { cleared.push(token); },
  });

  assert.equal(scheduler.start(), "fallback");
  assert.equal(queued.length, 1);
  assert.equal(queued[0].delay, 20);

  queued.shift().callback();
  assert.equal(ticks, 1);
  assert.equal(queued.length, 1, "fallback should schedule the next wake-up only after the current tick");

  scheduler.stop();
  assert.equal(scheduler.running, false);
  assert.ok(cleared.length >= 1);
});

test("worker failure falls back without changing scheduler cadence", () => {
  const queued = [];
  const worker = {
    onmessage: null,
    onerror: null,
    postMessage() {},
    terminate() {},
  };
  const scheduler = createPreviewWakeScheduler({
    intervalMs: 17,
    workerUrl: new URL("https://example.test/preview-scheduler-worker"),
    workerFactory: () => worker,
    setTimeoutFn: (callback, delay) => {
      const token = { callback, delay };
      queued.push(token);
      return token;
    },
    clearTimeoutFn: () => {},
  });

  assert.equal(scheduler.start(), "worker");
  worker.onerror(new Error("worker failed"));
  assert.equal(scheduler.mode, "fallback");
  assert.equal(queued.at(-1).delay, 17);
  scheduler.stop();
});
