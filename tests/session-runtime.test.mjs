import assert from "node:assert/strict";
import test from "node:test";
import {
  applyPersistedSessionState,
  createPersistedSessionSnapshot,
  createSessionAutosaveController,
  decodePersistedSession,
} from "../src/core/session-runtime.js";
import {
  applyGenerationPreferences,
  captureGenerationPreferences,
  deferEmptyCanvasFacts,
  syncAutoPresentation,
} from "../src/ui/session-preferences.js";

const SESSION_UI = {
  applyGenerationPreferences,
  syncAutoPresentation,
  deferEmptyCanvasFacts,
};

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

test("session snapshots preserve preferences even before a song exists", () => {
  const previousDocument = globalThis.document;
  globalThis.document = {
    getElementById(id) {
      return ({
        tempoControl: { value: "102" },
        keyControl: { value: "F#" },
      })[id] ?? null;
    },
  };
  try {
    const snapshot = createPersistedSessionSnapshot({
      song: null,
      trackSettings: DEFAULTS,
      muted: new Set(["drums"]),
      solo: new Set(),
      locked: new Set(["drums"]),
      autoControls: new Set(["energyControl"]),
      selectedTrack: "drums",
      guidedMode: true,
      recipeIndex: 2,
      mixAssistant: { enabled: true },
      tasteProfile: { likes: 3 },
    }, {
      schema: 2,
      now: () => new Date("2026-09-12T03:00:00.000Z"),
      normalizeMixAssistant: (value) => ({ enabled: Boolean(value?.enabled), normalized: true }),
      captureGenerationPreferences,
    });

    assert.equal(snapshot.schema, 2);
    assert.equal("song" in snapshot, false, "session snapshots should not spend storage on an inactive song payload");
    assert.equal(snapshot.savedAt, "2026-09-12T03:00:00.000Z");
    assert.deepEqual(snapshot.muted, ["drums"]);
    assert.deepEqual(snapshot.locked, ["drums"]);
    assert.deepEqual(snapshot.mixAssistant, { enabled: true, normalized: true });
    assert.equal(snapshot.generationPreferences.tempoControl, "102");
    assert.equal(snapshot.generationPreferences.keyControl, "F#");
  } finally {
    globalThis.document = previousDocument;
  }
});

test("first-run decode starts empty with supported controls automatic", () => {
  const decoded = decodePersistedSession({ status: "empty", value: null }, {
    schema: 2,
    trackOrder: TRACK_ORDER,
    defaultTrackSettings: DEFAULTS,
    genreIds: ["hipHop"],
  });
  assert.equal(decoded.status, "ready");
  assert.equal(decoded.value.song, null);
  assert.ok(decoded.value.autoControls.has("tempoControl"));
  assert.ok(decoded.value.autoControls.has("track:drums:density"));
});

test("session decode rejects corruption, sanitizes preferences, and never auto-restores the last song", () => {
  const invalid = decodePersistedSession({ status: "ready", value: { schema: 999, song: null } }, {
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
      song: { corrupted: true },
      trackSettings: { drums: { density: 999, program: -10 } },
      muted: ["drums", "ghost"],
      solo: ["ghost"],
      locked: ["drums"],
      autoControls: ["energyControl", 12, "x".repeat(90)],
      selectedTrack: "ghost",
      guidedMode: false,
      recipeIndex: 99,
      mixAssistant: { enabled: 1 },
      tasteProfile: { likes: 2, genreVotes: { hipHop: 3, fake: 7 } },
      generationPreferences: { tempoControl: "101", keyControl: "G", unknown: "ignore" },
    },
  }, {
    schema: 2,
    trackOrder: TRACK_ORDER,
    defaultTrackSettings: DEFAULTS,
    genreIds: ["hipHop"],
    recipeCount: 3,
    normalizeMixAssistant: (value) => ({ enabled: Boolean(value?.enabled) }),
  });

  assert.equal(decoded.status, "ready", "legacy/corrupt song payloads must not block valid preference restore");
  assert.equal(decoded.value.song, null, "relaunch should start with an empty plate");
  assert.deepEqual([...decoded.value.muted], ["drums"]);
  assert.deepEqual([...decoded.value.solo], []);
  assert.equal(decoded.value.selectedTrack, "drums");
  assert.equal(decoded.value.guidedMode, false);
  assert.equal(decoded.value.recipeIndex, 2);
  assert.equal(decoded.value.trackSettings.drums.density, 100);
  assert.equal(decoded.value.trackSettings.drums.program, 0);
  assert.deepEqual(decoded.value.tasteProfile.genreVotes, { hipHop: 3 });
  assert.equal(decoded.value.generationPreferences.tempoControl, "101");
  assert.equal(decoded.value.generationPreferences.keyControl, "G");
  assert.equal(decoded.value.generationPreferences.unknown, undefined);

  const target = {};
  assert.equal(applyPersistedSessionState(target, decoded.value, SESSION_UI), true);
  assert.equal(target.song, null);
});

test("autosave controller persists preferences even when the song plate is empty", () => {
  const calls = [];
  let pending;
  let timerId = 0;
  const storage = {
    save(value) {
      calls.push(["save", value.schema, value.song]);
      return { ok: true };
    },
    discard() {
      calls.push(["discard"]);
      return true;
    },
  };
  const controller = createSessionAutosaveController({
    storage,
    snapshot: () => ({ schema: 2, song: null, generationPreferences: { tempoControl: "104" } }),
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
  assert.deepEqual(calls.slice(-2), [["save", 2, null], ["saved"]]);
  assert.equal(controller.discard(), true);
  assert.deepEqual(calls.at(-1), ["discard"]);
});


test("Creative Range preferences round-trip through capture and select validation", () => {
  const previousDocument = globalThis.document;
  const validOptions = [
    { value: "" },
    { value: "familiar" },
    { value: "fresh" },
    { value: "wild" },
  ];
  const creativeRangeControl = {
    tagName: "SELECT",
    value: "fresh",
    options: validOptions,
  };
  globalThis.document = {
    getElementById(id) {
      return id === "creativeRangeControl" ? creativeRangeControl : null;
    },
  };

  try {
    const snapshot = createPersistedSessionSnapshot({ song: null }, {
      schema: 2,
      now: () => new Date("2026-09-17T00:00:00.000Z"),
      captureGenerationPreferences,
    });
    assert.equal(snapshot.generationPreferences.creativeRangeControl, "fresh");

    const decoded = decodePersistedSession({ status: "ready", value: snapshot }, {
      schema: 2,
      trackOrder: TRACK_ORDER,
      defaultTrackSettings: DEFAULTS,
      genreIds: ["hipHop"],
    });
    assert.equal(decoded.status, "ready");
    assert.equal(decoded.value.generationPreferences.creativeRangeControl, "fresh");

    creativeRangeControl.value = "";
    assert.equal(applyPersistedSessionState({}, decoded.value, SESSION_UI), true);
    assert.equal(creativeRangeControl.value, "fresh");

    creativeRangeControl.value = "";
    const invalid = decodePersistedSession({
      status: "ready",
      value: {
        ...snapshot,
        generationPreferences: { creativeRangeControl: "unsupported" },
      },
    }, {
      schema: 2,
      trackOrder: TRACK_ORDER,
      defaultTrackSettings: DEFAULTS,
      genreIds: ["hipHop"],
    });
    assert.equal(invalid.status, "ready");
    assert.equal(applyPersistedSessionState({}, invalid.value, SESSION_UI), true);
    assert.equal(creativeRangeControl.value, "", "invalid select values must not overwrite the neutral default");
  } finally {
    globalThis.document = previousDocument;
  }
});
