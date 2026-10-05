import assert from "node:assert/strict";
import test from "node:test";
import {
  diagnoseCandidateRepair,
  diagnoseSurgicalRepairWindow,
  evaluateSongCandidate,
  generateNew,
  spliceNotesInSurgicalWindow,
} from "../src/music-engine.js";

function notesOutsideWindow(track, window) {
  return (track?.notes ?? []).filter((note) => (
    note.start < window.startBeat - 1e-6 || note.start >= window.endBeat - 1e-6
  )).map(({ pitch, start, duration, velocity }) => ({ pitch, start, duration, velocity }));
}

function musicalNoteEvents(track) {
  return (track?.notes ?? []).map(({ pitch, start, duration, velocity }) => ({ pitch, start, duration, velocity }));
}

test("Producer Brain chooses a deterministic 2-8 bar surgical repair window", () => {
  const song = generateNew({
    seed: "surgical-window-diagnosis",
    genre: "techno",
    bars: 16,
    candidateCount: 1,
    energy: 0.72,
    complexity: 0.68,
  });
  const diagnosis = diagnoseCandidateRepair(evaluateSongCandidate(song));
  const first = diagnoseSurgicalRepairWindow(song, diagnosis);
  const second = diagnoseSurgicalRepairWindow(song, diagnosis);

  assert.ok(diagnosis);
  assert.ok(first);
  assert.deepEqual(first, second, "window diagnosis must remain deterministic");
  assert.ok(first.bars >= 2 && first.bars <= 8, `expected 2-8 bars, received ${first.bars}`);
  assert.equal(first.endBar - first.startBar, first.bars);
  assert.ok(first.startBeat >= 0 && first.endBeat <= song.meta.totalBeats + 1e-6);
  assert.ok(first.endBeat > first.startBeat);
  assert.ok(first.phraseWindowIds.length >= 1 && first.phraseWindowIds.length <= 2);
  assert.equal(first.focusDimension, diagnosis.weakestDimension);

  const section = song.structure.find((candidate) => candidate.id === first.sectionId);
  assert.ok(section, "surgical window must resolve to a real section");
  assert.ok(first.startBar >= section.startBar);
  assert.ok(first.endBar <= section.startBar + section.bars);
});

test("surgical splice preserves every source event outside its diagnosed window", () => {
  const window = { startBeat: 8, endBeat: 16 };
  const source = [
    { pitch: 60, start: 4, duration: 0.5, velocity: 80 },
    { pitch: 62, start: 9, duration: 0.5, velocity: 82 },
    { pitch: 64, start: 13, duration: 0.5, velocity: 84 },
    { pitch: 65, start: 18, duration: 0.5, velocity: 86 },
  ];
  const repaired = [
    { pitch: 72, start: 2, duration: 1, velocity: 110 },
    { pitch: 67, start: 9.5, duration: 0.75, velocity: 92 },
    { pitch: 69, start: 14, duration: 0.25, velocity: 94 },
    { pitch: 74, start: 20, duration: 1, velocity: 112 },
  ];

  const first = spliceNotesInSurgicalWindow(source, repaired, window);
  const second = spliceNotesInSurgicalWindow(source, repaired, window);

  assert.deepEqual(first, second, "surgical splicing must remain deterministic");
  assert.deepEqual(
    first.filter((note) => note.start < 8 || note.start >= 16),
    [source[0], source[3]],
    "events outside the diagnosed window must come only from the source",
  );
  assert.deepEqual(
    first.filter((note) => note.start >= 8 && note.start < 16),
    [repaired[1], repaired[2]],
    "events inside the diagnosed window must come only from the repaired candidate",
  );
});

