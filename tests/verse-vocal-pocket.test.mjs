import assert from "node:assert/strict";
import test from "node:test";
import { measureVerseVocalPocket } from "../src/core/verse-vocal-pocket.js";
import { songInspectorSuggestions } from "../src/core/song-inspector.js";
import { createShapeCandidate, rejectShapeCandidate } from "../src/core/shape-director-engine.js";

const note = (id, start, duration, pitch = 64) =>
  ({ id, start, duration, pitch, velocity: 82 });

function fixture(genre = "rap") {
  return {
    id: "pocket-inspector-proof", genre, meta: { genre, beatsPerBar: 4 },
    structure: [
      { id: "verse-1", name: "Verse 1", startBeat: 0, endBeat: 16, bars: 4 },
      { id: "chorus-1", name: "Chorus", startBeat: 16, endBeat: 32, bars: 4 },
    ],
    tracks: [
      { id: "drums", notes: [note("kick", 0, 0.25, 36), note("snare", 2, 0.25, 38)] },
      { id: "bass", notes: [note("bass", 0, 1, 40)] },
      { id: "melody", notes: [
        note("m0", 0, 2), note("m1", 4, 2),
        note("m2", 8, 2), note("m3", 12, 2),
        note("chorus-m", 19, 1),
      ] },
      { id: "counterpoint", notes: [
        note("c0", 1, 2, 69), note("c1", 5, 2, 72),
        note("c2", 9, 2, 67), note("c3", 13, 2, 71),
      ] },
    ],
  };
}

function suggestions(song, trackId, section = song.structure[0], target = "track") {
  return songInspectorSuggestions({ song, section, target, trackId });
}

test("verse MIDI coverage combines durations without double-counting overlap", () => {
  const song = fixture();
  const pristine = structuredClone(song);
  const report = measureVerseVocalPocket(song, song.structure[0]);
  assert.equal(report.source, "midi-note-coverage");
  assert.equal(report.leadNotes, 4);
  assert.equal(report.counterpointNotes, 4);
  assert.equal(report.leadActivityFraction, 0.5);
  assert.equal(report.counterpointActivityFraction, 0.5);
  assert.equal(report.overlapFraction, 0.25);
  assert.equal(report.jointRestFraction, 0.25);
  assert.equal(report.crowdedLead, true);
  assert.equal(report.crowdedCounterpoint, true);
  assert.deepEqual(measureVerseVocalPocket(song, song.structure[0]), report);
  assert.ok(Object.isFrozen(report));
  assert.deepEqual(song, pristine);

  // An overlapping held-note duplicate cannot inflate the active duration.
  song.tracks[2].notes.push(note("copy", 0.5, 1));
  const repeated = measureVerseVocalPocket(song, song.structure[0]);
  assert.equal(repeated.leadNotes, 5);
  assert.equal(repeated.leadActivityFraction, 0.5);
  assert.equal(repeated.overlapFraction, 0.25);
});

test("Song Inspector prioritizes real MIDI space for the selected melodic lane", () => {
  const song = fixture("hip-hop");
  const baseline = structuredClone(song);
  for (const trackId of ["melody", "counterpoint"]) {
    const ideas = suggestions(song, trackId);
    assert.equal(ideas[0].directionId, "moreSpace");
    assert.equal(ideas[0].evidence, "VERSE MIDI SPACE");
    assert.match(ideas[0].explanation, /both silent for 25%.*overlap for 25%/);
    assert.match(ideas[0].explanation, /not a vocal recording/);
    assert.equal(ideas[0].action, "Preview More Space");
    assert.ok(ideas.length <= 2);
    assert.equal(ideas.filter((idea) => idea.directionId === "moreSpace").length, 1);
    assert.ok(Object.isFrozen(ideas) && Object.isFrozen(ideas[0]));
    assert.deepEqual(suggestions(song, trackId), ideas);

    const tx = createShapeCandidate(song, {
      selection: { target: "track", sectionId: "verse-1", trackId },
      size: "transform", direction: ideas[0].directionId,
    }, { seed: "measured-pocket:" + trackId });
    assert.equal(tx.status, "candidate");
    assert.ok(tx.summary.deletedNoteCount > 0,
      "preview may create room by simplifying only the selected melodic lane");
    assert.deepEqual(tx.after.tracks.filter((track) => track.id !== trackId),
      song.tracks.filter((track) => track.id !== trackId));
    assert.deepEqual(rejectShapeCandidate(tx), song);
  }
  assert.deepEqual(song, baseline);
});

test("Song Inspector never proposes thinning the drum/bass or entire section for vocal space", () => {
  const song = fixture();
  for (const [target, trackId] of [
    ["track", "drums"], ["track", "bass"], ["track", "chords"],
    ["section", "melody"], ["notes", "melody"],
  ]) {
    const ideas = suggestions(song, trackId, song.structure[0], target);
    assert.ok(ideas.every((idea) => idea.evidence !== "VERSE MIDI SPACE"),
      target + "/" + trackId);
  }
});

test("Sparse verses, unsupported genres and non-verses do not trigger a false crowding alert", () => {
  for (const genre of ["pop", "jazz", "neoSoul", ""]) {
    const song = fixture(genre);
    assert.equal(measureVerseVocalPocket(song, song.structure[0]), null);
    assert.ok(suggestions(song, "melody").every((idea) => idea.evidence !== "VERSE MIDI SPACE"));
  }
  const sparse = fixture();
  sparse.tracks[2].notes = [note("m", 0, 0.25), note("hook", 17, 0.25)];
  sparse.tracks[3].notes = [note("c", 10, 0.25)];
  const report = measureVerseVocalPocket(sparse, sparse.structure[0]);
  assert.ok(report);
  assert.equal(report.crowdedLead, false);
  assert.equal(report.crowdedCounterpoint, false);
  assert.ok(suggestions(sparse, "melody").every((idea) => idea.evidence !== "VERSE MIDI SPACE"));

  const chorus = fixture();
  assert.equal(measureVerseVocalPocket(chorus, chorus.structure[1]), null);
  assert.ok(suggestions(chorus, "melody", chorus.structure[1])
    .every((idea) => idea.evidence !== "VERSE MIDI SPACE"));
});

test("Unavailable track/section authority returns no observation instead of guessing", () => {
  const noCounterpoint = fixture();
  noCounterpoint.tracks = noCounterpoint.tracks.filter((track) => track.id !== "counterpoint");
  assert.equal(measureVerseVocalPocket(noCounterpoint, noCounterpoint.structure[0]), null);

  const broken = fixture();
  broken.structure[0].endBeat = Number.NaN;
  broken.structure[0].bars = undefined;
  assert.equal(measureVerseVocalPocket(broken, broken.structure[0]), null);

  const shifted = fixture("trap");
  shifted.structure[0].name = "Bridge";
  shifted.structure[0].id = "bridge";
  assert.equal(measureVerseVocalPocket(shifted, shifted.structure[0]), null);
  assert.equal(measureVerseVocalPocket(fixture(), { name: "Verse", startBeat: 0, endBeat: 16 }), null);
});

test("all Rap-family genres can report the exact verse MIDI rest proportion", () => {
  for (const genre of ["rap", "hipHop", "hip-hop", "trap", "drill"]) {
    const song = fixture(genre);
    const report = measureVerseVocalPocket(song, song.structure[0]);
    assert.equal(report?.jointRestFraction, 0.25, genre);
    assert.equal(suggestions(song, "counterpoint")[0].evidence, "VERSE MIDI SPACE");
  }
});
