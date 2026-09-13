import assert from "node:assert/strict";
import test from "node:test";

import { continueElementLineage } from "../src/core/elemental-lineage.js";
import { createGenerationRunner } from "../src/core/generation-runner.js";
import { generateProducerVariationSet } from "../src/core/producer-variation-set.js";

function track(id, program, settings = {}) {
  return {
    id,
    program,
    settings: {
      volume: 0.7,
      velocity: 0.9,
      reverb: 0.22,
      cutoff: 7000,
      resonance: 0.2,
      gate: 0.8,
      ...settings,
    },
  };
}

function sourceFireSong() {
  return {
    id: "fire-parent",
    title: "Family Record",
    meta: { key: "A", mode: "minor", tempo: 96, bars: 32 },
    settings: { bars: 32, chordPath: "Am-F-C-G" },
    tracks: [
      track("drums", 16),
      track("bass", 38),
      track("chords", 61),
      track("melody", 81),
      track("counterpoint", 86),
      track("pad", 90),
    ],
    variationSet: {
      id: "elemental-variation-root",
      element: {
        id: "fire",
        label: "Fire",
        symbol: "🔥",
        description: "Heat, punch and impact",
        intensity: 0.9,
        meter: { label: "Heat", value: 2700, unit: "°F" },
      },
      moodIntent: {
        id: "romantic",
        label: "Romantic",
        description: "Warm emotional intent",
      },
    },
  };
}

function genericGenerated(id = "similar-child") {
  return {
    id,
    title: "Generated",
    meta: {
      key: "A",
      mode: "minor",
      tempo: 96,
      bars: 32,
      scoreDetails: {
        totalScore: 91,
        subscores: {
          groove: 91,
          transitions: 90,
          harmony: 92,
          phraseResolution: 91,
          hook: 90,
          arrangement: 91,
        },
        balance: { balanceScore: 91 },
        releaseGate: { passed: true },
      },
    },
    settings: { bars: 32, chordPath: "Am-F-C-G" },
    tracks: [
      track("drums", 0),
      track("bass", 33),
      track("chords", 4),
      track("melody", 73),
      track("counterpoint", 10),
      track("pad", 88),
    ],
  };
}

test("selected element continues through Similar with production identity intact", () => {
  const source = sourceFireSong();
  const generated = genericGenerated();
  const originalCutoff = generated.tracks.find((entry) => entry.id === "melody").settings.cutoff;

  const result = continueElementLineage(source, generated);

  assert.equal(result, generated);
  assert.equal(result.variationSet, undefined, "Similar descendant must not masquerade as an original sibling card");
  assert.equal(result.elementLineage.element.id, "fire");
  assert.equal(result.elementLineage.element.intensity, 0.9);
  assert.equal(result.elementLineage.moodIntent.id, "romantic");
  assert.equal(result.elementLineage.rootFamilyId, "elemental-variation-root");
  assert.equal(result.elementLineage.depth, 1);
  assert.equal(result.tracks.find((entry) => entry.id === "melody").program, 81, "Fire sound family should remain recognizable");
  assert.ok(
    result.tracks.find((entry) => entry.id === "melody").settings.cutoff > originalCutoff,
    "Fire tone shaping should survive the Similar continuation",
  );
});

test("repeated Similar keeps the root family and increments lineage depth", () => {
  const first = continueElementLineage(sourceFireSong(), genericGenerated("child-1"));
  const second = continueElementLineage(first, genericGenerated("child-2"));

  assert.equal(second.elementLineage.element.id, "fire");
  assert.equal(second.elementLineage.depth, 2);
  assert.equal(second.elementLineage.parentSongId, "child-1");
  assert.equal(second.elementLineage.rootFamilyId, "elemental-variation-root");
  assert.equal(second.tracks.find((entry) => entry.id === "bass").program, 38);
});

test("non-elemental Similar remains untouched", () => {
  const source = genericGenerated("plain-source");
  const generated = genericGenerated("plain-child");
  const before = JSON.stringify(generated);
  const result = continueElementLineage(source, generated);
  assert.equal(result, generated);
  assert.equal(JSON.stringify(result), before);
});

test("fallback generation runner applies the same elemental Similar contract", async () => {
  const runner = createGenerationRunner({
    generateNew: () => genericGenerated("new"),
    generateSimilar: () => genericGenerated("fallback-child"),
  });

  const result = await runner.generate("similar", { sourceSong: sourceFireSong(), config: { seed: "fallback" } });
  assert.equal(result.status, "committed");
  assert.equal(result.song.elementLineage.element.id, "fire");
  assert.equal(result.song.tracks.find((entry) => entry.id === "chords").program, 61);
});

test("new elemental family after Similar inherits the carried mood intent", () => {
  const similar = continueElementLineage(sourceFireSong(), genericGenerated("lineage-source"));
  const variations = generateProducerVariationSet(similar, {
    seed: "lineage-family",
    candidatesPerVariation: 1,
  }, {
    generateSimilar: (_current, config) => ({
      ...genericGenerated(config.seed),
      seed: config.seed,
      meta: {
        ...genericGenerated(config.seed).meta,
        key: config.key,
        mode: config.mode,
        tempo: config.tempo,
      },
    }),
  });

  assert.equal(variations.length, 3);
  assert.deepEqual(variations.map((song) => song.variationSet.element.id), ["fire", "electric", "drip"]);
  assert.ok(variations.every((song) => song.variationSet.moodIntent.id === "romantic"));
});
