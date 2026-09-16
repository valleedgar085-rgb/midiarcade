import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { createGenerationOwnership } from "../src/core/generation-ownership.js";
import { createGenerationExecutor } from "../src/core/generation-executor.js";

const source = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
function sourceBetween(start, end) {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `application boundary: ${start}`);
  return source.slice(from, to);
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

// Execute the actual application entry points and watchdog with deterministic
// timers and deferred engine responses, without running the musical search.
function appHarness() {
  const state = { song: { id: "accepted" }, history: [], locked: [], generationCount: 0 };
  const timers = new Map();
  const requests = [];
  let nextTimer = 0;
  let disposals = 0;
  let hidden = 0;
  const noop = () => {};
  const context = vm.createContext({
    createGenerationOwnership, state, console: { warn: noop, error: noop },
    appStore: { transaction: (_label, mutate) => mutate(state) },
    setTimeout: (callback) => { timers.set(++nextTimer, callback); return nextTimer; },
    clearTimeout: (id) => timers.delete(id), clearInterval: noop,
    generationExecutor: {
      run() { const request = deferred(); requests.push(request); return request.promise; },
      dispose() { disposals += 1; },
    },
    hideGenerationActivity: () => { hidden += 1; }, showGenerationActivity: noop,
    showToast: noop, resolvePendingShapeDirectorCandidate: noop,
    GENERATION_STATUS_COPY: { new: {}, similar: {}, songVariations: {} },
    player: { stop: noop },
    pushHistory: (snapshot = { song: state.song }) => state.history.push(snapshot),
    createHistorySnapshot: () => ({ song: state.song }),
    restoreHistory: () => { const snapshot = state.history.pop(); if (snapshot) state.song = snapshot.song; },
    createSeed: () => "seed", chooseNewGenrePrograms: noop, buildConfig: () => ({}),
    recentSongsForGeneration: () => [], generationDelay: () => Promise.resolve(),
    preserveLockedTracks: (_song, candidate) => candidate,
    captureResolvedAutoTrackSettings: noop, applyTrackSettingsToSong: (song) => song,
    syncControlsFromSong: noop, captureAppliedGenerationSettings: noop,
    renderAll: noop, scheduleSessionSave: noop, setWorkflowStep: noop,
    editorSection: () => ({ id: "verse", name: "Verse" }),
    deepClone: structuredClone, renderSectionVariationLab: noop,
    TRACK_META: { melody: { name: "Melody" } }, trackRewriteStatus: () => "working",
    buildTrackRerollInput: () => ({}), songTracks: (song) => song?.tracks ?? [],
    trackId: (track) => track.id, renderAttitudeStrip: noop,
  });
  vm.runInContext([
    sourceBetween("let generationSafetyTimer", "function showGenerationActivity"),
    sourceBetween("async function runGeneration(", "function applyElementAutoPrograms"),
    sourceBetween("async function exploreSectionVariations(", "async function auditionSectionVariation"),
    sourceBetween("async function regenerateTrack(", "function randomizeTrackControls"),
  ].join("\n"), context);
  return {
    state, requests, timers, context,
    get disposals() { return disposals; }, get hidden() { return hidden; },
    timeout() { const callback = [...timers.values()][0]; assert.ok(callback); callback(); },
    start(kind) {
      if (kind === "section") return context.exploreSectionVariations();
      if (kind === "track") return context.regenerateTrack("melody");
      return context.runGeneration(kind);
    },
  };
}

for (const kind of ["new", "similar", "songVariations", "section", "track"]) {
  for (const outcome of ["success", "failure"]) {
    test(`${kind}: timed-out ${outcome} cannot overwrite or clean up a newer generation`, async () => {
      const app = appHarness();
      const accepted = app.state.song;
      const first = app.start(kind);
      assert.equal(app.state.isGenerating, true);
      app.timeout();
      assert.equal(app.disposals, 1, "watchdog must stop the old worker");
      assert.equal(app.state.isGenerating, false);
      assert.strictEqual(app.state.song, accepted);
      const second = app.start("new");
      const historyLength = app.state.history.length;
      const hidden = app.hidden;
      const activeTimer = [...app.timers.keys()];
      if (outcome === "success") app.requests[0].resolve({ song: { id: "stale" }, options: [], variations: [] });
      else app.requests[0].reject(new Error("late failure"));
      await first;
      assert.strictEqual(app.state.song, accepted, "old completion must not commit");
      assert.equal(app.state.sectionVariations, undefined);
      assert.equal(app.state.history.length, historyLength, "old error must not pop newer history");
      assert.equal(app.state.isGenerating, true, "old finally must not unlock the newer job");
      assert.equal(app.hidden, hidden, "old finally must not hide the newer progress overlay");
      assert.deepEqual([...app.timers.keys()], activeTimer, "new watchdog must remain armed");
      app.requests[1].resolve({ song: { id: "newest" } });
      await second;
      assert.equal(app.state.song.id, "newest");
      assert.equal(app.state.generationCount, 1);
      assert.equal(app.state.isGenerating, false);
      assert.equal(app.timers.size, 0);
    });
  }
}

test("dispose prevents a queued fallback from starting and permits a fresh run", async () => {
  let calls = 0;
  const executor = createGenerationExecutor({ fallback() { calls += 1; return { song: { id: "fresh" } }; } });
  const first = executor.run("new");
  executor.dispose();
  await assert.rejects(first, /canceled/);
  assert.equal(calls, 0);
  assert.equal((await executor.run("new")).song.id, "fresh");
  assert.equal(calls, 1);
});

test("dispose rejects the result of an already-running fallback", async () => {
  const started = deferred();
  const result = deferred();
  const executor = createGenerationExecutor({ fallback() { started.resolve(); return result.promise; } });
  const work = executor.run("new");
  await started.promise;
  executor.dispose();
  result.resolve({ song: { id: "stale-fallback" } });
  await assert.rejects(work, /canceled/);
});

test("events from a disposed worker cannot terminate its replacement", async () => {
  const workers = [];
  const executor = createGenerationExecutor({
    workerFactory() {
      const listeners = new Map();
      const worker = {
        listeners, messages: [], terminated: false,
        addEventListener(type, listener) { listeners.set(type, listener); },
        postMessage(message) { this.messages.push(message); },
        terminate() { this.terminated = true; },
      };
      workers.push(worker);
      return worker;
    },
    fallback() { throw new Error("unexpected fallback"); },
  });
  const first = executor.run("new");
  executor.dispose();
  await assert.rejects(first, /canceled/);
  const second = executor.run("new");
  workers[0].listeners.get("error")();
  assert.equal(workers[1].terminated, false);
  assert.equal(executor.activeRequests, 1);
  workers[1].listeners.get("message")({ data: {
    requestId: workers[1].messages[0].requestId, ok: true, result: { song: { id: "replacement" } },
  } });
  assert.equal((await second).song.id, "replacement");
  assert.equal(executor.activeRequests, 0);
  executor.dispose();
});
