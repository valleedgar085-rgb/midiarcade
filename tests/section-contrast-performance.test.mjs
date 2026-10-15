import assert from "node:assert/strict";
import test from "node:test";
import { applyArrangementPerformance } from "../src/core/arrangement-performance.js";
import { createArrangementCandidates, MAX_ARRANGEMENT_CANDIDATES } from "../src/core/arrangement-candidates.js";
import { generateNew } from "../src/music-engine.js";

const note = (start, pitch, velocity = 80, extra = {}) => ({
  start, pitch, duration: 0.5, velocity, ...extra,
});

function songFixture() {
  const structure = [
    { id: "verse-1", name: "verse", startBeat: 0, endBeat: 16, bars: 4 },
    { id: "chorus-1", name: "chorus", startBeat: 16, endBeat: 32, bars: 4 },
    { id: "verse-2", name: "verse", startBeat: 32, endBeat: 48, bars: 4 },
  ];
  return {
    genre: "hipHop",
    meta: { genre: "hipHop", bars: 12, beatsPerBar: 4 },
    structure,
    producerIntent: {
      scenes: [
        { sectionId: "verse-1", roles: { chords: "support", pad: "support", counterpoint: "answer" } },
        { sectionId: "chorus-1", roles: { chords: "support", pad: "support", counterpoint: "answer" } },
        { sectionId: "verse-2", roles: { chords: "support", pad: "support", counterpoint: "answer" } },
      ],
    },
    arrangementTransitions: [
      { fromSectionId: "verse-1", toSectionId: "chorus-1", type: "lift", strength: 0.7, pickupBeats: 1 },
      { fromSectionId: "chorus-1", toSectionId: "verse-2", type: "drop-out", strength: 0.7, pickupBeats: 1 },
    ],
    tracks: [
      { id: "drums", notes: [note(2, 36), note(18, 36), note(34, 36)] },
      { id: "bass", notes: [note(2, 40), note(18, 40), note(34, 40)] },
      { id: "melody", notes: [note(2, 67), note(18, 69), note(34, 67)] },
      { id: "chords", notes: [
        note(2, 60, 76), note(4, 64, 78, { finalAssemblyRole: "protected" }),
        note(6, 67, 80), note(15.5, 64, 78),
        note(18, 60, 82), note(20, 64, 84), note(22, 67, 84),
        note(34, 60, 80),
      ] },
      { id: "pad", notes: [
        note(2, 48, 66), note(6, 55, 70),
        note(18, 48, 70), note(22, 55, 72),
        note(34, 48, 66),
      ] },
      { id: "counterpoint", notes: [note(2, 72), note(18, 74), note(34, 72)] },
    ],
  };
}

test("opt-in section contrast stages support dynamics while preserving immutable note topology", () => {
  const source = songFixture();
  const original = structuredClone(source);
  const noOption = applyArrangementPerformance(source, { profile: "balanced" });
  const withOption = applyArrangementPerformance(source, {
    profile: "balanced", sectionContrastDynamics: true,
  });
  const repeated = applyArrangementPerformance(source, {
    profile: "balanced", sectionContrastDynamics: true,
  });

  assert.deepEqual(source, original);
  assert.deepEqual(withOption, repeated, "same input must produce identical note velocities");
  assert.ok(withOption.diagnostics.sectionContrastNotes > 0);
  assert.ok(withOption.diagnostics.sectionContrastSections >= 2);
  assert.ok(withOption.song.tracks.find(t => t.id === "chords").notes[0].velocity <
    noOption.song.tracks.find(t => t.id === "chords").notes[0].velocity, "supporting verse chord should yield");
  assert.ok(withOption.song.tracks.find(t => t.id === "chords").notes[4].velocity >
    noOption.song.tracks.find(t => t.id === "chords").notes[4].velocity, "return chorus chord should open");
  assert.equal(withOption.song.tracks.find(t => t.id === "chords").notes[1].velocity,
    noOption.song.tracks.find(t => t.id === "chords").notes[1].velocity, "protected note must not be modified");

  for (const beforeTrack of source.tracks) {
    const afterTrack = withOption.song.tracks.find(t => t.id === beforeTrack.id);
    const baselineTrack = noOption.song.tracks.find(t => t.id === beforeTrack.id);
    assert.equal(afterTrack.notes.length, beforeTrack.notes.length);
    for (let i = 0; i < beforeTrack.notes.length; i += 1) {
      const before = beforeTrack.notes[i];
      const after = afterTrack.notes[i];
      assert.equal(after.start, before.start);
      assert.equal(after.duration, before.duration);
      assert.equal(after.pitch, before.pitch);
      assert.ok(after.velocity >= 1 && after.velocity <= 127);
      if (["drums", "bass", "melody", "counterpoint"].includes(beforeTrack.id)) {
        assert.deepEqual(after, baselineTrack.notes[i], beforeTrack.id + " should be unaffected by staging option");
      }
    }
  }
});

test("disabled, no-payoff, and fusion configurations do not introduce section-dynamics changes", () => {
  const source = songFixture();
  const off = applyArrangementPerformance(source, { sectionContrastDynamics: false });
  const noPayoff = structuredClone(source);
  noPayoff.structure[1].name = "idea";
  const baseline = applyArrangementPerformance(noPayoff, { sectionContrastDynamics: false });
  const skipped = applyArrangementPerformance(noPayoff, { sectionContrastDynamics: true });
  assert.deepEqual(skipped.song.tracks, baseline.song.tracks);
  assert.equal(skipped.diagnostics.sectionContrastNotes ?? 0, 0);
  assert.equal(off.diagnostics.sectionContrastNotes ?? 0, 0);
  const fusion = structuredClone(source);
  fusion.meta.isFusion = true;
  const fusionOff = applyArrangementPerformance(fusion, {});
  const fusionOn = applyArrangementPerformance(fusion, { sectionContrastDynamics: true });
  assert.deepEqual(fusionOn.song.tracks, fusionOff.song.tracks);
});

test("arrangement audition preserves 3-candidate ceiling with opt-in section dynamics", () => {
  const song = generateNew({
    genre: "hipHop", seed: "section-contrast-audition-source", bars: 32, candidateCount: 1,
  });
  let candidates = [];
  for (let index = 0; index < 16 && !candidates.length; index += 1) {
    candidates = createArrangementCandidates(song, {
      genre: "hipHop", bars: 32, seed: "section-contrast-audition-" + index,
      arrangementEvolution: true, sectionContrastDynamics: true,
    }, { maxCandidates: 3 });
  }
  assert.ok(candidates.length > 0);
  assert.ok(candidates.length <= MAX_ARRANGEMENT_CANDIDATES);
  for (const candidate of candidates) {
    const audition = candidate.song.outputQualityEvolution.arrangement.audition;
    assert.equal(audition.sectionContrastDynamicsRequested, true);
    assert.ok(Number.isInteger(audition.sectionContrastNotes));
    // A candidate with no eligible support notes is a valid no-op, not an
    // invitation to invent filler notes or bypass candidate safety.
    if (candidate.performance.sectionContrastDynamics) {
      assert.equal(candidate.performance.sectionContrastNotes, audition.sectionContrastNotes);
    }
    assert.equal(candidate.song.tracks.reduce((sum, t) => sum + t.notes.length, 0),
      song.tracks.reduce((sum, t) => sum + t.notes.length, 0));
  }
});

test("section contrast never clamps extreme existing velocities into a larger edit", () => {
  const source = songFixture();
  const chords = source.tracks.find(track => track.id === "chords");
  chords.notes[0].velocity = 127; // verse note: old clamp could change by -15
  chords.notes[4].velocity = 40;  // chorus note: old clamp could change by +8
  const a = applyArrangementPerformance(source, { sectionContrastDynamics: false });
  const b = applyArrangementPerformance(source, { sectionContrastDynamics: true });
  assert.equal(b.song.tracks.find(t => t.id === "chords").notes[0].velocity,
    a.song.tracks.find(t => t.id === "chords").notes[0].velocity);
  assert.equal(b.song.tracks.find(t => t.id === "chords").notes[4].velocity,
    a.song.tracks.find(t => t.id === "chords").notes[4].velocity);
  assert.ok(b.diagnostics.sectionContrastNotes >= 0);
});
