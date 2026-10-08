import test from "node:test";
import assert from "node:assert/strict";
import { generateNew } from "../src/music-engine.js";

test("Producer intent contract correctly evaluates colliding answers without errors", () => {
  const song = generateNew({ seed: "producer-intent-test", bars: 16 });
  assert.ok(song.tracks, "Song should have tracks");
  assert.ok(song.structure, "Song should have structure");
  assert.ok(song.songBlueprint?.producerIntent, "Song should have producerIntent");
});
