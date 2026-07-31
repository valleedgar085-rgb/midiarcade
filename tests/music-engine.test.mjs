import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// The project intentionally has no package-level module-mode requirement yet.
// A data URL lets this browser-native ES module be tested in plain Node.
const source = await readFile(new URL("../src/music-engine.js", import.meta.url), "utf8");
const engine = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

const CONFIG = {
  seed: "test-seed-2026",
  key: "Eb",
  scale: "dorian",
  tempo: 124,
  bars: 12,
  energy: 0.76,
  complexity: 0.68,
  variation: 0.62,
  swing: 0.2,
  humanize: 0.25,
};

const GENRE_TEMPOS = {
  neoSoul: [68, 96, 84],
  hipHop: [82, 108, 94],
  rap: [76, 104, 90],
  trap: [130, 150, 140],
  house: [115, 130, 124],
  techno: [120, 132, 126],
  drumBass: [160, 180, 174],
  synthwave: [84, 118, 100],
  pop: [92, 128, 112],
  loFiHipHop: [70, 92, 82],
  rnbSoul: [60, 85, 72],
  drill: [138, 150, 144],
  reggaeton: [88, 102, 96],
  afrobeats: [98, 116, 108],
  jazz: [108, 200, 140],
  ambient: [58, 80, 68],
  funk: [88, 112, 100],
  country: [82, 126, 104],
  rock: [92, 148, 120],
  popRadio: [112, 128, 120],
  synthPopRadio: [118, 134, 124],
};

function midiTrackChunks(midi) {
  const view = new DataView(midi.buffer, midi.byteOffset, midi.byteLength);
  const chunks = [];
  let offset = 14;
  while (offset + 8 <= midi.length) {
    assert.equal(String.fromCharCode(...midi.slice(offset, offset + 4)), "MTrk");
    const length = view.getUint32(offset + 4);
    chunks.push(midi.slice(offset + 8, offset + 8 + length));
    offset += 8 + length;
  }
  return chunks;
}

function midiChannelEvents(chunk) {
  const events = [];
  let offset = 0;
  let tick = 0;
  const variable = () => {
    let value = 0;
    let byte;
    do {
      byte = chunk[offset++];
      value = (value << 7) | (byte & 0x7f);
    } while (byte & 0x80);
    return value;
  };
  while (offset < chunk.length) {
    tick += variable();
    const status = chunk[offset++];
    if (status === 0xff) {
      offset += 1;
      const length = variable();
      offset += length;
      continue;
    }
    if (status === 0xf0 || status === 0xf7) {
      const length = variable();
      offset += length;
      continue;
    }
    const kind = status & 0xf0;
    const dataLength = kind === 0xc0 || kind === 0xd0 ? 1 : 2;
    const data = Array.from(chunk.slice(offset, offset + dataLength));
    offset += dataLength;
    events.push({ tick, status, data });
  }
  return events;
}

function assertValidNotes(song) {
  for (const track of song.tracks) {
    const seen = new Set();
    for (const note of track.notes) {
      assert.ok(Number.isFinite(note.start));
      assert.ok(Number.isFinite(note.duration));
      assert.ok(note.pitch >= 0 && note.pitch <= 127);
      assert.ok(note.velocity >= 1 && note.velocity <= 127);
      assert.ok(note.start >= 0);
      assert.ok(note.start + note.duration <= song.meta.totalBeats + 1e-5);
      const identity = `${note.pitch}:${note.start}`;
      assert.ok(!seen.has(identity), `${track.id} contains duplicate pitch/onset ${identity}`);
      seen.add(identity);
    }
  }
}

function assertAllGeneratedPitchesInScale(song) {
  const mod12 = (value) => ((Math.round(value) % 12) + 12) % 12;
  const allowed = new Set(song.meta.scaleIntervals.map((interval) => mod12(song.meta.keyPc + interval)));
  for (const track of song.tracks) {
    if (track.id === "drums") continue;
    for (const note of track.notes) {
      assert.ok(
        allowed.has(mod12(note.pitch)),
        `${track.id} pitch ${note.pitch} is outside ${song.meta.key} ${song.meta.scale}`,
      );
    }
  }
  for (const chord of song.harmony) {
    for (const tone of chord.tones) {
      assert.ok(
        allowed.has(mod12(tone)),
        `${chord.symbol} tone ${tone} is outside ${song.meta.key} ${song.meta.scale}`,
      );
    }
  }
}

test("seeded new-song generation is deterministic and structurally complete", () => {
  const first = engine.generateNew(CONFIG);
  const second = engine.generateNew(CONFIG);

  assert.deepEqual(first, second);
  assert.equal(first.schema, "midi-arcade/song@1");
  assert.equal(first.generation, "new");
  assert.equal(first.meta.tempo, 124);
  assert.equal(first.meta.bars, 12);
  assert.equal(first.meta.key, "Eb");
  assert.equal(first.meta.scale, "dorian");
  assert.equal(first.meta.ppq, 480);
  assert.equal(first.structure.reduce((sum, section) => sum + section.bars, 0), 12);
  assert.deepEqual(first.tracks.map((track) => track.id), [
    "drums",
    "bass",
    "chords",
    "melody",
    "counterpoint",
    "pad",
  ]);

  for (const track of first.tracks) {
    assert.ok(track.notes.length > 0, `${track.id} should contain notes`);
    for (const note of track.notes) {
      assert.ok(Number.isFinite(note.start));
      assert.ok(Number.isFinite(note.duration));
      assert.ok(note.pitch >= 0 && note.pitch <= 127);
      assert.ok(note.velocity >= 1 && note.velocity <= 127);
      assert.ok(note.start >= 0);
      assert.ok(note.start + note.duration <= first.meta.totalBeats + 1e-5);
    }
  }
});

test("genre fusion engine blends two distinct genres into a valid hybrid profile", () => {
  const fusion = engine.createFusedGenreProfile("jazz", "drill", 0.5);
  assert.equal(fusion.isFusion, true);
  assert.equal(fusion.primaryGenre, "jazz");
  assert.equal(fusion.secondaryGenre, "drill");
  assert.ok(fusion.label.includes("Jazz"));
  assert.ok(fusion.label.includes("Drill"));
  assert.equal(fusion.bpm.default, Math.round((140 + 144) / 2));
  assert.ok(fusion.instrumentPrograms.drums.length > 0);

  const song = engine.generateNew({
    genre: "jazz",
    secondaryGenre: "drill",
    fusionBlend: 0.5,
    seed: "test-fusion-jazz-drill",
    bars: 8,
  });

  assert.equal(song.meta.secondaryGenre, "drill");
  assert.equal(song.meta.isFusion, true);
  assert.ok(song.tracks.length >= 6);
  assertValidNotes(song);
  assertAllGeneratedPitchesInScale(song);
});

test("exotic and regional 30+ scales remain scale-safe in generation", () => {
  const exoticScales = ["doubleHarmonic", "hirajoshi", "hungarianMinor", "bebopDominant", "wholeTone"];
  for (const scale of exoticScales) {
    const song = engine.generateNew({
      key: "D",
      scale,
      seed: `exotic-scale-${scale}`,
      bars: 8,
    });
    assert.equal(song.meta.scale, scale);
    assertValidNotes(song);
    assertAllGeneratedPitchesInScale(song);
  }
});

test("every supported key and scale generates only scale-safe pitched notes", () => {
  const genres = Object.keys(GENRE_TEMPOS);
  let combination = 0;
  for (const scale of Object.keys(engine.SCALES)) {
    for (let keyPc = 0; keyPc < 12; keyPc += 1) {
      const song = engine.generateNew({
        seed: `scale-safety-${scale}-${keyPc}`,
        key: keyPc,
        scale,
        genre: genres[combination % genres.length],
        bars: 4,
        candidateCount: 1,
        energy: 0.92,
        complexity: 1,
        variation: 1,
        surprise: 1,
      });
      assertAllGeneratedPitchesInScale(song);
      assert.equal(song.producerPass.checks.scaleSafety, true);
      assert.equal(song.producerPass.metrics.scaleFit, 1);
      assert.equal(song.meta.scoreDetails.diagnostics.scaleFit, 1);
      assert.equal(song.meta.qualityGate.scaleSafe, true);
      combination += 1;
    }
  }
});

test("related generation obeys a newly selected key and scale", () => {
  const original = engine.generateNew({
    ...CONFIG,
    seed: "scale-safety-related-source",
    key: "Eb",
    scale: "dorian",
    bars: 8,
    candidateCount: 1,
  });
  const related = engine.generateSimilar(original, {
    seed: "scale-safety-related-result",
    key: "B",
    scale: "phrygian",
    candidateCount: 1,
    complexity: 1,
    variation: 1,
    surprise: 1,
  });
  assert.equal(related.meta.key, "B");
  assert.equal(related.meta.scale, "phrygian");
  assertAllGeneratedPitchesInScale(related);
  assert.equal(related.meta.qualityGate.scaleSafe, true);
});

test("candidate generation is deterministic, bounded, and commits the highest score", () => {
  const config = { ...CONFIG, seed: "candidate-pipeline", candidateCount: 6 };
  const first = engine.generateNew(config);
  const second = engine.generateNew(config);
  const details = first.meta.scoreDetails;

  assert.deepEqual(first, second);
  assert.equal(details.candidatesEvaluated, 6);
  assert.equal(details.candidateScores.length, 6);
  assert.equal(
    details.totalScore,
    Math.max(...details.candidateScores.map(({ score }) => score)),
  );
  assert.equal(
    details.totalScore,
    details.candidateScores.find(({ index }) => index === details.selectedCandidate).score,
  );
  assert.equal(details.candidateSearch.adaptive, false);
  assert.equal(details.candidateSearch.expandedBy, 0);
  assert.ok(details.balance.balanceScore >= 0 && details.balance.balanceScore <= 100);
  assert.ok(details.balance.creativeFloor >= 0 && details.balance.creativeFloor <= 100);

  const bounded = engine.generateNew({ ...CONFIG, seed: "bounded-pipeline", candidateCount: 0 });
  assert.equal(bounded.meta.scoreDetails.candidatesEvaluated, 1);
});

test("balanced candidate search expands only during generation when the default pool misses its target", () => {
  const input = { ...CONFIG, seed: "adaptive-contract-3", bars: 8 };
  const fixed = engine.generateNew({ ...input, candidateCount: 4 });
  const adaptive = engine.generateNew(input);
  const repeated = engine.generateNew(input);
  const search = adaptive.meta.scoreDetails.candidateSearch;

  assert.deepEqual(adaptive, repeated, "adaptive search must remain deterministic");
  assert.equal(search.adaptive, true);
  assert.equal(search.baseCandidateCount, 4);
  assert.equal(search.maxCandidateCount, 7);
  assert.ok(search.expandedBy > 0 && search.expandedBy <= 3);
  assert.equal(
    adaptive.meta.scoreDetails.candidatesEvaluated,
    4 + search.expandedBy + adaptive.meta.scoreDetails.criticRepair.attempts,
  );
  assert.deepEqual(
    adaptive.meta.scoreDetails.candidateScores.slice(0, 4),
    fixed.meta.scoreDetails.candidateScores,
    "adaptive search must preserve the original deterministic candidate pool",
  );
  assert.equal(adaptive.ideaEnginePhases[2].id, "balanced-candidate-search");
  assert.equal(adaptive.ideaEnginePhases[2].expandedBy, search.expandedBy);
});

test("balanced critic exposes weak creative dimensions hidden by a high average", () => {
  const strongSubscores = Object.fromEntries([
    "harmonic",
    "groove",
    "motif",
    "storyArc",
    "voiceLeading",
    "separation",
    "transitions",
    "harmonicJourney",
    "performance",
    "orchestration",
    "memory",
  ].map((name) => [name, 90]));
  const strong = engine.evaluateCandidateBalance({
    score: 90,
    subscores: strongSubscores,
    diagnostics: { scaleFit: 1 },
  });
  const weakMotif = engine.evaluateCandidateBalance({
    score: 90,
    subscores: { ...strongSubscores, motif: 38 },
    diagnostics: { scaleFit: 1 },
  });

  assert.equal(strong.passed, true);
  assert.equal(strong.aspirational, false);
  assert.equal(weakMotif.passed, false);
  assert.equal(weakMotif.creativeFloor, 38);
  assert.ok(weakMotif.balanceScore < strong.balanceScore);
});

test("phase 20 diagnoses the weakest critic dependency group deterministically", () => {
  const strong = Object.fromEntries([
    "harmonic",
    "groove",
    "motif",
    "storyArc",
    "density",
    "voiceLeading",
    "separation",
    "cadence",
    "repetition",
    "transitions",
    "harmonicJourney",
    "performance",
    "orchestration",
    "memory",
    "production",
  ].map((name) => [name, 90]));
  const groove = engine.diagnoseCandidateRepair({
    score: 82,
    subscores: { ...strong, groove: 28, density: 41 },
  });
  const next = engine.diagnoseCandidateRepair({
    score: 82,
    subscores: { ...strong, groove: 28, density: 41, motif: 44 },
  }, ["groove"]);

  assert.deepEqual(groove, {
    version: 1,
    group: "groove",
    route: "groove-first",
    weakestDimension: "groove",
    weakestScore: 28,
    groupScore: 34.5,
  });
  assert.equal(next.group, "motif");
  assert.equal(next.weakestDimension, "motif");
  assert.equal(next.route, "hook-first");
});

test("phase 20 repairs only when needed and stays inside a bounded deterministic budget", () => {
  const input = {
    seed: "weak-c",
    bars: 12,
    genre: "jazz",
    energy: 0.1,
    complexity: 0.1,
  };
  const withoutRepair = engine.generateNew({ ...input, targetedRepair: false });
  const repaired = engine.generateNew(input);
  const repeated = engine.generateNew(input);
  const details = repaired.meta.scoreDetails;
  const repair = details.criticRepair;

  assert.deepEqual(repaired, repeated, "targeted repairs must remain deterministic");
  assert.equal(repair.enabled, true);
  assert.ok(repair.attempts >= 1 && repair.attempts <= 2);
  assert.equal(repair.groups.length, repair.attempts);
  assert.ok(details.candidatesEvaluated <= 12, "generation CPU must stay inside the hard candidate budget");
  assert.equal(
    details.candidatesEvaluated,
    withoutRepair.meta.scoreDetails.candidatesEvaluated + repair.attempts,
  );
  assert.deepEqual(
    details.candidateScores.slice(0, withoutRepair.meta.scoreDetails.candidatesEvaluated),
    withoutRepair.meta.scoreDetails.candidateScores,
    "phase 20 must preserve the complete pre-repair candidate pool",
  );
  assert.equal(repaired.criticRepair.phase, 20);
  assert.equal(repaired.ideaEnginePhases.at(-1).id, "targeted-critic-repair");
  assert.equal(repaired.ideaEnginePhases.at(-1).attempts, repair.attempts);
  assertAllGeneratedPitchesInScale(repaired);
});

test("phase 40 reconciles repaired tracks with the actual final interlock plan", () => {
  const input = {
    seed: "repair-reconcile-0",
    bars: 8,
    genre: "jazz",
    energy: 0.05,
    complexity: 0.05,
  };
  const song = engine.generateNew(input);
  assert.equal(song.meta.scoreDetails.criticRepair.selectedFromRepair, true);
  assert.equal(song.generationInterlock.version, 2);
  assert.deepEqual(song.generationInterlock.reconciliation, {
    phase: 40,
    repairGroup: song.criticRepair.group,
    source: "actual-repaired-song",
  });

  const contracts = new Map(song.generationInterlock.sectionContracts.map((contract) => [
    contract.sectionId,
    contract,
  ]));
  for (const track of song.tracks) {
    for (const note of track.notes) {
      const section = song.structure.find((candidate) => (
        note.start >= candidate.startBeat - 1e-6 && note.start < candidate.endBeat - 1e-6
      )) ?? song.structure.at(-1);
      assert.equal(note.connectionId, contracts.get(section.id).id);
      assert.equal(note.connectionRole, contracts.get(section.id).role);
    }
  }
  assert.ok(engine.evaluateSongCandidate(song).subscores.stageInterlock >= 70);
  assert.deepEqual(song, engine.generateNew(input), "repair reconciliation must remain deterministic");
});

test("song blueprint coordinates narrative, section energy, cadence, and motif development", () => {
  const config = { ...CONFIG, genre: "pop", seed: "blueprint-story", bars: 32 };
  const song = engine.generateNew(config);
  const blueprint = song.songBlueprint;

  assert.equal(blueprint.version, 5);
  assert.match(blueprint.narrative.label, /\S/);
  assert.equal(blueprint.sectionPlans.length, song.structure.length);
  assert.ok(blueprint.hookSectionId);
  assert.ok(blueprint.peakSectionId);
  assert.equal(blueprint.tensionCurve.length, song.structure.length);
  assert.ok(Object.values(blueprint.qualityTargets).every((value) => value >= 0 && value <= 1));

  const transforms = new Set();
  for (const section of song.structure) {
    const plan = blueprint.sectionPlans.find((candidate) => candidate.sectionId === section.id);
    assert.ok(plan, `${section.id} should have a shared section plan`);
    assert.equal(section.intent.motifTransform, plan.motifTransform);
    assert.equal(section.intent.cadence, plan.cadence);
    assert.equal(plan.developmentPath.length, 3);
    assert.match(plan.harmonicRole, /\S/);
    assert.match(plan.harmonicColor, /\S/);
    assert.ok(plan.energy >= 0 && plan.energy <= 1);
    assert.ok(plan.density >= 0 && plan.density <= 1);
    assert.ok(plan.tensionEnvelope.start >= 0 && plan.tensionEnvelope.start <= 1);
    assert.ok(plan.tensionEnvelope.peak >= plan.tensionEnvelope.start);
    assert.ok(plan.tensionEnvelope.end >= 0 && plan.tensionEnvelope.end <= 1);
    assert.ok(plan.tensionEnvelope.peakAt > 0 && plan.tensionEnvelope.peakAt < 1);
    assert.ok([2, 3, 4].includes(plan.tensionEnvelope.phraseBars));
    assert.ok(plan.tensionEnvelope.phraseLift > 0);
    transforms.add(plan.motifTransform);
  }
  assert.ok(transforms.size >= 4, "the arrangement should tell a story with several motif transformations");
  assert.equal(blueprint.transitions.length, song.structure.length - 1);
  assert.ok(blueprint.transitions.every((transition) => (
    transition.fromSectionId && transition.toSectionId
    && transition.strength >= 0 && transition.strength <= 1
    && transition.pickupBeats > 0
  )));

  const similar = engine.generateSimilar(song, { seed: "blueprint-story-similar", similarity: 0.94 });
  assert.equal(similar.songBlueprint.narrative.id, blueprint.narrative.id);
  assert.deepEqual(
    similar.songBlueprint.sectionPlans.map(({ sectionId, motifTransform, cadence }) => ({ sectionId, motifTransform, cadence })),
    blueprint.sectionPlans.map(({ sectionId, motifTransform, cadence }) => ({ sectionId, motifTransform, cadence })),
  );
  assert.deepEqual(
    similar.songBlueprint.sectionPlans.map(({ sectionId, harmonicRole, harmonicColor }) => ({ sectionId, harmonicRole, harmonicColor })),
    blueprint.sectionPlans.map(({ sectionId, harmonicRole, harmonicColor }) => ({ sectionId, harmonicRole, harmonicColor })),
  );
});

test("phase 29 tension conductor coordinates harmony color, melody register, and drum dynamics", () => {
  const config = {
    genre: "neoSoul",
    seed: "tension-conductor-proof",
    bars: 32,
    energy: 0.82,
    complexity: 0.86,
    variation: 0.78,
    evolution: 0.92,
    syncopation: 0.72,
    humanize: 0,
    swing: 0,
    candidateCount: 1,
    tracks: {
      melody: { density: 0.9, variation: 0.8, humanize: 0 },
      drums: { density: 0.88, variation: 0.8, humanize: 0 },
    },
  };
  const song = engine.generateNew(config);
  assert.deepEqual(song, engine.generateNew(config));

  const peak = song.structure.find((section) => section.id === song.songBlueprint.peakSectionId);
  const release = song.structure.at(-1);
  const peakPlan = song.songBlueprint.sectionPlans.find((plan) => plan.sectionId === peak.id);
  const releasePlan = song.songBlueprint.sectionPlans.find((plan) => plan.sectionId === release.id);
  assert.equal(peakPlan.tensionEnvelope.shape, "crest");
  assert.equal(releasePlan.tensionEnvelope.shape, "release");
  assert.ok(peakPlan.tensionEnvelope.peak - releasePlan.tensionEnvelope.end >= 0.5);
  assert.ok(releasePlan.tensionEnvelope.end < releasePlan.tensionEnvelope.start);

  const notesIn = (trackId, section) => song.tracks
    .find((track) => track.id === trackId).notes
    .filter((note) => note.start >= section.startBeat && note.start < section.endBeat);
  const harmonyIn = (section) => song.harmony
    .filter((event) => event.start >= section.startBeat && event.start < section.endBeat);
  const average = (items, value) => items.reduce((sum, item) => sum + value(item), 0) / items.length;
  const peakMelody = notesIn("melody", peak);
  const releaseMelody = notesIn("melody", release);
  const peakDrums = notesIn("drums", peak);
  const releaseDrums = notesIn("drums", release);

  assert.ok(peakMelody.length > 4 && releaseMelody.length > 0);
  assert.ok(average(peakMelody, (note) => note.pitch) >= average(releaseMelody, (note) => note.pitch) + 8);
  assert.ok(average(peakMelody, (note) => note.velocity) >= average(releaseMelody, (note) => note.velocity) + 12);
  assert.ok(average(peakDrums, (note) => note.velocity) >= average(releaseDrums, (note) => note.velocity) + 10);
  assert.ok(average(harmonyIn(peak), (event) => event.tones.length) > average(harmonyIn(release), (event) => event.tones.length));
  assert.ok(notesIn("drums", song.structure.find((section) => section.name === "bridge"))
    .some((note) => note.rhythmicFeature === "tension-pickup"));

  const taggedTension = song.tracks.find((track) => track.id === "melody").notes
    .map((note) => note.plannedTension)
    .filter(Number.isFinite);
  assert.ok(taggedTension.length > 12);
  assert.ok(Math.max(...taggedTension) - Math.min(...taggedTension) >= 0.45);
  assertValidNotes(song);
  assertAllGeneratedPitchesInScale(song);
});

test("Critic 6.0 scores genre authenticity, phrase resolution, tension, drum variety, register health, and stage connections", () => {
  const song = engine.generateNew({
    ...CONFIG,
    genre: "pop",
    key: "C",
    scale: "major",
    seed: "critic-two-proof",
    bars: 24,
  });
  const evaluation = engine.evaluateSongCandidate(song);
  assert.equal(evaluation.version, 6);
  assert.deepEqual(Object.keys(evaluation.subscores), [
    "harmonic", "groove", "motif", "storyArc", "density", "voiceLeading", "separation", "cadence", "repetition",
    "transitions", "harmonicJourney", "performance", "orchestration", "memory", "production",
    "phraseResolution", "tensionFollow", "drumVariety", "registerHealth", "stageInterlock", "genreAuthenticity",
  ]);
  assert.ok(Object.values(evaluation.subscores).every((score) => score >= 0 && score <= 100));
  assert.equal(song.meta.scoreDetails.criticVersion, 6);
  assert.equal(evaluation.diagnostics.genreProfile, "pop");
  assert.ok(Object.keys(song.meta.scoreDetails.diagnostics).length >= 5);

  const damaged = structuredClone(song);
  for (const track of damaged.tracks) {
    if (track.id !== "drums") {
      for (const note of track.notes) {
        note.pitch = 61;
        note.velocity = 64;
      }
    }
  }
  const melody = damaged.tracks.find((track) => track.id === "melody").notes;
  const counterpoint = damaged.tracks.find((track) => track.id === "counterpoint").notes;
  for (let index = 0; index < Math.min(melody.length, counterpoint.length); index += 1) {
    counterpoint[index].start = melody[index].start;
    counterpoint[index].duration = melody[index].duration;
  }
  for (const event of damaged.harmony) {
    if (event.start + event.duration >= damaged.meta.totalBeats - 0.1) event.degree = 3;
  }
  const damagedEvaluation = engine.evaluateSongCandidate(damaged);
  assert.ok(damagedEvaluation.score < evaluation.score, `${damagedEvaluation.score} should score below ${evaluation.score}`);
  assert.ok(damagedEvaluation.subscores.harmonic < evaluation.subscores.harmonic);
  assert.ok(damagedEvaluation.subscores.separation < evaluation.subscores.separation);
});

test("phase-three arrangement uses coordinated transitions, harmonic roles, and a fixed performance profile", () => {
  const config = {
    ...CONFIG,
    genre: "neoSoul",
    seed: "phase-three-arrangement",
    bars: 32,
    candidateCount: 1,
    humanize: 0.55,
    evolution: 0.8,
  };
  const first = engine.generateNew(config);
  const repeated = engine.generateNew(config);

  assert.deepEqual(repeated, first, "the complete performance must remain fixed for the same generation seed");
  assert.equal(first.performanceProfile.version, 1);
  assert.match(first.performanceProfile.feel.label, /\S/);
  assert.ok(first.performanceProfile.timingJitter >= 0 && first.performanceProfile.timingJitter <= 0.04);
  assert.equal(first.arrangementTransitions.length, first.structure.length - 1);

  const storyEvents = first.harmony.filter((event) => event.sectionId && event.harmonicRole && event.harmonicColor);
  assert.equal(storyEvents.length, first.harmony.length, "every harmony event should carry its section story role");
  for (const plan of first.songBlueprint.sectionPlans) {
    const section = first.structure.find((candidate) => candidate.id === plan.sectionId);
    const events = first.harmony.filter((event) => event.sectionId === plan.sectionId);
    assert.ok(section && events.length, `${plan.sectionId} should have a harmonic route`);
    assert.equal(events[0].degree % 7, plan.harmonicStartDegree % 7);
  }

  const transitionNotes = first.tracks.flatMap((track) => track.notes)
    .filter((note) => note.transitionFeature);
  assert.ok(transitionNotes.length > 0, "the transition plan should be audible in generated notes");

  const similar = engine.generateSimilar(first, { seed: "phase-three-related", candidateCount: 1 });
  assert.equal(similar.performanceProfile.feel.id, first.performanceProfile.feel.id);
  assert.notEqual(similar.oneShotKit.id, first.oneShotKit.id, "every new generation should choose a different one-shot kit");
});

test("phases 7, 8, and 9 orchestrate sections, recall musical ideas, and pass a producer quality gate", () => {
  const config = {
    ...CONFIG,
    genre: "pop",
    seed: "phase-nine-complete",
    bars: 32,
    candidateCount: 1,
    evolution: 0.82,
  };
  const song = engine.generateNew(config);
  assert.deepEqual(engine.generateNew(config), song, "phase 9 must remain deterministic for a fixed generation");
  assert.equal(song.songBlueprint.version, 5);
  assert.deepEqual(song.generationPhases.map(({ phase }) => phase), [7, 8, 9, 39, 41, 42, 44, 46, 47, 48, 51, 52, 66, 67, 68, 69, 70, 71, 72, 75]);
  assert.ok(song.generationPhases.every(({ status }) => status === "complete" || status === "passed" || status === "best-available"));

  assert.equal(song.orchestrationMatrix.length, song.structure.length);
  for (const entry of song.orchestrationMatrix) {
    assert.ok(song.structure.some((section) => section.id === entry.sectionId));
    assert.ok(song.tracks.some((track) => track.id === entry.featuredTrack));
    assert.deepEqual(Object.keys(entry.lanes), song.tracks.map((track) => track.id));
    assert.ok(Object.values(entry.lanes).every((lane) => lane.presence >= 0 && lane.presence <= 1));
  }
  assert.ok(song.tracks.flatMap((track) => track.notes).some((note) => note.orchestrationRole === "feature"));

  assert.equal(song.memoryMap.length, song.structure.length);
  const recalled = song.memoryMap.filter((entry) => ["recall", "return", "contrast"].includes(entry.relationship));
  assert.ok(recalled.length >= 2);
  assert.ok(song.tracks.find((track) => track.id === "melody").notes.some((note) => note.memoryRole));

  assert.equal(song.producerPass.phase, 9);
  assert.match(song.producerPass.status, /passed|best-available/);
  assert.ok(Object.values(song.producerPass.checks).every((value) => typeof value === "boolean"));
  assert.ok(song.producerPass.metrics.peakVelocity <= 120);
  assert.equal(song.meta.qualityGate.phase, 9);
  assert.equal(song.meta.qualityGate.totalScore, song.meta.scoreDetails.totalScore);
  assert.equal(song.meta.scoreDetails.criticVersion, 6);
});

test("fresh and chained generation advance to distinct arrangements", () => {
  const first = engine.generateNew({ bars: 4, candidateCount: 1 });
  const second = engine.generateNew({ bars: 4, candidateCount: 1 });
  assert.notEqual(first.seed, second.seed);
  assert.notEqual(first.id, second.id);

  const similar = engine.generateSimilar(first, { candidateCount: 1 });
  const nextSimilar = engine.generateSimilar(similar, { candidateCount: 1 });
  assert.equal(similar.revision, 1);
  assert.equal(nextSimilar.revision, 2);
  assert.notEqual(similar.seed, nextSimilar.seed);
  assert.notEqual(similar.id, nextSimilar.id);
  assert.notDeepEqual(
    similar.tracks.find((track) => track.id === "melody").notes,
    nextSimilar.tracks.find((track) => track.id === "melody").notes,
  );
});

test("every generation chooses a different one-shot kit unless one is explicitly requested", () => {
  const first = engine.generateNew({ ...CONFIG, seed: "one-shot-first" });
  const next = engine.generateNew({
    ...CONFIG,
    seed: "one-shot-next",
    excludeOneShotKitIds: [first.oneShotKit.id],
  });
  const similar = engine.generateSimilar(next, { seed: "one-shot-similar" });

  assert.ok(engine.ONE_SHOT_KITS.length >= 6);
  assert.ok(Object.isFrozen(engine.ONE_SHOT_KITS));
  assert.notEqual(next.oneShotKit.id, first.oneShotKit.id);
  assert.notEqual(similar.oneShotKit.id, next.oneShotKit.id);
  for (const key of ["kick", "snare", "clap", "hat", "openHat", "cymbal", "tom"]) {
    assert.match(next.oneShotKit.oneShots[key], /\S/);
  }
  assert.match(next.idea.soundPalette.find((entry) => entry.trackId === "drums").name, new RegExp(next.oneShotKit.name));
});

test("a different new seed changes every instrument pattern", () => {
  const first = engine.generateNew({ ...CONFIG, seed: "one" });
  const second = engine.generateNew({ ...CONFIG, seed: "two" });

  for (const id of first.tracks.map((track) => track.id)) {
    const a = first.tracks.find((track) => track.id === id).notes;
    const b = second.tracks.find((track) => track.id === id).notes;
    assert.notDeepEqual(a, b, `${id} should receive a new pattern`);
  }
});

test("similar generation preserves DNA while producing a real variation", () => {
  const original = engine.generateNew(CONFIG);
  const similar = engine.generateSimilar(original, {
    seed: "recognizable-variation",
    similarity: 0.9,
    variation: 0.7,
  });

  assert.equal(similar.generation, "similar");
  assert.equal(similar.parentId, original.id);
  assert.equal(similar.revision, original.revision + 1);
  assert.deepEqual(
    similar.structure.map(({ name, startBar, bars }) => ({ name, startBar, bars })),
    original.structure.map(({ name, startBar, bars }) => ({ name, startBar, bars })),
  );
  const originalDegrees = original.harmony.map((event) => event.degree);
  const similarDegrees = similar.harmony.map((event) => event.degree);
  const matchingHarmony = similarDegrees.filter((degree, index) => degree === originalDegrees[index]).length;
  assert.ok(matchingHarmony / originalDegrees.length >= 0.7);

  const originalContour = original.motifs.melody.events.map((event) => event.degree);
  const similarContour = similar.motifs.melody.events.map((event) => event.degree);
  const sharedNotes = similarContour.filter((degree, index) => degree === originalContour[index]).length;
  assert.ok(sharedNotes / originalContour.length >= 0.5, "melody contour should remain recognizable");
  assert.notDeepEqual(
    similar.tracks.find((track) => track.id === "melody").notes,
    original.tracks.find((track) => track.id === "melody").notes,
  );
});

test("section variation lab preserves every event outside the selected section and honors locks", () => {
  const song = engine.generateNew({ ...CONFIG, seed: "section-lab-proof", bars: 12, candidateCount: 1 });
  const section = song.structure[Math.min(1, song.structure.length - 1)];
  const options = engine.generateSectionVariations(song, section.id, {
    count: 3,
    seed: "section-lab-options",
    candidateCount: 1,
    lockedTrackIds: ["bass"],
  });
  assert.equal(options.length, 3);
  assert.equal(new Set(options.map((candidate) => candidate.seed)).size, 3);
  for (const candidate of options) {
    assert.equal(candidate.title, song.title);
    assert.equal(candidate.sectionVariation.preservedOutsideSection, true);
    assert.deepEqual(
      candidate.tracks.find((track) => track.id === "bass"),
      song.tracks.find((track) => track.id === "bass"),
    );
    for (const track of song.tracks.filter((entry) => entry.id !== "bass")) {
      const replacement = candidate.tracks.find((entry) => entry.id === track.id);
      assert.deepEqual(
        replacement.notes.filter((note) => note.start < section.startBeat || note.start >= section.endBeat),
        track.notes.filter((note) => note.start < section.startBeat || note.start >= section.endBeat),
      );
    }
    assertAllGeneratedPitchesInScale(candidate);
  }
});

test("expressive articulation is deterministic and shared with sound-ready MIDI", () => {
  const song = engine.generateNew({ ...CONFIG, seed: "articulation-proof", bars: 16, candidateCount: 1 });
  assert.ok(song.tracks.every((track) => track.notes.every((note) => typeof note.articulation === "string")));
  assert.ok(song.tracks.find((track) => track.id === "chords").automation.some((event) => event.type === "cc" && event.controller === 64));
  assert.ok(song.tracks.find((track) => track.id === "melody").automation.some((event) => event.type === "cc" && event.controller === 1));
  const midi = Array.from(engine.encodeMidi(song));
  assert.ok(midi.some((value, index) => (value & 0xf0) === 0xb0 && midi[index + 1] === 64), "MIDI should carry sustain");
  assert.ok(midi.some((value, index) => (value & 0xf0) === 0xb0 && midi[index + 1] === 1), "MIDI should carry modulation");
});

test("phase 36 phrase-resolution composer creates scale-safe chord and tonic landings", () => {
  const song = engine.generateNew({
    ...CONFIG,
    seed: "phrase-resolution-composer-proof",
    bars: 20,
    candidateCount: 1,
  });
  const leadNotes = song.tracks
    .filter((track) => ["melody", "counterpoint"].includes(track.id))
    .flatMap((track) => track.notes);
  const landings = leadNotes.filter((note) => note.resolutionRole);
  assert.ok(landings.length >= 3);
  assert.ok(landings.every((note) => Number.isFinite(note.phraseBoundary)));
  assert.ok(landings.every((note) => note.start + note.duration <= note.phraseBoundary + 0.001));
  const tonicLandings = landings.filter((note) => note.resolutionRole === "tonic-landing");
  assert.ok(tonicLandings.length >= 1);
  assert.ok(tonicLandings.every((note) => ((note.pitch % 12) + 12) % 12 === song.meta.keyPc));
  assertAllGeneratedPitchesInScale(song);
});

test("phase 37 develops adjacent duplicate drum bars without breaking the groove anchors", () => {
  const song = engine.generateNew({
    ...CONFIG,
    genre: "house",
    seed: "drum-development-proof",
    bars: 20,
    variation: 0.72,
    candidateCount: 1,
  });
  const barBeats = song.meta.beatsPerBar;
  const drums = song.tracks.find((track) => track.id === "drums").notes;
  const signatures = Array.from({ length: song.bars }, (_, bar) => drums
    .filter((note) => Math.floor(note.start / barBeats) === bar)
    .map((note) => `${note.pitch}:${Math.round((note.start - bar * barBeats) * 1000)}`)
    .sort()
    .join("|"));
  for (let bar = 1; bar < signatures.length; bar += 1) {
    if (signatures[bar] && signatures[bar - 1]) assert.notEqual(signatures[bar], signatures[bar - 1]);
  }
  for (let bar = 0; bar < song.bars; bar += 1) {
    assert.ok(drums.some((note) => note.pitch === 36 && Math.abs(note.start - bar * barBeats) < 0.01));
  }
});

test("phase 39 connects intent, harmony, motifs, groove, ensemble, performance, and critic", () => {
  const song = engine.generateNew({
    ...CONFIG,
    genre: "neoSoul",
    seed: "generation-interlock-proof",
    bars: 24,
    candidateCount: 1,
  });
  const interlock = song.generationInterlock;
  assert.equal(interlock.version, 1);
  assert.equal(interlock.phase, 39);
  assert.deepEqual(
    interlock.stages.map((stage) => stage.id),
    ["intent", "harmony", "motif", "groove", "ensemble", "arrangement", "performance", "critic"],
  );
  assert.ok(interlock.stages.slice(1).every((stage) => stage.receives.length && stage.publishes.length));
  assert.equal(interlock.sectionContracts.length, song.structure.length);

  for (const contract of interlock.sectionContracts) {
    assert.ok(contract.harmonicGoalPitchClasses.length > 0);
    assert.ok(contract.bars.length > 0);
    assert.match(contract.motifId, /\S/);
    const participants = new Set(song.tracks
      .filter((track) => track.notes.some((note) => note.connectionId === contract.id))
      .map((track) => track.id));
    assert.ok(participants.size >= 3, `${contract.sectionId} should connect at least three instrument roles`);
  }

  const notes = song.tracks.flatMap((track) => track.notes);
  assert.ok(notes.length > 0);
  assert.ok(notes.filter((note) => note.connectionId).length / notes.length >= 0.98);
  assert.ok(notes.some((note) => note.ensembleAccent));
  const connectedEvaluation = engine.evaluateSongCandidate(song);
  assert.ok(connectedEvaluation.subscores.stageInterlock >= 70);

  const disconnected = structuredClone(song);
  for (const track of disconnected.tracks) {
    for (const note of track.notes) {
      delete note.connectionId;
      delete note.connectionRole;
      delete note.ensembleAccent;
    }
  }
  const disconnectedEvaluation = engine.evaluateSongCandidate(disconnected);
  assert.ok(disconnectedEvaluation.subscores.stageInterlock < connectedEvaluation.subscores.stageInterlock);
  assertAllGeneratedPitchesInScale(song);
});

test("per-track controls survive normalization and affect MIDI audibility", () => {
  const song = engine.generateNew({
    ...CONFIG,
    seed: "track-controls",
    tracks: {
      bass: { octave: 1, density: 35, variation: 80, mute: true, program: 38 },
      melody: { solo: true, pan: 0.5, reverb: 0.7 },
    },
  });
  const bass = song.tracks.find((track) => track.id === "bass");
  const melody = song.tracks.find((track) => track.id === "melody");
  assert.equal(bass.settings.octave, 1);
  assert.equal(bass.settings.density, 0.35);
  assert.equal(bass.settings.variation, 0.8);
  assert.equal(bass.settings.mute, true);
  assert.equal(bass.program, 38);
  assert.equal(melody.settings.solo, true);
});

test("MIDI encoder writes a valid type-1 file with conductor and six tracks", () => {
  const song = engine.generateNew({ ...CONFIG, seed: "midi-file" });
  const midi = engine.encodeMidi(song);
  const view = new DataView(midi.buffer, midi.byteOffset, midi.byteLength);
  const text = (offset, length) => String.fromCharCode(...midi.slice(offset, offset + length));

  assert.equal(text(0, 4), "MThd");
  assert.equal(view.getUint32(4), 6);
  assert.equal(view.getUint16(8), 1);
  assert.equal(view.getUint16(10), 7);
  assert.equal(view.getUint16(12), 480);
  assert.equal(text(14, 4), "MTrk");

  const bytes = Array.from(midi);
  assert.ok(bytes.includes(0x51), "tempo meta event should be present");
  assert.ok(bytes.includes(0x58), "time-signature meta event should be present");
  assert.ok(bytes.includes(0xc0), "program changes should be present");
  assert.ok(bytes.includes(0xc9), "GM2 drum-kit selection should use a channel-10 program change");
  assert.ok(bytes.includes(0x99), "drum notes should use zero-based channel 9 / MIDI channel 10");
});

test("sound-ready MIDI matches the audible mix and carries complete instrument setup", () => {
  const song = engine.generateNew({ ...CONFIG, seed: "sound-ready-export", bars: 8 });
  for (const track of song.tracks) {
    track.settings.mute = track.id === "drums";
    track.settings.solo = track.id === "melody";
  }
  const midi = engine.encodeMidi(song);
  const chunks = midiTrackChunks(midi);
  assert.equal(chunks.length, 7, "muting must keep every named track shell");
  const trackEvents = chunks.slice(1).map(midiChannelEvents);
  const noteOns = trackEvents.map((events) => events.filter((event) => (event.status & 0xf0) === 0x90 && event.data[1] > 0));
  assert.equal(noteOns[0].length, 0, "muted drums must not reappear in export");
  assert.ok(noteOns[3].length > 0, "the soloed melody must remain audible");
  assert.ok(noteOns.every((events, index) => index === 3 || events.length === 0), "non-soloed tracks must export silently");

  const melodyEvents = trackEvents[3];
  const channel = song.tracks[3].channel;
  const has = (status, first, second = null) => melodyEvents.some((event) => (
    event.status === status && event.data[0] === first && (second == null || event.data[1] === second)
  ));
  assert.ok(has(0xb0 | channel, 0, 121), "GM2 melodic bank MSB must precede the program");
  assert.ok(has(0xb0 | channel, 32, 0), "bank LSB must be explicit");
  assert.ok(has(0xc0 | channel, song.tracks[3].program), "the selected instrument program must be embedded");
  for (const controller of [7, 10, 11, 71, 74, 91]) {
    assert.ok(has(0xb0 | channel, controller), `controller ${controller} must be exported`);
  }
  const text = new TextDecoder().decode(midi);
  assert.match(text, /General MIDI 2 sound-ready export/);
  assert.match(text, /program \d+ .*velocity \d+% .*gate \d+%/);
  assert.ok(Array.from(midi).some((value, index, bytes) => (
    value === 0xf0 && bytes.slice(index + 2, index + 7).join(",") === "126,127,9,3,247"
  )), "the conductor must initialize a GM2-compatible sound module");

  const allTracks = engine.encodeMidi(song, { includeMuted: true });
  const allNoteOns = midiTrackChunks(allTracks).slice(1).map(midiChannelEvents)
    .map((events) => events.filter((event) => (event.status & 0xf0) === 0x90 && event.data[1] > 0));
  assert.ok(allNoteOns.every((events) => events.length > 0), "includeMuted remains an explicit archival override");
});

test("exported note velocity and gate use the same performance scaling as preview", () => {
  const settings = {
    volume: 0.73,
    velocity: 1.35,
    pan: -0.4,
    reverb: 0.62,
    cutoff: 4600,
    resonance: 0.57,
    gate: 1.3,
    mute: false,
    solo: false,
  };
  const song = {
    meta: {
      totalBeats: 4,
      ppq: 480,
      tempo: 120,
      key: "C",
      keyPc: 0,
      scale: "major",
      timeSignature: [4, 4],
    },
    structure: [],
    tracks: [{
      id: "melody",
      name: "Melody",
      channel: 2,
      program: 81,
      settings,
      automation: [{ type: "cc", controller: 11, beat: 0, value: 127 }],
      notes: [{ pitch: 64, start: 0, duration: 1, velocity: 82 }],
    }],
  };
  const events = midiChannelEvents(midiTrackChunks(engine.encodeMidi(song))[1]);
  const noteOn = events.find((event) => event.status === 0x92 && event.data[0] === 64);
  const noteOff = events.find((event) => event.status === 0x82 && event.data[0] === 64);
  const defaults = engine.TRACK_DEFINITIONS.melody;
  assert.equal(noteOn.data[1], Math.round(82 * Math.sqrt(settings.velocity / defaults.velocity)));
  assert.equal(noteOff.tick, Math.round(480 * Math.sqrt(settings.gate / defaults.gate)));

  for (const gate of [0.08, 1.5]) {
    const extreme = structuredClone(song);
    extreme.tracks[0].settings.gate = gate;
    const extremeEvents = midiChannelEvents(midiTrackChunks(engine.encodeMidi(extreme))[1]);
    const extremeOff = extremeEvents.find((event) => event.status === 0x82 && event.data[0] === 64);
    const expectedScale = Math.min(1.4, Math.max(0.65, Math.sqrt(gate / defaults.gate)));
    assert.equal(
      extremeOff.tick,
      Math.round(480 * expectedScale),
      `extreme gate ${gate} must match preview's safe performance scale`,
    );
  }
});

test("MIDI key signatures preserve modal accidentals and enharmonic sharp roots", () => {
  const signature = (key, scale) => {
    const midi = engine.encodeMidi(engine.generateNew({ seed: `signature-${key}-${scale}`, key, scale, bars: 4 }));
    const bytes = Array.from(midi);
    const index = bytes.findIndex((value, offset) => value === 0xff && bytes[offset + 1] === 0x59 && bytes[offset + 2] === 0x02);
    assert.ok(index >= 0, `${key} ${scale} should include FF 59`);
    return bytes.slice(index + 3, index + 5);
  };

  assert.deepEqual(signature("C", "dorian"), [0xfe, 1], "C Dorian uses Bb-major accidentals / two flats");
  assert.deepEqual(signature("D", "dorian"), [0x00, 1], "D Dorian uses C-major accidentals");
  assert.deepEqual(signature("G#", "major"), [0xfc, 0], "G# major should use the playable Ab enharmonic signature");
  assert.deepEqual(signature("F", "lydian"), [0x00, 0], "F Lydian uses C-major accidentals");
});

test("genre profiles expose frozen professional tempo, groove, harmony, and palette rules", () => {
  assert.deepEqual(Object.keys(engine.GENRE_PROFILES), Object.keys(GENRE_TEMPOS));
  assert.ok(Object.isFrozen(engine.GENRE_PROFILES));

  for (const [genre, [min, max, defaultTempo]] of Object.entries(GENRE_TEMPOS)) {
    const profile = engine.GENRE_PROFILES[genre];
    assert.equal(profile.id, genre);
    assert.ok(profile.label.length > 2);
    assert.deepEqual(profile.bpm, { min, max, default: defaultTempo });
    assert.ok(profile.preferredScales.length >= 4);
    assert.ok(profile.tripletChance >= 0 && profile.tripletChance <= 1);
    assert.ok(profile.snareRollChance >= 0 && profile.snareRollChance <= 1);
    assert.ok(profile.arrangement.phraseBars >= 4);
    for (const id of ["drums", "bass", "chords", "melody", "counterpoint", "pad"]) {
      const minimumChoices = id === "drums" ? 2 : 3;
      assert.ok(profile.instrumentPrograms[id].length >= minimumChoices, `${genre}.${id} should have a program palette`);
      assert.ok(Object.isFrozen(profile.instrumentPrograms[id]));
    }
  }
});

test("Critic 6.0 and harmony grammar use explicit targets for every genre", () => {
  assert.deepEqual(Object.keys(engine.GENRE_CRITIC_PROFILES), Object.keys(GENRE_TEMPOS));
  assert.deepEqual(Object.keys(engine.GENRE_PROGRESSION_GRAMMARS), Object.keys(GENRE_TEMPOS));
  assert.ok(Object.isFrozen(engine.GENRE_CRITIC_PROFILES));
  assert.ok(Object.isFrozen(engine.GENRE_PROGRESSION_GRAMMARS));

  for (const genre of Object.keys(GENRE_TEMPOS)) {
    const critic = engine.GENRE_CRITIC_PROFILES[genre];
    const grammar = engine.GENRE_PROGRESSION_GRAMMARS[genre];
    assert.ok(critic.density > 0);
    assert.ok(critic.repetition > 0 && critic.repetition < 1);
    assert.ok(critic.syncopation >= 0 && critic.syncopation <= 1);
    assert.ok(grammar.verse.length >= 2);
    assert.ok(grammar.chorus.length >= 2);
    assert.ok(grammar.bridge.length >= 1);
    assert.ok(grammar.cadence.length >= 1);

    const song = engine.generateNew({
      genre,
      seed: `critic-six-${genre}`,
      bars: 8,
      candidateCount: 1,
      targetedRepair: false,
    });
    const evaluation = engine.evaluateSongCandidate(song);
    assert.equal(evaluation.version, 6);
    assert.equal(evaluation.diagnostics.genreProfile, genre);
    assert.equal(evaluation.diagnostics.densityTarget, critic.density);
    assert.equal(evaluation.diagnostics.syncopationTarget, critic.syncopation);
    assert.equal(evaluation.diagnostics.backbeatsPerBarTarget, critic.backbeats);
    assert.ok(evaluation.subscores.genreAuthenticity >= 20);
    assert.ok(song.harmony.every((event) => event.genreGrammar === genre));
  }
});

test("genre harmony grammars produce distinct scale-safe harmonic identities", () => {
  const signature = (genre, seed) => engine.generateNew({
    genre,
    seed,
    key: "C",
    scale: "major",
    bars: 16,
    candidateCount: 1,
    targetedRepair: false,
  }).harmony.map((event) => event.degree).join(",");

  const genres = ["country", "rock", "jazz", "techno", "ambient"];
  const signatures = new Map(genres.map((genre) => [
    genre,
    new Set(["a", "b", "c"].map((suffix) => signature(genre, `genre-harmony-${suffix}`))),
  ]));
  assert.ok([...signatures.values()].every((values) => values.size >= 2), "each genre should retain harmonic variation");
  assert.ok(new Set([...signatures.values()].map((values) => [...values].sort().join("|"))).size >= 4,
    "genre vocabularies should not collapse into one harmonic identity");
});

test("genre melody grammars shape source motifs before performance rendering", () => {
  assert.deepEqual(Object.keys(engine.GENRE_MELODY_GRAMMARS), Object.keys(GENRE_TEMPOS));
  assert.ok(Object.isFrozen(engine.GENRE_MELODY_GRAMMARS));

  const songs = Object.fromEntries(["country", "rock", "ambient", "funk", "jazz"].map((genre) => [
    genre,
    engine.generateNew({
      genre,
      seed: `melody-grammar-${genre}`,
      bars: 12,
      candidateCount: 1,
      targetedRepair: false,
    }),
  ]));
  for (const [genre, song] of Object.entries(songs)) {
    const grammar = engine.GENRE_MELODY_GRAMMARS[genre];
    assert.equal(song.motifs.melody.genreGrammar, genre);
    assert.ok(grammar.phraseShapes.includes(song.motifs.melody.phraseShape));
    assert.ok(grammar.contours.includes(song.motifs.melody.contourShape));
    assert.ok(song.tracks.find((track) => track.id === "melody").notes
      .some((note) => note.genrePhraseGrammar === genre));
    assertAllGeneratedPitchesInScale(song);
  }

  const averageDuration = (song) => {
    const events = song.motifs.melody.events;
    return events.reduce((sum, event) => sum + event.duration, 0) / events.length;
  };
  assert.ok(averageDuration(songs.ambient) > averageDuration(songs.funk),
    "Ambient source phrases should breathe longer than Funk cells");
  assert.ok(new Set(Object.values(songs).map((song) => (
    `${song.motifs.melody.phraseShape}:${song.motifs.melody.contourShape}`
  ))).size >= 4, "genre families should expose distinct phrase identities");
});

test("every genre uses its default tempo and deterministic program palette when values are omitted", () => {
  const archetypes = { trap: "halfTime", house: "fourFloor", techno: "fourFloor", drumBass: "breakbeat" };
  for (const [genre, [, , defaultTempo]] of Object.entries(GENRE_TEMPOS)) {
    const first = engine.generateNew({ genre, seed: `genre-${genre}`, bars: 8 });
    const second = engine.generateNew({ genre, seed: `genre-${genre}`, bars: 8 });
    const profile = engine.GENRE_PROFILES[genre];
    assert.deepEqual(first, second);
    assert.equal(first.genre, genre);
    assert.equal(first.meta.genre, genre);
    assert.equal(first.meta.genreLabel, profile.label);
    assert.equal(first.meta.tempo, defaultTempo);
    assert.ok(profile.preferredScales.includes(first.meta.scale));
    if (archetypes[genre]) assert.equal(first.style.drumGroove, archetypes[genre]);
    for (const track of first.tracks) {
      assert.ok(profile.instrumentPrograms[track.id].includes(track.program), `${genre}.${track.id} program ${track.program} should come from its palette`);
    }
    assertValidNotes(first);
  }

  const outsidePocket = engine.generateNew({ genre: "neoSoul", tempo: 132, seed: "explicit-tempo", bars: 4 });
  assert.equal(outsidePocket.meta.tempo, 132, "explicit tempos remain valid creative choices");
  assert.equal(outsidePocket.idea.tempoFit, "Above typical");
  const customProgram = engine.generateNew({ genre: "house", seed: "custom-patch", bars: 4, tracks: { melody: { program: 70 } } });
  assert.equal(customProgram.tracks.find((track) => track.id === "melody").program, 70);
});

test("high-energy trap emits exact beat triplets and phrase-boundary snare rolls", () => {
  const config = { genre: "trap", seed: "triplet-roll-proof", bars: 20, energy: 0.96, complexity: 0.94, drumFills: 1, tripletAmount: 1, rollAmount: 1, humanize: 0 };
  const song = engine.generateNew(config);
  const repeated = engine.generateNew(config);
  assert.deepEqual(song, repeated);

  const tagged = song.tracks.flatMap((track) => track.notes.map((note) => ({ ...note, trackId: track.id }))).filter((note) => note.rhythmicFeature);
  const triplets = tagged.filter((note) => note.rhythmicFeature.startsWith("triplet-"));
  const rolls = tagged.filter((note) => note.rhythmicFeature === "snare-roll");
  assert.ok(triplets.length >= 6, "trap should produce a meaningful triplet figure");
  assert.ok(rolls.length >= 2, "trap should produce a selected boundary roll");
  assert.ok(triplets.some((note) => note.trackId === "drums"));
  assert.ok(triplets.some((note) => note.trackId === "melody"));

  for (const note of triplets) {
    const divisor = note.rhythmicFeature === "triplet-sixteenth" ? 6 : 3;
    assert.ok(Math.abs(note.start * divisor - Math.round(note.start * divisor)) < 0.00001, `${note.start} should lie on a 1/${divisor}-beat grid`);
  }
  for (const note of rolls) {
    assert.ok([0.25, 0.166667, 0.125].some((step) => Math.abs(note.subdivision - step) < 0.00001));
    const section = song.structure.find((candidate) => note.start >= candidate.startBeat && note.start < candidate.endBeat);
    assert.ok(section);
    assert.ok(note.start >= section.endBeat - 1.001, "rolls stay in the final beat of a section");
    assert.ok(section.endBeat < song.meta.totalBeats, "the final outro does not receive a transition roll");
  }
  const rollSections = new Set(rolls.map((note) => song.structure.find((section) => note.start >= section.startBeat && note.start < section.endBeat)?.id));
  assert.ok(rollSections.size <= Math.max(1, Math.floor((song.structure.length - 1) / 3)), "rolls are selected fills, not an every-section effect");
  assert.ok(new Set(rolls.map((note) => note.velocity)).size > 1, "rolls have ramped/alternating dynamics");
  assert.equal(song.idea.tripletEvents, triplets.length);
  assert.equal(song.idea.snareRollEvents, rolls.length);
  assertValidNotes(song);
});

test("drum & bass also receives deterministic contextual rhythmic detail", () => {
  const config = { genre: "drumBass", seed: "dnb-boundary-detail", bars: 20, energy: 0.94, complexity: 0.9, drumFills: 1, humanize: 0 };
  const song = engine.generateNew(config);
  const triplets = song.tracks.flatMap((track) => track.notes).filter((note) => String(note.rhythmicFeature ?? "").startsWith("triplet-"));
  const rolls = song.tracks.find((track) => track.id === "drums").notes.filter((note) => note.rhythmicFeature === "snare-roll");
  assert.ok(triplets.length > 0);
  assert.ok(rolls.length > 0);
  assert.equal(song.style.drumGroove, "breakbeat");
  assert.equal(song.idea.grooveLabel, "Syncopated breakbeat");
  assertValidNotes(song);
});

test("idea analysis is UI-ready and Similar preserves genre DNA while refreshing its drum palette", () => {
  const original = engine.generateNew({ genre: "neoSoul", seed: "velvet-dna", bars: 16, energy: 0.72, complexity: 0.78 });
  const idea = original.idea;
  assert.deepEqual(Object.keys(idea), [
    "genreId", "genreLabel", "tempoRange", "tempoFit", "grooveLabel", "rhythmIdentity", "halfTime", "tripletEvents", "snareRollEvents",
    "rhythmicFeatures", "chordProgression", "harmonicStory", "transitionTypes", "performanceFeel", "sectionArc", "soundPalette",
  ]);
  assert.equal(idea.genreId, "neoSoul");
  assert.equal(idea.genreLabel, "Neo Soul / R&B");
  assert.equal(idea.tempoFit, "Genre pocket");
  assert.match(idea.rhythmIdentity.label, /\S/);
  assert.match(idea.rhythmIdentity.signature, /^[A-Z0-9]{1,5}$/);
  assert.ok(idea.chordProgression.length > 0);
  assert.equal(idea.sectionArc.length, original.structure.length);
  assert.equal(idea.soundPalette.length, original.tracks.length);
  assert.match(idea.soundPalette[0].name, new RegExp(`^${original.oneShotKit.name} · `));
  assert.notEqual(idea.soundPalette.find((sound) => sound.trackId === "bass").name, "Bass");

  const similar = engine.generateSimilar(original, { seed: "velvet-dna-variation", similarity: 0.92, variation: 0.7 });
  assert.equal(similar.genre, original.genre);
  assert.equal(similar.meta.genre, original.meta.genre);
  assert.equal(similar.idea.genreId, original.idea.genreId);
  assert.equal(similar.meta.tempo, original.meta.tempo);
  assert.deepEqual(similar.tracks.map((track) => track.program), original.tracks.map((track) => track.program));
  assert.notEqual(similar.oneShotKit.id, original.oneShotKit.id);
  assert.deepEqual(similar.structure.map((section) => section.name), original.structure.map((section) => section.name));
  assertValidNotes(similar);

  const midi = engine.encodeMidi(similar);
  assert.equal(String.fromCharCode(...midi.slice(0, 4)), "MThd");
  assert.equal(new DataView(midi.buffer, midi.byteOffset, midi.byteLength).getUint16(8), 1);
});

test("rhythm identities and contextual titles make fresh ideas meaningfully distinct", () => {
  const songs = Array.from({ length: 24 }, (_, index) => engine.generateNew({
    genre: index % 2 ? "neoSoul" : "drumBass",
    seed: `identity-title-${index}`,
    bars: 4,
    candidateCount: 1,
    energy: 0.82,
    complexity: 0.78,
    variation: 0.74,
    syncopation: 0.72,
  }));
  assert.equal(new Set(songs.map((song) => song.style.rhythmIdentity.signature)).size, songs.length);
  assert.ok(new Set(songs.map((song) => song.title)).size >= 22, "seeded contextual names should rarely repeat");
  assert.ok(songs.every((song) => /^[A-Za-z][A-Za-z -]*(?: at | the | \/ )?[A-Za-z -]+$/.test(song.title)));
  assert.ok(songs.every((song) => song.idea.rhythmicFeatures.includes(song.style.rhythmIdentity.label)));
  const rhythmicTags = new Set(songs.flatMap((song) => song.tracks.find((track) => track.id === "drums").notes)
    .map((note) => note.rhythmicFeature)
    .filter(Boolean));
  assert.ok(rhythmicTags.has("ghost-note"), "enhanced pockets should include dynamic ghost notes");
  assert.ok([...rhythmicTags].some((tag) => String(tag).endsWith("-accent")), "enhanced pockets should include a seeded auxiliary lane");
});

test("idea engine rotates phrase shapes, motif lengths, timing pockets, and onset patterns", () => {
  const genres = Object.keys(GENRE_TEMPOS);
  const songs = Array.from({ length: 48 }, (_, index) => engine.generateNew({
    genre: genres[index % genres.length],
    seed: `foundation-variety-${index}`,
    bars: 12,
    candidateCount: 1,
    complexity: 0.82,
    variation: 0.8,
    syncopation: 0.72,
    humanize: 0.25,
  }));
  const identities = songs.map((song) => song.style.rhythmIdentity);
  assert.deepEqual(
    new Set(identities.map((identity) => identity.phraseShape)),
    new Set(["questionAnswer", "syncopatedLoop", "longShort", "staircase", "sparseEcho"]),
  );
  assert.deepEqual(
    new Set(identities.map((identity) => identity.timingPocket)),
    new Set(["centered", "laidBack", "pushed", "elastic", "live"]),
  );
  assert.deepEqual(
    new Set(identities.map((identity) => identity.contourShape)),
    new Set(["arch", "valley", "wave", "climbFall", "fallRebound", "pedalLaunch"]),
  );
  assert.deepEqual(new Set(identities.map((identity) => identity.phraseCycle)), new Set([2, 3, 4]));
  assert.deepEqual(new Set(identities.map((identity) => identity.motifBars)), new Set([1, 2, 3]));

  const onsetPatterns = new Set(songs.map((song) => song.motifs.melody.events
    .map((event) => `${event.offset}:${event.duration}`)
    .join("|")));
  assert.ok(onsetPatterns.size >= 40, "fresh ideas should expose audibly different phrase grids");
  const timingProfiles = new Set(songs.map((song) => JSON.stringify(song.performanceProfile.trackOffsets)));
  assert.ok(timingProfiles.size >= 8, "timing identities should produce several controlled instrument pockets");

  for (const song of songs) {
    const identity = song.style.rhythmIdentity;
    const grammar = engine.GENRE_MELODY_GRAMMARS[song.genre];
    assert.ok(grammar.phraseShapes.includes(song.motifs.melody.phraseShape));
    assert.ok(grammar.contours.includes(song.motifs.melody.contourShape));
    assert.equal(song.motifs.melody.genreGrammar, song.genre);
    assert.equal(song.motifs.melody.lengthBeats, identity.motifBars * song.meta.beatsPerBar);
    assert.equal(song.performanceProfile.timingPocket, identity.timingPocket);
    assert.ok(song.idea.rhythmicFeatures.some((feature) => feature.includes(`${identity.motifBars}-bar motif`)));
    assertValidNotes(song);
    assertAllGeneratedPitchesInScale(song);
  }
});

test("tripletAmount and rollAmount normalize, persist, and zero disables every tagged force path", () => {
  const profileDefaults = engine.normalizeConfig({ genre: "trap", seed: "control-defaults" });
  assert.equal(profileDefaults.tripletAmount, engine.GENRE_PROFILES.trap.tripletChance);
  assert.equal(profileDefaults.rollAmount, engine.GENRE_PROFILES.trap.snareRollChance);
  const percentControls = engine.normalizeConfig({ genre: "pop", tripletAmount: 75, rollAmount: 100 });
  assert.equal(percentControls.tripletAmount, 0.75);
  assert.equal(percentControls.rollAmount, 1);

  const zeroConfig = {
    genre: "trap",
    seed: "no-optional-rhythm",
    bars: 20,
    energy: 1,
    complexity: 1,
    drumFills: 1,
    tripletAmount: 0,
    rollAmount: 0,
  };
  const song = engine.generateNew(zeroConfig);
  const tagged = song.tracks.flatMap((track) => track.notes).filter((note) => note.rhythmicFeature);
  assert.equal(tagged.filter((note) => String(note.rhythmicFeature).startsWith("triplet-")).length, 0);
  assert.equal(tagged.filter((note) => note.rhythmicFeature === "snare-roll").length, 0);
  assert.equal(song.idea.tripletEvents, 0);
  assert.equal(song.idea.snareRollEvents, 0);
  assert.equal(song.settings.tripletAmount, 0);
  assert.equal(song.settings.rollAmount, 0);

  const similar = engine.generateSimilar(song, { seed: "no-optional-rhythm-similar" });
  assert.equal(similar.settings.tripletAmount, 0);
  assert.equal(similar.settings.rollAmount, 0);
  assert.equal(similar.idea.tripletEvents, 0);
  assert.equal(similar.idea.snareRollEvents, 0);
  assertValidNotes(similar);
});

test("bass phrases respond to the kick notes that actually survived drum generation", () => {
  const interactionRules = {
    house: [0.5],
    techno: [0, 0.5],
    trap: [0, 0.25],
    hipHop: [0, 0.25],
    drumBass: [0, 0.5],
    neoSoul: [0, 0.25, 0.5, 0.75],
  };
  for (const [genre, expectedDeltas] of Object.entries(interactionRules)) {
    const config = {
      genre,
      seed: `interaction-${genre}`,
      bars: 16,
      humanize: 0,
      swing: 0,
      energy: 0.9,
      complexity: 0.85,
      tripletAmount: 0,
      rollAmount: 0,
      tracks: { bass: { density: 1, variation: 0.7 }, drums: { density: 1, variation: 0.7 } },
    };
    const first = engine.generateNew(config);
    const second = engine.generateNew(config);
    assert.deepEqual(first, second);
    const kicks = first.tracks.find((track) => track.id === "drums").notes.filter((note) => note.pitch === 36).map((note) => note.start);
    const bass = first.tracks.find((track) => track.id === "bass").notes;
    assert.ok(kicks.length > 0 && bass.length > 0);
    for (const note of bass) {
      assert.ok(
        kicks.some((kick) => expectedDeltas.some((delta) => Math.abs(note.start - kick - delta) < 0.00001)),
        `${genre} bass at ${note.start} should lock to or answer an actual kick`,
      );
    }
    if (genre === "house") assert.ok(bass.every((note) => !kicks.some((kick) => Math.abs(note.start - kick) < 0.00001)), "house bass should leave the kick transient clear");
    if (genre === "trap") assert.ok(bass.filter((note) => kicks.some((kick) => Math.abs(note.start - kick) < 0.00001)).length / bass.length >= 0.7, "most trap 808 attacks should lock to kicks");
    if (genre === "neoSoul") assert.ok(bass.some((note) => kicks.some((kick) => [0.25, 0.5, 0.75].some((delay) => Math.abs(note.start - kick - delay) < 0.00001))), "neo soul should answer the kick more loosely");
    assertValidNotes(first);
  }

  for (const [genre, expectedDeltas] of Object.entries(interactionRules)) {
    const sparse = engine.generateNew({
      genre,
      seed: `sparse-interaction-${genre}`,
      bars: 12,
      energy: 0.78,
      complexity: 0.82,
      harmonicRhythm: 1,
      humanize: 0,
      swing: 0,
      tripletAmount: 0,
      rollAmount: 0,
      tracks: { bass: { density: 1, variation: 0.5 }, drums: { density: 0.08, variation: 0.15 } },
    });
    const kicks = sparse.tracks.find((track) => track.id === "drums").notes.filter((note) => note.pitch === 36).map((note) => note.start);
    const bass = sparse.tracks.find((track) => track.id === "bass").notes;
    assert.ok(kicks.length > 0 && bass.length > 0, `${genre} should retain a sparse kick/bass conversation`);
    for (const note of bass) {
      assert.ok(
        kicks.some((kick) => expectedDeltas.some((delta) => Math.abs(note.start - kick - delta) < 0.00001)),
        `${genre} sparse bass at ${note.start} should use a surviving kick, not a theoretical one`,
      );
    }
    assertValidNotes(sparse);
  }

  const drumless = engine.generateNew({
    genre: "neoSoul",
    seed: "independent-bass-without-drums",
    bars: 8,
    tracks: { drums: { density: 0 }, bass: { density: 1 } },
  });
  assert.equal(drumless.tracks.find((track) => track.id === "drums").notes.length, 0);
  assert.ok(drumless.tracks.find((track) => track.id === "bass").notes.length > 0, "a deliberately drumless song should still have an independent bass line");
  assertValidNotes(drumless);
});

test("lead phrases retain motif identity while developing contour, rhythm, rests, answers, and register", () => {
  const config = {
    genre: "pop",
    seed: "phrase-evolve",
    bars: 32,
    humanize: 0,
    swing: 0,
    tripletAmount: 0,
    rollAmount: 0,
    tracks: { melody: { density: 1, variation: 0.8, humanize: 0 } },
  };
  const song = engine.generateNew(config);
  const repeated = engine.generateNew(config);
  assert.deepEqual(song, repeated);
  const melody = song.tracks.find((track) => track.id === "melody").notes;
  const motifLength = song.motifs.melody.lengthBeats;
  const section = song.structure.find((candidate) => candidate.endBeat - candidate.startBeat >= motifLength * 2);
  assert.ok(section, "the arrangement should contain a section with a repeated motif");
  const phrase = (repeat) => {
    const start = section.startBeat + repeat * motifLength;
    return melody
      .filter((note) => note.start >= start && note.start < start + motifLength)
      .map((note) => ({ localStart: Number((note.start - start).toFixed(6)), pitch: note.pitch, duration: note.duration }));
  };
  const statement = phrase(0);
  const development = phrase(1);
  assert.ok(statement.length > 2 && development.length > 2);
  assert.notDeepEqual(development, statement, "the answer phrase should not be a mechanical copy");
  const statementOnsets = new Set(statement.map((note) => note.localStart));
  const sharedOnsets = development.filter((note) => statementOnsets.has(note.localStart)).length;
  assert.ok(sharedOnsets / Math.min(statement.length, development.length) >= 0.45, "development should retain a recognizable rhythmic skeleton");

  const averageVelocity = (name) => {
    const sections = song.structure.filter((candidate) => candidate.name === name);
    const notes = melody.filter((note) => sections.some((candidate) => note.start >= candidate.startBeat && note.start < candidate.endBeat));
    return notes.reduce((sum, note) => sum + note.velocity, 0) / notes.length;
  };
  assert.ok(averageVelocity("chorus") > averageVelocity("intro"), "section intensity should lift developed phrases");

  const similarInput = { seed: "phrase-evolve-similar", similarity: 0.94, variation: 0.8 };
  const similar = engine.generateSimilar(song, similarInput);
  assert.deepEqual(similar, engine.generateSimilar(song, similarInput));
  const sharedContour = similar.motifs.melody.events.filter((event, index) => event.degree === song.motifs.melody.events[index]?.degree).length;
  assert.ok(sharedContour / song.motifs.melody.events.length >= 0.5, "Similar should keep the motif identity");
  assert.notDeepEqual(similar.tracks.find((track) => track.id === "melody").notes, melody, "Similar should vary phrase development");
  assert.equal(similar.settings.tripletAmount, 0);
  assert.equal(similar.settings.rollAmount, 0);
  assertValidNotes(song);
  assertValidNotes(similar);

  const midi = engine.encodeMidi(similar);
  const view = new DataView(midi.buffer, midi.byteOffset, midi.byteLength);
  assert.equal(String.fromCharCode(...midi.slice(0, 4)), "MThd");
  assert.equal(view.getUint16(8), 1);
  assert.equal(view.getUint16(10), 7);
});

test("counterpoint answers real melody gaps instead of stacking the same attacks", () => {
  const config = {
    genre: "synthwave",
    seed: "interlaced-phrase-proof",
    bars: 24,
    humanize: 0,
    swing: 0,
    tripletAmount: 0,
    rollAmount: 0,
    tracks: {
      melody: { density: 1, variation: 0.72, humanize: 0 },
      counterpoint: { density: 1, variation: 0.72, humanize: 0 },
    },
  };
  const song = engine.generateNew(config);
  assert.deepEqual(song, engine.generateNew(config));
  const melody = song.tracks.find((track) => track.id === "melody").notes;
  const counterpoint = song.tracks.find((track) => track.id === "counterpoint").notes;
  assert.ok(melody.length > 20 && counterpoint.length >= 8);
  const simultaneous = counterpoint.filter((note) => melody.some((lead) => Math.abs(lead.start - note.start) < 0.00001));
  const underLead = counterpoint.filter((note) => melody.some((lead) => note.start > lead.start - 0.04 && note.start < lead.start + lead.duration + 0.08));
  assert.ok(simultaneous.length / counterpoint.length <= 0.1, "counterpoint should rarely duplicate the lead attack grid");
  assert.ok(underLead.length / counterpoint.length <= 0.25, "most counterpoint attacks should occupy actual lead gaps");

  const similarInput = { seed: "interlaced-phrase-similar", similarity: 0.93, variation: 0.72 };
  const similar = engine.generateSimilar(song, similarInput);
  assert.deepEqual(similar, engine.generateSimilar(song, similarInput));
  const similarMelody = similar.tracks.find((track) => track.id === "melody").notes;
  const similarCounter = similar.tracks.find((track) => track.id === "counterpoint").notes;
  const similarOverlap = similarCounter.filter((note) => similarMelody.some((lead) => Math.abs(lead.start - note.start) < 0.00001));
  assert.ok(similarOverlap.length / Math.max(1, similarCounter.length) <= 0.1);
  const sharedContour = similar.motifs.melody.events.filter((event, index) => event.degree === song.motifs.melody.events[index]?.degree).length;
  assert.ok(sharedContour / song.motifs.melody.events.length >= 0.5, "interlacing must not replace Similar's motif identity");
  assertValidNotes(song);
  assertValidNotes(similar);
});

test("drum grammar stays coherent inside phrases and evolves at phrase or section boundaries", () => {
  const config = {
    genre: "trap",
    seed: "phrase-drums-proof",
    bars: 32,
    energy: 0.94,
    complexity: 0.9,
    humanize: 0,
    swing: 0,
    tripletAmount: 1,
    rollAmount: 1,
    tracks: { drums: { density: 0.85, variation: 0.8, humanize: 0 } },
  };
  const song = engine.generateNew(config);
  assert.deepEqual(song, engine.generateNew(config));
  const drums = song.tracks.find((track) => track.id === "drums").notes;
  const barBeats = song.meta.beatsPerBar;
  const stableSignature = (bar) => drums
    .filter((note) => Math.floor((note.start + 1e-6) / barBeats) === bar)
    .filter((note) => !note.rhythmicFeature && ![45, 47, 49, 50].includes(note.pitch))
    .filter((note) => [36, 38, 39].includes(note.pitch))
    .filter((note) => note.start - bar * barBeats < Math.min(3, barBeats - 0.1))
    .map((note) => `${note.pitch}@${(note.start - bar * barBeats).toFixed(3)}`)
    .join(",");
  const averageVelocity = (bar) => {
    const notes = drums.filter((note) => Math.floor((note.start + 1e-6) / barBeats) === bar && note.start - bar * barBeats < Math.min(3, barBeats - 0.1) && !note.rhythmicFeature);
    return notes.reduce((sum, note) => sum + note.velocity, 0) / Math.max(1, notes.length);
  };

  let stablePairs = 0;
  let gentlyDevelopedPairs = 0;
  const phraseBars = song.grooveConductor.phraseBars;
  for (const section of song.structure) {
    for (let local = 0; local + phraseBars < section.bars; local += phraseBars) {
      const firstBar = section.startBar + local;
      const laterBar = firstBar + phraseBars;
      assert.equal(stableSignature(firstBar), stableSignature(laterBar), `${section.id} should retain its ${phraseBars}-bar phrase grammar`);
      const velocityDifference = Math.abs(averageVelocity(firstBar) - averageVelocity(laterBar));
      assert.ok(velocityDifference < 16, "phrase dynamics should move smoothly, not jump bar to bar");
      if (velocityDifference > 0.1) gentlyDevelopedPairs += 1;
      stablePairs += 1;
    }
  }
  assert.ok(stablePairs >= 3);
  assert.ok(gentlyDevelopedPairs > 0, "stable hit patterns should still gain a subtle dynamic arc");
  const detailedSignature = (bar) => drums
    .filter((note) => Math.floor((note.start + 1e-6) / barBeats) === bar)
    .filter((note) => !["snare-roll", "tension-pickup"].includes(note.rhythmicFeature))
    .map((note) => `${note.pitch}@${(note.start - bar * barBeats).toFixed(3)}`)
    .join(",");
  const sectionStarts = song.structure.map((section) => detailedSignature(section.startBar));
  assert.ok(new Set(sectionStarts).size >= Math.ceil(sectionStarts.length / 2), "kick, hat, ghost, and percussion lanes should develop between sections");

  const triplets = drums.filter((note) => String(note.rhythmicFeature ?? "").startsWith("triplet-"));
  const rolls = drums.filter((note) => note.rhythmicFeature === "snare-roll");
  assert.ok(triplets.length > 0 && rolls.length > 0);
  for (const note of triplets) {
    const divisor = note.rhythmicFeature === "triplet-sixteenth" ? 6 : 3;
    assert.ok(Math.abs(note.start * divisor - Math.round(note.start * divisor)) < 0.00001);
  }
  for (const note of rolls) {
    const section = song.structure.find((candidate) => note.start >= candidate.startBeat && note.start < candidate.endBeat);
    assert.ok(section && note.start >= section.endBeat - 1.001 && section.endBeat < song.meta.totalBeats);
  }
  assertValidNotes(song);
});

test("slow expression fades are deterministic, emotional, restored when needed, and exported as CC11", () => {
  const config = {
    genre: "synthwave",
    seed: "emotion-proof",
    bars: 24,
    tracks: {
      melody: { velocity: 1.25, gate: 0.64, reverb: 0.77, feel: 0.31, humanize: 0.22, pan: 0.61, volume: 0.42 },
    },
  };
  const song = engine.generateNew(config);
  assert.deepEqual(song, engine.generateNew(config));
  for (const track of song.tracks) {
    assert.ok(Array.isArray(track.automation));
    assert.deepEqual(track.automation[0], {
      type: "cc",
      controller: 11,
      beat: 0,
      value: track.automation[0].value,
    });
    for (let index = 0; index < track.automation.length; index += 1) {
      const event = track.automation[index];
      assert.ok(["cc", "pitchBend"].includes(event.type));
      if (event.type === "cc") assert.ok([1, 11, 64].includes(event.controller));
      assert.ok(event.beat >= 0 && event.beat <= song.meta.totalBeats);
      assert.ok(Number.isInteger(event.value) && event.value >= 0 && event.value <= (event.type === "pitchBend" ? 16383 : 127));
      if (index) assert.ok(event.beat >= track.automation[index - 1].beat);
    }
  }

  const pad = song.tracks.find((track) => track.id === "pad");
  const outro = song.structure[song.structure.length - 1];
  assert.equal(outro.name, "outro");
  const finalFade = pad.automation.filter((event) => event.type === "cc" && event.controller === 11 && event.beat >= outro.startBeat);
  assert.ok(finalFade.length >= 3);
  assert.ok(finalFade.every((event, index) => index === 0 || event.value <= finalFade[index - 1].value), "the final emotional fade should be a slow monotonic ramp");
  assert.ok(finalFade.at(-1).value >= 42 && finalFade.at(-1).value < finalFade[0].value * 0.6, "the fade should remain audible instead of reaching silence");

  const bridge = song.structure.find((section) => section.name === "bridge");
  const bridgeCurve = pad.automation.filter((event) => (
    event.type === "cc"
    && event.controller === 11
    && event.beat >= bridge.startBeat
    && event.beat <= bridge.endBeat
  ));
  const minimum = Math.min(...bridgeCurve.map((event) => event.value));
  assert.ok(bridgeCurve.length >= 5 && minimum < bridgeCurve[0].value);
  assert.equal(bridgeCurve.at(-1).value, bridgeCurve[0].value, "a non-final emotional dip must restore expression");

  const melody = song.tracks.find((track) => track.id === "melody");
  assert.equal(melody.settings.velocity, 1.25);
  assert.equal(melody.settings.gate, 0.64);
  assert.equal(melody.settings.reverb, 0.77);
  assert.equal(melody.settings.feel, 0.31);
  assert.equal(melody.settings.humanize, 0.22);
  assert.equal(melody.settings.pan, 0.61);
  assert.equal(melody.settings.volume, 0.42);

  const similarInput = { seed: "emotion-proof-similar", similarity: 0.94 };
  const similar = engine.generateSimilar(song, similarInput);
  assert.deepEqual(similar, engine.generateSimilar(song, similarInput));
  assert.deepEqual(similar.tracks.find((track) => track.id === "melody").settings, melody.settings);
  assert.ok(similar.tracks.every((track) => track.automation[0]?.controller === 11 && track.automation[0]?.beat === 0));

  const midi = engine.encodeMidi(song);
  const bytes = Array.from(midi);
  const hasController = (status, controller) => bytes.some((value, index) => value === status && bytes[index + 1] === controller);
  for (const track of song.tracks) {
    const status = 0xb0 | (track.id === "drums" ? 9 : track.channel);
    assert.ok(hasController(status, 7), `${track.id} should export volume CC7`);
    assert.ok(hasController(status, 10), `${track.id} should export pan CC10`);
    assert.ok(hasController(status, 11), `${track.id} should export expression CC11`);
    assert.ok(hasController(status, 91), `${track.id} should export reverb CC91`);
  }
  const view = new DataView(midi.buffer, midi.byteOffset, midi.byteLength);
  assert.equal(view.getUint16(8), 1);
  assert.equal(view.getUint16(10), 7);
  assertValidNotes(song);
  assertValidNotes(similar);
});

test("targeted Similar generation composes against the retained rhythm partner", () => {
  const current = engine.generateNew({
    seed: "retained-partner-base",
    genre: "trap",
    bars: 24,
    humanize: 0,
    swing: 0,
    tracks: {
      drums: { density: 0.86, humanize: 0 },
      bass: { density: 0.8, humanize: 0 },
      melody: { density: 0.84, humanize: 0 },
      counterpoint: { density: 0.75, humanize: 0 },
    },
  });
  const byId = (song, id) => song.tracks.find((track) => track.id === id);
  const seed = "retained-partner-reroll";
  const counterpoint = engine.generateSimilar(current, {
    seed,
    targetTrack: "counterpoint",
    contextTracks: { melody: byId(current, "melody") },
  });
  const melody = engine.generateSimilar(current, {
    seed: `${seed}-melody`,
    targetTrack: "melody",
    contextTracks: { counterpoint: byId(current, "counterpoint") },
  });
  const bass = engine.generateSimilar(current, {
    seed: `${seed}-bass`,
    targetTrack: "bass",
    contextTracks: { drums: byId(current, "drums") },
  });
  const drums = engine.generateSimilar(current, {
    seed: `${seed}-drums`,
    targetTrack: "drums",
    contextTracks: { bass: byId(current, "bass") },
  });

  const soundingOverlap = (notes, retained) => notes.filter((note) => retained.some((other) => (
    note.start > other.start - 0.04 && note.start < other.start + other.duration + 0.08
  ))).length / Math.max(1, notes.length);
  assert.ok(soundingOverlap(byId(counterpoint, "counterpoint").notes, byId(current, "melody").notes) <= 0.25);
  assert.ok(soundingOverlap(byId(melody, "melody").notes, byId(current, "counterpoint").notes) <= 0.25);

  const retainedKicks = byId(current, "drums").notes.filter((note) => note.pitch === 36);
  const rerolledKicks = byId(drums, "drums").notes.filter((note) => note.pitch === 36);
  const trapInteraction = (bassNotes, kicks) => bassNotes.filter((note) => kicks.some((kick) => (
    [0, 0.25].some((gap) => Math.abs((note.start - kick.start) - gap) < 0.12)
  ))).length / Math.max(1, bassNotes.length);
  assert.ok(trapInteraction(byId(bass, "bass").notes, retainedKicks) >= 0.85);
  assert.ok(trapInteraction(byId(current, "bass").notes, rerolledKicks) >= 0.85);
  assert.deepEqual(counterpoint, engine.generateSimilar(current, {
    seed,
    targetTrack: "counterpoint",
    contextTracks: { melody: byId(current, "melody") },
  }));
});

test("variety controls remain deterministic and FL Studio export stays multitrack", () => {
  const normalized = engine.normalizeConfig({ evolution: 0.83, surprise: 0.71 });
  assert.equal(normalized.evolution, 0.83);
  assert.equal(normalized.surprise, 0.71);
  const restrained = engine.generateNew({ ...CONFIG, seed: "variety-control", evolution: 0.08, surprise: 0.02 });
  const adventurous = engine.generateNew({ ...CONFIG, seed: "variety-control", evolution: 0.94, surprise: 0.92 });
  assert.notDeepEqual(adventurous.tracks, restrained.tracks);
  assert.deepEqual(adventurous, engine.generateNew({ ...CONFIG, seed: "variety-control", evolution: 0.94, surprise: 0.92 }));

  const muted = structuredClone(adventurous);
  for (const track of muted.tracks) track.settings.mute = true;
  const midi = engine.encodeMidi(muted, { includeMuted: true });
  const view = new DataView(midi.buffer, midi.byteOffset, midi.byteLength);
  assert.equal(view.getUint16(8), 1);
  assert.equal(view.getUint16(10), 7);
  const text = new TextDecoder().decode(midi);
  for (const label of ["01 Drums", "02 Bass", "03 Chords", "04 Melody", "05 Counterpoint", "06 Pad"]) {
    assert.ok(text.includes(label), `FL Studio MIDI should preserve named track ${label}`);
  }
  for (const status of [0x99, 0x90, 0x91, 0x92, 0x93, 0x94]) {
    assert.ok(midi.includes(status), `FL Studio MIDI should retain channel status ${status.toString(16)}`);
  }
});

test("motif families create section-aware statements, answers, hooks, and contrasts", () => {
  const config = {
    genre: "pop",
    seed: "motif-family-contract",
    bars: 32,
    humanize: 0,
    swing: 0,
    tracks: {
      melody: { density: 0.9, variation: 0.74, humanize: 0 },
      counterpoint: { density: 0.78, variation: 0.68, humanize: 0 },
    },
  };
  const song = engine.generateNew(config);
  assert.deepEqual(song, engine.generateNew(config));
  assert.deepEqual(Object.keys(song.motifs.family), ["A", "APrime", "B", "C"]);
  assert.deepEqual(song.motifs.melody, song.motifs.family.A.melody);
  assert.deepEqual(song.motifs.counterpoint, song.motifs.family.A.counterpoint);
  assert.equal(song.motifs.sectionAssignments.length, song.structure.length);

  const assignedIds = new Set(song.motifs.sectionAssignments.map((assignment) => assignment.motifId));
  assert.ok(assignedIds.has("A"));
  assert.ok(assignedIds.has("B"));
  assert.ok(assignedIds.has("C"));
  for (const section of song.structure) {
    const assignment = song.motifs.sectionAssignments.find((entry) => entry.sectionId === section.id);
    assert.ok(assignment);
    if (["chorus", "drop"].includes(section.name)) assert.equal(assignment.motifId, "B");
    if (["prechorus", "build", "bridge", "breakdown"].includes(section.name)) assert.equal(assignment.motifId, "C");
  }

  for (const member of Object.values(song.motifs.family)) {
    assert.ok(member.melody.events.length >= 3);
    assert.ok(member.counterpoint.events.length >= 2);
    assert.equal(member.melody.lengthBeats, song.motifs.family.A.melody.lengthBeats);
  }
  const aEvents = song.motifs.family.A.melody.events;
  const answerEvents = song.motifs.family.APrime.melody.events;
  const sharedAnswerOnsets = answerEvents.filter((event, index) => event.offset === aEvents[index]?.offset).length;
  assert.ok(sharedAnswerOnsets / answerEvents.length >= 0.75, "A′ should be recognizably related to A");
  assert.notDeepEqual(song.motifs.family.APrime.melody.events, aEvents);
  assert.notDeepEqual(song.motifs.family.B.melody.events, aEvents);
  assert.notDeepEqual(song.motifs.family.C.melody.events, aEvents);
  assert.ok(song.idea.rhythmicFeatures.includes("A/A′/B/C motif conversation"));
  assertValidNotes(song);
  assertAllGeneratedPitchesInScale(song);
});

test("ensemble groove conductor gives every bar shared rhythmic anchors and breathing space", () => {
  const config = {
    genre: "trap",
    seed: "groove-conductor-2",
    bars: 28,
    energy: 0.86,
    complexity: 0.78,
    humanize: 0,
    swing: 0,
    tracks: {
      drums: { density: 0.9, variation: 0.75, humanize: 0 },
      bass: { density: 0.9, variation: 0.68, humanize: 0 },
      chords: { density: 0.84, variation: 0.65, humanize: 0 },
      melody: { density: 0.86, variation: 0.72, humanize: 0 },
    },
  };
  const song = engine.generateNew(config);
  assert.deepEqual(song, engine.generateNew(config));
  assert.equal(song.grooveConductor.version, 3);
  assert.ok([3, 4].includes(song.grooveConductor.phraseBars));
  assert.equal(song.grooveConductor.bars.length, song.bars);
  assert.ok(song.grooveConductor.subdivision === 0.25 || song.grooveConductor.subdivision === 0.5);
  for (const plan of song.grooveConductor.bars) {
    assert.equal(plan.anchors[0], 0);
    for (const lane of ["anchors", "answers", "spaces", "bassPulses", "chordPulses", "leadPulses", "counterPulses"]) {
      assert.ok(Array.isArray(plan[lane]));
      assert.deepEqual(plan[lane], [...plan[lane]].sort((a, b) => a - b));
    }
    assert.ok(plan.spaces.every((space) => !plan.bassPulses.includes(space) && !plan.chordPulses.includes(space)));
  }

  const drums = song.tracks.find((track) => track.id === "drums").notes;
  const kickStarts = drums.filter((note) => note.pitch === 36).map((note) => note.start);
  const plannedAnchors = song.grooveConductor.bars.flatMap((plan) => (
    plan.anchors.map((offset) => plan.bar * song.meta.beatsPerBar + offset)
  ));
  const realizedAnchors = plannedAnchors.filter((beat) => kickStarts.some((start) => Math.abs(start - beat) < 0.01));
  assert.ok(realizedAnchors.length / plannedAnchors.length >= 0.8);

  let repeatingPairs = 0;
  const phraseBars = song.grooveConductor.phraseBars;
  for (const section of song.structure) {
    for (let local = 0; local + phraseBars < section.bars; local += phraseBars) {
      const first = song.grooveConductor.bars[section.startBar + local];
      const repeated = song.grooveConductor.bars[section.startBar + local + phraseBars];
      assert.deepEqual(repeated.anchors, first.anchors);
      assert.deepEqual(repeated.spaces, first.spaces);
      repeatingPairs += 1;
    }
  }
  assert.ok(repeatingPairs > 0);
  const phraseRoles = new Set(song.grooveConductor.bars.map((plan) => plan.role));
  assert.ok(phraseRoles.size >= 3);
  for (const requiredRole of ["statement", "answer", "turnaround"]) assert.ok(phraseRoles.has(requiredRole));
  const melody = song.tracks.find((track) => track.id === "melody").notes;
  const synchronizedAttacks = melody.filter((note) => {
    const start = Number(note.start.toFixed(2));
    const bar = Math.floor(start / song.meta.beatsPerBar);
    const offset = start - bar * song.meta.beatsPerBar;
    return song.grooveConductor.bars[bar]?.leadPulses.some((pulse) => Math.abs(pulse - offset) <= 0.01);
  });
  assert.ok(synchronizedAttacks.length / melody.length >= 0.75, "lead attacks should lock to the shared groove without becoming rigid");
  assert.ok(song.idea.rhythmicFeatures.includes("Ensemble groove conductor"));
  assertValidNotes(song);
  assertAllGeneratedPitchesInScale(song);
});

test("recurring song sections retain one groove identity while instruments develop by phrase role", () => {
  const song = engine.generateNew({
    genre: "rock",
    seed: "section-family-cohesion",
    bars: 32,
    energy: 0.82,
    complexity: 0.7,
    variation: 0.74,
    evolution: 0.78,
    humanize: 0,
    swing: 0,
    candidateCount: 1,
  });
  const repeatedNames = [...new Set(song.structure.map(({ name }) => name))]
    .filter((name) => song.structure.filter((section) => section.name === name).length > 1);
  assert.ok(repeatedNames.length, "the proof arrangement needs a returning section");

  for (const name of repeatedNames) {
    const returns = song.structure.filter((section) => section.name === name);
    const signatures = returns.map((section) => song.grooveConductor.bars
      .filter((bar) => bar.sectionId === section.id)
      .slice(0, song.grooveConductor.phraseBars)
      .map((bar) => ({
        family: bar.sectionFamilyId,
        role: bar.role,
        anchors: bar.anchors,
        spaces: bar.spaces,
      })));
    for (const signature of signatures.slice(1)) {
      assert.deepEqual(
        signature,
        signatures[0].slice(0, signature.length),
        `${name} returns should recall their rhythmic foundation`,
      );
    }
  }

  const phraseRoles = new Set();
  for (const track of song.tracks) {
    assert.ok(track.notes.every((note) => typeof note.sectionPatternId === "string"));
    for (const note of track.notes) phraseRoles.add(note.phraseRole);
  }
  assert.ok(phraseRoles.has("statement"));
  assert.ok(phraseRoles.has("turnaround"));
  assert.ok(phraseRoles.size >= 2, "instrument dynamics should distinguish phrase functions");
  const pads = song.tracks.find((track) => track.id === "pad").notes;
  assert.ok(pads.some((note) => Number.isFinite(note.plannedTension)), "pads must follow the shared section tension plan");
  assertValidNotes(song);
  assertAllGeneratedPitchesInScale(song);
});

test("spectrum conductor protects sub weight while opening upper registers at section peaks", () => {
  const song = engine.generateNew({
    genre: "trap",
    seed: "full-spectrum-low-end",
    bars: 32,
    energy: 0.9,
    complexity: 0.82,
    variation: 0.82,
    evolution: 0.84,
    humanize: 0,
    candidateCount: 1,
    tracks: {
      drums: { density: 0.95, variation: 0.82, humanize: 0 },
      bass: { density: 0.95, variation: 0.86, humanize: 0 },
      melody: { density: 0.82, variation: 0.78, humanize: 0 },
      counterpoint: { density: 0.62, variation: 0.72, humanize: 0 },
      pad: { density: 0.9, variation: 0.5, humanize: 0 },
    },
  });
  assert.equal(song.spectrumPlan.version, 1);
  assert.ok(song.spectrumPlan.metrics.span >= 60, "the pitched arrangement should use a broad musical spectrum");
  assert.ok(song.spectrumPlan.metrics.lowestPitch <= 36, "the low end should reach the sub-bass register");
  assert.ok(song.spectrumPlan.metrics.highestPitch >= 90, "featured parts should open the presence and air registers");

  const bass = song.tracks.find((track) => track.id === "bass").notes;
  assert.ok(bass.some((note) => note.spectrumRole === "sub-anchor" && note.pitch <= 43));
  assert.ok(bass.some((note) => note.bassRegisterRole === "upper-harmonic"), "bass should include controlled upper-register movement");
  const drums = song.tracks.find((track) => track.id === "drums").notes;
  assert.ok(drums.some((note) => note.spectrumRole === "sub-transient"));
  assert.ok(drums.some((note) => ["layered-backbeat", "low-tom-turnaround"].includes(note.rhythmicFeature)));
  assert.ok(song.producerPass.metrics.spectralSpan >= 60);
  assertValidNotes(song);
  assertAllGeneratedPitchesInScale(song);
});

test("Critic 7.0 evaluates short phrases and limits surgical repair to weak windows", () => {
  const config = {
    genre: "rnbSoul",
    seed: "phrase-critic-surgery",
    bars: 32,
    energy: 0.76,
    complexity: 0.74,
    variation: 0.78,
    evolution: 0.82,
    humanize: 0,
    candidateCount: 1,
  };
  const song = engine.generateNew(config);
  assert.equal(song.phraseCritic.phase, 41);
  assert.equal(song.phraseCritic.status, "complete");
  assert.ok(song.phraseCritic.analyzedWindows >= song.structure.length);
  assert.ok(song.phraseCritic.repairedWindows <= 2, "mobile generation must keep repair work bounded");
  assert.equal(
    song.phraseCritic.windows.reduce((bars, window) => bars + window.endBar - window.startBar, 0),
    song.bars,
    "phrase windows should cover the arrangement exactly once",
  );
  const repairedNotes = song.tracks.flatMap((track) => track.notes.map((note) => ({ ...note, trackId: track.id })))
    .filter((note) => note.phraseRepair);
  for (const note of repairedNotes) {
    assert.ok(song.phraseCritic.repairs.some((repair) => {
      const window = song.phraseCritic.windows.find((candidate) => candidate.id === repair.windowId);
      return window && note.start >= window.startBeat - 1e-6 && note.start < window.endBeat - 1e-6;
    }), "surgical edits must stay inside a diagnosed phrase");
  }
  assert.deepEqual(song, engine.generateNew(config));
  assertValidNotes(song);
  assertAllGeneratedPitchesInScale(song);
});

test("musical returns coordinate lead, bass, and counterpoint callback memory", () => {
  const song = engine.generateNew({
    genre: "rock",
    seed: "ensemble-callback-memory",
    bars: 32,
    evolution: 0.84,
    variation: 0.72,
    humanize: 0,
    candidateCount: 1,
  });
  const returns = song.memoryMap.filter((memory) => ["recall", "return"].includes(memory.relationship));
  assert.ok(returns.length, "the proof arrangement needs at least one musical return");
  for (const memory of returns) {
    for (const trackId of ["melody", "bass", "counterpoint"]) {
      const track = song.tracks.find((candidate) => candidate.id === trackId);
      assert.ok(track.notes.some((note) => (
        note.memoryRole === memory.relationship
        && note.memoryOriginSectionId === memory.originSectionId
      )), `${trackId} should remember ${memory.originSectionId}`);
    }
  }
  assert.ok(song.tracks.find((track) => track.id === "bass").notes.some((note) => note.memoryTransform === "rhythmic-callback"));
  assert.ok(song.tracks.find((track) => track.id === "counterpoint").notes.some((note) => note.memoryTransform === "answer-callback"));
  assertValidNotes(song);
  assertAllGeneratedPitchesInScale(song);
});

test("every genre exposes a native rhythm sentence shared by drums and bass", () => {
  assert.deepEqual(
    Object.keys(engine.GENRE_RHYTHM_GRAMMARS).sort(),
    Object.keys(engine.GENRE_PROFILES).sort(),
  );
  for (const genre of ["trap", "house", "drumBass", "afrobeats", "country", "rock"]) {
    const song = engine.generateNew({
      genre,
      seed: `native-rhythm-${genre}`,
      bars: 16,
      variation: 0.8,
      evolution: 0.82,
      humanize: 0,
      candidateCount: 1,
    });
    const phrase = engine.GENRE_RHYTHM_GRAMMARS[genre].phrase;
    assert.ok(song.grooveConductor.bars.every((bar) => bar.genrePhrase === phrase));
    assert.ok(song.tracks.find((track) => track.id === "drums").notes.some((note) => note.genrePhrase === phrase));
    assert.ok(song.tracks.find((track) => track.id === "bass").notes.some((note) => note.genrePhrase === phrase));
    assert.ok(song.idea.rhythmicFeatures.includes(`Genre phrase: ${phrase}`));
    assertValidNotes(song);
  }
});

test("perceptual mix critic creates masking space with bounded deterministic corrections", () => {
  const config = {
    genre: "neoSoul",
    seed: "perceptual-mix-space",
    bars: 24,
    complexity: 0.86,
    energy: 0.78,
    humanize: 0,
    candidateCount: 1,
  };
  const song = engine.generateNew(config);
  assert.equal(song.perceptualMix.phase, 42);
  assert.equal(song.perceptualMix.status, "complete");
  assert.ok(song.perceptualMix.maskingPairs >= song.perceptualMix.attenuatedNotes);
  assert.ok(song.perceptualMix.dynamicRange >= 0);
  assert.ok(["sub", "body", "presence"].every((band) => Number.isFinite(song.perceptualMix.spectralBands[band])));
  const repaired = song.tracks.flatMap((track) => track.notes).filter((note) => note.perceptualRepair);
  assert.equal(repaired.length, song.perceptualMix.attenuatedNotes);
  assert.deepEqual(song, engine.generateNew(config));
  assertValidNotes(song);
  assertAllGeneratedPitchesInScale(song);
});

test("performance phrasing marks breaths, responses, lifts, and restrained drum ghosts", () => {
  const song = engine.generateNew({
    genre: "funk",
    seed: "performed-not-sequenced",
    bars: 24,
    energy: 0.82,
    humanize: 0.3,
    candidateCount: 1,
  });
  const pitched = song.tracks.filter((track) => track.id !== "drums").flatMap((track) => track.notes);
  const roles = new Set(pitched.map((note) => note.performanceRole));
  assert.ok(roles.has("phrase-ending"));
  assert.ok(roles.has("continuation") || roles.has("response") || roles.has("lift"));
  assert.ok(pitched.every((note) => typeof note.performanceRole === "string"));
  const ghosts = song.tracks.find((track) => track.id === "drums").notes.filter((note) => note.performanceRole === "ghost");
  assert.ok(ghosts.every((note) => note.velocity < 108));
  assertValidNotes(song);
  assertAllGeneratedPitchesInScale(song);
});

test("final output master preserves headroom, bounds, ordering, and lead clarity", () => {
  const song = engine.generateNew({
    genre: "rap",
    seed: "final-output-master",
    bars: 24,
    energy: 0.92,
    complexity: 0.88,
    variation: 0.84,
    candidateCount: 1,
  });
  assert.equal(song.finalMaster.phase, 52);
  assert.equal(song.finalMaster.status, "complete");
  assert.ok(Object.values(song.finalMaster.checks).every(Boolean));
  assert.ok(song.finalMaster.metrics.peakVelocity <= 120);
  assert.ok(song.finalMaster.metrics.dynamicRange >= 0);
  const notes = song.tracks.flatMap((track) => track.notes);
  assert.equal(song.finalMaster.metrics.noteCount, notes.length);
  assert.ok(notes.every((note) => ["section-breath", "section-body", "section-peak"].includes(note.finalMasterRole)));

  const melody = song.tracks.find((track) => track.id === "melody").notes;
  const counterpoint = song.tracks.find((track) => track.id === "counterpoint").notes;
  assert.ok(counterpoint.every((counterNote) => !melody.some((leadNote) => (
    leadNote.pitch === counterNote.pitch
    && Math.abs(leadNote.start - counterNote.start) <= 0.035
    && leadNote.start < counterNote.start + counterNote.duration
    && counterNote.start < leadNote.start + leadNote.duration
  ))));
  assertValidNotes(song);
  assertAllGeneratedPitchesInScale(song);
});

test("creative polish phases improve voice leading, shared pocket, and arrangement breathing", () => {
  const config = {
    genre: "neoSoul",
    seed: "three-dimensional-polish",
    bars: 32,
    energy: 0.76,
    complexity: 0.8,
    humanize: 0.34,
    candidateCount: 1,
  };
  const song = engine.generateNew(config);
  assert.equal(song.voiceLeading.phase, 46);
  assert.equal(song.pocketCohesion.phase, 47);
  assert.equal(song.negativeSpace.phase, 48);
  assert.equal(song.finalMaster.phase, 52);
  assert.ok(song.voiceLeading.averageVoiceMotion >= 0);
  assert.equal(song.voiceLeading.scalePreserved, true);
  assert.ok(song.voiceLeading.commonTonesHeld >= 0);
  assert.ok(song.voiceLeading.bassCollisionsCleared >= 0);
  assert.ok(song.voiceLeading.padDoublingsAvoided >= 0);
  assert.ok(song.pocketCohesion.anchorCount > 0);
  assert.ok(song.pocketCohesion.alignedNotes >= 0);
  assert.ok(song.negativeSpace.windows.length > 0);
  assert.ok(song.negativeSpace.notesRemoved >= 0);
  assert.deepEqual(song, engine.generateNew(config));
  assertValidNotes(song);
  assertAllGeneratedPitchesInScale(song);
});

test("whole-voicing harmony stays scale-safe and separated from bass across musical styles", () => {
  const cases = [
    ["jazz", "C", "dorian"],
    ["neoSoul", "F#", "minor"],
    ["country", "G", "major"],
    ["rock", "E", "minor"],
    ["house", "A", "minor"],
  ];
  let optimizedNotes = 0;
  let commonTones = 0;
  let avoidedDoublings = 0;

  for (const [genre, key, scale] of cases) {
    const song = engine.generateNew({
      genre,
      key,
      scale,
      seed: `whole-voicing-${genre}`,
      bars: 12,
      energy: 0.72,
      complexity: 0.78,
      candidateCount: 1,
    });
    const bass = song.tracks.find((track) => track.id === "bass").notes;
    const harmony = song.tracks.filter((track) => ["chords", "pad"].includes(track.id));

    assert.equal(song.voiceLeading.scalePreserved, true);
    assert.ok(song.voiceLeading.averageVoiceMotion <= 7);
    commonTones += song.voiceLeading.commonTonesHeld;
    avoidedDoublings += song.voiceLeading.padDoublingsAvoided;
    for (const note of harmony.flatMap((track) => track.notes)) {
      if (note.voiceLeadingRepair !== "whole-voicing-optimizer") continue;
      optimizedNotes += 1;
      const soundingBass = bass.filter((bassNote) => (
        note.start < bassNote.start + bassNote.duration - 0.04
        && bassNote.start < note.start + note.duration - 0.04
      ));
      if (soundingBass.length) {
        assert.ok(
          note.pitch - Math.max(...soundingBass.map((bassNote) => bassNote.pitch)) >= 7,
          `${genre} harmony must leave clean low-frequency space above its bass`,
        );
      }
    }
    assertValidNotes(song);
    assertAllGeneratedPitchesInScale(song);
  }

  assert.ok(optimizedNotes > 0);
  assert.ok(commonTones > 0);
  assert.ok(avoidedDoublings > 0);
});

test("phase 66 gives bass, melody, and harmony one section-level cadence contract", () => {
  for (const genre of ["neoSoul", "rock", "house", "rap", "jazz"]) {
    const song = engine.generateNew({
      genre,
      seed: `ensemble-cadence-${genre}`,
      bars: 16,
      energy: 0.74,
      complexity: 0.76,
      candidateCount: 1,
    });
    assert.equal(song.ensembleCadence.phase, 66);
    assert.equal(song.ensembleCadence.status, "complete");
    assert.equal(song.ensembleCadence.scalePreserved, true);
    assert.ok(song.ensembleCadence.sectionsCoordinated > 0);
    const plans = new Map(song.songBlueprint.sectionPlans.map((plan) => [plan.sectionId, plan]));

    for (const id of ["bass", "melody"]) {
      const notes = song.tracks.find((track) => track.id === id).notes
        .filter((note) => note.ensembleCadenceRole);
      assert.ok(notes.length > 0, `${genre} ${id} should participate in at least one cadence`);
      for (const note of notes) {
        const section = song.structure.find((candidate) => (
          note.start >= candidate.startBeat - 1e-6 && note.start < candidate.endBeat - 1e-6
        ));
        const plan = plans.get(section.id);
        const goal = song.harmony.filter((event) => (
          event.start < section.endBeat - 1e-6
          && event.start + event.duration > section.startBeat + 1e-6
        )).at(-1);
        const pitchClass = ((note.pitch % 12) + 12) % 12;
        if (id === "bass" || plan.cadence === "resolve") {
          assert.equal(pitchClass, goal.rootPc);
        } else {
          assert.ok(goal.tones.includes(pitchClass));
        }
      }
    }
    assertValidNotes(song);
    assertAllGeneratedPitchesInScale(song);
  }
});

test("phase 67 preserves exact ensemble handoffs after performance humanization", () => {
  let alignedArrivals = 0;
  let verifiedDropouts = 0;
  for (const genre of ["house", "rock", "rap", "jazz", "ambient"]) {
    const song = engine.generateNew({
      genre,
      seed: `transition-handoff-${genre}`,
      bars: 16,
      energy: 0.8,
      complexity: 0.74,
      humanize: 0.9,
      candidateCount: 1,
    });
    assert.equal(song.transitionHandoff.phase, 67);
    assert.equal(song.transitionHandoff.status, "complete");
    assert.ok(song.transitionHandoff.transitionsCoordinated > 0);
    for (const transition of song.arrangementTransitions) {
      const from = song.structure.find((section) => section.id === transition.fromSectionId);
      const to = song.structure.find((section) => section.id === transition.toSectionId);
      const lastSection = song.structure.at(-1);
      if (to.id === lastSection.id && ["outro", "breakdown"].includes(to.name)) continue;
      const boundary = from.endBeat;
      if (transition.type === "drop-out") {
        const silenceStart = boundary - transition.pickupBeats;
        assert.ok(song.tracks.every((track) => track.notes.every((note) => (
          note.start < silenceStart - 1e-6 || note.start >= boundary - 1e-6
        ))));
        verifiedDropouts += 1;
        continue;
      }
      const arrivals = song.tracks.flatMap((track) => track.notes).filter((note) => (
        note.transitionHandoffRole === `${transition.type}-arrival`
        && note.transitionHandoffId === `${transition.fromSectionId}->${transition.toSectionId}`
      ));
      assert.ok(arrivals.every((note) => Math.abs(note.start - boundary) < 1e-6));
      alignedArrivals += arrivals.length;
      if (transition.strength >= 0.72) {
        for (const id of ["melody", "counterpoint", "chords", "pad"]) {
          const outgoing = song.tracks.find((track) => track.id === id).notes.filter((note) => (
            note.start < boundary - 0.035
          ));
          assert.ok(outgoing.every((note) => note.start + note.duration <= boundary - 0.035 + 1e-6));
        }
      }
    }
    assertValidNotes(song);
    assertAllGeneratedPitchesInScale(song);
  }
  assert.ok(alignedArrivals > 0);
  assert.ok(verifiedDropouts > 0);
});

test("phase 68 rotates featured instruments when song sections return", () => {
  for (const genre of ["trap", "neoSoul", "pop", "country", "rock"]) {
    const input = {
      genre,
      seed: `section-contrast-${genre}`,
      bars: 32,
      energy: 0.76,
      evolution: 0.84,
      candidateCount: 1,
    };
    const song = engine.generateNew(input);
    assert.equal(song.sectionContrast.phase, 68);
    assert.equal(song.sectionContrast.status, "complete");
    assert.ok(song.sectionContrast.repeatedSections > 0);
    assert.equal(song.sectionContrast.rotatedReturns, song.sectionContrast.repeatedSections);
    assert.ok(song.sectionContrast.densityRange > 0);
    assert.ok(song.sectionContrast.featuredTracks.length >= 3);

    const firstByName = new Map();
    for (const entry of song.orchestrationMatrix) {
      const first = firstByName.get(entry.sectionName);
      if (first) assert.notEqual(entry.featuredTrack, first.featuredTrack);
      else firstByName.set(entry.sectionName, entry);
      const section = song.structure.find((candidate) => candidate.id === entry.sectionId);
      const featuredNotes = song.tracks.find((track) => track.id === entry.featuredTrack).notes.filter((note) => (
        note.start >= section.startBeat - 1e-6
        && note.start < section.endBeat - 1e-6
        && note.orchestrationRole === "feature"
      ));
      assert.ok(featuredNotes.length > 0, `${genre} ${section.id} must audibly feature ${entry.featuredTrack}`);
    }
    assert.deepEqual(song, engine.generateNew(input));
    assertValidNotes(song);
    assertAllGeneratedPitchesInScale(song);
  }
});

test("phase 69 transfers recognizable hook rhythm into each returning featured instrument", () => {
  let recognizableOffsets = 0;
  for (const genre of ["trap", "neoSoul", "pop", "country", "rock"]) {
    const input = {
      genre,
      seed: `motif-${genre}-0`,
      bars: 32,
      candidateCount: 1,
    };
    const song = engine.generateNew(input);
    const tagged = song.tracks.flatMap((track) => track.notes).filter((note) => note.motifHandoffRole);
    assert.equal(song.motifHandoff.phase, 69);
    assert.equal(song.motifHandoff.status, "complete");
    assert.ok(song.motifHandoff.handoffs > 0);
    assert.ok(song.motifHandoff.notesAdapted >= 2);
    assert.ok(tagged.length >= 2);
    for (const note of tagged) {
      const [sourceTrackId, targetTrackId] = note.motifHandoffRole.split("-to-");
      const origin = song.structure.find((section) => section.id === note.motifHandoffOriginSectionId);
      const target = song.structure.find((section) => (
        note.start >= section.startBeat - 0.04 && note.start < section.endBeat - 0.04
      ));
      const matrix = song.orchestrationMatrix.find((entry) => entry.sectionId === target.id);
      assert.equal(matrix.featuredTrack, targetTrackId);
      assert.notEqual(sourceTrackId, targetTrackId);
      const sourceOffsets = song.tracks.find((track) => track.id === sourceTrackId).notes
        .filter((sourceNote) => (
          sourceNote.start >= origin.startBeat - 1e-6 && sourceNote.start < origin.endBeat - 1e-6
        ))
        .map((sourceNote) => sourceNote.start - origin.startBeat);
      const targetOffset = note.start - target.startBeat;
      if (sourceOffsets.some((offset) => Math.abs(offset - targetOffset) <= 0.03)) recognizableOffsets += 1;
    }
    assert.deepEqual(song, engine.generateNew(input));
    assertValidNotes(song);
    assertAllGeneratedPitchesInScale(song);
  }
  assert.ok(recognizableOffsets > 0);
});

test("phase 70 strengthens only weak hooks after route shaping", () => {
  for (const genre of ["drumBass", "loFiHipHop", "country"]) {
    const input = {
      genre,
      seed: `hook-audit-${genre}`,
      bars: 16,
      candidateCount: 1,
    };
    const song = engine.generateNew(input);
    const report = song.hookDistinctiveness;
    assert.equal(report.phase, 70);
    assert.equal(report.repaired, true);
    assert.ok(report.after.score > report.before.score);
    assert.ok(report.after.uniqueDegrees >= 3);
    assert.ok(report.after.uniqueGaps >= 2);
    assert.ok(report.after.contourTurns >= 1);
    assert.deepEqual(song, engine.generateNew(input));
    assertValidNotes(song);
    assertAllGeneratedPitchesInScale(song);
  }

  for (const genre of ["neoSoul", "rnbSoul", "jazz", "funk", "pop"]) {
    const song = engine.generateNew({
      genre,
      seed: `hook-audit-${genre}`,
      bars: 16,
      candidateCount: 1,
    });
    assert.equal(song.hookDistinctiveness.repaired, false);
    assert.deepEqual(song.hookDistinctiveness.after, song.hookDistinctiveness.before);
  }
});

test("phase 71 gives each genre family deterministic drum fills without immediate repeats", () => {
  const families = {
    house: "electronic",
    trap: "bassmusic",
    rock: "acoustic",
    neoSoul: "pocket",
  };
  for (const [genre, family] of Object.entries(families)) {
    const input = {
      genre,
      seed: `phase71-${genre}`,
      bars: 32,
      energy: 0.82,
      complexity: 0.72,
      variation: 0.9,
      drumFills: 1,
      rollAmount: 0,
      tripletAmount: 0,
      candidateCount: 1,
    };
    const song = engine.generateNew(input);
    const report = song.drumFillVocabulary;
    const fillNotes = song.tracks.find((track) => track.id === "drums").notes
      .filter((note) => note.drumFillId);
    assert.equal(report.phase, 71);
    assert.equal(report.status, "complete");
    assert.equal(report.family, family);
    assert.ok(report.patternCount >= 2, `${genre} should develop more than one fill shape`);
    assert.ok(report.patternsUsed.every((id) => id.startsWith(`${family}-`)));
    assert.equal(report.fillEvents, fillNotes.length);

    const fillByBar = new Map();
    for (const note of fillNotes) {
      const bar = Math.floor(note.start / song.meta.beatsPerBar);
      fillByBar.set(bar, note.drumFillId);
      assert.equal(note.drumFillFamily, family);
      assert.notEqual(note.pitch, 36, "fills must not replace the protected kick anchor");
    }
    const fillSequence = [...fillByBar.entries()].sort(([left], [right]) => left - right);
    for (let index = 1; index < fillSequence.length; index += 1) {
      const [previousBar, previousId] = fillSequence[index - 1];
      const [currentBar, currentId] = fillSequence[index];
      if (currentBar - previousBar <= 1) assert.notEqual(currentId, previousId);
    }
    assert.deepEqual(song, engine.generateNew(input));
    assertValidNotes(song);
    assertAllGeneratedPitchesInScale(song);
  }
});

test("phase 72 makes bass answer drum fills with scale-safe section approaches", () => {
  for (const genre of ["house", "trap", "rock", "neoSoul"]) {
    const input = {
      genre,
      seed: genre === "neoSoul" ? "phase72-neosoul-0" : `phase72-${genre}`,
      bars: 32,
      energy: 0.82,
      complexity: 0.72,
      variation: 0.9,
      drumFills: 1,
      rollAmount: 0,
      tripletAmount: 0,
      candidateCount: 1,
    };
    const song = engine.generateNew(input);
    const report = song.rhythmTurnaroundConversation;
    const drumCalls = song.tracks.find((track) => track.id === "drums").notes
      .filter((note) => note.rhythmTurnaroundRole === "drum-call");
    const bassAnswers = song.tracks.find((track) => track.id === "bass").notes
      .filter((note) => note.rhythmTurnaroundRole === "bass-answer");
    const callIds = new Set(drumCalls.map((note) => note.rhythmTurnaroundId));

    assert.equal(report.phase, 72);
    assert.equal(report.status, "complete");
    assert.ok(report.drumCalls > 0);
    assert.ok(report.pairedTurnarounds > 0);
    assert.ok(report.pairRate >= 0.5);
    assert.equal(report.bassAnswers, bassAnswers.length);
    for (const answer of bassAnswers) {
      assert.ok(callIds.has(answer.rhythmTurnaroundId));
      const bar = Number(answer.rhythmTurnaroundId.split(":")[1]);
      const boundary = (bar + 1) * song.meta.beatsPerBar;
      assert.ok(answer.start >= boundary - 1.05 && answer.start < boundary);
      assert.equal(answer.rhythmTurnaroundRole, "bass-answer");
    }
    assert.deepEqual(song, engine.generateNew(input));
    assertValidNotes(song);
    assertAllGeneratedPitchesInScale(song);
  }
});

test("phase 75 validates the actual final arrangement after every space-making pass", () => {
  for (const genre of ["pop", "trap", "neoSoul", "rock"]) {
    const song = engine.generateNew({
      ...CONFIG,
      genre,
      seed: `phase-75-final-assembly:${genre}`,
      bars: 32,
      candidateCount: 1,
    });
    assert.equal(song.finalAssembly.phase, 75);
    assert.equal(song.finalAssembly.status, "complete");
    assert.deepEqual(song.finalAssembly.metrics.silentSections, []);
    assert.deepEqual(song.finalAssembly.metrics.missingFeaturedSections, []);
    assert.ok(Object.values(song.finalAssembly.checks).every(Boolean));
    assert.equal(
      song.finalAssembly.metrics.coordinatedTransitions,
      song.finalAssembly.metrics.transitionCount,
    );
  }
});

test("phase 51 reserves deterministic verse space for vocals without weakening instrumental genres", () => {
  const rap = engine.generateNew({
    genre: "rap",
    seed: "room-for-sixteen-bars",
    bars: 24,
    complexity: 0.84,
    candidateCount: 1,
  });
  assert.equal(rap.vocalSpace.phase, 51);
  assert.equal(rap.vocalSpace.enabled, true);
  assert.ok(rap.vocalSpace.windowCount > 0);
  assert.ok(rap.vocalSpace.freedNotes > 0);
  assert.ok(rap.vocalSpace.openWindowRatio >= 0.5);
  assert.ok(rap.tracks.flatMap((track) => track.notes).some((note) => note.vocalSpaceRole));

  const techno = engine.generateNew({
    genre: "techno",
    seed: "instrumental-lane",
    bars: 16,
    candidateCount: 1,
  });
  assert.equal(techno.vocalSpace.enabled, false);
  assert.equal(techno.vocalSpace.windowCount, 0);
  assert.equal(techno.vocalSpace.freedNotes, 0);
  assert.deepEqual(rap, engine.generateNew({
    genre: "rap",
    seed: "room-for-sixteen-bars",
    bars: 24,
    complexity: 0.84,
    candidateCount: 1,
  }));
  assertValidNotes(rap);
  assertAllGeneratedPitchesInScale(rap);
});

test("four-floor grooves preserve the pulse while developing quieter kick pickups", () => {
  for (const genre of ["house", "techno"]) {
    const song = engine.generateNew({
      genre,
      seed: "four-floor-development-0",
      bars: 16,
      complexity: 0.9,
      variation: 0.9,
      evolution: 0.9,
      syncopation: 0.9,
      humanize: 0,
      swing: 0,
      candidateCount: 1,
    });
    const kicks = song.tracks.find((track) => track.id === "drums").notes.filter((note) => note.pitch === 36);
    const pickups = kicks.filter((note) => note.rhythmicFeature === "ghost-kick");
    const core = kicks.filter((note) => note.rhythmicFeature !== "ghost-kick");
    const averageVelocity = (notes) => notes.reduce((sum, note) => sum + note.velocity, 0) / notes.length;

    assert.ok(pickups.length > 0, `${genre} should develop syncopated kick pickups`);
    assert.ok(averageVelocity(pickups) < averageVelocity(core), `${genre} pickups should support, not overpower, the four-floor pulse`);
    for (const plan of song.grooveConductor.bars) {
      for (const beat of [0, 1, 2, 3]) assert.ok(plan.anchors.includes(beat), `${genre} must retain kick beat ${beat + 1}`);
    }
    assertValidNotes(song);
  }
});

test("composition routes produce deterministic harmony-led, groove-led, and hook-led songs", () => {
  assert.deepEqual(engine.COMPOSITION_ROUTES.map((route) => route.id), [
    "harmony-first",
    "groove-first",
    "hook-first",
  ]);
  const base = {
    genre: "pop",
    seed: "composition-route-contract",
    bars: 24,
    candidateCount: 1,
    humanize: 0,
    swing: 0,
  };
  const harmonyFirst = engine.generateNew({ ...base, compositionRoute: "harmony-first" });
  const grooveFirst = engine.generateNew({ ...base, compositionRoute: "groove-first" });
  const hookFirst = engine.generateNew({ ...base, compositionRoute: "hook-first" });
  for (const song of [harmonyFirst, grooveFirst, hookFirst]) {
    assert.equal(song.compositionRoute.id, song.grooveConductor.routeId);
    assert.equal(song.ideaEnginePhases[0].id, "composition-routes");
    assert.equal(song.ideaEnginePhases[0].route, song.compositionRoute.id);
    assert.deepEqual(song, engine.generateNew({ ...base, compositionRoute: song.compositionRoute.id }));
    assertValidNotes(song);
    assertAllGeneratedPitchesInScale(song);
  }
  assert.notDeepEqual(harmonyFirst.tracks, grooveFirst.tracks);
  assert.notDeepEqual(grooveFirst.tracks, hookFirst.tracks);

  const grooveAnchors = grooveFirst.grooveConductor.bars.reduce((sum, bar) => sum + bar.anchors.length, 0);
  const harmonyAnchors = harmonyFirst.grooveConductor.bars.reduce((sum, bar) => sum + bar.anchors.length, 0);
  assert.ok(grooveAnchors > harmonyAnchors, "groove-first should add an intentional syncopated anchor");

  const hook = hookFirst.motifs.family.B.melody;
  const half = hook.lengthBeats / 2;
  const opening = hook.events.filter((event) => event.offset < half - 0.01);
  const repeated = opening.filter((event) => hook.events.some((answer) => Math.abs(answer.offset - event.offset - half) < 0.01));
  assert.ok(repeated.length >= Math.min(2, opening.length), "hook-first should repeat a concise B-cell");

  const strongHarmonyEvents = harmonyFirst.motifs.family.A.melody.events
    .filter((event) => Math.abs(event.offset - Math.round(event.offset)) < 0.04);
  assert.ok(strongHarmonyEvents.length > 0);
  for (const event of strongHarmonyEvents) {
    const chord = harmonyFirst.harmony.find((candidate) => (
      event.offset >= candidate.start - 0.001 && event.offset < candidate.start + candidate.duration - 0.001
    ));
    const scale = harmonyFirst.meta.scaleIntervals;
    const degree = event.degree;
    const pc = ((harmonyFirst.meta.keyPc + scale[((degree % scale.length) + scale.length) % scale.length]) % 12 + 12) % 12;
    assert.ok(chord?.tones.includes(pc), "harmony-first strong motif events should target chord tones");
  }
});

test("comparative novelty critic avoids replaying a recent winning fingerprint", () => {
  const config = {
    ...CONFIG,
    seed: "comparative-novelty-contract",
    bars: 24,
    candidateCount: 6,
  };
  const original = engine.generateNew(config);
  const compared = engine.generateNew({ ...config, recentSongs: [original] });
  assert.deepEqual(compared, engine.generateNew({ ...config, recentSongs: [original] }));
  assert.equal(compared.meta.novelty.compared, 1);
  assert.equal(compared.ideaEnginePhases[1].id, "comparative-novelty");
  assert.equal(compared.ideaEnginePhases[1].compared, 1);
  assert.equal(compared.meta.scoreDetails.candidateScores.length, 6);
  assert.ok(new Set(compared.meta.scoreDetails.candidateScores.map((candidate) => candidate.compositionRoute)).size === 3);

  const replayedCandidate = compared.meta.scoreDetails.candidateScores.find((candidate) => (
    candidate.index === original.meta.scoreDetails.selectedCandidate
  ));
  assert.equal(replayedCandidate.maxSimilarity, 1, "the exact previous winner should be recognized");
  assert.equal(replayedCandidate.noveltyScore, 0);
  assert.notEqual(compared.meta.scoreDetails.selectedCandidate, original.meta.scoreDetails.selectedCandidate);
  assert.ok(compared.meta.novelty.maxSimilarity < 1);

  const phase9 = compared.meta.scoreDetails.candidateScores.some((candidate) => candidate.passedPhase9)
    ? compared.meta.scoreDetails.candidateScores.filter((candidate) => candidate.passedPhase9)
    : compared.meta.scoreDetails.candidateScores;
  const eligible = phase9.some((candidate) => candidate.passedBalanceGate)
    ? phase9.filter((candidate) => candidate.passedBalanceGate)
    : phase9;
  assert.equal(
    compared.meta.scoreDetails.selectionScore,
    Math.max(...eligible.map((candidate) => candidate.selectionScore)),
  );
  assert.deepEqual(original.meta.ideaFingerprint, engine.createSongFingerprint(original));
  assert.equal(engine.evaluateSongNovelty(original, [original], "new").maxSimilarity, 1);
  assertValidNotes(compared);
  assertAllGeneratedPitchesInScale(compared);
});

test("hook motifs enforce earworm catchiness, step-resolution, and distinctiveness across seeds", () => {
  const seeds = ["hit-catchy-seed-1", "hit-catchy-seed-2", "hit-catchy-seed-3", "hit-catchy-seed-4"];
  for (const seed of seeds) {
    const song = engine.generateNew({ ...CONFIG, seed, genre: "pop" });
    assert.ok(song.motifs?.family?.B?.melody, "hook motif family B must exist");
    const hook = song.motifs.family.B.melody;
    assert.ok(hook.events.length >= 3, "hook motif must contain at least 3 pitch events");
    assert.ok(song.motifs.hookDistinctiveness?.after?.score >= 0.5, "hook distinctiveness score must meet catchiness target");
    assertValidNotes(song);
    assertAllGeneratedPitchesInScale(song);
  }
});

test("zero out-of-scale pitch safety sweep across all key roots and 15+ scale families", () => {
  const keys = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  const scales = ["major", "minor", "dorian", "phrygian", "lydian", "mixolydian", "locrian", "pentatonic", "blues", "hirajoshi", "hungarianMinor", "arabic", "inSen"];
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    const scale = scales[index % scales.length];
    const song = engine.generateNew({ seed: `scale-sweep-${key}-${scale}`, key, scale, bars: 8 });
    assertValidNotes(song);
    assertAllGeneratedPitchesInScale(song);
    assert.equal(song.meta.scoreDetails?.critic?.diagnostics?.scaleFit ?? 1, 1, "scale fit score must be 1.0 (100%)");
  }
});

test("all 17 genre profiles hit genre authenticity targets and scale-safe harmony", () => {
  const genres = [
    "pop", "house", "hipHop", "rap", "trap", "drumBass", "synthwave",
    "neoSoul", "loFiHipHop", "rnbSoul", "drill", "reggaeton", "afrobeats",
    "jazz", "ambient", "funk", "country", "rock",
  ];
  for (const genre of genres) {
    const song = engine.generateNew({ seed: `genre-bullseye-${genre}`, genre, bars: 8 });
    const evalResult = engine.evaluateSongCandidate(song);
    assert.ok(evalResult.subscores.genreAuthenticity >= 60, `${genre} authenticity must be >= 60`);
    assertValidNotes(song);
    assertAllGeneratedPitchesInScale(song);
  }
});

test("multi-seed generation produces dynamic arrangement variety without note-level cloning", () => {
  const songs = Array.from({ length: 5 }, (_, i) => engine.generateNew({ seed: `variety-seed-${i}`, genre: "pop" }));
  const contours = new Set(songs.map((s) => JSON.stringify(s.motifs?.melody?.events?.map((e) => e.degree))));
  assert.ok(contours.size >= 3, "random seeds must generate distinct melodic contours");
  const titles = new Set(songs.map((s) => s.title));
  assert.equal(titles.size, 5, "each random seed must produce a unique title");
});

