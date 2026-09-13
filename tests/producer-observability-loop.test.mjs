import assert from "node:assert/strict";
import test from "node:test";
import { createSongBlueprint } from "../src/core/producer-blueprint.js";
import { createProducerBrainPlan } from "../src/core/producer-brain.js";
import { createGenerationFlightRecorder } from "../src/core/generation-flight-recorder.js";
import { createGenerationRunner } from "../src/core/generation-runner.js";

const CHARACTER = {
  grooveDepth: 0.9,
  bassMotion: 0.82,
  melodyMotion: 0.78,
  harmonicColor: 0.7,
  space: 0.62,
};

const TASTE = {
  confidence: 0.7,
  energy: 0.74,
  complexity: 0.6,
  variation: 0.68,
  genreAffinity: 0.5,
  rejectionPressure: 0.16,
};

test("song blueprint is deterministic and expresses an energy/contrast brief", () => {
  const config = {
    seed: "phase3-blueprint",
    genre: "hipHop",
    bars: 24,
    energy: 0.72,
    complexity: 0.58,
    variation: 0.56,
    evolution: 0.64,
    surprise: 0.3,
  };
  const priorities = [
    { id: "groove", weight: 0.9 },
    { id: "hook", weight: 0.8 },
    { id: "space", weight: 0.7 },
  ];
  const first = createSongBlueprint(config, { kind: "new", character: CHARACTER, taste: TASTE, priorities });
  const second = createSongBlueprint(config, { kind: "new", character: CHARACTER, taste: TASTE, priorities });

  assert.deepEqual(first, second);
  assert.equal(first.id, "producer-blueprint-v1");
  assert.equal(first.bars, 24);
  assert.ok(first.intent.energyArc.peak >= first.intent.energyArc.body);
  assert.ok(first.intent.contrast > 0);
  assert.deepEqual(first.repairFocus, ["groove", "hook", "space"]);
  assert.equal(first.guardrails.preserveDeterminism, true);
});

test("Producer Brain publishes blueprint plus the adaptive self-correction contract", () => {
  const plan = createProducerBrainPlan(
    { seed: "phase3-loop", genre: "hipHop", thinkingDepth: "deep", bars: 16 },
    { kind: "new", character: CHARACTER, taste: TASTE },
  );

  assert.equal(plan.blueprint.id, "producer-blueprint-v1");
  assert.deepEqual(plan.adaptiveLoop.stages, ["plan", "compose", "diagnose", "repair", "compare", "finalize"]);
  assert.equal(plan.adaptiveLoop.enabled, true);
  assert.equal(plan.adaptiveLoop.targetedRepair, true);
  assert.equal(plan.adaptiveLoop.maxRepairPasses, plan.search.repairAttempts);
});

test("generation flight recorder captures stages without changing runner result shape", async () => {
  let now = 100;
  const recorder = createGenerationFlightRecorder({ clock: () => now += 5, limit: 8 });
  const song = {
    id: "flight-song",
    seed: "flight-seed",
    title: "Flight Song",
    tracks: [],
    meta: {
      scoreDetails: {
        candidateSearch: {
          thinkingDepth: "deep",
          totalCandidates: 7,
          weakestDimension: "groove",
          repairAttempts: 1,
          repairAccepted: true,
        },
      },
    },
  };
  const runner = createGenerationRunner({
    generateNew: () => song,
    generateSimilar: (source) => source,
    validate: (candidate) => Array.isArray(candidate?.tracks),
    recorder,
  });

  const result = await runner.generate("new", {
    config: {
      seed: "flight-seed",
      genre: "hipHop",
      producerBrain: {
        id: "producer-brain-v2",
        version: 2,
        mode: "deep-audition",
        blueprint: { id: "producer-blueprint-v1" },
      },
    },
  });

  assert.deepEqual(result, { status: "committed", song });
  const [entry] = recorder.snapshot();
  assert.equal(entry.status, "committed");
  assert.equal(entry.config.producerBrain.blueprintId, "producer-blueprint-v1");
  assert.deepEqual(entry.stages.map(({ stage }) => stage), ["plan", "compose", "diagnose", "finalize"]);
  assert.equal(entry.song.candidateSearch.weakestDimension, "groove");
  assert.equal(recorder.activeCount, 0);
});

test("flight recorder closes failed runs and remains bounded", async () => {
  let now = 0;
  const recorder = createGenerationFlightRecorder({ clock: () => ++now, limit: 4 });
  const runner = createGenerationRunner({
    generateNew: () => { throw new Error("composition failed"); },
    generateSimilar: (source) => source,
    recorder,
  });

  await assert.rejects(() => runner.generate("new", { config: { seed: "bad" } }), /composition failed/);
  assert.equal(recorder.snapshot()[0].status, "failed");
  assert.equal(recorder.activeCount, 0);

  for (let index = 0; index < 6; index += 1) {
    const id = recorder.begin("new", { config: { seed: `seed-${index}` } });
    recorder.complete(id, { id: `song-${index}` });
  }
  assert.equal(recorder.snapshot().length, 4);
});
