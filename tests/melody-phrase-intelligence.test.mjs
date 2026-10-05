import assert from "node:assert/strict";
import test from "node:test";
import { evaluateMelodyPhraseIntelligence } from "../src/core/melody-phrase-intelligence.js";

function fixture(notes) {
  return {
    meta: { beatsPerBar: 4 },
    structure: [{ id: "verse", startBeat: 0, endBeat: 8, bars: 2 }],
    harmony: [
      { start: 0, duration: 4, rootPc: 0, tones: [60, 64, 67] },
      { start: 4, duration: 4, rootPc: 5, tones: [65, 69, 72] },
    ],
    grooveConductor: {
      bars: [
        { bar: 0, sectionId: "verse", leadPulses: [0.5, 1.5, 2.5, 3.5] },
        { bar: 1, sectionId: "verse", leadPulses: [0.5, 1.5, 2.5, 3.5] },
      ],
    },
    tracks: [{ id: "melody", notes }],
  };
}

test("melody phrase critic is deterministic and read-only", () => {
  const song = fixture([
    { start: 0.5, pitch: 64, duration: 0.5, velocity: 82 },
    { start: 1.5, pitch: 67, duration: 0.25, velocity: 91 },
    { start: 2.5, pitch: 69, duration: 0.5, velocity: 86 },
    { start: 3.5, pitch: 67, duration: 0.75, velocity: 96 },
    { start: 4.5, pitch: 69, duration: 0.5, velocity: 84 },
    { start: 5.5, pitch: 72, duration: 0.25, velocity: 93 },
    { start: 6.5, pitch: 74, duration: 0.5, velocity: 88 },
    { start: 7.5, pitch: 72, duration: 0.75, velocity: 99 },
  ]);
  const before = structuredClone(song);
  const first = evaluateMelodyPhraseIntelligence(song);
  const second = evaluateMelodyPhraseIntelligence(song);
  assert.deepEqual(song, before);
  assert.deepEqual(first, second);
  assert.equal(first.mode, "read-only");
  assert.ok(first.score >= 68, JSON.stringify(first));
});

test("dense repeated filler does not receive a professional melody score", () => {
  const notes = Array.from({ length: 16 }, (_, index) => ({
    start: index * 0.5,
    pitch: 61,
    duration: 0.25,
    velocity: 84,
  }));
  const report = evaluateMelodyPhraseIntelligence(fixture(notes));
  assert.equal(report.passed, false);
  assert.ok(report.weakestSection.metrics.motifIdentity < 0.5);
  assert.ok(report.weakestSection.metrics.contourMovement < 0.5);
  assert.ok(report.weakestSection.metrics.expressiveShape < 0.5);
});

test("critic exposes weak harmonic phrase landings", () => {
  const song = fixture([
    { start: 0.5, pitch: 62, duration: 0.25, velocity: 84 },
    { start: 1.5, pitch: 65, duration: 0.25, velocity: 88 },
    { start: 2.5, pitch: 68, duration: 0.25, velocity: 90 },
    { start: 3.5, pitch: 66, duration: 0.9, velocity: 92 },
    { start: 4.5, pitch: 67, duration: 0.25, velocity: 86 },
    { start: 5.5, pitch: 70, duration: 0.25, velocity: 90 },
    { start: 6.5, pitch: 73, duration: 0.25, velocity: 94 },
    { start: 7.5, pitch: 71, duration: 0.9, velocity: 96 },
  ]);
  const report = evaluateMelodyPhraseIntelligence(song);
  assert.ok(report.weakestSection.metrics.harmonicLandings < 0.6, JSON.stringify(report));
});


test("critic detects an isolated random leap spike inside an otherwise shaped phrase", () => {
  const shaped = fixture([
    { start: 0.5, pitch: 64, duration: 0.5, velocity: 82 },
    { start: 1.5, pitch: 67, duration: 0.25, velocity: 91 },
    { start: 2.5, pitch: 69, duration: 0.5, velocity: 86 },
    { start: 3.5, pitch: 67, duration: 0.75, velocity: 96 },
    { start: 4.5, pitch: 69, duration: 0.5, velocity: 84 },
    { start: 5.5, pitch: 72, duration: 0.25, velocity: 93 },
    { start: 6.5, pitch: 74, duration: 0.5, velocity: 88 },
    { start: 7.5, pitch: 72, duration: 0.75, velocity: 99 },
  ]);
  const spiky = structuredClone(shaped);
  spiky.tracks[0].notes[2].pitch = 79;

  const shapedReport = evaluateMelodyPhraseIntelligence(shaped);
  const spikyReport = evaluateMelodyPhraseIntelligence(spiky);

  assert.ok(
    spikyReport.weakestSection.metrics.leapDiscipline
      < shapedReport.weakestSection.metrics.leapDiscipline,
    JSON.stringify({ shaped: shapedReport, spiky: spikyReport }),
  );
  assert.ok(spikyReport.weakestSection.metrics.leapDiscipline < 0.72, JSON.stringify(spikyReport));
});


test("phrase critic rewards deliberate breathing between melodic statements", () => {
  const breathing = fixture([
    { start: 0.5, pitch: 64, duration: 0.35, velocity: 82 },
    { start: 1.25, pitch: 67, duration: 0.35, velocity: 90 },
    { start: 2, pitch: 69, duration: 0.35, velocity: 86 },
    { start: 3.5, pitch: 67, duration: 0.45, velocity: 94 },
    { start: 4.5, pitch: 69, duration: 0.35, velocity: 84 },
    { start: 5.25, pitch: 72, duration: 0.35, velocity: 92 },
    { start: 6, pitch: 74, duration: 0.35, velocity: 88 },
    { start: 7.5, pitch: 72, duration: 0.45, velocity: 97 },
  ]);
  const continuous = fixture(Array.from({ length: 16 }, (_, index) => ({
    start: index * 0.5,
    pitch: [64, 67, 69, 67][index % 4],
    duration: 0.5,
    velocity: 86 + (index % 4) * 2,
  })));

  const breathingReport = evaluateMelodyPhraseIntelligence(breathing);
  const continuousReport = evaluateMelodyPhraseIntelligence(continuous);

  assert.ok(
    breathingReport.weakestSection.metrics.phraseBreathing
      > continuousReport.weakestSection.metrics.phraseBreathing,
    JSON.stringify({ breathingReport, continuousReport }),
  );
});


test("phrase placement diagnostic detects a whole phrase shifted off authored lead pulses", () => {
  const aligned = fixture([
    { start: 0.5, pitch: 64, duration: 0.5, velocity: 82 },
    { start: 1.5, pitch: 67, duration: 0.25, velocity: 91 },
    { start: 2.5, pitch: 69, duration: 0.5, velocity: 86 },
    { start: 3.5, pitch: 67, duration: 0.75, velocity: 96 },
    { start: 4.5, pitch: 69, duration: 0.5, velocity: 84 },
    { start: 5.5, pitch: 72, duration: 0.25, velocity: 93 },
    { start: 6.5, pitch: 74, duration: 0.5, velocity: 88 },
    { start: 7.5, pitch: 72, duration: 0.75, velocity: 99 },
  ]);
  const shifted = structuredClone(aligned);
  shifted.tracks[0].notes.forEach((note) => { note.start += 0.25; });

  const alignedReport = evaluateMelodyPhraseIntelligence(aligned);
  const shiftedReport = evaluateMelodyPhraseIntelligence(shifted);

  assert.ok(
    alignedReport.weakestPlacementSection.metrics.phrasePlacement
      > shiftedReport.weakestPlacementSection.metrics.phrasePlacement,
    JSON.stringify({ alignedReport, shiftedReport }),
  );
  assert.ok(
    shiftedReport.weakestPlacementSection.metrics.phrasePlacement < 0.76,
    JSON.stringify(shiftedReport),
  );
});


test("phrase conversation critic rewards a related answer and detects an unrelated answer", () => {
  const statement = [
    { start: 0.5, pitch: 60, duration: 0.25, velocity: 84 },
    { start: 1.0, pitch: 64, duration: 0.25, velocity: 88 },
    { start: 1.5, pitch: 67, duration: 0.25, velocity: 92 },
  ];
  const related = fixture([
    ...statement,
    { start: 4.0, pitch: 67, duration: 0.25, velocity: 86 },
    { start: 4.5, pitch: 71, duration: 0.25, velocity: 90 },
    { start: 5.0, pitch: 60, duration: 0.5, velocity: 94 },
  ]);
  const unrelated = fixture([
    ...statement,
    { start: 4.0, pitch: 67, duration: 0.25, velocity: 86 },
    { start: 4.5, pitch: 65, duration: 0.25, velocity: 90 },
    { start: 5.0, pitch: 60, duration: 0.5, velocity: 94 },
  ]);

  const relatedReport = evaluateMelodyPhraseIntelligence(related);
  const unrelatedReport = evaluateMelodyPhraseIntelligence(unrelated);
  const relatedConversation = relatedReport.weakestConversationSection.metrics.phraseConversation;
  const unrelatedConversation = unrelatedReport.weakestConversationSection.metrics.phraseConversation;

  assert.equal(relatedReport.weakestConversationSection.metrics.phraseConversationPairs, 1);
  assert.ok(relatedConversation >= 0.72, JSON.stringify(relatedReport));
  assert.ok(unrelatedConversation < 0.72, JSON.stringify(unrelatedReport));
  assert.ok(relatedConversation > unrelatedConversation, JSON.stringify({
    relatedConversation,
    unrelatedConversation,
  }));
});

test("sections without a real statement-answer pair stay neutral for phrase conversation", () => {
  const report = evaluateMelodyPhraseIntelligence(fixture([
    { start: 0.5, pitch: 60, duration: 0.25, velocity: 84 },
    { start: 1.0, pitch: 64, duration: 0.25, velocity: 88 },
    { start: 1.5, pitch: 67, duration: 0.25, velocity: 92 },
    { start: 2.0, pitch: 65, duration: 0.25, velocity: 90 },
  ]));
  assert.equal(report.weakestConversationSection, null);
  assert.equal(report.weakestSection.metrics.phraseConversationPairs, 0);
  assert.equal(report.weakestSection.metrics.phraseConversation, 0.76);
});


test("melodic arc critic rewards a late payoff and resolution over an early flat peak", () => {
  const intentional = fixture([
    { start: 0.5, pitch: 60, duration: 0.25, velocity: 78 },
    { start: 1.5, pitch: 62, duration: 0.25, velocity: 80 },
    { start: 2.5, pitch: 64, duration: 0.25, velocity: 82 },
    { start: 3.5, pitch: 65, duration: 0.25, velocity: 84 },
    { start: 4.5, pitch: 67, duration: 0.25, velocity: 88 },
    { start: 5.5, pitch: 72, duration: 0.5, velocity: 98 },
    { start: 6.5, pitch: 69, duration: 0.25, velocity: 90 },
    { start: 7.5, pitch: 67, duration: 0.75, velocity: 86 },
  ]);
  const earlyPeak = fixture([
    { start: 0.5, pitch: 72, duration: 0.5, velocity: 98 },
    { start: 1.5, pitch: 67, duration: 0.25, velocity: 90 },
    { start: 2.5, pitch: 65, duration: 0.25, velocity: 86 },
    { start: 3.5, pitch: 64, duration: 0.25, velocity: 84 },
    { start: 4.5, pitch: 64, duration: 0.25, velocity: 82 },
    { start: 5.5, pitch: 65, duration: 0.25, velocity: 84 },
    { start: 6.5, pitch: 64, duration: 0.25, velocity: 82 },
    { start: 7.5, pitch: 62, duration: 0.75, velocity: 80 },
  ]);
  const good = evaluateMelodyPhraseIntelligence(intentional);
  const weak = evaluateMelodyPhraseIntelligence(earlyPeak);
  assert.ok(good.weakestArcSection.metrics.melodicArcPayoff >= 0.7, JSON.stringify(good));
  assert.ok(weak.weakestArcSection.metrics.melodicArcPayoff < 0.7, JSON.stringify(weak));
  assert.ok(
    good.weakestArcSection.metrics.melodicArcPayoff > weak.weakestArcSection.metrics.melodicArcPayoff,
    JSON.stringify({ good, weak }),
  );
});
