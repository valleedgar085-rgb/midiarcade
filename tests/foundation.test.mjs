import assert from "node:assert/strict";
import test from "node:test";
import { createAppStore, createInitialAppState } from "../src/core/app-store.js";
import { createGenerationRunner } from "../src/core/generation-runner.js";
import { createGenerationExecutor } from "../src/core/generation-executor.js";
import { appendWithinLimit, compactRecentSongs, HISTORY_LIMIT } from "../src/core/generation-memory.js";
import { applyGenerationTheme, generationTheme } from "../src/core/generation-theme.js";
import { createSessionStorage } from "../src/core/session-storage.js";
import { createWorkspaceController } from "../src/ui/workspace-controller.js";
import { createRenderCoordinator } from "../src/ui/render-coordinator.js";
import { createPlaybackView, shouldRefreshPlaybackDetails } from "../src/ui/playback-view.js";

test("app store creates isolated state and reports named transactions", () => {
  const first = createInitialAppState();
  const second = createInitialAppState();
  assert.notStrictEqual(first.tasteProfile, second.tasteProfile);
  assert.equal(first.activeWorkspace, "create");

  const store = createAppStore(first);
  const events = [];
  const unsubscribe = store.subscribe((event) => events.push([event.label, event.revision]));
  store.transaction("generation:commit", (state) => {
    state.generationCount += 1;
  });
  unsubscribe();

  assert.equal(store.getState().generationCount, 1);
  assert.equal(store.getRevision(), 1);
  assert.deepEqual(events, [["generation:commit", 1]]);
});

test("session storage isolates JSON access and rejects stale schemas", () => {
  const values = new Map();
  const storage = {
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
  const sessions = createSessionStorage({
    key: "studio/session",
    schema: 3,
    storageProvider: () => storage,
  });

  assert.equal(sessions.load().status, "empty");
  assert.equal(sessions.save({ schema: 3, song: { id: "idea" } }).ok, true);
  assert.deepEqual(sessions.load(), {
    status: "ready",
    value: { schema: 3, song: { id: "idea" } },
  });
  values.set("studio/session", JSON.stringify({ schema: 2 }));
  assert.equal(sessions.load().status, "invalid");
  assert.equal(sessions.discard(), true);
  assert.equal(values.has("studio/session"), false);
});

test("generation memory keeps bounded undo state and compacts scored recent songs", () => {
  let history = [];
  for (let index = 0; index < 12; index += 1) history = appendWithinLimit(history, { index });
  assert.equal(history.length, HISTORY_LIMIT);
  assert.deepEqual(history.map(({ index }) => index), [6, 7, 8, 9, 10, 11]);

  const fullSong = {
    id: "song-one",
    seed: "one",
    title: "One",
    meta: { ideaFingerprint: { version: 2, motifContour: [0, 2, 1] } },
    tracks: [{ id: "melody", notes: Array.from({ length: 200 }, (_, pitch) => ({ pitch })) }],
  };
  const compact = compactRecentSongs([fullSong, fullSong]);
  assert.equal(compact.length, 1);
  assert.deepEqual(compact[0].tracks, []);
  assert.equal(compact[0].meta.ideaFingerprint, fullSong.meta.ideaFingerprint);
});

test("generation runner commits one complete result and rejects overlapping runs", async () => {
  let resolveGeneration;
  const runner = createGenerationRunner({
    generateNew: () => new Promise((resolve) => { resolveGeneration = resolve; }),
    generateSimilar: (song) => ({ ...song, revision: song.revision + 1 }),
    validate: (song) => Array.isArray(song?.tracks),
  });

  const first = runner.generate("new", { config: { seed: "one" } });
  const overlap = await runner.generate("new", { config: { seed: "two" } });
  assert.equal(overlap.status, "busy");
  resolveGeneration({ id: "song-one", tracks: [] });
  assert.deepEqual(await first, {
    status: "committed",
    song: { id: "song-one", tracks: [] },
  });
  assert.equal(runner.running, false);
});

test("generation executor uses a module worker and falls back when workers are unavailable", async () => {
  const listeners = new Map();
  const messages = [];
  const fakeWorker = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    postMessage(message) {
      messages.push(message);
      queueMicrotask(() => listeners.get("message")?.({
        data: {
          requestId: message.requestId,
          ok: true,
          result: { status: "committed", song: { id: "worker-song" } },
        },
      }));
    },
    terminate() {},
  };
  const workerExecutor = createGenerationExecutor({
    workerFactory: () => fakeWorker,
    fallback: () => ({ status: "committed", song: { id: "fallback-song" } }),
  });
  assert.deepEqual(await workerExecutor.run("new", { config: { seed: "worker" } }), {
    status: "committed",
    song: { id: "worker-song" },
  });
  assert.equal(messages[0].kind, "new");
  assert.equal(workerExecutor.activeRequests, 0);
  assert.equal(workerExecutor.usingWorker, true);

  const fallbackExecutor = createGenerationExecutor({
    workerFactory: () => { throw new Error("unsupported"); },
    fallback: (kind) => ({ status: "committed", song: { id: `${kind}-fallback` } }),
  });
  assert.deepEqual(await fallbackExecutor.run("similar"), {
    status: "committed",
    song: { id: "similar-fallback" },
  });
  assert.equal(fallbackExecutor.usingWorker, false);
});

test("generation executor recovers the same request when a running worker fails", async () => {
  const listeners = new Map();
  const failedWorker = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    postMessage() { queueMicrotask(() => listeners.get("error")?.(new Error("worker crashed"))); },
    terminate() {},
  };
  const executor = createGenerationExecutor({
    workerFactory: () => failedWorker,
    fallback: (kind, payload) => ({
      status: "committed",
      song: { id: `${kind}-${payload.config.seed}` },
    }),
  });
  assert.deepEqual(await executor.run("new", { config: { seed: "recovered" } }), {
    status: "committed",
    song: { id: "new-recovered" },
  });
  assert.equal(executor.activeRequests, 0);
  assert.equal(executor.usingWorker, false);
});

test("generation executor recovers worker-declared errors without double-settling", async () => {
  const listeners = new Map();
  let fallbackCalls = 0;
  const rejectedWorker = {
    addEventListener(type, listener) { listeners.set(type, listener); },
    postMessage(message) {
      queueMicrotask(() => listeners.get("message")?.({
        data: { requestId: message.requestId, ok: false, error: "stale worker module" },
      }));
    },
    terminate() {},
  };
  const executor = createGenerationExecutor({
    workerFactory: () => rejectedWorker,
    fallback: (kind) => {
      fallbackCalls += 1;
      return { status: "committed", song: { id: `${kind}-safe` } };
    },
  });
  assert.deepEqual(await executor.run("new"), {
    status: "committed",
    song: { id: "new-safe" },
  });
  assert.equal(fallbackCalls, 1);
  assert.equal(executor.activeRequests, 0);
});

test("generation themes are deterministic, varied, and apply readable design tokens", () => {
  const first = generationTheme({ id: "one", seed: "alpha", genre: "rock", key: "E" });
  const repeated = generationTheme({ id: "one", seed: "alpha", genre: "rock", key: "E" });
  const alternatives = Array.from({ length: 12 }, (_, index) => (
    generationTheme({ id: `song-${index}`, seed: `seed-${index}`, genre: "country", key: "G" })
  ));
  assert.deepEqual(first, repeated);
  assert.ok(new Set(alternatives.map(({ id }) => id)).size >= 4);
  assert.ok(new Set(alternatives.map(({ pattern }) => pattern)).size >= 4);

  const properties = new Map();
  const root = {
    dataset: {},
    style: { setProperty(name, value) { properties.set(name, value); } },
  };
  assert.equal(applyGenerationTheme(root, { id: "one", seed: "alpha" }).id, root.dataset.generationTheme);
  assert.match(properties.get("--accent"), /^#[0-9a-f]{6}$/i);
  assert.match(properties.get("--bg"), /^#[0-9a-f]{6}$/i);
  assert.ok(root.dataset.generationPattern);
});

function mockWorkspaceElement(dataset = {}) {
  const classes = new Set();
  const listeners = new Map();
  return {
    dataset,
    hidden: false,
    tabIndex: 0,
    attributes: new Map(),
    classList: {
      toggle(name, force) {
        force ? classes.add(name) : classes.delete(name);
      },
      contains(name) {
        return classes.has(name);
      },
    },
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    },
    focus() {
      this.focused = true;
    },
    dispatch(type, event = {}) {
      listeners.get(type)?.({ preventDefault() {}, ...event });
    },
  };
}

test("workspace controller owns accessible tab and panel state", () => {
  const buttons = ["create", "arrange", "mix", "finish"].map((workspace) => (
    mockWorkspaceElement({ workspace })
  ));
  const panels = ["create", "arrange", "mix", "finish"].map((workspacePanel) => (
    mockWorkspaceElement({ workspacePanel })
  ));
  const changes = [];
  const root = {
    querySelectorAll(selector) {
      return selector === "[data-workspace]" ? buttons : panels;
    },
  };
  const controller = createWorkspaceController({
    root,
    onChange: (workspace) => changes.push(workspace),
  });

  controller.bind();
  buttons[2].dispatch("click");
  assert.equal(controller.activeWorkspace, "mix");
  assert.equal(buttons[2].attributes.get("aria-selected"), "true");
  assert.equal(buttons[0].attributes.get("aria-selected"), "false");
  assert.equal(panels[2].hidden, false);
  assert.equal(panels[0].hidden, true);
  buttons[2].dispatch("keydown", { key: "ArrowRight" });
  assert.equal(controller.activeWorkspace, "finish");
  assert.equal(buttons[3].focused, true);
  assert.deepEqual(changes, ["mix", "finish"]);
});

test("render coordinator deduplicates targeted regions and exposes measurable cycles", () => {
  const calls = [];
  const coordinator = createRenderCoordinator({
    summary: () => calls.push("summary"),
    timeline: () => calls.push("timeline"),
    tracks: () => calls.push("tracks"),
  });

  assert.deepEqual(coordinator.render("timeline", "timeline", "tracks"), ["timeline", "tracks"]);
  assert.deepEqual(calls, ["timeline", "tracks"]);
  assert.deepEqual(coordinator.snapshot(), {
    cycles: 1,
    counts: { summary: 0, timeline: 1, tracks: 1 },
  });

  coordinator.renderAll();
  assert.deepEqual(calls, ["timeline", "tracks", "summary", "timeline", "tracks"]);
  assert.deepEqual(coordinator.snapshot(), {
    cycles: 2,
    counts: { summary: 1, timeline: 2, tracks: 2 },
  });
});

test("playback view caches section lookup and adaptive detail cadence", () => {
  const view = createPlaybackView({
    bpm: 120,
    beatsPerBar: 4,
    bars: 8,
    sections: [
      { id: "verse", name: "Verse", start: 0, bars: 4 },
      { id: "hook", name: "Hook", start: 4, bars: 4 },
    ],
  });

  assert.equal(view.sectionAtSeconds(0).id, "verse");
  assert.equal(view.sectionAtSeconds(7.99).id, "verse");
  assert.equal(view.sectionAtSeconds(8).id, "hook");
  assert.equal(view.sectionAtBeat(31.99).id, "hook");
  assert.equal(shouldRefreshPlaybackDetails(-Infinity, 0, 250), true);
  assert.equal(shouldRefreshPlaybackDetails(1, 1.249, 250), false);
  assert.equal(shouldRefreshPlaybackDetails(1, 1.25, 250), true);
});
