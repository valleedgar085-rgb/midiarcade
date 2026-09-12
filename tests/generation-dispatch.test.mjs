import assert from "node:assert/strict";
import test from "node:test";
import {
  dispatchGenerationRequest,
  isGenerationKind,
} from "../src/core/generation-dispatch.js";

function fakeEngine(calls) {
  return {
    generateNew(config) {
      calls.push(["new", config]);
      return { id: "new-song" };
    },
    generateSimilar(sourceSong, config) {
      calls.push(["similar", sourceSong, config]);
      return { id: "similar-song" };
    },
    generateSectionVariations(sourceSong, sectionId, input) {
      calls.push(["sectionVariations", sourceSong, sectionId, input]);
      return [{ id: "section-a" }, { id: "section-b" }];
    },
    generateSongVariations(sourceSong, config) {
      calls.push(["songVariations", sourceSong, config]);
      return [{ id: "song-a" }, { id: "song-b" }, { id: "song-c" }];
    },
  };
}

test("generation dispatcher owns the complete background generation command surface", () => {
  const calls = [];
  const engine = fakeEngine(calls);
  const sourceSong = { id: "source" };

  assert.deepEqual(dispatchGenerationRequest("new", { config: { seed: "one" } }, engine), {
    status: "committed",
    song: { id: "new-song" },
  });
  assert.deepEqual(dispatchGenerationRequest("similar", { sourceSong, config: { seed: "two" } }, engine), {
    status: "committed",
    song: { id: "similar-song" },
  });
  assert.deepEqual(dispatchGenerationRequest("sectionVariations", {
    sourceSong,
    sectionId: "chorus-1",
    input: { intensity: 0.8 },
  }, engine), {
    status: "committed",
    options: [{ id: "section-a" }, { id: "section-b" }],
  });
  assert.deepEqual(dispatchGenerationRequest("songVariations", {
    sourceSong,
    config: { candidatesPerVariation: 3 },
  }, engine), {
    status: "committed",
    variations: [{ id: "song-a" }, { id: "song-b" }, { id: "song-c" }],
  });

  assert.deepEqual(calls, [
    ["new", { seed: "one" }],
    ["similar", sourceSong, { seed: "two" }],
    ["sectionVariations", sourceSong, "chorus-1", { intensity: 0.8 }],
    ["songVariations", sourceSong, { candidatesPerVariation: 3 }],
  ]);
});

test("generation dispatcher applies stable empty payload defaults without mutating input", () => {
  const calls = [];
  const engine = fakeEngine(calls);
  const payload = Object.freeze({ sourceSong: Object.freeze({ id: "source" }) });

  dispatchGenerationRequest("similar", payload, engine);
  dispatchGenerationRequest("sectionVariations", payload, engine);
  dispatchGenerationRequest("songVariations", payload, engine);

  assert.deepEqual(calls, [
    ["similar", payload.sourceSong, {}],
    ["sectionVariations", payload.sourceSong, undefined, {}],
    ["songVariations", payload.sourceSong, {}],
  ]);
  assert.deepEqual(payload, { sourceSong: { id: "source" } });
});

test("generation dispatcher rejects unknown commands and incomplete engine contracts precisely", () => {
  assert.equal(isGenerationKind("new"), true);
  assert.equal(isGenerationKind("songVariations"), true);
  assert.equal(isGenerationKind("renderAudio"), false);
  assert.throws(
    () => dispatchGenerationRequest("renderAudio", {}, {}),
    /Unknown background generation kind: renderAudio/,
  );
  assert.throws(
    () => dispatchGenerationRequest("new", {}, {}),
    /generation engine is missing generateNew/,
  );
});
