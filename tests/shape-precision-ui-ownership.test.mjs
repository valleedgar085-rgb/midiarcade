import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createShapeIntent } from "../src/core/shape-director-policy.js";
import { createShapeCandidate } from "../src/core/shape-director-engine.js";

const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const prepareSource = app.slice(app.indexOf("async function prepareShapeDirectorCandidate("), app.indexOf("async function prepareBlueprintCompositionCandidate("));

test("a pending precision preview cannot attach to a different selected section or changed preserve locks", async () => {
  for (const change of ["selection", "locks", "size"]) {
    let release;
    const song = { id: "song", meta: { beatsPerBar: 4 }, structure: [{ id: "a", startBeat: 0, endBeat: 8 }],
      tracks: [{ id: "drums", notes: [{ pitch: 42, start: 0.5, duration: 0.1, velocity: 80 }] }] };
    const state = { song, generationCount: 1, editorTrack: "drums" };
    const director = { size: "touchUp", preserve: [], transaction: null };
    let selection = { target: "track", sectionId: "a", trackId: "drums" };
    const prepare = runInNewContext(`(${prepareSource})`, {
      state, createShapeIntent, createShapeCandidate, deepClone: structuredClone,
      editorSection: () => ({ id: "a" }), shapeDirectorSelection: () => selection,
      shapeDirectorState: () => director, clearShapeDirectorCandidate() {},
      appStore: { transaction(_name, mutate) { mutate(state); } },
      generationExecutor: { run(_kind, payload) { return new Promise((resolve) => { release = () => resolve({ transaction: createShapeCandidate(payload.sourceSong, payload.intent, { seed: payload.seed }) }); }); } },
      generationOwnership: { isCurrent: () => true }, armGenerationSafetyTimer: () => 1,
      finishGenerationActivity() { state.isGenerating = false; return true; },
      showGenerationActivity() {}, hideGenerationActivity() {}, renderShapeDirector() {}, showToast() {}, console,
    });
    const pending = prepare("hatAccents");
    if (change === "selection") selection = { ...selection, sectionId: "b" };
    if (change === "locks") director.preserve = ["rhythm"];
    if (change === "size") director.size = "transform";
    release();
    assert.equal(await pending, false, change);
    assert.equal(director.transaction, null, change);
    assert.equal(state.song, song);
  }
});
