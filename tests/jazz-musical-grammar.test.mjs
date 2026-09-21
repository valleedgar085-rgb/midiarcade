import assert from "node:assert/strict";
import test from "node:test";

import {
  JAZZ_ARCHETYPES,
  JAZZ_PHRASE_TRANSFORMATIONS,
  createJazzGrammarDirective,
  jazzArchetypeForSong,
} from "../src/core/jazz-musical-grammar.js";
import { createDirectorDirective } from "../src/core/blueprint-composer.js";
import { diagnoseCompositionCandidate } from "../src/core/composition-self-correction.js";

function jazzSong(seed = "jazz-grammar-fixture") {
  return {
    id: "jazz-song",
    seed,
    genre: "jazz",
    meta: { genre: "jazz", beatsPerBar: 4, bars: 4 },
    structure: [{ id: "head-1", name: "verse", startBeat: 0, endBeat: 16, bars: 4 }],
    harmony: [{ start: 0, duration: 16, tones: [0, 4, 7, 11] }],
    tracks: [
      { id: "drums", notes: [] },
      { id: "bass", notes: [] },
      { id: "chords", notes: [] },
      { id: "melody", notes: [] },
      { id: "counterpoint", notes: [] },
      { id: "pad", notes: [] },
    ],
  };
}

test("Jazz archetype selection is deterministic and uses the bounded vocabulary", () => {
  const source = jazzSong("same-seed");
  const first = jazzArchetypeForSong(source);
  const second = jazzArchetypeForSong(source);
  assert.deepEqual(first, second);
  assert.ok(JAZZ_ARCHETYPES[first.id]);
  assert.ok(first.walkingBias >= 0 && first.walkingBias <= 1);
});

test("explicit Jazz archetype remains authoritative", () => {
  const source = jazzSong("any-seed");
  source.meta.jazzArchetype = "cool";
  assert.equal(jazzArchetypeForSong(source).id, "cool");
});

test("Jazz grammar carries guide-tone, walking-bass, phrase and conservative fallback intent", () => {
  const grammar = createJazzGrammarDirective(jazzSong(), {
    target: "section-track",
    sectionId: "head-1",
    trackId: "bass",
  });
  assert.equal(grammar.selection.trackId, "bass");
  assert.ok(grammar.harmony.priorities.includes("guide-tones-3rd-7th"));
  assert.equal(grammar.walkingBass.nextHarmonyApproach, true);
  assert.ok(JAZZ_PHRASE_TRANSFORMATIONS.includes("enclosure"));
  assert.equal(grammar.chromaticism.executionEnabled, false);
  assert.equal(grammar.fallback.neverRelaxReleaseGate, true);
});

test("Director embeds Jazz grammar without changing selection authority", () => {
  const directive = createDirectorDirective(jazzSong(), {
    target: "section-track",
    sectionId: "head-1",
    trackId: "melody",
  });
  assert.equal(directive.selection.trackId, "melody");
  assert.equal(directive.jazzGrammar.selection.trackId, "melody");
  assert.ok(directive.jazzGrammar.archetype.id);
});

test("Jazz critic failures route into focused self-correction", () => {
  const walking = diagnoseCompositionCandidate({
    validation: {
      valid: false,
      issues: ["jazz:walking-bass-regression"],
    },
  });
  assert.equal(walking.shouldRetry, true);
  assert.equal(walking.focusGroup, "groove");
  assert.equal(walking.focusRoute, "groove-first");

  const guide = diagnoseCompositionCandidate({
    validation: {
      valid: false,
      issues: ["jazz:guide-tone-regression"],
    },
  });
  assert.equal(guide.focusGroup, "harmony");
  assert.equal(guide.focusRoute, "harmony-first");
});
