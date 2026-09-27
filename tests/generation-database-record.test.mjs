import assert from "node:assert/strict";
import test from "node:test";

import { createGenerationDatabaseRecord } from "../src/core/generation-database-record.js";
import { createProfessionalGenerationGauntletSong } from "../src/core/professional-gauntlet-song.js";
import { CANONICAL_MUSICAL_EVENT_SCHEMA } from "../src/core/canonical-musical-event.js";

function fixtureSong() {
  return {
    id: "song-1",
    schema: "midi-arcade/song@1",
    title: "Database Contract",
    seed: "database-contract",
    genre: "hipHop",
    bars: 2,
    meta: {
      key: "A",
      scale: "minor",
      tempo: 96,
      beatsPerBar: 4,
      timeSignature: [4, 4],
      scoreDetails: {
        totalScore: 91,
        candidateSearch: { totalCandidates: 4 },
        subscores: { groove: 93, harmony: 95, register: 89 },
      },
    },
    songBlueprint: {
      intent: { summary: "laid-back verse into a lifted hook" },
      sections: [{ sectionId: "verse" }, { sectionId: "chorus" }],
    },
    grooveConductor: {
      version: 4,
      subdivision: 0.25,
      swing: 0.12,
      bars: [
        { bar: 0, sectionId: "verse", anchors: [0, 2], answers: [1.5] },
        { bar: 1, sectionId: "chorus", anchors: [0, 2], answers: [1.75] },
      ],
    },
    harmony: [{ start: 0, root: "A", chord: "Am9" }],
    structure: [
      { id: "verse", name: "Verse", startBar: 0, bars: 1, energy: 0.5 },
      { id: "chorus", name: "Chorus", startBar: 1, bars: 1, energy: 0.82 },
    ],
    tracks: [
      {
        id: "bass",
        program: 38,
        notes: [
          { start: 0, duration: 1, pitch: 33, velocity: 92 },
          { start: 4, duration: 0.5, pitch: 36, velocity: 96, articulation: "slide" },
        ],
      },
      {
        id: "melody",
        program: 80,
        notes: [{ start: 4.5, duration: 0.5, pitch: 69, velocity: 88 }],
      },
    ],
  };
}

test("generation database record preserves canonical Groove DNA and rendered pitches", () => {
  const song = fixtureSong();
  const record = createGenerationDatabaseRecord({
    kind: "new",
    config: {
      genre: "hipHop",
      seed: "database-contract",
      bars: 2,
      thinkingDepth: "deep",
      adaptiveCandidates: true,
      weaknessAwareSearch: true,
      targetedRepair: true,
      producerBrain: { id: "producer-brain-v2", version: 2 },
    },
    song,
    runId: "generation-1",
    startedAt: "2026-09-24T02:00:00.000Z",
    completedAt: "2026-09-24T02:00:00.150Z",
    durationMs: 150,
    stages: [
      { stage: "plan", at: 100, detail: { blueprint: "producer-blueprint-v1" } },
      { stage: "compose", at: 120, detail: {} },
      { stage: "finalize", at: 230, detail: {} },
    ],
  });

  assert.equal(record.schema, "midi-arcade/generation-record@1");
  assert.deepEqual(JSON.parse(record.grooveDna.groove_json), song.grooveConductor);
  assert.deepEqual(
    record.musicalEvents.map((event) => event.pitch),
    [33, 36, 69],
    "database pitch must be the exact rendered pitch used by preview/export",
  );
  assert.equal(record.musicalEventSchema, CANONICAL_MUSICAL_EVENT_SCHEMA);
  const gauntletSong = createProfessionalGenerationGauntletSong(song);
  const persistedCanonicalEvents = record.musicalEvents.map((event) => JSON.parse(event.event_json));
  assert.deepEqual(
    persistedCanonicalEvents,
    gauntletSong.musicalEvents,
    "database must persist the exact canonical events consumed by the Gauntlet",
  );
  assert.equal(record.musicalEvents[1].section_id, "generation-1:section:chorus");
  assert.equal(record.sections[1].source_section_id, "chorus");
  assert.equal(record.generationRun.candidate_count, 4);
  assert.equal(record.generationRun.started_at, "2026-09-24T02:00:00.000Z");
  assert.equal(record.generationRun.completed_at, "2026-09-24T02:00:00.150Z");
  assert.equal(record.songVersion.version_number, 1);
  assert.equal(record.stages[0].started_at, "2026-09-24T02:00:00.000Z");
  assert.equal(record.stages[0].completed_at, "2026-09-24T02:00:00.020Z");
  assert.equal(record.stages[0].duration_ms, 20);
  assert.equal(record.debuggerEvents.length, 4);
  assert.equal(record.performanceShadow.mode, "diagnostic-only");
  assert.equal(record.performanceShadow.outputMutation, false);
  assert.equal(record.performanceShadow.technicalSafety.pitchPreserved, true);
  const shadowDebug = record.debuggerEvents.find((event) => event.code === "performance-shadow-v1");
  assert.ok(shadowDebug);
  assert.equal(shadowDebug.subsystem, "performance-shadow");
  assert.equal(JSON.parse(shadowDebug.context_json).id, "performance-shadow-v1");
  assert.equal(record.debuggerEvents[0].generation_run_id, "generation-1");
  assert.equal(record.debuggerEvents[0].song_id, "song-1");
  assert.equal(record.debuggerEvents[0].code, "stage-plan");
  assert.equal(record.debuggerEvents[0].occurred_at, "2026-09-24T02:00:00.000Z");
});


test("generation database record persists canonical and performed timing separately", () => {
  const song = fixtureSong();
  song.tracks[1].notes[0] = {
    ...song.tracks[1].notes[0],
    start: 4.48,
    duration: 0.44,
    velocity: 91,
    canonicalStartBeat: 4.5,
    canonicalDurationBeats: 0.5,
    canonicalVelocity: 88,
    microtimingMs: -10,
    source: "performance-engine",
    musicalReason: "delayed hook answer",
    rhythmSource: "chorus-pocket",
  };

  const record = createGenerationDatabaseRecord({
    song,
    runId: "generation-performance",
  });
  const row = record.musicalEvents.find((event) => event.pitch === 69);
  const event = JSON.parse(row.event_json);

  assert.equal(row.start_beat, 4.48);
  assert.equal(row.duration_beats, 0.44);
  assert.equal(row.velocity, 91);
  assert.equal(row.microtiming_ms, -10);
  assert.equal(row.source, "performance-engine");
  assert.equal(event.canonical.startBeat, 4.5);
  assert.equal(event.canonical.durationBeats, 0.5);
  assert.equal(event.canonical.velocity, 88);
  assert.equal(event.performed.startBeat, 4.48);
  assert.equal(event.performed.durationBeats, 0.44);
  assert.equal(event.performed.velocity, 91);
  assert.equal(event.intent.reason, "delayed hook answer");
  assert.equal(event.intent.rhythmSource, "chorus-pocket");
});

test("generation database record snapshots accepted song without mutating it", () => {
  const song = fixtureSong();
  const before = structuredClone(song);
  const record = createGenerationDatabaseRecord({ song, runId: "generation-2" });
  assert.deepEqual(song, before);
  assert.deepEqual(JSON.parse(record.song.snapshot_json), before);
  assert.deepEqual(JSON.parse(record.songVersion.snapshot_json), before);
});

test("generation database record rejects incomplete non-song payloads", () => {
  assert.throws(
    () => createGenerationDatabaseRecord({ song: { id: "broken" } }),
    /accepted song with tracks/,
  );
});
