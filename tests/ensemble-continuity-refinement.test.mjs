import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeEnsembleContinuity,
  createEnsembleContinuityCandidates,
  ENSEMBLE_CONTINUITY_TRACKS,
} from "../src/core/ensemble-continuity-refinement.js";
import { applyEnsembleContinuityRefinement } from "../src/core/output-quality-pipeline-register.js";
import { evaluateCrossAuthorityCoherence } from "../src/core/cross-authority-coherence.js";
import { resolveEnsembleCoherenceRepairHint } from "../src/core/generation-repair-router.js";

function ensembleDropoutSong() {
  const harmony = Array.from({ length: 12 }, (_, bar) => ({
    bar,
    start: bar * 4,
    duration: 4,
    rootPc: [0, 5, 9, 7][bar % 4],
    degree: [0, 3, 5, 4][bar % 4],
  }));
  const grooveBars = Array.from({ length: 12 }, (_, bar) => ({
    bar,
    sectionId: bar < 2 ? "intro-1" : bar < 6 ? "verse-1" : bar < 10 ? "chorus-1" : "outro-1",
    anchors: [0, 2.5],
    answers: [0.75, 3.25],
    chordPulses: [0, 2],
    counterPulses: [0.75, 2.75],
  }));
  return {
    id: "ensemble-continuity-proof",
    genre: "pop",
    meta: { genre: "pop", bars: 12, beatsPerBar: 4, totalBeats: 48 },
    structure: [
      { id: "intro-1", name: "intro", startBeat: 0, endBeat: 8, bars: 2 },
      { id: "verse-1", name: "verse", startBeat: 8, endBeat: 24, bars: 4 },
      { id: "chorus-1", name: "chorus", startBeat: 24, endBeat: 40, bars: 4 },
      { id: "outro-1", name: "outro", startBeat: 40, endBeat: 48, bars: 2 },
    ],
    harmony,
    grooveConductor: { bars: grooveBars },
    producerIntent: {
      scenes: [
        {
          sectionId: "verse-1",
          roles: { drums: "foundation", chords: "support", counterpoint: "answer", pad: "support" },
        },
        {
          sectionId: "chorus-1",
          roles: { drums: "foundation", chords: "support", counterpoint: "answer", pad: "support" },
        },
      ],
    },
    orchestrationMatrix: [
      {
        sectionId: "verse-1",
        lanes: {
          drums: { presence: 0.9 },
          chords: { presence: 0.8 },
          counterpoint: { presence: 0.32 },
          pad: { presence: 0.7 },
        },
      },
      {
        sectionId: "chorus-1",
        lanes: {
          drums: { presence: 1 },
          chords: { presence: 0.9 },
          counterpoint: { presence: 0.34 },
          pad: { presence: 0.82 },
        },
      },
    ],
    tracks: [
      {
        id: "drums",
        notes: [
          ...Array.from({ length: 16 }, (_, index) => ({
            id: `dv-${index}`,
            pitch: index % 4 === 2 ? 38 : 36,
            start: 8 + index,
            duration: 0.08,
            velocity: 92,
          })),
          { id: "dc1", pitch: 36, start: 24, duration: 0.08, velocity: 96 },
          { id: "dc2", pitch: 38, start: 36, duration: 0.08, velocity: 94 },
        ],
      },
      {
        id: "chords",
        notes: [
          { id: "cv1", pitch: 60, start: 8, duration: 1.5, velocity: 78 },
          { id: "cv2", pitch: 65, start: 12, duration: 1.5, velocity: 80 },
          { id: "cv3", pitch: 69, start: 16, duration: 1.5, velocity: 82 },
          { id: "cv4", pitch: 67, start: 20, duration: 1.5, velocity: 80 },
          { id: "cc1", pitch: 60, start: 24, duration: 0.7, velocity: 84 },
          { id: "cc2", pitch: 67, start: 36, duration: 0.7, velocity: 84 },
        ],
      },
      {
        id: "counterpoint",
        notes: [
          { id: "qv1", pitch: 72, start: 8.75, duration: 0.4, velocity: 80 },
          { id: "qv2", pitch: 74, start: 12.75, duration: 0.4, velocity: 80 },
          { id: "qv3", pitch: 76, start: 16.75, duration: 0.4, velocity: 82 },
          { id: "qv4", pitch: 74, start: 20.75, duration: 0.4, velocity: 80 },
          { id: "qc1", pitch: 72, start: 24.75, duration: 0.35, velocity: 82 },
          { id: "qc2", pitch: 74, start: 36.75, duration: 0.35, velocity: 82 },
        ],
      },
      {
        id: "pad",
        notes: [
          { id: "pv1", pitch: 48, start: 8, duration: 3.6, velocity: 68 },
          { id: "pv2", pitch: 53, start: 12, duration: 3.6, velocity: 70 },
          { id: "pv3", pitch: 57, start: 16, duration: 3.6, velocity: 70 },
          { id: "pv4", pitch: 55, start: 20, duration: 3.6, velocity: 68 },
          { id: "pc1", pitch: 48, start: 24, duration: 1, velocity: 72 },
          { id: "pc2", pitch: 55, start: 36, duration: 1, velocity: 72 },
        ],
      },
      { id: "bass", notes: [] },
      { id: "melody", notes: [] },
    ],
  };
}

function longEnsembleDropoutSong() {
  const song = ensembleDropoutSong();
  song.meta.bars = 36;
  song.meta.totalBeats = 144;
  song.structure = [
    { id: "intro-1", name: "intro", startBeat: 0, endBeat: 8, bars: 2 },
    { id: "verse-1", name: "verse", startBeat: 8, endBeat: 24, bars: 4 },
    { id: "chorus-1", name: "chorus", startBeat: 24, endBeat: 40, bars: 4 },
    { id: "bridge-1", name: "bridge", startBeat: 40, endBeat: 88, bars: 12 },
    { id: "verse-2", name: "verse", startBeat: 88, endBeat: 136, bars: 12 },
    { id: "outro-1", name: "outro", startBeat: 136, endBeat: 144, bars: 2 },
  ];
  song.harmony = Array.from({ length: 36 }, (_, bar) => ({
    bar,
    start: bar * 4,
    duration: 4,
    rootPc: [0, 5, 9, 7][bar % 4],
    degree: [0, 3, 5, 4][bar % 4],
  }));
  song.grooveConductor.bars = Array.from({ length: 36 }, (_, bar) => ({
    bar,
    sectionId: bar < 2 ? "intro-1"
      : bar < 6 ? "verse-1"
        : bar < 10 ? "chorus-1"
          : bar < 22 ? "bridge-1"
            : bar < 34 ? "verse-2"
              : "outro-1",
    anchors: [0, 2.5],
    answers: [0.75, 3.25],
    chordPulses: [0, 2],
    counterPulses: [0.75, 2.75],
  }));
  for (const sectionId of ["bridge-1", "verse-2"]) {
    song.producerIntent.scenes.push({
      sectionId,
      roles: { drums: "foundation", chords: "support", counterpoint: "answer", pad: "support" },
    });
    song.orchestrationMatrix.push({
      sectionId,
      lanes: {
        drums: { presence: 0.92 },
        chords: { presence: 0.82 },
        counterpoint: { presence: 0.4 },
        pad: { presence: 0.74 },
      },
    });
  }
  return song;
}

function evaluationFor(candidateSong, { regress = false } = {}) {
  const links = candidateSong.tracks.reduce((sum, track) => (
    sum + (track.notes ?? []).filter((note) => String(note.continuityRole ?? "").includes("continuity-link")).length
  ), 0);
  return {
    score: 86 + links,
    subscores: {
      density: 76 + links,
      groove: 86 + links,
      performance: regress && links ? 84 : 85,
      motif: 85,
      repetition: 84,
      memory: 86,
      registerHealth: 89,
      separation: 89,
      phraseResolution: 85,
      genreAuthenticity: 87,
    },
    diagnostics: { scaleFit: 1 },
  };
}

test("ensemble continuity detects weak body sections for every remaining instrument", () => {
  const result = analyzeEnsembleContinuity(ensembleDropoutSong());
  assert.ok(result.deficit > 0);
  const actionableTracks = new Set(
    result.tracks
      .filter((track) => track.sections.some((section) => section.actionable))
      .map((track) => track.trackId),
  );
  for (const trackId of ENSEMBLE_CONTINUITY_TRACKS) assert.equal(actionableTracks.has(trackId), true);
  for (const track of result.tracks) {
    assert.equal(track.sections.some((section) => section.id === "intro-1"), false);
    assert.equal(track.sections.some((section) => section.id === "outro-1"), false);
  }
});

test("ensemble continuity candidates are deterministic, bounded, and harmony/groove aware", () => {
  const source = ensembleDropoutSong();
  const before = structuredClone(source);
  const first = createEnsembleContinuityCandidates(source);
  const repeated = createEnsembleContinuityCandidates(source);

  assert.deepEqual(source, before);
  assert.deepEqual(first, repeated);
  assert.ok(first.length >= 1 && first.length <= 3);
  assert.ok(first.every((candidate) => candidate.changedNotes >= 1 && candidate.changedNotes <= 4));
  assert.ok(first.every((candidate) => candidate.continuityErrorDelta < 0));

  const balanced = first.find((candidate) => candidate.id === "balanced-ensemble-links");
  assert.ok(balanced);
  for (const trackId of ENSEMBLE_CONTINUITY_TRACKS) {
    const additions = balanced.song.tracks
      .find((track) => track.id === trackId).notes
      .filter((note) => String(note.continuityRole ?? "").includes("continuity-link"));
    assert.equal(additions.length, 1);
    const note = additions[0];
    assert.ok(note.start >= 24 && note.start < 40);
    if (trackId === "drums") {
      assert.equal(note.pitch, 36);
      const bar = Math.floor(note.start / 4);
      const offset = note.start - bar * 4;
      assert.ok(balanced.song.grooveConductor.bars[bar].anchors.some((anchor) => Math.abs(anchor - offset) < 1e-6));
    } else {
      const chord = balanced.song.harmony.find((entry) => note.start >= entry.start && note.start < entry.start + entry.duration);
      assert.equal(((note.pitch % 12) + 12) % 12, ((chord.rootPc % 12) + 12) % 12);
    }
  }
});

test("long songs with severe gaps expose a bounded deep ensemble candidate", () => {
  const source = longEnsembleDropoutSong();
  const before = analyzeEnsembleContinuity(source);
  const candidates = createEnsembleContinuityCandidates(source);
  const balanced = candidates.find((candidate) => candidate.id === "balanced-ensemble-links");
  const deep = candidates.find((candidate) => candidate.id === "deep-ensemble-links");

  assert.ok(before.deficit >= 6);
  assert.ok(balanced);
  assert.ok(deep);
  assert.ok(deep.changedNotes > balanced.changedNotes);
  assert.ok(deep.changedNotes <= 6);
  assert.ok(deep.afterContinuityDeficit < balanced.afterContinuityDeficit);
  assert.ok(deep.continuityErrorDelta < balanced.continuityErrorDelta);
});

test("final ensemble continuity stage accepts only a release-safe no-regression repair", () => {
  const source = ensembleDropoutSong();
  const result = applyEnsembleContinuityRefinement(
    source,
    { ensembleContinuityRefinement: true },
    (candidateSong) => evaluationFor(candidateSong),
    () => ({ passed: true, totalScore: 92 }),
  );

  assert.equal(result.diagnostics.attempted, true);
  assert.equal(result.diagnostics.accepted, true);
  assert.ok(result.diagnostics.changedNotes >= 1);
  assert.ok(result.diagnostics.continuityErrorDelta < 0);
  assert.ok(result.song !== source);
});

test("auto-resolved unsupported coherence hints fall back to general ensemble continuity repair", () => {
  const source = addEnsembleContractsForTargeting(ensembleDropoutSong());
  const hint = resolveEnsembleCoherenceRepairHint(evaluateCrossAuthorityCoherence(source));

  assert.equal(hint.available, true);
  assert.equal(hint.relationship, "kick-bass");

  const result = applyEnsembleContinuityRefinement(
    source,
    { ensembleContinuityRefinement: true },
    (candidateSong) => evaluationFor(candidateSong),
    () => ({ passed: true, totalScore: 92 }),
  );

  assert.ok(result.diagnostics.candidatesEvaluated > 0);
  assert.notEqual(result.diagnostics.reason, "no-targeted-ensemble-move");
  assert.ok(result.diagnostics.candidateIds.includes("focused-ensemble-link"));
});

test("ensemble continuity fails closed when another critic regresses", () => {
  const source = ensembleDropoutSong();
  const result = applyEnsembleContinuityRefinement(
    source,
    { ensembleContinuityRefinement: true },
    (candidateSong) => evaluationFor(candidateSong, { regress: true }),
    () => ({ passed: true, totalScore: 92 }),
  );

  assert.equal(result.diagnostics.accepted, false);
  assert.equal(result.diagnostics.reason, "protected-dimension-regression");
  assert.equal(result.song, source);
});

test("ensemble continuity fails closed when release rejects the repair", () => {
  const source = ensembleDropoutSong();
  const result = applyEnsembleContinuityRefinement(
    source,
    { ensembleContinuityRefinement: true },
    (candidateSong) => evaluationFor(candidateSong),
    () => ({ passed: false, totalScore: 70 }),
  );

  assert.equal(result.diagnostics.accepted, false);
  assert.equal(result.diagnostics.reason, "release-gate");
  assert.equal(result.song, source);
});

test("pad continuity uses canonical pad to chordPulses mapping", () => {
  const source = ensembleDropoutSong();
  source.grooveConductor.bars = source.grooveConductor.bars.map((bar) => ({
    ...bar,
    chordPulses: [0.5],
  }));
  const balanced = createEnsembleContinuityCandidates(source)
    .find((candidate) => candidate.id === "balanced-ensemble-links");
  assert.ok(balanced);
  const padLink = balanced.song.tracks
    .find((track) => track.id === "pad").notes
    .find((note) => String(note.continuityRole ?? "").includes("continuity-link"));
  assert.ok(padLink);
  const offset = ((padLink.start % 4) + 4) % 4;
  assert.ok(Math.abs(offset - 0.5) < 1e-6, `expected pad chordPulse, got ${padLink.start}`);
});


test("ensemble continuity keeps the safer shallow repair when a deeper repair improves continuity but regresses a protected dimension", () => {
  const source = longEnsembleDropoutSong();
  const result = applyEnsembleContinuityRefinement(
    source,
    { ensembleContinuityRefinement: true },
    (candidateSong) => {
      const links = candidateSong.tracks.reduce((sum, track) => (
        sum + (track.notes ?? []).filter((note) => String(note.continuityRole ?? "").includes("continuity-link")).length
      ), 0);
      return {
        score: 94,
        subscores: {
          density: 84,
          groove: 88,
          performance: 86,
          motif: 87,
          repetition: 86,
          memory: 88,
          registerHealth: 90,
          separation: links >= 6 ? 84 : 89,
          phraseResolution: 85,
          stageInterlock: links >= 6 ? 91 : 92,
          genreAuthenticity: 89,
        },
        diagnostics: { scaleFit: 1 },
      };
    },
    () => ({ passed: true, totalScore: 94 }),
  );

  assert.equal(result.diagnostics.accepted, true);
  assert.notEqual(result.diagnostics.id, "deep-ensemble-links");
  const deep = result.diagnostics.candidateSummaries.find((candidate) => candidate.id === "deep-ensemble-links");
  assert.ok(deep);
  assert.equal(deep.accepted, false);
  assert.equal(deep.reason, "protected-dimension-regression");
  assert.ok(deep.continuityErrorDelta < 0);
  assert.strictEqual(result.song === source, false);
});


function addEnsembleContractsForTargeting(song) {
  song.generationInterlock = {
    sectionContracts: song.structure
      .filter((section) => ["verse-1", "chorus-1"].includes(section.id))
      .map((section) => ({
        sectionId: section.id,
        featuredTrack: "melody",
        harmonicGoalPitchClasses: [0, 5, 7, 9],
        coordination: {
          featuredTrack: "melody",
          roles: {
            drums: "foundation",
            bass: "foundation",
            chords: "support",
            melody: "feature",
            counterpoint: "answer",
            pad: "support",
          },
          relationships: [
            { kind: "rhythm-foundation" },
            { kind: "harmonic-support" },
            { kind: "lead-dialogue" },
            { kind: "foreground-hierarchy" },
            { kind: "cadence-team" },
          ],
        },
      })),
  };
  const melody = song.tracks.find((track) => track.id === "melody");
  melody.notes = [
    { id: "mv1", pitch: 72, start: 8.75, duration: 0.5, velocity: 88 },
    { id: "mv2", pitch: 74, start: 12.75, duration: 0.5, velocity: 88 },
    { id: "mc1", pitch: 72, start: 24.75, duration: 0.5, velocity: 90 },
    { id: "mc2", pitch: 74, start: 36.75, duration: 0.5, velocity: 90 },
  ];
  return song;
}

test("targeted ensemble repair changes only the authorized relationship track inside the exact section", () => {
  const source = ensembleDropoutSong();
  const before = structuredClone(source);
  const hint = {
    version: 1,
    available: true,
    owner: "ensemble",
    specialist: "ensemble-specialist",
    sectionId: "chorus-1",
    relationship: "melody-counterline",
    allowedMutations: ["timing", "topology"],
    reason: "committed-section-coherence-failure",
  };

  const first = createEnsembleContinuityCandidates(source, { repairHint: hint });
  const repeated = createEnsembleContinuityCandidates(source, { repairHint: hint });

  assert.deepEqual(source, before);
  assert.deepEqual(first, repeated);
  assert.equal(first.length, 1);
  assert.equal(first[0].targeted, true);
  assert.equal(first[0].targetSectionId, "chorus-1");
  assert.equal(first[0].targetRelationship, "melody-counterline");
  assert.deepEqual(first[0].targetTrackIds, ["counterpoint"]);
  assert.ok(first[0].authorizedMutations.includes("topology"));

  const candidate = first[0].song;
  for (const trackId of ["drums", "chords", "pad", "bass", "melody"]) {
    assert.deepEqual(
      candidate.tracks.find((track) => track.id === trackId),
      source.tracks.find((track) => track.id === trackId),
    );
  }

  const sourceCounterpoint = source.tracks.find((track) => track.id === "counterpoint").notes;
  const candidateCounterpoint = candidate.tracks.find((track) => track.id === "counterpoint").notes;
  const sourceVerse = sourceCounterpoint.filter((note) => note.start >= 8 && note.start < 24);
  const candidateVerse = candidateCounterpoint.filter((note) => note.start >= 8 && note.start < 24);
  assert.deepEqual(candidateVerse, sourceVerse);

  const additions = candidateCounterpoint.filter((note) => (
    String(note.continuityRole ?? "") === "counterpoint-continuity-link"
  ));
  assert.equal(additions.length, 1);
  assert.ok(additions[0].start >= 24 && additions[0].start < 40);
});

test("targeted ensemble repair rejects inherited relationship names", () => {
  const source = ensembleDropoutSong();
  const candidates = createEnsembleContinuityCandidates(source, {
    repairHint: {
      available: true,
      sectionId: "chorus-1",
      relationship: "constructor",
      allowedMutations: ["topology"],
    },
  });
  assert.deepEqual(candidates, []);
});

test("targeted ensemble repair never extends a new note beyond the selected section", () => {
  const source = ensembleDropoutSong();
  const counterpoint = source.tracks.find((track) => track.id === "counterpoint");
  counterpoint.notes = counterpoint.notes.filter((note) => note.id !== "qc2");
  for (const bar of source.grooveConductor.bars) {
    if (bar.sectionId === "chorus-1") bar.counterPulses = bar.bar === 9 ? [3.7] : [];
  }
  const candidates = createEnsembleContinuityCandidates(source, {
    repairHint: {
      available: true,
      sectionId: "chorus-1",
      relationship: "melody-counterline",
      allowedMutations: ["topology"],
    },
  });

  assert.ok(candidates.length > 0, "boundary fixture must produce at least one repair candidate");
  for (const candidate of candidates) {
    const added = candidate.song.tracks.find((track) => track.id === "counterpoint").notes
      .filter((note) => String(note.continuityRole ?? "") === "counterpoint-continuity-link");
    assert.ok(added.length > 0, "boundary candidate must add a counterpoint continuity link");
    assert.ok(added.every((note) => note.start + note.duration <= 40 + 1e-6));
  }
});

test("targeted ensemble repair fails closed when the hint does not authorize topology", () => {
  const source = ensembleDropoutSong();
  const candidates = createEnsembleContinuityCandidates(source, {
    repairHint: {
      available: true,
      sectionId: "chorus-1",
      relationship: "kick-bass",
      allowedMutations: ["timing", "duration"],
    },
  });
  assert.deepEqual(candidates, []);
});

test("targeted melody-counterline repair is rejected while collision control remains unsafe", () => {
  const source = addEnsembleContractsForTargeting(ensembleDropoutSong());
  const hint = {
    available: true,
    owner: "ensemble",
    specialist: "ensemble-specialist",
    sectionId: "chorus-1",
    relationship: "melody-counterline",
    allowedMutations: ["timing", "topology"],
  };

  const result = applyEnsembleContinuityRefinement(
    source,
    { ensembleContinuityRefinement: true, ensembleCoherenceRepairHint: hint },
    (candidateSong) => evaluationFor(candidateSong),
    () => ({ passed: true, totalScore: 92 }),
  );

  assert.equal(result.diagnostics.attempted, true);
  assert.equal(result.diagnostics.targeted, true);
  assert.equal(result.diagnostics.targetSectionId, "chorus-1");
  assert.equal(result.diagnostics.targetRelationship, "melody-counterline");
  assert.deepEqual(result.diagnostics.targetTrackIds, ["counterpoint"]);
  assert.equal(result.diagnostics.accepted, false);
  assert.equal(result.diagnostics.reason, "target-relationship-not-improved");
  assert.equal(result.song, source);
});

test("targeted ensemble stage rejects a continuity move when the diagnosed relationship cannot be verified as improved", () => {
  const source = ensembleDropoutSong();
  const hint = {
    available: true,
    owner: "ensemble",
    specialist: "ensemble-specialist",
    sectionId: "chorus-1",
    relationship: "melody-counterline",
    allowedMutations: ["timing", "topology"],
  };

  const result = applyEnsembleContinuityRefinement(
    source,
    { ensembleContinuityRefinement: true, ensembleCoherenceRepairHint: hint },
    (candidateSong) => evaluationFor(candidateSong),
    () => ({ passed: true, totalScore: 92 }),
  );

  assert.equal(result.diagnostics.accepted, false);
  assert.equal(result.diagnostics.reason, "target-relationship-not-improved");
  assert.equal(result.song, source);
});
