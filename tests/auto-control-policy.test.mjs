import assert from "node:assert/strict";
import test from "node:test";
import { createInitialAppState } from "../src/core/app-store.js";
import {
  AUTO_GENERATION_RANGE_IDS,
  AUTO_SELECT_IDS,
  AUTO_TRACK_RANGE_KEYS,
  AUTO_TRACK_SELECT_KEYS,
  createDefaultAutoControls,
  isAutoTrackControl,
  sanitizeAutoControls,
  trackAutoControlKey,
} from "../src/core/auto-control-policy.js";

const TRACKS = ["drums", "bass", "chords", "melody", "counterpoint", "pad"];

test("first-run studio defaults every supported generation and instrument control to Auto", () => {
  const expected = createDefaultAutoControls(TRACKS);
  const state = createInitialAppState();
  assert.deepEqual(state.autoControls, expected);
  for (const id of AUTO_GENERATION_RANGE_IDS) assert.ok(state.autoControls.has(id));
  for (const id of AUTO_SELECT_IDS) assert.ok(state.autoControls.has(id));
  for (const trackId of TRACKS) {
    for (const key of [...AUTO_TRACK_RANGE_KEYS, ...AUTO_TRACK_SELECT_KEYS]) {
      assert.ok(state.autoControls.has(`track:${trackId}:${key}`));
    }
    assert.equal(isAutoTrackControl(state.autoControls, trackId, "program"), true);
  }
});

test("saved manual program choices remain manual while malformed auto keys are discarded", () => {
  const restored = sanitizeAutoControls([
    "tempoControl",
    "track:bass:density",
    "track:melody:program",
    "track:ghost:program",
    "unknownControl",
  ], { trackIds: TRACKS });
  assert.deepEqual(
    [...restored].sort(),
    ["tempoControl", "track:bass:density", "track:melody:program"].sort(),
  );
  restored.delete(trackAutoControlKey("melody", "program"));
  assert.equal(isAutoTrackControl(restored, "melody", "program"), false);
  assert.equal(isAutoTrackControl(restored, "bass", "program"), false);
});
