import assert from "node:assert/strict";
import test from "node:test";

import { evaluateWholeSongCompletion } from "../src/core/whole-song-completion.js";
import { generateNew, refreshCommittedGenerationDiagnostics } from "../src/music-engine.js";

function note(start, pitch = 60, velocity = 90, duration = 0.5) {
  return { start, pitch, velocity, duration };
}

function completeFixture(genre = "hipHop") {
  const structure = [
    { id: "intro-1", name: "intro", startBeat: 0, endBeat: 4, bars: 1 },
    { id: "verse-1", name: "verse", startBeat: 4, endBeat: 12, bars: 2 },
    { id: "chorus-1", name: "chorus", startBeat: 12, endBeat: 20, bars: 2 },
    { id: "verse-2", name: "verse", startBeat: 20, endBeat: 28, bars: 2 },
    { id: "bridge-1", name: "bridge", startBeat: 28, endBeat: 32, bars: 1 },
    { id: "chorus-2", name: "chorus", startBeat: 32, endBeat: 40, bars: 2 },
    { id: "outro-1", name: "outro", startBeat: 40, endBeat: 44, bars: 1 },
  ];
  const tracks = [
    {
      id: "drums",
      notes: [
        note(0, 36, 78), note(2, 38, 72),
        note(4, 36, 88), note(6, 38, 84), note(8, 36, 86), note(10, 38, 84),
        note(12, 36, 108), note(13, 42, 88), note(14, 38, 102), note(16, 36, 106), note(18, 38, 104),
        note(20, 36, 88), note(22, 38, 84), note(24, 36, 90), note(26, 38, 84),
        note(28, 36, 74), note(30, 38, 72),
        note(32, 36, 112), note(33, 42, 92), note(34, 38, 106), note(36, 36, 110), note(38, 38, 108), note(39, 46, 84),
        note(40, 36, 72),
      ],
    },
    {
      id: "bass",
      notes: [
        note(4, 40, 88, 1), note(8, 43, 86, 1),
        note(12, 40, 104, 1), note(14, 43, 100, 1), note(16, 45, 104, 1), note(18, 43, 102, 1),
        note(20, 40, 88, 1), note(24, 43, 90, 1),
        note(28, 38, 74, 1),
        note(32, 40, 108, 1), note(34, 43, 104, 1), note(36, 45, 108, 1), note(38, 47, 106, 1),
        note(40, 40, 70, 1),
      ],
    },
    {
      id: "chords",
      notes: [
        note(4, 60, 76, 2), note(8, 63, 78, 2),
        note(12, 60, 96, 2), note(14, 64, 94, 2), note(16, 67, 98, 2), note(18, 64, 96, 2),
        note(20, 60, 78, 2), note(24, 63, 80, 2),
        note(28, 58, 68, 2),
        note(32, 60, 100, 2), note(34, 64, 98, 2), note(36, 67, 102, 2), note(38, 69, 100, 2),
        note(40, 60, 66, 2),
      ],
    },
    {
      id: "melody",
      notes: [
        note(6, 67, 82), note(10, 69, 84),
        note(12, 72, 102), note(14, 74, 100), note(16, 76, 104), note(18, 74, 102),
        note(22, 67, 84), note(26, 69, 86),
        note(29, 65, 72),
        note(32, 72, 106), note(34, 74, 104), note(36, 76, 108), note(38, 77, 106), note(39, 74, 98),
        note(40, 67, 68),
      ],
    },
    {
      id: "counterpoint",
      notes: [note(13, 79, 76), note(17, 81, 78), note(33, 79, 80), note(37, 81, 82), note(39, 83, 78)],
    },
    {
      id: "pad",
      notes: [note(0, 55, 54, 4), note(12, 55, 68, 4), note(28, 53, 48, 4), note(32, 55, 72, 4), note(40, 55, 46, 4)],
    },
  ];
  return {
    meta: { genre, beatsPerBar: 4, bars: 11 },
    structure,
    tracks,
    sectionCompletion: {
      finalBoundary: { endingFit: 0.92, cadenceFit: 0.9 },
    },
  };
}

test("whole-song completion critic is read-only and rewards a developed Hip-Hop form", () => {
  const song = completeFixture("hipHop");
  const before = structuredClone(song);
  const report = evaluateWholeSongCompletion(song);

  assert.deepEqual(song, before, "completion evaluation must never mutate committed music");
  assert.equal(report.readOnly, true);
  assert.equal(report.authority, "whole-song-completion-v1");
  assert.equal(report.passed, true, JSON.stringify(report));
  assert.ok(report.score >= 72);
  assert.equal(report.checks.noSilentSections, true);
  assert.equal(report.checks.narrative, true);
  assert.ok(report.payoffLift.payoffs.length >= 2);
  assert.ok(report.returnDevelopment.comparisons.length >= 1);
});

test("whole-song completion critic exposes unfinished payoff and missing backbone coverage", () => {
  const song = completeFixture("pop");
  const damaged = structuredClone(song);
  const chorus = damaged.structure.find((section) => section.id === "chorus-2");
  for (const track of damaged.tracks) {
    if (["drums", "bass", "chords", "counterpoint", "pad"].includes(track.id)) {
      track.notes = track.notes.filter((entry) => (
        entry.start < chorus.startBeat || entry.start >= chorus.endBeat
      ));
    }
  }
  damaged.sectionCompletion.finalBoundary = { endingFit: 0.42, cadenceFit: 0.5 };

  const healthy = evaluateWholeSongCompletion(song);
  const broken = evaluateWholeSongCompletion(damaged);

  assert.ok(broken.score < healthy.score, `damaged score ${broken.score} should fall below healthy ${healthy.score}`);
  assert.equal(broken.passed, false);
  assert.equal(broken.checks.finalResolution, false);
  assert.equal(broken.checks.backboneCoverage, false);
  assert.ok(broken.backbone.weakSections.includes("chorus-2"));
});

test("committed diagnostic refresh publishes whole-song completion without changing selection score semantics", () => {
  for (const genre of ["hipHop", "pop"]) {
    const generated = generateNew({
      genre,
      seed: `whole-song-completion-${genre}`,
      bars: 16,
      candidateCount: 1,
      targetedRepair: false,
    });
    const selectionScore = generated.meta?.scoreDetails?.totalScore;
    const refreshed = refreshCommittedGenerationDiagnostics(generated);

    assert.equal(refreshed.wholeSongCompletion?.authority, "whole-song-completion-v1");
    assert.equal(refreshed.wholeSongCompletion?.readOnly, true);
    assert.equal(refreshed.committedAuthorityValidation?.wholeSongCompletion, refreshed.wholeSongCompletion.status);
    assert.equal(refreshed.meta?.scoreDetails?.totalScore, selectionScore);
  }
});
