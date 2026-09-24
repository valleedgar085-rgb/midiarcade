import assert from "node:assert/strict";
import test from "node:test";
import * as engine from "../src/music-engine.js";
import {
  PROFESSIONAL_GAUNTLET_ROLE_IDS,
  createProfessionalGenerationGauntletSong,
  validateProfessionalGenerationGauntletSong,
} from "../src/core/professional-gauntlet-song.js";

test("Professional Generation GauntletSong exposes one canonical musical authority", () => {
  const song = engine.generateNew({
    seed: "professional-gauntlet-song-contract",
    genre: "pop",
    key: "A",
    scale: "minor",
    bars: 16,
    energy: 0.72,
    complexity: 0.64,
    variation: 0.58,
    thinkingDepth: "deep",
  });

  const gauntletSong = createProfessionalGenerationGauntletSong(song);
  const validation = validateProfessionalGenerationGauntletSong(gauntletSong);

  assert.equal(gauntletSong.version, 1);
  assert.ok(gauntletSong.intent);
  assert.ok("blueprint" in gauntletSong);
  assert.ok(Array.isArray(gauntletSong.harmonyTimeline));
  assert.ok(Array.isArray(gauntletSong.grooveTimeline));
  assert.ok(Array.isArray(gauntletSong.sections));
  assert.ok(Array.isArray(gauntletSong.musicalEvents));
  assert.deepEqual(
    Object.keys(gauntletSong.instrumentRoles),
    PROFESSIONAL_GAUNTLET_ROLE_IDS,
  );
  assert.ok(gauntletSong.musicalEvents.length > 0);

  for (const event of gauntletSong.musicalEvents.slice(0, 64)) {
    assert.ok(Number.isFinite(event.time));
    assert.ok(Number.isFinite(event.duration));
    assert.ok(event.semanticPitch);
    assert.ok(Number.isInteger(event.renderedMidiPitch));
    assert.ok(Number.isInteger(event.velocity));
    assert.ok("chordContext" in event);
    assert.ok(event.motifId);
    assert.ok(event.phraseRole);
    assert.ok(event.articulation);
  }

  assert.equal(validation.passed, true, validation.issues.join(", "));
});

test("Professional Generation GauntletSong is deterministic for a fixed generated song", () => {
  const song = engine.generateNew({
    seed: "professional-gauntlet-determinism",
    genre: "hipHop",
    key: "C",
    scale: "minorPentatonic",
    bars: 8,
  });
  const first = createProfessionalGenerationGauntletSong(song);
  const second = createProfessionalGenerationGauntletSong(song);
  assert.deepEqual(first, second);
});
