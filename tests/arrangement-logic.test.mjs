import assert from "node:assert/strict";
import test from "node:test";
import {
  duplicateSongSection,
  executeArrangementCommand,
  repairArrangementTiming,
  validateArrangementSong,
} from "../src/ui/arrangement-logic.js";

function fixture() {
  const structure = [
    { id: "verse-1", name: "Verse", bars: 2, startBar: 0, startBeat: 0, endBeat: 8 },
    { id: "hook-1", name: "Hook", bars: 2, startBar: 2, startBeat: 8, endBeat: 16 },
  ];
  return {
    bars: 4,
    meta: { bars: 4, beatsPerBar: 4, totalBeats: 16 },
    structure,
    sections: structuredClone(structure),
    harmony: [
      { startBeat: 0, duration: 4, symbol: "Cm7" },
      { startBeat: 8, duration: 4, symbol: "Abmaj7" },
    ],
    tracks: [{
      id: "melody",
      notes: [
        { pitch: 60, start: 1, duration: 1, velocity: 90 },
        { pitch: 67, start: 9, duration: 1, velocity: 100 },
      ],
      automation: [{ type: "expression", start: 2, value: 0.7 }, { type: "expression", start: 10, value: 0.9 }],
    }],
    songBlueprint: { sectionPlans: [{ sectionId: "verse-1", role: "verse" }, { sectionId: "hook-1", role: "hook" }] },
  };
}

test("section duplication preserves the source, copies its complete performance, and shifts later material", () => {
  const source = fixture();
  const before = structuredClone(source);
  const result = duplicateSongSection(source, "verse-1");
  assert.ok(result);
  assert.deepEqual(source, before, "the arrangement operation must remain immutable");
  assert.equal(result.song.bars, 6);
  assert.equal(result.song.meta.totalBeats, 24);
  assert.deepEqual(result.song.structure.map(({ id, startBeat, endBeat }) => ({ id, startBeat, endBeat })), [
    { id: "verse-1", startBeat: 0, endBeat: 8 },
    { id: result.duplicateId, startBeat: 8, endBeat: 16 },
    { id: "hook-1", startBeat: 16, endBeat: 24 },
  ]);
  assert.deepEqual(result.song.tracks[0].notes.map(({ pitch, start }) => [pitch, start]), [
    [60, 1], [60, 9], [67, 17],
  ]);
  assert.deepEqual(result.song.tracks[0].automation.map(({ start }) => start), [2, 10, 18]);
  assert.deepEqual(result.song.harmony.map(({ startBeat, symbol }) => [startBeat, symbol]), [
    [0, "Cm7"], [8, "Cm7"], [16, "Abmaj7"],
  ]);
  assert.ok(result.song.songBlueprint.sectionPlans.some((plan) => plan.sectionId === result.duplicateId));
});

test("section duplication enforces structural limits and rejects malformed requests", () => {
  const song = fixture();
  assert.equal(duplicateSongSection(song, "missing"), null);
  assert.equal(duplicateSongSection(null, "verse-1"), null);
  assert.equal(duplicateSongSection(song, "verse-1", { maxBars: 5 }), null);
});

test("the command boundary duplicates immutably and reports its new focus", () => {
  const source = fixture();
  const before = structuredClone(source);
  const result = executeArrangementCommand(source, {
    type: "duplicate",
    sectionId: "verse-1",
    maxBars: 64,
  });
  assert.equal(result.changed, true);
  assert.deepEqual(source, before);
  assert.equal(result.song.structure[1].id, result.focusSectionId);
  assert.equal(result.command.type, "duplicate");
});

test("reorder relocates notes, automation, and harmony as one atomic command", () => {
  const source = fixture();
  const before = structuredClone(source);
  const result = executeArrangementCommand(source, {
    type: "reorder",
    sectionId: "hook-1",
    targetIndex: 0,
  });
  assert.equal(result.changed, true);
  assert.deepEqual(source, before);
  assert.deepEqual(result.song.structure.map(({ id, startBeat }) => [id, startBeat]), [
    ["hook-1", 0],
    ["verse-1", 8],
  ]);
  assert.deepEqual(result.song.tracks[0].notes.map(({ pitch, start }) => [pitch, start]), [
    [67, 1],
    [60, 9],
  ]);
  assert.deepEqual(result.song.tracks[0].automation.map(({ start }) => start), [2, 10]);
  assert.deepEqual(result.song.harmony.map(({ startBeat, symbol }) => [startBeat, symbol]), [
    [0, "Abmaj7"],
    [8, "Cm7"],
  ]);
});

test("section transforms stay inside their target and preserve velocity limits", () => {
  const source = fixture();
  const outsideNote = structuredClone(source.tracks[0].notes[1]);
  const energy = executeArrangementCommand(source, {
    type: "transform",
    sectionId: "verse-1",
    operation: "energy",
    value: "high",
  });
  assert.equal(energy.changed, true);
  assert.deepEqual(source.tracks[0].notes[1], outsideNote);
  assert.deepEqual(energy.song.tracks[0].notes[1], outsideNote);
  assert.ok(energy.song.tracks[0].notes[0].velocity <= 120);

  const build = executeArrangementCommand(source, {
    type: "transform",
    sectionId: "verse-1",
    operation: "build",
  });
  assert.equal(build.changed, true);
  assert.ok(build.song.tracks[0].notes[0].velocity <= 120);
});

test("the command boundary rejects unsupported and malformed requests without throwing", () => {
  assert.deepEqual(executeArrangementCommand(null, { type: "reorder" }), {
    changed: false,
    error: "invalid-command",
  });
  assert.equal(executeArrangementCommand(fixture(), { type: "unknown" }).changed, false);
  assert.equal(executeArrangementCommand({ structure: [{ id: "a", bars: 1 }] }, {
    type: "transform",
    sectionId: "a",
    operation: "energy",
    value: "high",
  }).changed, false);
});

test("arrangement validation protects contiguous sections and bounded performance data", () => {
  assert.deepEqual(validateArrangementSong(fixture()), {
    valid: true,
    totalBars: 4,
    totalBeats: 16,
  });
  const duplicateIds = fixture();
  duplicateIds.structure[1].id = "verse-1";
  assert.equal(validateArrangementSong(duplicateIds).error, "invalid-section-identity");
  const gap = fixture();
  gap.structure[1].startBeat = 9;
  assert.equal(validateArrangementSong(gap).error, "noncontiguous-sections");
  const overflow = fixture();
  overflow.tracks[0].notes[1].duration = 8;
  assert.equal(validateArrangementSong(overflow).error, "invalid-track-events");
});

test("commands relocate beat-keyed automation and reject true musical no-ops", () => {
  const source = fixture();
  source.tracks[0].automation = [{ type: "cc", controller: 11, beat: 2, value: 80 }];
  const moved = executeArrangementCommand(source, {
    type: "reorder",
    sectionId: "verse-1",
    targetIndex: 1,
  });
  assert.equal(moved.changed, true);
  assert.equal(moved.song.tracks[0].automation[0].beat, 10);

  const noOp = executeArrangementCommand(source, {
    type: "transform",
    sectionId: "verse-1",
    operation: "tension",
    value: "balanced",
  });
  assert.equal(noOp.changed, false);
  assert.equal(noOp.error, "no-musical-change");
  assert.equal(executeArrangementCommand(source, {
    type: "transform",
    sectionId: "verse-1",
    operation: "pocket",
    value: "impossible",
  }).error, "invalid-transform");
});

test("timing preflight repairs derived section metadata without rewriting music", () => {
  const source = fixture();
  const originalTracks = structuredClone(source.tracks);
  source.structure[1].startBar = 9;
  source.structure[1].startBeat = 36;
  source.meta.totalBeats = 44;
  const repaired = repairArrangementTiming(source);
  assert.ok(repaired);
  assert.deepEqual(repaired.tracks, originalTracks);
  assert.equal(repaired.structure[1].startBeat, 8);
  assert.equal(repaired.meta.totalBeats, 16);
  assert.equal(validateArrangementSong(repaired).valid, true);

  const command = executeArrangementCommand(source, {
    type: "transform",
    sectionId: "verse-1",
    operation: "energy",
    value: "high",
  });
  assert.equal(command.changed, true);
  assert.equal(command.repaired, true);
  assert.equal(command.song.structure[1].startBeat, 8);
});

test("timing repair refuses ambiguous identities and destructive event correction", () => {
  const duplicateIds = fixture();
  duplicateIds.structure[1].id = "verse-1";
  assert.equal(repairArrangementTiming(duplicateIds), null);

  const overflowingNote = fixture();
  overflowingNote.structure[1].startBeat = 9;
  overflowingNote.tracks[0].notes[1].duration = 20;
  assert.equal(repairArrangementTiming(overflowingNote), null);
});
