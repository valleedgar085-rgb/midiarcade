import assert from "node:assert/strict";
import test from "node:test";

import {
  BASS_PHRASE_DNA,
  bassPhraseFamily,
  createBassPhrasePlan,
} from "../src/core/bass-phrase-dna.js";
import {
  createGrooveDNA,
  grooveDNAConductorLanes,
} from "../src/core/groove-intelligence.js";

const SOURCE_KICKS = [0, 3, 7, 10, 14];
const SOURCE_HATS = [2, 6, 10, 14];

function plan(overrides = {}) {
  return createBassPhrasePlan({
    genre: "hipHop",
    relationship: {
      source: "kick",
      mode: "lock-and-answer",
      lock: 0.62,
      answerDelayBeats: 0.25,
      syncopation: 0.66,
    },
    sourceSteps: SOURCE_KICKS,
    beatsPerStep: 0.25,
    gridSteps: 16,
    seed: "bass-phrase-dna-test",
    sectionRole: "body",
    density: 0.64,
    variation: 0.56,
    ...overrides,
  });
}

test("Bass Phrase DNA catalog is original symbolic vocabulary with target genre families", () => {
  for (const genre of ["hipHop", "trap", "pop", "house", "neoSoul"]) {
    const family = bassPhraseFamily(genre);
    assert.ok(family.length >= 4, `${genre} should expose a small authored vocabulary`);
    assert.ok(family.every((entry) => entry.id && entry.steps.length >= 3));
  }
  assert.equal(Object.keys(BASS_PHRASE_DNA).includes("general"), true);
});

test("Bass Phrase DNA is deterministic for a fixed seed and context", () => {
  assert.deepEqual(plan(), plan());
  assert.deepEqual(
    plan({ genre: "trap", relationship: { mode: "808-interlock" } }),
    plan({ genre: "trap", relationship: { mode: "808-interlock" } }),
  );
});

test("Hip-Hop, Trap, House and Neo-Soul relationship modes produce distinct bass plans", () => {
  const common = {
    beatsPerStep: 0.25,
    gridSteps: 16,
    seed: "bass-mode-separation",
    sectionRole: "body",
    density: 0.68,
    variation: 0.58,
  };
  const hipHop = createBassPhrasePlan({
    ...common,
    genre: "hipHop",
    relationship: { mode: "lock-and-answer" },
    sourceSteps: SOURCE_KICKS,
  });
  const trap = createBassPhrasePlan({
    ...common,
    genre: "trap",
    relationship: { mode: "808-interlock" },
    sourceSteps: [0, 6, 10, 13],
  });
  const house = createBassPhrasePlan({
    ...common,
    genre: "house",
    relationship: { mode: "offbeat-interlock" },
    sourceSteps: SOURCE_HATS,
  });
  const neoSoul = createBassPhrasePlan({
    ...common,
    genre: "neoSoul",
    relationship: { mode: "elastic-answer" },
    sourceSteps: [0, 5, 10, 14],
  });

  assert.notDeepEqual(hipHop.steps, trap.steps);
  assert.notDeepEqual(hipHop.steps, house.steps);
  assert.notDeepEqual(trap.steps, neoSoul.steps);
  assert.equal(hipHop.mode, "lock-and-answer");
  assert.equal(trap.mode, "808-interlock");
  assert.equal(house.mode, "offbeat-interlock");
  assert.equal(neoSoul.mode, "elastic-answer");
  assert.ok(house.steps.some((step) => [2, 6, 10, 14].includes(step)));
  assert.ok(neoSoul.targets.lockRatio < trap.targets.lockRatio);
});

test("opening-boundary Bass Phrase DNA cannot wrap late replies into a fake pre-existing loop", () => {
  const result = plan({
    seed: "bass-opening-boundary",
    openingBoundary: true,
    wrap: false,
    sectionRole: "intro",
  });
  assert.ok(result.steps.every((step) => Math.abs(step) < 1e-6 || step >= 8 - 1e-6));
});

test("outro Bass Phrase DNA authors a late resolution attack near the final boundary", () => {
  const result = createBassPhrasePlan({
    genre: "pop",
    relationship: { mode: "pulse-reinforcement" },
    sourceSteps: [0, 8, 10],
    beatsPerStep: 0.25,
    gridSteps: 16,
    seed: "bass-outro-resolution",
    sectionRole: "outro",
    density: 0.58,
    variation: 0.48,
    wrap: false,
  });

  assert.ok(
    result.steps.some((step) => step >= 15 - 1e-6),
    `outro bass should include a late authored resolution attack: ${result.steps.join(",")}`,
  );
});

test("Groove DNA publishes Bass Phrase DNA provenance into the shared conductor", () => {
  const structure = [
    { id: "verse-1", name: "verse", startBar: 0, bars: 2 },
    { id: "chorus-1", name: "chorus", startBar: 2, bars: 2 },
  ];
  const result = createGrooveDNA({
    seed: "bass-phrase-integration",
    genre: "hipHop",
    bars: 4,
    beatsPerBar: 4,
    complexity: 0.66,
    variation: 0.58,
  }, { structure });

  const first = result.bars[0].relationships.bass;
  assert.match(first.phraseDnaId, /^bass-phrase-dna:/);
  assert.ok(first.phraseCellId);
  assert.ok(first.phraseCharacter);
  assert.ok(first.phraseTargets);
  assert.deepEqual(grooveDNAConductorLanes(result, 0).bassPulses, first.pulses);
});

test("House remains offbeat-led while Hip-Hop publishes lock-and-answer phrase provenance", () => {
  const house = createGrooveDNA({
    seed: "bass-house-offbeat",
    genre: "house",
    bars: 4,
    beatsPerBar: 4,
    complexity: 0.65,
    variation: 0.5,
  });
  const hipHop = createGrooveDNA({
    seed: "bass-hiphop-answer",
    genre: "hipHop",
    bars: 4,
    beatsPerBar: 4,
    complexity: 0.65,
    variation: 0.5,
  });

  assert.equal(house.relationships.bass.mode, "offbeat-interlock");
  assert.equal(hipHop.relationships.bass.mode, "lock-and-answer");
  assert.ok(house.bars[0].relationships.bass.phraseCellId.startsWith("house-"));
  assert.ok(hipHop.bars[0].relationships.bass.phraseCellId.startsWith("hiphop-"));
  assert.notDeepEqual(
    grooveDNAConductorLanes(house, 0).bassPulses,
    grooveDNAConductorLanes(hipHop, 0).bassPulses,
  );
});
