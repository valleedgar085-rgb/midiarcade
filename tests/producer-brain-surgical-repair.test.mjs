import assert from "node:assert/strict";
import test from "node:test";
import {
  diagnoseCandidateRepair,
  diagnoseSurgicalRepairWindow,
  evaluateSongCandidate,
  generateNew,
} from "../src/music-engine.js";

function notesOutsideWindow(track, window) {
  return (track?.notes ?? []).filter((note) => (
    note.start < window.startBeat - 1e-6 || note.start >= window.endBeat - 1e-6
  ));
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

test("a winning surgical repair preserves every event outside its diagnosed window", () => {
  const input = {
    seed: "surgical-accept-jazz-8-0",
    bars: 8,
    genre: "jazz",
    energy: 0.05,
    complexity: 0.05,
  };
  const source = generateNew({ ...input, targetedRepair: false });
  const repaired = generateNew(input);
  const repeated = generateNew(input);
  const details = repaired.meta.scoreDetails;
  const repair = details.criticRepair;

  assert.deepEqual(repaired, repeated, "surgical regeneration must remain deterministic");
  assert.ok(repair.surgicalAttempts >= 1, "the repair pass should attempt at least one local window");
  assert.equal(repair.surgicalWindows.length, repair.surgicalAttempts);
  assert.ok(repair.surgicalWindows.every((window) => window.bars >= 2 && window.bars <= 8));
  assert.ok(repair.acceptanceHistory.some((entry) => entry.repairMode === "surgical-window"));
  assert.equal(repair.selectedFromRepair, true, "the verified surgical seed should select its accepted repair");
  assert.equal(repaired.criticRepair.mode, "surgical-window");

  const window = repaired.criticRepair.surgicalWindow;
  const surgicalTracks = new Set(repaired.criticRepair.surgicalTracks);
  assert.ok(window && window.bars >= 2 && window.bars <= 8);
  assert.ok(surgicalTracks.size > 0);

  for (const repairedTrack of repaired.tracks) {
    const sourceTrack = source.tracks.find((track) => track.id === repairedTrack.id);
    assert.ok(sourceTrack, `missing source track ${repairedTrack.id}`);
    if (!surgicalTracks.has(repairedTrack.id)) {
      assert.deepEqual(
        repairedTrack.notes,
        sourceTrack.notes,
        `${repairedTrack.id} must remain completely untouched by a surgical repair`,
      );
      continue;
    }
    assert.deepEqual(
      notesOutsideWindow(repairedTrack, window),
      notesOutsideWindow(sourceTrack, window),
      `${repairedTrack.id} changed outside the surgical repair window`,
    );
  }

  const selected = details.candidateScores.find((candidate) => candidate.index === details.selectedCandidate);
  assert.equal(selected.repairMode, "surgical-window");
  assert.equal(selected.repairWindowId, window.id);
  assert.equal(selected.repairWindowBars, window.bars);
});
