import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  PROJECT_SCHEMA, makeProjectRecord, validateProjectRecord,
  validateProjectSong, createProjectLibrary,
} from "../src/core/project-library.js";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const SONG = {
  seed: 1234,
  bpm: 96,
  bars: 16,
  sections: [{ id: "intro", name: "Intro", bars: 4 }],
  tracks: [
    { id: "drums", notes: [{ pitch: 36, start: 0, duration: .25, velocity: 110 }] },
    { id: "melody", notes: [{ pitch: 64, start: 0.5, duration: 0.5, velocity: 0.9 }] },
  ],
};

function make(id = "project-fixture") {
  return makeProjectRecord({
    id, name: " My beat ",
    song: SONG,
    trackSettings: { drums: { volume: .8 }, melody: { program: 2 } },
    muted: new Set(["drums"]), solo: [], locked: [],
    selectedTrack: "melody",
  }, { now: () => "2026-10-13T13:00:00.000Z" });
}

test("project record preserves exact notes, deterministic seed, sections and mix settings", () => {
  const record = make();
  assert.equal(record.schema, PROJECT_SCHEMA);
  assert.equal(record.name, "My beat");
  assert.equal(record.payload.song.seed, 1234);
  assert.deepEqual(record.payload.song, SONG);
  assert.deepEqual(record.payload.muted, ["drums"]);
  assert.equal(record.payload.selectedTrack, "melody");
  assert.equal(validateProjectRecord(record), true);
  assert.equal(Object.isFrozen(record), true);
  assert.equal(validateProjectRecord(JSON.parse(JSON.stringify(record))), true);
});

test("project validation rejects unknown schema, missing tracks, changed notes and checksum mismatch", () => {
  const record = make();
  assert.equal(validateProjectSong({ tracks: [] }), false);
  assert.equal(validateProjectSong({ tracks: [{ id: "x", notes: [{ pitch: 160, start: 1, duration: 1 }] }] }), false);
  assert.equal(validateProjectRecord({ ...record, schema: 99 }), false);
  assert.equal(validateProjectRecord({ ...record, checksum: "12345678" }), false);
  assert.equal(validateProjectRecord({
    ...record, payload: { ...record.payload, song: {
      ...record.payload.song,
      tracks: [{ id: "drums", notes: [{ pitch: 36, start: 1, duration: 0 }] }],
    } },
  }), false);
  assert.equal(validateProjectRecord({ ...record, payload: { ...record.payload, muted: "all" } }), false);
  assert.throws(() => makeProjectRecord({ id: "../../bad", song: SONG }), /identifier/);
  assert.throws(() => makeProjectRecord({
    id: "x", song: { tracks: [{ notes: [{ pitch: 60, start: 0, duration: -1 }] }] },
  }), /valid, nonempty song/);
});

test("library unavailable never pretends it saved a project", async () => {
  const library = createProjectLibrary({ indexedDBProvider: () => null });
  await assert.rejects(() => library.save(make()), /unavailable/);
  await assert.rejects(() => library.list(), /unavailable/);
});

test("project storage round-trips explicitly and refuses damaged stored records", async () => {
  const records = new Map();
  // Minimal async IndexedDB double; transactions must complete before writes
  // are reported as durable, not merely when put() returns.
  function fakeStore(tx) {
    return {
      put(value) {
        queueMicrotask(() => { records.set(value.id, structuredClone(value)); tx.oncomplete?.(); });
      },
      delete(id) {
        queueMicrotask(() => { records.delete(id); tx.oncomplete?.(); });
      },
      get(id) {
        const request = {};
        queueMicrotask(() => { request.result = structuredClone(records.get(id)); request.onsuccess?.(); });
        return request;
      },
      getAll() {
        const request = {};
        queueMicrotask(() => { request.result = [...records.values()].map((x) => structuredClone(x)); request.onsuccess?.(); });
        return request;
      },
    };
  }
  const db = {
    onversionchange: null,
    transaction(_name, _mode) {
      const tx = { oncomplete: null, onerror: null, onabort: null, error: null };
      tx.objectStore = () => fakeStore(tx);
      return tx;
    },
    close() {},
  };
  const factory = {
    open() {
      const request = { result: db, error: null };
      queueMicrotask(() => request.onsuccess?.());
      return request;
    },
  };
  const library = createProjectLibrary({ indexedDBProvider: () => factory });
  await library.save(make("project-a"));
  await library.save(make("project-b"));
  assert.deepEqual((await library.list()).map((p) => p.id), ["project-a", "project-b"]);
  const loaded = await library.load("project-a");
  assert.deepEqual(loaded.payload.song, SONG);
  records.get("project-a").payload.song.tracks[0].notes[0].pitch = 39;
  records.get("project-a").savedAt = null;
  await assert.rejects(() => library.load("project-a"), /integrity/);
  const damaged = (await library.list()).find((p) => p.id === "project-a");
  assert.equal(damaged.valid, false, "bad records remain visible and quarantined");
  assert.equal(damaged.savedAt, "1970-01-01T00:00:00.000Z", "invalid timestamps must not crash the library view");
  await library.remove("project-a");
  assert.equal((await library.list()).length, 1);
  await assert.rejects(() => library.load("project-a"), /not found/);
});

test("app project loading is explicitly authorized and does not change startup autosave", () => {
  const app = read("src/app.js");
  const panel = read("src/ui/project-library-panel.js");
  const session = read("src/core/session-runtime.js");
  const html = read("index.html");
  assert.match(app, /const projectLibrary = createProjectLibrary\(\)/);
  assert.match(app, /const record = await projectLibrary\.load\(id\)/);
  assert.match(app, /window\.confirm\(/);
  assert.match(app, /const previous = createHistorySnapshot\(\)/);
  assert.match(app, /applyHistorySnapshot\(newSnapshot\)/);
  assert.match(app, /if \(previous\) pushHistory\(previous\)/);
  assert.match(app, /state\.history = previousHistory/);
  assert.match(app, /projectLibraryActionAllowed\(\)/);
  assert.match(panel, /id="projectLibraryPanel"/);
  assert.match(panel, /id="projectLibrarySave"/);
  assert.match(panel, /id="projectLibraryList"/);
  assert.match(panel, /id="menuItemProjects"/);
  assert.doesNotMatch(html, /id="projectLibrarySave"/, "new library buttons must not affect protected initial DOM budget");
  assert.match(session, /song: null,/);
  assert.match(session, /Reopening the studio intentionally starts with an empty plate/);
});
