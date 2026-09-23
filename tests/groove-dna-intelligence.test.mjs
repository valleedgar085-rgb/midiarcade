import assert from "node:assert/strict";
import test from "node:test";

import * as engine from "../src/music-engine.js";
import {
  createGrooveDNA,
  grooveDNAConductorLanes,
  validateGrooveDNA,
} from "../src/core/groove-intelligence.js";
import { createSpecialistDirectorPlan } from "../src/core/specialist-musicians.js";

const STRUCTURE = [
  { id: "verse-1", name: "verse", startBar: 0, bars: 2 },
  { id: "prechorus-1", name: "prechorus", startBar: 2, bars: 1 },
  { id: "chorus-1", name: "chorus", startBar: 3, bars: 1 },
];

test("Groove DNA executes base rhythm -> probability -> density -> variation -> humanization -> instrument mapping", () => {
  const dna = createGrooveDNA({
    seed: "groove-pipeline",
    genre: "hipHop",
    bars: 4,
    beatsPerBar: 4,
    complexity: 0.62,
    variation: 0.58,
  }, { structure: STRUCTURE });

  assert.deepEqual(dna.pipeline, [
    "base-rhythm",
    "probability",
    "density-transform",
    "variation",
    "humanization",
    "instrument-mapping",
  ]);
  assert.equal(validateGrooveDNA(dna).passed, true);
  assert.equal(dna.barCount, 4);
  assert.equal(dna.bars.length, 4);

  const first = dna.bars[0];
  for (const lane of ["kick", "snare", "hat", "percussion"]) {
    assert.ok(Array.isArray(first[lane].baseSteps));
    assert.ok(Array.isArray(first[lane].probabilitySteps));
    assert.ok(Array.isArray(first[lane].densitySteps));
    assert.ok(Array.isArray(first[lane].steps));
    assert.ok(Array.isArray(first[lane].events));
  }
});

test("Groove DNA is deterministic for a fixed seed and configuration", () => {
  const input = {
    seed: "groove-determinism",
    genre: "trap",
    bars: 4,
    beatsPerBar: 4,
    complexity: 0.78,
    variation: 0.72,
  };
  const first = createGrooveDNA(input, { structure: STRUCTURE });
  const second = createGrooveDNA(input, { structure: STRUCTURE });
  assert.deepEqual(first, second);
});

test("genre changes select different structural rhythm grammars", () => {
  const common = {
    seed: "genre-grammar-difference",
    bars: 4,
    beatsPerBar: 4,
    complexity: 0.68,
    variation: 0.56,
  };
  const hipHop = createGrooveDNA({ ...common, genre: "hipHop" }, { structure: STRUCTURE });
  const trap = createGrooveDNA({ ...common, genre: "trap" }, { structure: STRUCTURE });
  const pop = createGrooveDNA({ ...common, genre: "pop" }, { structure: STRUCTURE });
  const house = createGrooveDNA({ ...common, genre: "house" }, { structure: STRUCTURE });
  const neoSoul = createGrooveDNA({ ...common, genre: "neoSoul" }, { structure: STRUCTURE });
  const jazz = createGrooveDNA({ ...common, genre: "jazz" }, { structure: STRUCTURE });
  const rock = createGrooveDNA({ ...common, genre: "rock" }, { structure: STRUCTURE });

  const grammars = [hipHop, trap, pop, house, neoSoul, jazz, rock].map((dna) => dna.grammarId);
  assert.equal(new Set(grammars).size, 7);

  assert.deepEqual(house.grammar.kick.required, [0, 4, 8, 12]);
  assert.deepEqual(trap.grammar.snare.required, [8]);
  assert.deepEqual(hipHop.grammar.snare.required, [4, 12]);
  assert.ok(neoSoul.humanization.laidBackBeats > 0);
  assert.ok(jazz.humanization.swing > rock.humanization.swing);
  assert.notDeepEqual(
    grooveDNAConductorLanes(trap, 1).hatPulses,
    grooveDNAConductorLanes(house, 1).hatPulses,
  );
});

test("Groove DNA publishes inter-instrument relationships for one shared pocket", () => {
  const dna = createGrooveDNA({
    seed: "relationship-pocket",
    genre: "neoSoul",
    bars: 4,
    beatsPerBar: 4,
    complexity: 0.7,
    variation: 0.5,
  }, { structure: STRUCTURE });

  assert.equal(dna.relationships.bass.mode, "elastic-answer");
  assert.equal(dna.relationships.chords.mode, "anticipate-backbeat");
  assert.equal(dna.relationships.lead.mode, "behind-beat-conversation");

  const lane = grooveDNAConductorLanes(dna, 0);
  assert.ok(lane.anchors.length > 0);
  assert.ok(lane.snarePulses.length > 0);
  assert.ok(lane.hatPulses.length > 0);
  assert.ok(lane.bassPulses.length > 0);
  assert.ok(lane.chordPulses.length > 0);
  assert.ok(lane.leadPulses.length > 0);
});

test("music engine exposes Groove DNA through the shared conductor and drum lanes", () => {
  const song = engine.generateNew({
    seed: "groove-engine-integration",
    genre: "house",
    key: "A",
    scale: "minor",
    bars: 8,
    energy: 0.7,
    complexity: 0.62,
    variation: 0.52,
    candidateCount: 1,
  });

  assert.equal(song.grooveConductor?.version, 5);
  assert.equal(song.grooveConductor?.grooveDNA?.id, "groove-dna-v1");
  assert.equal(song.grooveConductor?.grooveDNA?.grammarId, "house-four-floor-interlock");
  assert.deepEqual(song.grooveConductor.bars[0].anchors, [0, 1, 2, 3]);
  assert.deepEqual(song.grooveConductor.bars[0].hatPulses, [0.5, 1.5, 2.5, 3.5]);

  const firstBarDrums = song.tracks
    .find((track) => track.id === "drums")
    .notes
    .filter((note) => note.start >= 0 && note.start < 4);
  const kicks = firstBarDrums.filter((note) => note.pitch === 36).map((note) => note.start);
  assert.ok([0, 1, 2, 3].every((beat) => kicks.some((start) => Math.abs(start - beat) < 0.05)));
});

test("specialist Director publishes the same Groove DNA to the whole band", () => {
  const song = engine.generateNew({
    seed: "groove-specialist-band",
    genre: "trap",
    bars: 8,
    candidateCount: 1,
  });
  const plan = createSpecialistDirectorPlan(song);

  assert.equal(plan.grooveDNA.id, "groove-dna-v1");
  assert.equal(plan.grooveDNA.grammarId, "trap-subdivision-engine");

  for (const specialist of plan.specialists) {
    assert.equal(specialist.context.grooveDNA.id, "groove-dna-v1");
    assert.equal(specialist.context.grooveDNA.grammarId, plan.grooveDNA.grammarId);
  }
});
