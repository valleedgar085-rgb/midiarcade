import assert from "node:assert/strict";
import test from "node:test";

import {
  GENRE_GROOVE_GRAMMARS,
  createGrooveDNA,
  grooveDNAConductorLanes,
  validateGrooveDNA,
} from "../src/core/groove-intelligence.js";
import { generateNew } from "../src/music-engine.js";
import { analyzeCompositionCandidate } from "../src/core/composition-candidate-judge.js";

const STRUCTURE = [
  { id: "verse-1", name: "verse", startBar: 0, bars: 2 },
  { id: "prechorus-1", name: "prechorus", startBar: 2, bars: 1 },
  { id: "chorus-1", name: "chorus", startBar: 3, bars: 1 },
];

const TARGET_GENRES = ["hipHop", "trap", "pop", "house", "neoSoul", "jazz", "rock"];

function dna(genre, seed = "groove-dna") {
  return createGrooveDNA({
    seed: `${seed}:${genre}`,
    genre,
    bars: 4,
    beatsPerBar: 4,
    complexity: 0.68,
    variation: 0.56,
  }, { structure: STRUCTURE });
}

function overlaps(values, protectedSpaces) {
  return values.some((value) => protectedSpaces.some((space) => Math.abs(value - space) < 1e-6));
}

function onsetPhases(notes, pitch = null) {
  return notes
    .filter((note) => pitch == null || note.pitch === pitch)
    .map((note) => Math.round((((note.start % 4) + 4) % 4) * 1000) / 1000);
}

test("Groove DNA compiles base rhythm -> probability -> density -> variation -> humanization -> mapping", () => {
  const result = dna("hipHop", "pipeline");
  assert.deepEqual(result.pipeline, [
    "base-rhythm",
    "probability",
    "density-transform",
    "variation",
    "humanization",
    "instrument-mapping",
  ]);
  assert.equal(result.barCount, 4);
  assert.equal(result.bars.length, 4);
  assert.equal(validateGrooveDNA(result).passed, true);

  const first = result.bars[0];
  for (const lane of ["kick", "snare", "hat", "percussion"]) {
    assert.ok(Array.isArray(first[lane].requiredSteps));
    assert.ok(Array.isArray(first[lane].optionalSteps));
    assert.ok(Array.isArray(first[lane].protectedSteps));
    assert.ok(Array.isArray(first[lane].baseSteps));
    assert.ok(Array.isArray(first[lane].probabilitySteps));
    assert.ok(Array.isArray(first[lane].densitySteps));
    assert.ok(Array.isArray(first[lane].steps));
    assert.ok(Array.isArray(first[lane].events));
  }
});

test("Groove DNA is deterministic for every target genre", () => {
  for (const genre of TARGET_GENRES) {
    const first = dna(genre, "deterministic");
    const second = dna(genre, "deterministic");
    assert.deepEqual(first, second, `${genre} Groove DNA must be fixed-seed deterministic`);
  }
});

test("required identity anchors survive while density cannot populate protected phrase rests", () => {
  for (const genre of TARGET_GENRES) {
    const result = dna(genre, "protected-space");
    for (const bar of result.bars) {
      for (const lane of ["kick", "snare", "hat", "percussion"]) {
        const pulses = bar[lane].steps.map((step) => step * result.beatsPerStep);
        assert.equal(
          overlaps(pulses, bar.protectedSpaces),
          false,
          `${genre} ${lane} violated protected space in bar ${bar.bar}`,
        );
        for (const required of bar[lane].requiredSteps) {
          assert.ok(
            bar[lane].steps.some((step) => Math.abs(step - required) < 1e-6),
            `${genre} ${lane} lost required step ${required}`,
          );
        }
      }
    }
  }
});

test("the seven target genres select seven distinct structural grammar identities", () => {
  const results = TARGET_GENRES.map((genre) => dna(genre, "separability"));
  assert.equal(new Set(results.map((entry) => entry.grammarId)).size, TARGET_GENRES.length);

  const hipHop = results.find((entry) => entry.genre === "hipHop");
  const trap = results.find((entry) => entry.genre === "trap");
  const house = results.find((entry) => entry.genre === "house");
  const jazz = results.find((entry) => entry.genre === "jazz");

  assert.deepEqual(house.grammar.kick.required, [0, 4, 8, 12]);
  assert.deepEqual(trap.grammar.snare.required, [8]);
  assert.deepEqual(hipHop.grammar.snare.required, [4, 12]);
  assert.notDeepEqual(trap.grammar.hat.base, house.grammar.hat.base);
  assert.ok(jazz.humanization.swing > house.humanization.swing);
});

test("House conductor identity remains four-floor plus offbeat hats", () => {
  const result = dna("house", "house-foundation");
  for (let bar = 0; bar < result.barCount; bar += 1) {
    const lanes = grooveDNAConductorLanes(result, bar);
    assert.deepEqual(lanes.anchors, [0, 1, 2, 3]);
    assert.deepEqual(lanes.hatPulses, [0.5, 1.5, 2.5, 3.5]);
  }
});

test("Jazz keeps a stable quarter-note ride foundation as variation changes", () => {
  const steady = createGrooveDNA({
    seed: "jazz-ride-foundation",
    genre: "jazz",
    bars: 8,
    beatsPerBar: 4,
    complexity: 0.68,
    variation: 0,
  });
  const varied = createGrooveDNA({
    seed: "jazz-ride-foundation",
    genre: "jazz",
    bars: 8,
    beatsPerBar: 4,
    complexity: 0.68,
    variation: 1,
  });
  for (const result of [steady, varied]) {
    for (let bar = 0; bar < result.barCount; bar += 1) {
      const lanes = grooveDNAConductorLanes(result, bar);
      for (const beat of [0, 1, 2, 3]) {
        assert.ok(lanes.hatPulses.some((pulse) => Math.abs(pulse - beat) < 0.001));
      }
    }
  }
  assert.deepEqual(varied.bars.map((bar) => bar.hat.steps), steady.bars.map((bar) => bar.hat.steps));
});

test("generated Jazz maps its timekeeper and accents to consistent ride voices", () => {
  const song = generateNew({
    seed: "jazz-ride-voices",
    genre: "jazz",
    bars: 8,
    candidateCount: 1,
  });
  const drums = song.tracks.find((track) => track.id === "drums")?.notes ?? [];
  const ride = drums.filter((note) => note.grooveSource === "jazz-swing-conversation.hat");
  const accents = drums.filter((note) => note.grooveSource === "jazz-swing-conversation.percussion");
  assert.ok(ride.length >= 24);
  assert.ok(accents.length > 0);
  assert.ok(ride.every((note) => note.pitch === 51));
  assert.ok(accents.every((note) => note.pitch === 53));
});

test("Trap and Hip-Hop are not variants of the same kick/snare/hat skeleton", () => {
  const hipHop = dna("hipHop", "hiphop-v-trap");
  const trap = dna("trap", "hiphop-v-trap");
  const hipHopBars = hipHop.bars.map((bar) => ({
    kick: bar.kick.steps,
    snare: bar.snare.steps,
    hat: bar.hat.steps,
  }));
  const trapBars = trap.bars.map((bar) => ({
    kick: bar.kick.steps,
    snare: bar.snare.steps,
    hat: bar.hat.steps,
  }));
  assert.notDeepEqual(hipHopBars, trapBars);
  assert.equal(trap.relationships.bass.mode, "808-interlock");
  assert.equal(hipHop.relationships.bass.mode, "lock-and-answer");
});

test("Neo-Soul publishes elastic rhythm-section relationships rather than hard kick cloning", () => {
  const result = dna("neoSoul", "elastic-pocket");
  assert.equal(result.relationships.bass.mode, "elastic-answer");
  assert.ok(result.relationships.bass.lock < 0.7);
  assert.equal(result.relationships.chords.mode, "anticipate-backbeat");
  assert.equal(result.relationships.lead.mode, "behind-beat-conversation");
  assert.ok(result.humanization.laidBackBeats > 0);
});

test("generated House uses Groove DNA kick and hat lanes", () => {
  const song = generateNew({
    seed: "groove-dna-house-integration",
    genre: "house",
    key: "A",
    scale: "minor",
    bars: 8,
    candidateCount: 1,
    variation: 0.52,
    complexity: 0.62,
  });
  assert.equal(song.grooveConductor?.version, 5);
  assert.equal(song.grooveConductor?.grooveDNA?.grammarId, "house-four-floor-interlock");
  const drums = song.tracks.find((track) => track.id === "drums")?.notes ?? [];
  const firstBar = drums.filter((note) => note.start >= 0 && note.start < 4);
  const kickPhases = onsetPhases(firstBar, 36);
  for (const beat of [0, 1, 2, 3]) {
    assert.ok(
      kickPhases.some((phase) => Math.abs(phase - beat) < 0.08),
      `House lost four-floor kick at ${beat}`,
    );
  }
});

test("Groove DNA metadata no longer automatically disables humanization", () => {
  const song = generateNew({
    seed: "groove-metadata-humanization",
    genre: "hipHop",
    bars: 8,
    candidateCount: 1,
    humanize: 0.7,
    swing: 0.2,
  });
  const drums = song.tracks.find((track) => track.id === "drums")?.notes ?? [];
  const grammarNotes = drums.filter((note) => note.grooveSource && !note.preserveSubdivision && !note.preserveTiming);
  assert.ok(grammarNotes.length > 0, "expected Groove DNA provenance notes");
  assert.ok(
    grammarNotes.some((note) => Math.abs(note.start * 4 - Math.round(note.start * 4)) > 0.005),
    "Groove DNA provenance should not force every note to an exact subdivision",
  );
});

test("target grammar catalog remains explicit and reviewable", () => {
  const ids = Object.values(GENRE_GROOVE_GRAMMARS).map((grammar) => grammar.id);
  for (const expected of [
    "hip-hop-pocket",
    "trap-subdivision-engine",
    "pop-pulse-lift",
    "house-four-floor-interlock",
    "neo-soul-elastic-pocket",
    "jazz-swing-conversation",
    "rock-kit-riff-drive",
  ]) {
    assert.ok(ids.includes(expected), `missing structural groove grammar ${expected}`);
  }
});


test("candidate judge recognizes House offbeat bass as correct interlock instead of weak kick lock", () => {
  const song = generateNew({
    seed: "house-relationship-judge",
    genre: "house",
    bars: 8,
    candidateCount: 1,
    humanize: 0,
  });
  const analysis = analyzeCompositionCandidate(song, { target: "song" });
  assert.ok(
    analysis.groove.kickBass.lock >= 0.6,
    `House relationship fit was only ${analysis.groove.kickBass.lock}`,
  );
  assert.ok(
    analysis.groove.kickBass.distribution.offbeat > 0,
    "House should expose offbeat bass relationship events",
  );
});


test("full-song intros use a one-way opening boundary instead of entering mid-loop", () => {
  const structure = [
    { id: "intro-1", name: "intro", startBar: 0, bars: 2 },
    { id: "verse-1", name: "verse", startBar: 2, bars: 6 },
    { id: "chorus-1", name: "chorus", startBar: 8, bars: 4 },
  ];

  for (const genre of ["hipHop", "trap", "pop", "house", "neoSoul", "rock"]) {
    const result = createGrooveDNA({
      seed: `opening-boundary:${genre}`,
      genre,
      bars: 12,
      beatsPerBar: 4,
      complexity: 0.68,
      variation: 0.56,
    }, { structure });
    const opening = result.bars[0];
    assert.equal(opening.openingBoundary, true, `${genre} should mark the first intro bar as an opening boundary`);
    assert.ok(opening.kick.steps.some((step) => Math.abs(step) < 1e-6), `${genre} should establish beat one`);
    assert.ok(
      opening.snare.steps.every((step) => step >= 8 - 1e-6),
      `${genre} should not play a backbeat as though the intro began before beat one`,
    );
    assert.ok(
      opening.percussion.steps.every((step) => step >= 12 - 1e-6),
      `${genre} opening percussion should enter as a late-bar pickup, not a pre-existing loop`,
    );
    assert.equal(result.bars[1].openingBoundary, false);
  }
});

test("short loop sketches preserve immediate Groove DNA behavior", () => {
  const structure = [
    { id: "intro-1", name: "intro", startBar: 0, bars: 2 },
    { id: "idea-1", name: "idea", startBar: 2, bars: 6 },
  ];
  const result = createGrooveDNA({
    seed: "short-loop-opening-boundary",
    genre: "house",
    bars: 8,
    beatsPerBar: 4,
    complexity: 0.68,
    variation: 0.56,
  }, { structure });

  assert.equal(result.bars[0].openingBoundary, false);
  assert.deepEqual(result.bars[0].kick.requiredSteps, [0, 4, 8, 12]);
  assert.deepEqual(result.bars[0].hat.requiredSteps, [2, 6, 10, 14]);
});
