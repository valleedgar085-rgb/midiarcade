import assert from "node:assert/strict";
import test from "node:test";

import {
  generateNew,
  producerPacingDensityScale,
  producerRoleGateWindow,
  structureDirectorEnergyTarget,
} from "../src/music-engine.js";

const FULL_STRUCTURE = [
  { id: "intro-1", name: "intro", startBeat: 0, endBeat: 16, bars: 4 },
  { id: "verse-1", name: "verse", startBeat: 16, endBeat: 48, bars: 8 },
];

test("full-song intro pacing blooms from sparse opening to fuller handoff", () => {
  const scene = { purpose: "establish" };
  const config = { genre: "trap", timeSignature: [4, 4] };

  const drumEarly = producerPacingDensityScale(
    FULL_STRUCTURE[0], FULL_STRUCTURE, scene, "drums", "foundation", 0.25, config,
  );
  const drumLate = producerPacingDensityScale(
    FULL_STRUCTURE[0], FULL_STRUCTURE, scene, "drums", "foundation", 15.5, config,
  );
  const supportEarly = producerPacingDensityScale(
    FULL_STRUCTURE[0], FULL_STRUCTURE, scene, "chords", "support", 0.25, config,
  );
  const supportLate = producerPacingDensityScale(
    FULL_STRUCTURE[0], FULL_STRUCTURE, scene, "chords", "support", 15.5, config,
  );

  assert.ok(drumEarly < drumLate, `drum density should bloom: ${drumEarly} -> ${drumLate}`);
  assert.ok(supportEarly < supportLate, `support density should bloom: ${supportEarly} -> ${supportLate}`);
  assert.ok(drumEarly >= 0.45 && drumEarly < 0.7);
  assert.ok(supportEarly >= 0.35 && supportEarly < 0.6);
  assert.ok(drumLate > 0.95);
  assert.ok(supportLate > 0.88);
});

test("short loop forms keep immediate density and skip full-song intro staging", () => {
  const structure = [
    { id: "intro-1", name: "intro", startBeat: 0, endBeat: 8, bars: 2 },
    { id: "verse-1", name: "verse", startBeat: 8, endBeat: 32, bars: 6 },
  ];
  const scene = { purpose: "establish" };
  const config = { genre: "trap", timeSignature: [4, 4] };

  assert.equal(
    producerPacingDensityScale(structure[0], structure, scene, "drums", "foundation", 0.25, config),
    1,
  );
  assert.equal(
    producerRoleGateWindow(structure[0], structure, scene, "chords", "support", config),
    null,
  );
});

test("full-song staged entry hierarchy keeps bass and secondary layers out of the first gesture", () => {
  const scene = { purpose: "establish" };
  for (const genre of ["hipHop", "trap", "pop", "neoSoul"]) {
    const config = { genre, timeSignature: [4, 4] };
    const bass = producerRoleGateWindow(
      FULL_STRUCTURE[0], FULL_STRUCTURE, scene, "bass", "foundation", config,
    );
    const support = producerRoleGateWindow(
      FULL_STRUCTURE[0], FULL_STRUCTURE, scene, "chords", "support", config,
    );
    const answer = producerRoleGateWindow(
      FULL_STRUCTURE[0], FULL_STRUCTURE, scene, "counterpoint", "answer", config,
    );
    const texture = producerRoleGateWindow(
      FULL_STRUCTURE[0], FULL_STRUCTURE, scene, "pad", "texture", config,
    );

    assert.ok(bass?.entryBeat >= 0.5, `${genre} bass should enter after the opening gesture`);
    assert.ok(support?.entryBeat >= 0.5, `${genre} support should be staged`);
    assert.ok(answer?.entryBeat > support.entryBeat, `${genre} answer should follow support`);
    assert.ok(texture?.entryBeat > answer.entryBeat, `${genre} texture should enter last`);
  }
});

test("Hip-Hop full-song intro is pad-led with explicit breathing-room targets", { timeout: 120_000 }, () => {
  const input = {
    genre: "hipHop",
    seed: "phase-a9-hiphop-intro-bloom",
    bars: 32,
    key: "A",
    scale: "minor",
    energy: 0.76,
    complexity: 0.72,
    variation: 0.68,
    evolution: 0.72,
    candidateCount: 1,
  };
  const song = generateNew(input);
  const repeated = generateNew(input);
  assert.deepEqual(song, repeated, "intro pacing must remain deterministic");

  const intro = song.structure[0];
  const scene = song.producerIntent?.scenes?.find((entry) => entry.sectionId === intro.id);
  const matrix = song.orchestrationMatrix?.find((entry) => entry.sectionId === intro.id);

  assert.equal(intro.name, "intro");
  assert.equal(scene?.purpose, "establish");
  assert.equal(scene?.foregroundTrack, "pad");
  assert.equal(matrix?.featuredTrack, "pad");
  assert.ok(scene?.silenceBudget >= 0.3);
  assert.ok(scene?.densityCeiling <= 0.78);
});

test("final full-song intro retains pacing evidence while preserving core drum anchors", { timeout: 120_000 }, () => {
  const song = generateNew({
    genre: "trap",
    seed: "phase-a9-trap-pacing-evidence",
    bars: 32,
    key: "A",
    scale: "minor",
    energy: 0.8,
    complexity: 0.76,
    variation: 0.72,
    evolution: 0.76,
    candidateCount: 1,
  });
  const intro = song.structure[0];
  const introNotes = song.tracks.flatMap((track) => (
    track.notes
      .filter((note) => note.start >= intro.startBeat - 1e-6 && note.start < intro.endBeat - 1e-6)
      .map((note) => ({ ...note, trackId: track.id }))
  ));
  const paced = introNotes.filter((note) => Number.isFinite(note.producerPacingDensityScale));
  assert.ok(paced.length > 0, "full-song intro should retain pacing evidence");
  assert.ok(paced.every((note) => note.producerPacingDensityScale > 0 && note.producerPacingDensityScale < 1));

  const coreDrums = introNotes.filter((note) => (
    note.trackId === "drums" && [36, 38, 39].includes(Math.round(note.pitch))
  ));
  assert.ok(coreDrums.length > 0, "intro must preserve kick/snare anchors while thinning ornamentation");
});


test("Structure Director v3 keeps a clear establish-to-payoff energy hierarchy", () => {
  const intro = structureDirectorEnergyTarget("establish", 0.9, 1);
  const verse = structureDirectorEnergyTarget("pocket", 0.9, 1);
  const build = structureDirectorEnergyTarget("build", 0.9, 1);
  const payoff = structureDirectorEnergyTarget("payoff", 0.9, 1);
  const payoffReturn = structureDirectorEnergyTarget("payoff", 0.9, 2);
  const reset = structureDirectorEnergyTarget("reset", 0.9, 1);

  assert.ok(intro < verse, `intro should stay below verse: ${intro} < ${verse}`);
  assert.ok(verse < build, `verse should stay below build: ${verse} < ${build}`);
  assert.ok(build < payoff, `build should stay below payoff: ${build} < ${payoff}`);
  assert.ok(reset < build, `reset should create contrast: ${reset} < ${build}`);
  assert.ok(payoffReturn >= payoff, "later payoff should not shrink below the first payoff");
  assert.ok(intro <= 0.52);
  assert.ok(payoff >= 0.84);
});

test("build into payoff reserves a short bass/drum breath without muting the foreground", () => {
  const structure = [
    { id: "intro-1", name: "intro", startBeat: 0, endBeat: 16, bars: 4 },
    { id: "verse-1", name: "verse", startBeat: 16, endBeat: 32, bars: 4 },
    { id: "prechorus-1", name: "prechorus", startBeat: 32, endBeat: 48, bars: 4 },
    { id: "chorus-1", name: "chorus", startBeat: 48, endBeat: 64, bars: 4 },
  ];
  const scene = { purpose: "build", storyStage: "build", payoffBreathBars: 0.5 };
  const config = { genre: "pop", timeSignature: [4, 4] };

  const bass = producerRoleGateWindow(structure[2], structure, scene, "bass", "foundation", config);
  const drums = producerRoleGateWindow(structure[2], structure, scene, "drums", "foundation", config);
  const counter = producerRoleGateWindow(structure[2], structure, scene, "counterpoint", "answer", config);
  const melody = producerRoleGateWindow(structure[2], structure, scene, "melody", "foreground", config);

  assert.equal(bass?.exitBeat, 46);
  assert.equal(drums?.exitBeat, 47);
  assert.equal(counter?.exitBeat, 47);
  assert.equal(melody?.exitBeat ?? null, null);
});

test("build pacing rises toward the payoff instead of staying flat", () => {
  const structure = [
    { id: "verse-1", name: "verse", startBeat: 0, endBeat: 32, bars: 8 },
    { id: "prechorus-1", name: "prechorus", startBeat: 32, endBeat: 48, bars: 4 },
    { id: "chorus-1", name: "chorus", startBeat: 48, endBeat: 64, bars: 4 },
  ];
  const scene = { purpose: "build", storyStage: "build", payoffBreathBars: 0.5 };
  const config = { genre: "pop", timeSignature: [4, 4] };

  const early = producerPacingDensityScale(
    structure[1], structure, scene, "chords", "support", 32.25, config,
  );
  const late = producerPacingDensityScale(
    structure[1], structure, scene, "chords", "support", 47.5, config,
  );

  assert.ok(early < late, `build should climb: ${early} -> ${late}`);
  assert.ok(early >= 0.74 && early <= 0.8);
  assert.ok(late > 0.95);
});
