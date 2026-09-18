import assert from "node:assert/strict";
import test from "node:test";

import { createAppStore, createInitialAppState } from "../src/core/app-store.js";
import { createGenerationRunner } from "../src/core/generation-runner.js";
import {
  acceptShapeCandidate,
  createShapeCandidate,
} from "../src/core/shape-director-engine.js";
import { createWorkspaceController } from "../src/ui/workspace-controller.js";

function note(id, start, pitch, velocity = 88, duration = 0.5) {
  return { id, start, pitch, velocity, duration };
}

function sourceSong() {
  return {
    id: "track-a1-parent",
    title: "Track A1 Parent",
    seed: "track-a1-parent",
    meta: { key: "A", mode: "minor", tempo: 96, bars: 4, beatsPerBar: 4, totalBeats: 16 },
    settings: { bars: 4, chordPath: "Am-F-C-G" },
    structure: [
      { id: "verse", name: "Verse", startBeat: 0, endBeat: 8, bars: 2 },
      { id: "chorus", name: "Chorus", startBeat: 8, endBeat: 16, bars: 2 },
    ],
    tracks: [
      { id: "drums", notes: [note("d1", 0, 36, 105, 0.25), note("d2", 1, 38, 100, 0.25)] },
      { id: "bass", notes: [note("b1", 0, 45), note("b2", 2, 48)] },
      { id: "chords", notes: [note("c1", 0, 57, 78, 2), note("c2", 4, 53, 80, 2)] },
      {
        id: "melody",
        notes: [
          note("m1", 0, 69, 84), note("m2", 1, 72, 86), note("m3", 2, 76, 88), note("m4", 3, 72, 90),
          note("m5", 4, 69, 85), note("m6", 5, 72, 87), note("m7", 6, 76, 89), note("m8", 7, 72, 91),
          note("m9", 8, 76, 96), note("m10", 9, 79, 99),
        ],
      },
      { id: "counterpoint", notes: [note("cp1", 4, 76, 76)] },
      { id: "pad", notes: [note("p1", 0, 57, 68, 4)] },
    ],
  };
}

function qualityCandidate(id, source) {
  return {
    ...structuredClone(source),
    id,
    seed: id,
    meta: {
      ...structuredClone(source.meta),
      scoreDetails: {
        totalScore: 92,
        subscores: {
          groove: 92,
          transitions: 91,
          harmony: 93,
          phraseResolution: 92,
          hook: 92,
          arrangement: 91,
          production: 92,
          performance: 92,
        },
        balance: { balanceScore: 92 },
        releaseGate: { passed: true },
      },
    },
  };
}

function mockWorkspaceElement(dataset = {}) {
  const classes = new Set();
  return {
    dataset,
    hidden: false,
    tabIndex: 0,
    attributes: new Map(),
    classList: {
      toggle(name, force) {
        force ? classes.add(name) : classes.delete(name);
      },
    },
    addEventListener() {},
    setAttribute(name, value) {
      this.attributes.set(name, String(value));
    },
  };
}

function workspaceRoot() {
  const buttons = ["create", "arrange", "mix", "finish"].map((workspace) => mockWorkspaceElement({ workspace }));
  const panels = ["create", "arrange", "mix", "finish"].map((workspacePanel) => mockWorkspaceElement({ workspacePanel }));
  return {
    querySelectorAll(selector) {
      return selector === "[data-workspace]" ? buttons : panels;
    },
  };
}

test("Track A1 keeps one committed song through Create -> Shape -> Mix -> Finish -> Create -> Similar", async () => {
  const state = createInitialAppState();
  const store = createAppStore(state);
  const parent = sourceSong();

  store.transaction("generation:new-commit", (draft) => {
    draft.song = parent;
  });

  const controller = createWorkspaceController({
    root: workspaceRoot(),
    onChange(workspace) {
      store.transaction("workspace:change", (draft) => {
        draft.activeWorkspace = workspace;
      });
    },
  });
  controller.bind();
  assert.equal(state.activeWorkspace, "create");
  assert.strictEqual(state.song, parent);

  controller.activate("arrange");
  const transaction = createShapeCandidate(state.song, {
    selection: { target: "track", sectionId: "verse", trackId: "melody" },
    size: "reshape",
    direction: "harder",
  }, { seed: "track-a1-accepted-shape" });

  assert.equal(transaction.status, "candidate");
  assert.strictEqual(state.song, parent, "staging Shape must not replace the canonical song");

  const accepted = acceptShapeCandidate(transaction);
  store.transaction("shape:accept", (draft) => {
    draft.history.push({ song: structuredClone(draft.song) });
    draft.future = [];
    draft.song = accepted;
  });

  assert.strictEqual(state.song, accepted, "Accept must establish the new canonical song");
  assert.deepEqual(state.history[0].song, parent);
  assert.notDeepEqual(state.song, parent);

  for (const workspace of ["mix", "finish", "create"]) {
    controller.activate(workspace);
    assert.equal(state.activeWorkspace, workspace);
    assert.strictEqual(state.song, accepted, `${workspace} navigation must not fork or replace canonical song state`);
  }

  let receivedSource = null;
  const runner = createGenerationRunner({
    generateNew: () => qualityCandidate("unused-new", state.song),
    generateSimilar(source) {
      receivedSource = source;
      return qualityCandidate("track-a1-similar", source);
    },
  });

  const similarSource = state.song;
  const result = await runner.generate("similar", {
    sourceSong: similarSource,
    config: { seed: "track-a1-similar" },
  });

  assert.equal(result.status, "committed");
  assert.strictEqual(receivedSource, accepted, "Similar must branch from the accepted Shape song after the workspace round trip");

  store.transaction("generation:similar-commit", (draft) => {
    draft.history.push({ song: structuredClone(draft.song) });
    draft.future = [];
    draft.song = result.song;
  });

  assert.equal(state.song.id, "track-a1-similar");
  assert.equal(state.history.length, 2);
  assert.deepEqual(state.history[1].song, accepted, "the Similar commit must preserve the accepted Shape snapshot as its immediate Undo state");

  const undoSimilar = state.history.pop().song;
  state.future.push({ song: structuredClone(state.song) });
  state.song = undoSimilar;
  assert.deepEqual(state.song, accepted, "first Undo must return to the accepted Shape song");

  const undoShape = state.history.pop().song;
  state.song = undoShape;
  assert.deepEqual(state.song, parent, "second Undo must return to the pre-Shape parent");
});
