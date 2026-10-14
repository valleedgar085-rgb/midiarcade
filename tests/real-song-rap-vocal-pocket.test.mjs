import assert from "node:assert/strict";
import test from "node:test";
import { generateNew } from "../src/music-engine.js";
import { createShapeCandidate, rejectShapeCandidate } from "../src/core/shape-director-engine.js";
import { evaluateChorusHookRecurrence } from "../src/core/chorus-hook-recurrence.js";
import { measureVerseVocalPocket } from "../src/core/verse-vocal-pocket.js";

const CASES = Object.freeze([
  { genre: "rap", tempo: 91 },
  { genre: "hipHop", tempo: 94 },
  { genre: "trap", tempo: 142 },
  { genre: "drill", tempo: 144 },
]);

function verseSections(song) {
  return (song?.structure ?? song?.sections ?? []).filter((section) => (
    [section?.name, section?.role, section?.type, section?.id]
      .some((value) => /^(?:verse|rap[ -]?verse)(?:\b|[-_0-9])/i.test(String(value ?? "").trim()))
  ));
}

function range(song, section) {
  const beatsPerBar = Number(song.meta?.beatsPerBar ?? 4);
  const start = Number(section.startBeat ?? Number(section.startBar ?? 0) * beatsPerBar);
  const end = Number(section.endBeat ?? start + Number(section.bars ?? 4) * beatsPerBar);
  return { start, end };
}

function notesForSection(song, section, trackId) {
  const { start, end } = range(song, section);
  const notes = song.tracks.find((track) => track.id === trackId)?.notes ?? [];
  return notes.filter((note) => note.start >= start - 1e-6 && note.start < end - 1e-6);
}

function noteSignature(song, section, trackId) {
  return notesForSection(song, section, trackId)
    .map((note) => [note.start, note.duration, note.pitch, note.velocity]);
}

function placementSignature(song, section, trackId) {
  return notesForSection(song, section, trackId)
    .map((note) => [note.start, note.duration, note.pitch]);
}

// The note-duration union, rather than just counts of note attacks, measures
// how long a singer/rapper can occupy the lead without an instrumental lead.
function leadRestFraction(song, section, trackId = "melody") {
  const { start, end } = range(song, section);
  const intervals = notesForSection(song, section, trackId)
    .map((note) => [
      Math.max(start, note.start),
      Math.min(end, note.start + Math.max(0, Number(note.duration) || 0)),
    ]).sort((a, b) => a[0] - b[0]);
  let cursor = start;
  let covered = 0;
  for (const [a, b] of intervals) {
    if (b <= cursor) continue;
    covered += b - Math.max(a, cursor);
    cursor = b;
  }
  return Math.round(10000 * (1 - covered / Math.max(0.25, end - start))) / 10000;
}

test("real seeded Rap/Hip-Hop/Trap/Drill arrangements preserve vocal pocket during Catchier", { timeout: 120_000 }, () => {
  let checkedMelody = 0;
  let checkedCounterpoint = 0;
  const observations = [];

  for (const { genre, tempo } of CASES) {
    const input = {
      seed: "real-verse-vocal-pocket-" + genre + "-32",
      genre, tempo, key: "E", scale: "minor", bars: 32,
      energy: 0.62, complexity: 0.56, variation: 0.59,
      swing: 0.17, humanize: 0.12,
    };
    const song = generateNew(input);
    const original = structuredClone(song);
    const verses = verseSections(song);
    assert.ok(verses.length > 0,
      genre + ": expected at least one actual 32-bar verse; sections: "
      + JSON.stringify(song.structure?.map((s) => [s.id, s.name])));

    const reportBefore = evaluateChorusHookRecurrence(song);
    const perGenre = { genre, verseCount: verses.length, melodyPreviews: 0, counterpointPreviews: 0, measuredPockets: [] };

    for (const section of verses) {
      const observed = measureVerseVocalPocket(song, section);
      if (observed) {
        assert.deepEqual(measureVerseVocalPocket(song, section), observed,
          "measured MIDI activity must be deterministic");
        assert.ok(observed.jointRestFraction >= 0 && observed.jointRestFraction <= 1);
        assert.ok(observed.overlapFraction >= 0 && observed.overlapFraction <= 1);
        assert.ok(Math.abs(
          observed.jointRestFraction + observed.leadActivityFraction
          + observed.counterpointActivityFraction - observed.overlapFraction - 1
        ) <= 0.002, "merged MIDI durations must reconcile without double counting");
        perGenre.measuredPockets.push({
          section: section.id,
          rest: observed.jointRestFraction,
          overlap: observed.overlapFraction,
          crowdedLead: observed.crowdedLead,
          crowdedCounterpoint: observed.crowdedCounterpoint,
        });
      }
      const originalRest = leadRestFraction(song, section);
      const baselineReport = reportBefore.verses.find((entry) =>
        String(entry.sectionId) === String(section.id));

      for (const trackId of ["melody", "counterpoint"]) {
        const count = notesForSection(song, section, trackId).length;
        if (!count) continue;

        // Deliberately DO NOT lock rhythm: this must prove the Catchier
        // implementation itself protects vocal breathing space.
        const selection = { target: "track", sectionId: String(section.id), trackId };
        const args = { selection, size: "transform", direction: "catchier" };
        const seed = "vocal-pocket-audition-" + genre + "-" + trackId;
        const candidate = createShapeCandidate(song, args, { seed });
        assert.equal(candidate.status, "candidate",
          genre + "/" + section.id + "/" + trackId + ": " + JSON.stringify(candidate));

        assert.equal(candidate.summary.insertedNoteCount, 0);
        assert.equal(candidate.summary.deletedNoteCount, 0);
        assert.deepEqual(
          placementSignature(candidate.after, section, trackId),
          placementSignature(song, section, trackId),
          genre + "/" + section.id + ": no new attacks or pitches in " + trackId,
        );
        assert.deepEqual(
          candidate.after.tracks.filter((track) => track.id !== trackId),
          song.tracks.filter((track) => track.id !== trackId),
          "single-track Shape scope cannot change other instruments",
        );
        assert.deepEqual(rejectShapeCandidate(candidate), song,
          "Reject must restore the exact generated song");
        assert.deepEqual(
          createShapeCandidate(song, args, { seed }), candidate,
          "identical generated song/seed must yield identical Shape preview",
        );
        if (trackId === "melody") {
          assert.equal(leadRestFraction(candidate.after, section), originalRest);
          if (baselineReport) {
            const reportAfter = evaluateChorusHookRecurrence(candidate.after).verses
              .find((entry) => String(entry.sectionId) === String(section.id));
            assert.equal(reportAfter?.leadRestFraction, baselineReport.leadRestFraction);
            assert.equal(reportAfter?.longestLeadRestBeats, baselineReport.longestLeadRestBeats);
            assert.equal(reportAfter?.notesPerBar, baselineReport.notesPerBar);
          }
          checkedMelody += 1;
          perGenre.melodyPreviews += 1;
        } else {
          checkedCounterpoint += 1;
          perGenre.counterpointPreviews += 1;
        }
      }

      const initial = noteSignature(song, section, "melody");
      const whole = createShapeCandidate(song, {
        selection: { target: "section", sectionId: String(section.id) },
        size: "transform", direction: "catchier",
      }, { seed: "whole-verse-" + genre });
      if (whole.status === "candidate") {
        assert.deepEqual(
          placementSignature(whole.after, section, "melody"),
          placementSignature(song, section, "melody"),
          "whole-section Catchier must not add lead filler",
        );
        assert.equal(leadRestFraction(whole.after, section), originalRest);
        assert.ok(noteSignature(whole.after, section, "melody").length === initial.length);
      } else {
        assert.equal(whole.error, "no-musical-change",
          "only a genuine no-op may reject a whole-section shape audition");
      }
    }
    assert.deepEqual(song, original, "all candidate tests must leave generated source unchanged");
    observations.push(perGenre);
  }

  assert.ok(checkedMelody > 0, "expected to exercise real generated lead melody");
  assert.ok(checkedCounterpoint > 0, "expected to exercise real generated counterpoint");
  console.log("REAL_SONG_VOCAL_POCKET_AUDIT", JSON.stringify({
    songs: CASES.length, checkedMelody, checkedCounterpoint, observations,
  }));
});
