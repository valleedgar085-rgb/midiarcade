import assert from "node:assert/strict";
import test from "node:test";

import { createGenerationExecutor } from "../src/core/generation-executor.js";

test("generation executor persists the accepted post-Gauntlet song before returning it", async () => {
  const persisted = [];
  const song = {
    id: "accepted-song",
    schema: "midi-arcade/song@1",
    title: "Accepted",
    seed: "persist-me",
    genre: "hipHop",
    bars: 1,
    meta: { key: "A", scale: "minor", tempo: 96, beatsPerBar: 4 },
    songBlueprint: { intent: { summary: "groove-first" } },
    grooveConductor: {
      version: 4,
      subdivision: 0.25,
      bars: [{ bar: 0, sectionId: "verse", anchors: [0, 2] }],
    },
    harmony: [{ start: 0, chord: "Am9" }],
    structure: [{ id: "verse", name: "Verse", startBar: 0, bars: 1 }],
    tracks: [
      { id: "drums", notes: [{ start: 0, duration: 0.1, pitch: 36, velocity: 100 }] },
      { id: "bass", notes: [{ start: 0, duration: 1, pitch: 33, velocity: 92 }] },
    ],
  };

  const executor = createGenerationExecutor({
    workerFactory: null,
    fallback: () => ({ status: "committed", song }),
    persistGeneration(record) {
      persisted.push(record);
    },
  });

  const result = await executor.run("new", {
    config: {
      seed: "persist-me",
      genre: "hipHop",
      bars: 1,
      adaptiveCandidates: true,
      weaknessAwareSearch: true,
      targetedRepair: true,
    },
  });

  assert.equal(result.song, song);
  assert.equal(persisted.length, 1);
  assert.equal(persisted[0].song.id, "accepted-song");
  assert.deepEqual(JSON.parse(persisted[0].grooveDna.groove_json), song.grooveConductor);
  assert.deepEqual(persisted[0].musicalEvents.map(({ pitch }) => pitch), [36, 33]);
  assert.equal(persisted[0].stages.at(-1).stage, "persist");
});

test("non-canonical audition requests do not overwrite the generation database", async () => {
  let writes = 0;
  const sourceSong = {
    id: "source",
    tracks: [{ id: "melody", notes: [] }],
  };
  const transaction = {
    status: "candidate",
    validation: { valid: true, issues: [] },
    after: sourceSong,
  };
  const executor = createGenerationExecutor({
    workerFactory: null,
    fallback: () => ({ status: "candidate", transaction }),
    persistGeneration() {
      writes += 1;
    },
  });

  await executor.run("compositionCandidate", { sourceSong });
  assert.equal(writes, 0);
});
