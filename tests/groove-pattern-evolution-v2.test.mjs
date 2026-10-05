import assert from "node:assert/strict";
import test from "node:test";

import {
  applyPatternEvolution,
  createPatternEvolutionPlan,
  patternEvolutionSeed,
} from "../src/core/pattern-evolution-director.js";
import { createGrooveDNA } from "../src/core/groove-intelligence.js";

test("Pattern Evolution Director creates A/A/A-prime/turnaround then B family", () => {
  const section = { id: "verse-1", startBar: 0, bars: 8 };
  const roles = Array.from({ length: 8 }, (_, bar) => createPatternEvolutionPlan({ section, bar }).role);

  assert.deepEqual(roles, [
    "A",
    "A",
    "A-prime",
    "A-turnaround",
    "B",
    "B",
    "B-prime",
    "B-turnaround",
  ]);
});

test("repeated family bars share one memory seed while B gets a new seed", () => {
  const section = { id: "verse-1", startBar: 0, bars: 8 };
  const plans = Array.from({ length: 8 }, (_, bar) => createPatternEvolutionPlan({ section, bar }));
  const seeds = plans.map((plan) => patternEvolutionSeed({
    seed: "song-42",
    genre: "hipHop",
    sectionId: section.id,
    plan,
  }));

  assert.equal(seeds[0], seeds[1]);
  assert.equal(seeds[0], seeds[2]);
  assert.equal(seeds[0], seeds[3]);
  assert.equal(seeds[4], seeds[5]);
  assert.notEqual(seeds[0], seeds[4]);
});

test("A-prime edits are bounded to the back half and required/protected steps survive", () => {
  const plan = createPatternEvolutionPlan({
    section: { id: "verse-1", startBar: 0, bars: 4 },
    bar: 2,
  });
  const requiredSteps = [0, 4, 12];
  const protectedSteps = [10];
  const result = applyPatternEvolution({
    steps: [0, 4, 8, 12],
    allowedSteps: [0, 2, 4, 6, 8, 10, 12, 14],
    requiredSteps,
    protectedSteps,
    gridSteps: 16,
    plan,
    variation: 0.8,
    seed: "prime-localized",
    lane: "kick",
  });

  assert.ok(result.edits.length <= 1);
  assert.ok(result.edits.every((edit) => edit.step >= 8 && edit.step < 16));
  assert.ok(requiredSteps.every((step) => result.steps.includes(step)));
  assert.equal(result.steps.includes(10), false);
});

test("turnaround edits stay in the final quarter and never exceed two edits", () => {
  const plan = createPatternEvolutionPlan({
    section: { id: "verse-1", startBar: 0, bars: 4 },
    bar: 3,
  });
  const result = applyPatternEvolution({
    steps: [0, 4, 8, 12],
    allowedSteps: [0, 2, 4, 6, 8, 10, 12, 13, 14, 15],
    requiredSteps: [0, 4, 12],
    protectedSteps: [],
    gridSteps: 16,
    plan,
    variation: 0.9,
    seed: "turnaround-localized",
    lane: "hat",
  });

  assert.ok(result.edits.length <= 2);
  assert.ok(result.edits.every((edit) => edit.step >= 12 && edit.step < 16));
  assert.ok([0, 4, 12].every((step) => result.steps.includes(step)));
});

test("snare authority is not structurally mutated by pattern evolution", () => {
  const plan = createPatternEvolutionPlan({
    section: { id: "verse-1", startBar: 0, bars: 4 },
    bar: 3,
  });
  const steps = [4, 12];
  const result = applyPatternEvolution({
    steps,
    allowedSteps: [4, 11, 12, 15],
    requiredSteps: steps,
    gridSteps: 16,
    plan,
    variation: 1,
    seed: "snare-protected",
    lane: "snare",
  });

  assert.deepEqual(result.steps, steps);
  assert.deepEqual(result.edits, []);
});

test("pattern evolution is deterministic for a fixed seed and plan", () => {
  const plan = createPatternEvolutionPlan({
    section: { id: "verse-1", startBar: 0, bars: 4 },
    bar: 3,
  });
  const input = {
    steps: [0, 4, 8, 12],
    allowedSteps: [0, 2, 4, 6, 8, 10, 12, 13, 14, 15],
    requiredSteps: [0, 4, 12],
    protectedSteps: [10],
    gridSteps: 16,
    plan,
    variation: 0.8,
    seed: "deterministic-pattern",
    lane: "kick",
  };

  assert.deepEqual(applyPatternEvolution(input), applyPatternEvolution(input));
});


test("Groove DNA integration repeats A bars before bounded A-prime and turnaround changes", () => {
  const structure = [{ id: "verse-1", name: "verse", startBar: 0, bars: 8 }];
  const dna = createGrooveDNA({
    seed: "pattern-evolution-integration",
    genre: "hipHop",
    bars: 8,
    beatsPerBar: 4,
    complexity: 0.72,
    variation: 0.8,
  }, { structure });

  assert.equal(dna.patternEvolution.id, "pattern-evolution-director-v2");
  assert.deepEqual(
    dna.bars.map((bar) => bar.patternEvolution.role),
    ["A", "A", "A-prime", "A-turnaround", "B", "B", "B-prime", "B-turnaround"],
  );

  for (const lane of ["kick", "snare", "hat", "percussion"]) {
    assert.deepEqual(dna.bars[0][lane].steps, dna.bars[1][lane].steps);
    assert.deepEqual(dna.bars[4][lane].steps, dna.bars[5][lane].steps);
  }

  for (const bar of dna.bars) {
    for (const lane of ["kick", "snare", "hat", "percussion"]) {
      assert.ok(
        bar[lane].requiredSteps.every((step) => bar[lane].steps.includes(step)),
        `${lane} lost a required step in ${bar.patternEvolution.role}`,
      );
      assert.ok(
        bar[lane].steps.every((step) => !bar[lane].protectedSteps.includes(step)),
        `${lane} entered protected space in ${bar.patternEvolution.role}`,
      );
      assert.ok(
        bar[lane].patternEvolution.edits.length <= bar.patternEvolution.maxStepEdits,
        `${lane} exceeded the mutation budget in ${bar.patternEvolution.role}`,
      );
    }
  }
});
