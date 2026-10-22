import assert from "node:assert/strict";
import test from "node:test";

import {
  MIDI_ARCADE_DB_SCHEMA_VERSION,
  databaseMigrationPlan,
} from "../src/core/database-schema.js";
import { buildGenerationPersistenceSnapshot } from "../src/core/generation-persistence.js";

test("database migration plan is versioned and idempotent", () => {
  assert.equal(MIDI_ARCADE_DB_SCHEMA_VERSION, 1);
  assert.equal(databaseMigrationPlan(1).length, 0);
  const migrations = databaseMigrationPlan(0);
  assert.equal(migrations.length, 1);
  assert.match(migrations[0].sql, /CREATE TABLE IF NOT EXISTS groove_dna/);
  assert.match(migrations[0].sql, /CREATE TABLE IF NOT EXISTS musical_events/);
});

test("generation snapshot preserves blueprint and canonical groove authority", () => {
  const song = {
    seed: "fixed-seed",
    meta: { genre: "hipHop", bars: 8 },
    songBlueprint: {
      id: "blueprint-1",
      narrative: { label: "rise-and-payoff" },
    },
    grooveConductor: {
      version: 4,
      subdivision: 0.25,
      bars: [{ bar: 0, kickPulses: [0, 2.75] }],
    },
    harmony: [{ bar: 0, chord: "Am9" }],
    structure: [{ id: "intro", startBar: 0, endBar: 3 }],
    tracks: [{
      role: "bass",
      notes: [{ startBeat: 0, duration: 1, pitch: 40, velocity: 96 }],
    }],
  };
  const before = structuredClone(song);

  const snapshot = buildGenerationPersistenceSnapshot({
    runId: "run-1",
    songId: "song-1",
    kind: "new",
    config: { seed: "fixed-seed", genre: "hipHop", bars: 8 },
    song,
  });

  assert.deepEqual(song, before);
  assert.equal(snapshot.blueprint.blueprint.id, "blueprint-1");
  assert.equal(snapshot.grooveDna.groove.version, 4);
  assert.equal(snapshot.grooveDna.subdivision, 0.25);
  assert.equal(snapshot.sections[0].sectionId, "intro");
  assert.equal(snapshot.tracks[0].role, "bass");
  assert.equal(snapshot.tracks[0].track.notes, undefined, "track metadata must not duplicate persisted note events");
  assert.equal(snapshot.musicalEvents[0].pitch, 40);
});

test("snapshot rejects missing run and song identities", () => {
  assert.throws(() => buildGenerationPersistenceSnapshot({ songId: "song-1" }), /runId/);
  assert.throws(() => buildGenerationPersistenceSnapshot({ runId: "run-1" }), /songId/);
});
