import assert from "node:assert/strict";
import test from "node:test";

import * as engine from "../src/music-engine.js";
import {
  createGrooveDNA,
  grooveDNAConductorLanes,
  popReferenceCharacterForTempo,
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

test("Pop reference characters switch between bass-forward and rhythmic-lift pockets by tempo", () => {
  const common = {
    seed: "pop-reference-characters",
    genre: "pop",
    popReferenceEnabled: true,
    bars: 4,
    beatsPerBar: 4,
    complexity: 0.68,
    variation: 0.52,
  };
  const bassForward = createGrooveDNA({ ...common, tempo: 85 }, { structure: STRUCTURE });
  const rhythmicLift = createGrooveDNA({ ...common, tempo: 109 }, { structure: STRUCTURE });

  assert.equal(popReferenceCharacterForTempo(85).id, "bass-forward-half-time");
  assert.equal(popReferenceCharacterForTempo(109).id, "rhythmic-lift");
  assert.equal(bassForward.grammarId, "pop-pulse-lift");
  assert.equal(rhythmicLift.grammarId, "pop-pulse-lift");
  assert.equal(bassForward.characterId, "bass-forward-half-time");
  assert.equal(rhythmicLift.characterId, "rhythmic-lift");
  assert.deepEqual(bassForward.grammar.snare.required, [4, 12]);
  assert.deepEqual(rhythmicLift.grammar.snare.required, [4, 12]);
  assert.notDeepEqual(bassForward.grammar.kick.base, rhythmicLift.grammar.kick.base);
  assert.equal(bassForward.relationships.bass.mode, "bass-forward-lock-and-answer");
  assert.equal(rhythmicLift.relationships.bass.mode, "syncopated-pop-reply");
  assert.ok(rhythmicLift.grammar.percussion.base.includes(11));
});

test("Pop reference characters require explicit authority", () => {
  const legacy = createGrooveDNA({
    seed: "pop-reference-explicit-authority",
    genre: "pop",
    tempo: 85,
    bars: 4,
  }, { structure: STRUCTURE });
  const reference = createGrooveDNA({
    seed: "pop-reference-explicit-authority",
    genre: "pop",
    tempo: 85,
    bars: 4,
    popReferenceEnabled: true,
  }, { structure: STRUCTURE });

  assert.equal(legacy.characterId, legacy.grammarId);
  assert.equal(reference.characterId, "bass-forward-half-time");
  assert.notDeepEqual(legacy.grammar.kick.base, reference.grammar.kick.base);
});

test("generated Pop publishes its reference-informed pocket to the whole ensemble", () => {
  const bassForward = engine.generateNew({
    seed: "pop-reference-bass-forward",
    genre: "pop",
    tempo: 85,
    bars: 8,
    candidateCount: 1,
    professionalUpgrade: true,
  });
  const rhythmicLift = engine.generateNew({
    seed: "pop-reference-rhythmic-lift",
    genre: "pop",
    tempo: 109,
    bars: 8,
    candidateCount: 1,
    professionalUpgrade: true,
  });

  assert.equal(bassForward.grooveConductor.grooveDNA.characterId, "bass-forward-half-time");
  assert.equal(rhythmicLift.grooveConductor.grooveDNA.characterId, "rhythmic-lift");
  assert.ok(bassForward.grooveConductor.bars.every((bar) => bar.grooveDNA.characterId === "bass-forward-half-time"));
  assert.ok(rhythmicLift.grooveConductor.bars.every((bar) => bar.grooveDNA.characterId === "rhythmic-lift"));
  assert.equal(engine.evaluateSongCandidate(bassForward).diagnostics.syncopationTarget, 0.58);
  assert.equal(engine.evaluateSongCandidate(rhythmicLift).diagnostics.syncopationTarget, 0.62);
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

test("specialist Director preserves the source Pop reference character", () => {
  const song = engine.generateNew({
    seed: "groove-specialist-pop-reference",
    genre: "pop",
    tempo: 85,
    bars: 8,
    complexity: 0.71,
    variation: 0.64,
    candidateCount: 1,
    professionalUpgrade: true,
  });
  const plan = createSpecialistDirectorPlan(song);

  assert.equal(song.grooveConductor.grooveDNA.characterId, "bass-forward-half-time");
  assert.equal(plan.grooveDNA.characterId, song.grooveConductor.grooveDNA.characterId);
  assert.equal(plan.grooveDNA.relationships.bass.mode, "bass-forward-lock-and-answer");
  assert.deepEqual(
    plan.grooveDNA.bars[0].relationships.bass.pulses,
    song.grooveConductor.bars[0].bassPulses,
  );
});
