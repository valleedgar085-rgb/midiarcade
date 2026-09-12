import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPersistedSessionState,
  createPersistedSessionSnapshot,
  createSessionAutosaveController,
  decodePersistedSession,
} from "../src/core/session-runtime.js";

const TRACK_ORDER = ["drums"];
const DEFAULTS = {
  drums: {
    density: 68,
    variation: 36,
    octave: 0,
    program: 1,
    volume: 0.8,
    velocity: 1,
    pan: 0,
    reverb: 0.2,
    cutoff: 8000,
    resonance: 0.2,
    gate: 0.9,
    humanize: 0.7,
    feel: 0.7,
    waveform: "triangle",
    synthCutoff: 3500,
    synthResonance: 1.2,
    attack: 0.01,
    release: 0.25,
    detune: 0,
    attitude: "neutral",
  },
};

function song() {
  return {
    meta: { totalBeats: 4, tempo: 96 },
    tracks: [{
      id: "drums",
      notes: [{ pitch: 36, start: 0, duration: 0.25, velocity: 100 }],
    }],
  };
}

test("session snapshots preserve the app persistence contract", () => {
  const snapshot = createPersistedSessionSnapshot({
    song: song(),
    trackSettings: DEFAULTS,
    muted: new Set(["drums"]),
    solo: new Set(),
    locked: new Set(["drums"]),
    autoControls: new Set(["energy"]),
    selectedTrack: "drums",
    guidedMode: true,
    recipeIndex: 2,
    mixAssistant: { enabled: true },
    tasteProfile: { likes: 3 },
  }, {
    schema: 2,
    now: () => new Date("2026-09-12T03:00:00.000Z"),
    normalizeMixAssistant: (value) => ({ enabled: Boolean(value?.enabled), normalized: true }),
  });

  assert.equal(snapshot.schema, 2);
  assert.equal(snapshot.savedAt, "2026-09-12T03:00:00.000Z");
  assert.deepEqual(snapshot.muted, ["drums"]);
  assert.deepEqual(snapshot.locked, ["drums"]);
  assert.deepEqual(snapshot.mixAssistant, { enabled: true, normalized: true });
});

test("session decode rejects corruption and sanitizes restored state", () => {
  const invalid = decodePersistedSession({ status: "ready", value: { schema: 2, song: null } }, {
    schema: 2,
    trackOrder: TRACK_ORDER,
    defaultTrackSettings: DEFAULTS,
    genreIds: ["hipHop"],
  });
  assert.equal(invalid.status, "rejected");

  const decoded = decodePersistedSession({
    status: "ready",
    value: {
      schema: 2,
      song: song(),
      trackSettings: { drums: { density: 999, program: -10 } },
      muted: ["drums", "ghost"],
      solo: ["ghost"],
      locked: ["drums"],
      autoControls: ["energy", 12, "x".repeat(90)],
      selectedTrack: "ghost",
      guidedMode: false,
      recipeIndex: 99,
      mixAssistant: { enabled: 1 },
      tasteProfile: { likes: 2, genreVotes: { hipHop: 3, fake: 7 } },
    },
  }, {
    schema: 2,
    trackOrder: TRACK_ORDER,
    defaultTrackSettings: DEFAULTS,
    genreIds: ["hipHop"],
    recipeCount: 3,
    normalizeMixAssistant: (value) => ({ enabled: Boolean(value?.enabled) }),
  });

  assert.equal(decoded.status, "ready");
  assert.deepEqual([...decoded.value.muted], ["drums"]);
  assert.deepEqual([...decoded.value.solo], []);
  assert.equal(decoded.value.selectedTrack, "drums");
  assert.equal(decoded.value.guidedMode, false);
  assert.equal(decoded.value.recipeIndex, 2);
  assert.equal(decoded.value.trackSettings.drums.density, 100);
  assert.equal(decoded.value.trackSettings.drums.program, 0);
  assert.deepEqual(decoded.value.tasteProfile.genreVotes, { hipHop: 3 });

  const target = {};
  assert.equal(applyPersistedSessionState(target, decoded.value), true);
  assert.equal(target.song.meta.tempo, 96);
});

test("autosave controller coalesces pending saves and reports device persistence", () => {
  const calls = [];
  let pending;
  let timerId = 0;
  const storage = {
    save(value) {
      calls.push(["save", value.schema]);
      return { ok: true };
    },
    discard() {
      calls.push(["discard"]);
      return true;
    },
  };
  const controller = createSessionAutosaveController({
    storage,
    snapshot: () => ({ schema: 2, song: song() }),
    onSaved: () => calls.push(["saved"]),
    defer: (task) => task(),
    setTimer(task, delay) {
      pending = task;
      calls.push(["timer", delay]);
      return ++timerId;
    },
    clearTimer(id) {
      calls.push(["clear", id]);
    },
  });

  controller.schedule();
  controller.schedule();
  assert.deepEqual(calls.slice(0, 3), [["timer", 400], ["clear", 1], ["timer", 400]]);
  pending();
  assert.deepEqual(calls.slice(-2), [["save", 2], ["saved"]]);
  assert.equal(controller.discard(), true);
  assert.deepEqual(calls.at(-1), ["discard"]);
});
