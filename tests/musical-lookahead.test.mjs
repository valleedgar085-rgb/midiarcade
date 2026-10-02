import assert from "node:assert/strict";
import test from "node:test";
import {
  planMusicalLookahead,
  planRhythmMelodyLookahead,
  rankPhraseTargetCandidates,
  scorePhraseTargetCandidate,
} from "../src/core/musical-lookahead.js";
import { generateNew } from "../src/music-engine.js";

const major = [0, 2, 4, 5, 7, 9, 11];
const input = { pitch: 67, start: 3, boundary: 4, totalBeats: 16, scalePitchClasses: major, currentTones: [0, 4, 7], nextTones: [9, 0, 4] };
const pc = pitch => ((pitch % 12) + 12) % 12;

test("melody prepares the next chord with a nearby shared tone", () => {
  const before = structuredClone(input);
  const plan = planMusicalLookahead(input);
  assert.equal(plan.pitch, 64);
  assert.equal(plan.goalPitch, 64);
  assert.ok(input.currentTones.includes(pc(plan.pitch)));
  assert.ok(input.nextTones.includes(pc(plan.goalPitch)));
  assert.deepEqual(input, before);
  assert.deepEqual(planMusicalLookahead(input), plan);
  assert.equal(planMusicalLookahead({ ...input, nextTones: [0, 7, 11] }), null, "a changed future chord must change the preparation choice");
});

test("bass approaches an incoming root by scale step without an early root hit", () => {
  const plan = planMusicalLookahead({ ...input, pitch: 36, trackId: "bass", nextTones: [5] });
  assert.equal(plan.pitch, 38);
  assert.equal(plan.goalPitch, 41);
  assert.ok(Math.abs(plan.pitch - 36) <= 2);
  assert.ok(major.includes(pc(plan.pitch)));
  assert.notEqual(pc(plan.pitch), 5);
});

test("lookahead preserves tonic closure, early phrases, missing futures and disabled roles", () => {
  for (const patch of [
    { protectedLanding: true }, { boundary: 16 }, { start: 1 }, { boundary: 2 },
    { nextTones: [] }, { nextTones: [1, 6, 10] }, { trackId: "drums" },
    { pitch: NaN }, { totalBeats: undefined },
  ]) assert.equal(planMusicalLookahead({ ...input, ...patch }), null);
});

test("lookahead respects transposed scales, MIDI bounds and melody leap limits", () => {
  for (let transpose = 0; transpose < 12; transpose += 1) {
    const plan = planMusicalLookahead({ ...input, pitch: 67 + transpose,
      scalePitchClasses: major.map(tone => pc(tone + transpose)),
      currentTones: input.currentTones.map(tone => pc(tone + transpose)),
      nextTones: input.nextTones.map(tone => pc(tone + transpose)),
    });
    assert.equal(plan.pitch, 64 + transpose);
    assert.ok(Math.abs(plan.pitch - (67 + transpose)) <= 4);
  }
  for (const pitch of [0, 2, 125, 127]) {
    const plan = planMusicalLookahead({ ...input, pitch });
    if (plan) assert.ok(plan.pitch >= 0 && plan.pitch <= 127);
  }
});

test("generated songs use future-aware bass and melody choices deterministically", () => {
  const seen = new Set();
  for (const genre of ["hipHop", "house"]) {
    const config = { seed: "lookahead-1", genre, bars: 16, key: "C", scale: "minor", complexity: 0.7, variation: 0.8 };
    const song = generateNew(config);
    assert.deepEqual(song, generateNew(config));
    for (const track of song.tracks) {
      for (const note of track.notes.filter(note => note.musicalLookaheadIntent)) {
        const plan = note.musicalLookaheadIntent;
        assert.ok(plan.boundary < song.bars * 4, "the ending must not anticipate a fictitious loop");
        const nextChord = song.harmony.find(chord => Math.abs(chord.start - plan.boundary) < 0.01);
        assert.ok(nextChord);
        assert.ok(nextChord.tones.includes(pc(plan.goalPitch)));
        assert.ok([0, 2, 3, 5, 7, 8, 10].includes(pc(note.pitch)), "committed notes must remain in C minor");
        if (pc(note.pitch) === pc(plan.pitch)) seen.add(track.id);
      }
    }
  }
  assert.ok(seen.has("bass"), "a bass approach must survive into the committed song");
  assert.ok(seen.has("melody"), "a melodic chord connection must survive into the committed song");
});


test("phrase-target scoring prefers common tones over unnecessary motion", () => {
  const ranked = rankPhraseTargetCandidates({
    pitch: 67,
    scalePitchClasses: major,
    currentTones: [0, 4, 7],
    nextTones: [9, 0, 4],
    nextRootPc: 9,
  });

  assert.equal(ranked[0].candidate, 64);
  assert.equal(ranked[0].targetRole, "common-tone");
  assert.equal(ranked[0].goalPitch, 64);
  assert.equal(ranked[0].goalDistance, 0);
});

test("guide-tone scoring favors an incoming 3rd or 7th when voice leading is smooth", () => {
  const eToF = scorePhraseTargetCandidate({
    candidate: 64,
    sourcePitch: 64,
    currentTones: [0, 4, 7],
    nextTones: [7, 11, 2, 5],
    nextRootPc: 7,
  });
  const cToD = scorePhraseTargetCandidate({
    candidate: 60,
    sourcePitch: 64,
    currentTones: [0, 4, 7],
    nextTones: [7, 11, 2, 5],
    nextRootPc: 7,
  });

  assert.equal(eToF.goalPitch, 65);
  assert.equal(eToF.targetRole, "guide-tone");
  assert.equal(eToF.semitonePreparation, true);
  assert.ok(eToF.score > cToD.score);
});

test("lookahead leaves an already ideal common guide tone unchanged", () => {
  const plan = planMusicalLookahead({
    pitch: 71,
    start: 3.25,
    boundary: 4,
    totalBeats: 16,
    scalePitchClasses: major,
    currentTones: [7, 11, 2, 5],
    nextTones: [0, 4, 7, 11],
    currentRootPc: 7,
    nextRootPc: 0,
    trackId: "melody",
  });
  assert.equal(plan, null);
});

test("generated lead notes expose scored phrase-target intent before real chord changes", { timeout: 120_000 }, () => {
  let survivor = null;
  let survivorSong = null;

  for (let index = 0; index < 8 && !survivor; index += 1) {
    const config = {
      seed: `phrase-target-live-${index}`,
      genre: "pop",
      bars: 8,
      key: "C",
      scale: "major",
      complexity: 0.78,
      variation: 0.72,
      professionalUpgrade: true,
      candidateCount: 1,
    };
    const song = generateNew(config);
    assert.deepEqual(song, generateNew(config));

    survivor = song.tracks
      .filter((track) => ["melody", "counterpoint"].includes(track.id))
      .flatMap((track) => track.notes)
      .find((note) => (
        note.musicalLookaheadIntent?.role === "phrase-target"
        && Math.abs(note.pitch - note.musicalLookaheadIntent.pitch) < 1e-6
      )) ?? null;
    if (survivor) survivorSong = song;
  }

  assert.ok(survivor, "at least one composed lead note should retain a scored future-chord target");
  const plan = survivor.musicalLookaheadIntent;
  assert.ok(["common-guide-tone", "common-tone", "guide-tone", "future-chord-tone"].includes(plan.targetRole));
  assert.ok(plan.boundary > survivor.start);
  assert.ok(plan.goalDistance >= 0);
  const nextChord = survivorSong.harmony.find((chord) => Math.abs(chord.start - plan.boundary) < 0.01);
  assert.ok(nextChord);
  assert.ok(nextChord.tones.includes(pc(plan.goalPitch)));
});


test("rhythm-melody lookahead chooses a nearby authored pulse away from backbeat congestion", () => {
  const grooveConductor = {
    bars: [
      {
        bar: 0,
        sectionId: "verse",
        anchors: [0, 2],
        snarePulses: [1, 3],
        bassPulses: [0, 1, 2],
        leadPulses: [0.75, 1, 1.25, 2.75, 3],
        counterPulses: [0.5, 1.5, 2.5, 3.5],
        spaces: [],
      },
      {
        bar: 1,
        sectionId: "verse",
        anchors: [2],
        snarePulses: [1, 3],
        bassPulses: [2],
        chordPulses: [2],
        leadPulses: [0.5, 1.5, 2.5, 3.5],
        spaces: [],
      },
    ],
  };
  const plan = planRhythmMelodyLookahead({
    grooveConductor,
    beat: 1,
    beatsPerBar: 4,
    genre: "hipHop",
    lane: "leadPulses",
  });
  assert.ok(plan);
  assert.equal(plan.beat, 0.75);
  assert.ok(Math.abs(plan.shiftBeats) <= 0.25);
  assert.equal(plan.role, "avoid-current-congestion");
});

test("lookahead reserves the tail before a busy payoff opening", () => {
  const grooveConductor = {
    bars: [
      {
        bar: 0,
        sectionId: "build",
        anchors: [0, 2],
        snarePulses: [1, 3],
        bassPulses: [0, 2],
        leadPulses: [3.5, 3.75],
        spaces: [],
      },
      {
        bar: 1,
        sectionId: "drop",
        anchors: [0],
        snarePulses: [1],
        bassPulses: [0],
        chordPulses: [0],
        leadPulses: [0.5],
        grooveDNA: { sectionRole: "payoff" },
        spaces: [],
      },
    ],
  };
  const plan = planRhythmMelodyLookahead({
    grooveConductor,
    beat: 3.75,
    beatsPerBar: 4,
    genre: "hipHop",
    lane: "leadPulses",
  });
  assert.ok(plan);
  assert.equal(plan.beat, 3.5);
  assert.equal(plan.reserveTail, true);
  assert.equal(plan.incomingPayoff, true);
  assert.ok(plan.nextOpeningLoad >= 2);
});

test("house rhythm lookahead stays micro-bounded", () => {
  const grooveConductor = {
    bars: [
      {
        bar: 0,
        sectionId: "verse",
        anchors: [0, 1, 2, 3],
        snarePulses: [1, 3],
        bassPulses: [0.5, 1.5, 2.5, 3.5],
        leadPulses: [0.9375, 1, 1.0625],
        spaces: [],
      },
    ],
  };
  const plan = planRhythmMelodyLookahead({
    grooveConductor,
    beat: 1,
    beatsPerBar: 4,
    genre: "house",
    lane: "leadPulses",
  });
  if (plan) assert.ok(Math.abs(plan.shiftBeats) <= 0.0625 + 1e-9);
});

test("generated hip-hop exposes deterministic rhythm-melody lookahead intents", () => {
  const config = {
    seed: "rhythm-melody-lookahead-live",
    genre: "hipHop",
    bars: 16,
    professionalUpgrade: true,
    complexity: 0.76,
    variation: 0.72,
    candidateCount: 1,
  };
  const song = generateNew(config);
  assert.deepEqual(song, generateNew(config));
  const intents = song.tracks
    .filter((track) => ["melody", "counterpoint"].includes(track.id))
    .flatMap((track) => track.notes)
    .map((note) => note.rhythmMelodyLookaheadIntent)
    .filter(Boolean);
  assert.ok(intents.length >= 1);
  assert.ok(intents.every((intent) => Math.abs(intent.shiftBeats) <= 0.25 + 1e-9));
});
