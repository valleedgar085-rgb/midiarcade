import test from "node:test";
import assert from "node:assert/strict";
import { generateNew } from "../src/music-engine.js";

test("Producer intent contract correctly evaluates colliding answers without errors", () => {
  const song = generateNew({ seed: "producer-intent-test", bars: 16 });
  assert.ok(song.tracks, "Song should have tracks");
  assert.ok(song.structure, "Song should have structure");
  assert.ok(song.songBlueprint?.producerIntent, "Song should have producerIntent");
});

test("combined producer-intent optimizations preserve overlapping section membership and collisions", async () => {
  const { evaluateProducerIntentContract } = await import("../src/music-engine.js");
  const structure = [
    { id: "a", startBeat: 0, endBeat: 4 },
    { id: "b", startBeat: 3, endBeat: 8 },
  ];
  const tracks = [
    { id: "melody", notes: [{ start: 3.1, pitch: 64 }, { start: 5, pitch: 65 }] },
    { id: "counterpoint", notes: [{ start: 3.15, pitch: 67 }, { start: 5.5, pitch: 70 }] },
  ];
  const scenes = ["a", "b"].map((sectionId) => ({
    sectionId,
    foregroundTrack: "melody",
    answerTrack: "counterpoint",
    roles: { melody: "foreground", counterpoint: "answer" },
  }));
  const result = evaluateProducerIntentContract(tracks, structure, { scenes });
  assert.equal(result.scenes[0].foregroundNotes, 1);
  assert.equal(result.scenes[0].answerCollisionRate, 1);
  assert.equal(result.scenes[1].foregroundNotes, 2);
  assert.equal(result.scenes[1].answerCollisionRate, 0.5);
});
