import assert from "node:assert/strict";
import test from "node:test";

import { createGenerationExecutor } from "../src/core/generation-executor.js";
import {
  applyResultOutputQualityPipeline,
  applySongOutputQualityPipeline,
} from "../src/core/output-quality-pipeline-register.js";
import {
  createRegisterHealthCandidates,
  MAX_REGISTER_HEALTH_CANDIDATES,
  MAX_REGISTER_HEALTH_EDITS,
  registerHealthScore,
} from "../src/core/register-health-refinement.js";

function sourceSong() {
  const melody = Array.from({ length: 12 }, (_, index) => ({
    id: `m${index}`,
    start: index * 0.5,
    pitch: 60 + (index % 6),
    duration: 0.35,
    velocity: 90 + (index % 4),
  }));
  return {
    id: "register-health-proof",
    genre: "trap",
    bars: 4,
    meta: {
      genre: "trap",
      keyPc: 0,
      bars: 4,
      beatsPerBar: 4,
      totalBeats: 16,
      scoreDetails: {},
    },
    structure: [{ id: "a", name: "verse", startBeat: 0, endBeat: 16 }],
    harmony: [{ start: 0, duration: 16, root: 0, tones: [0, 3, 7] }],
    tracks: [
      { id: "drums", notes: [{ id: "k", start: 0, pitch: 36, duration: 0.1, velocity: 108 }] },
      { id: "bass", notes: [{ id: "b", start: 0, pitch: 36, duration: 1, velocity: 88 }] },
      { id: "chords", notes: [{ id: "c", start: 0, pitch: 60, duration: 4, velocity: 78 }] },
      { id: "counterpoint", notes: [{ id: "q", start: 2, pitch: 72, duration: 0.5, velocity: 72 }] },
      { id: "pad", notes: [{ id: "p", start: 0, pitch: 55, duration: 16, velocity: 62 }] },
      { id: "melody", notes: melody },
    ],
  };
}

function track(song, id) {
  return song.tracks.find((entry) => entry.id === id);
}

function pitchClass(pitch) {
  return ((pitch % 12) + 12) % 12;
}

function evaluator(song, forcedRegister = null) {
  const registerHealth = forcedRegister ?? registerHealthScore(track(song, "melody")?.notes ?? []);
  return {
    score: 86 + registerHealth * 0.05,
    diagnostics: { scaleFit: 1, densityTarget: 8 },
    subscores: {
      harmonic: 94,
      voiceLeading: 94,
      separation: 92,
      cadence: 92,
      harmonicJourney: 92,
      groove: 91,
      density: 90,
      performance: 91,
      drumVariety: 90,
      motif: 90,
      repetition: 90,
      memory: 90,
      phraseResolution: 90,
      registerHealth,
      storyArc: 92,
      transitions: 92,
      orchestration: 92,
      tensionFollow: 92,
      stageInterlock: 92,
      production: 93,
      genreAuthenticity: 94,
    },
  };
}

function releaseGate() {
  return { passed: true, totalScore: 96, exportChecks: { durationSafe: true } };
}

test("register candidates are deterministic, immutable, octave-only, onset-stable, and bounded", () => {
  const source = sourceSong();
  const before = structuredClone(source);
  const candidates = createRegisterHealthCandidates(source);
  const repeated = createRegisterHealthCandidates(source);

  assert.deepEqual(source, before);
  assert.ok(candidates.length > 0);
  assert.ok(candidates.length <= MAX_REGISTER_HEALTH_CANDIDATES);
  assert.deepEqual(
    repeated.map(({ id, changedNotes, semitones, localScoreDelta }) => [id, changedNotes, semitones, localScoreDelta]),
    candidates.map(({ id, changedNotes, semitones, localScoreDelta }) => [id, changedNotes, semitones, localScoreDelta]),
  );

  const sourceMelody = track(source, "melody").notes;
  for (const candidate of candidates) {
    assert.ok(candidate.changedNotes > 0 && candidate.changedNotes <= MAX_REGISTER_HEALTH_EDITS);
    assert.ok(candidate.localScoreDelta > 0);
    assert.ok(Math.abs(candidate.semitones) === 12);
    for (const trackId of ["drums", "bass", "chords", "counterpoint", "pad"]) {
      assert.deepEqual(track(candidate.song, trackId), track(source, trackId), `${trackId} must remain exact`);
    }

    const melody = track(candidate.song, "melody").notes;
    assert.equal(melody.length, sourceMelody.length);
    const sourceById = new Map(sourceMelody.map((note) => [note.id, note]));
    let changed = 0;
    for (const note of melody) {
      const original = sourceById.get(note.id);
      assert.ok(original);
      assert.equal(note.start, original.start);
      assert.equal(note.duration, original.duration);
      assert.equal(note.velocity, original.velocity);
      assert.equal(pitchClass(note.pitch), pitchClass(original.pitch), "octave shifts must preserve pitch class");
      const difference = note.pitch - original.pitch;
      assert.ok(difference === 0 || Math.abs(difference) === 12);
      if (difference !== 0) changed += 1;
    }
    assert.equal(changed, candidate.changedNotes);
    assert.ok(registerHealthScore(melody) > registerHealthScore(sourceMelody));
  }
});

test("register candidates never create piercing melody pitches outside the musical role window", () => {
  const source = sourceSong();
  track(source, "melody").notes.forEach((note, index) => {
    note.pitch = 78 + (index % 6);
  });
  const candidates = createRegisterHealthCandidates(source);
  for (const candidate of candidates) {
    const pitches = track(candidate.song, "melody").notes.map((note) => note.pitch);
    assert.ok(Math.max(...pitches) <= 84, "refinement must not create melody above C6");
    assert.ok(Math.min(...pitches) >= 48, "refinement must not create melody below C3");
  }
});

test("register pipeline commits a critic-verified phrase-register win without damaging protected melody dimensions", () => {
  const source = sourceSong();
  const before = structuredClone(source);
  const processed = applySongOutputQualityPipeline(source, {
    arrangementEvolution: false,
    returnDevelopment: false,
    densityRefinement: false,
    phraseResolutionRefinement: false,
    groovePocketRefinement: false,
    registerHealthRefinement: true,
  }, {
    evaluateCandidate: evaluator,
    evaluateReleaseGate: releaseGate,
  });

  assert.deepEqual(source, before);
  assert.notStrictEqual(processed.song, source);
  assert.equal(processed.registerHealthDiagnostics.accepted, true);
  assert.ok(processed.registerHealthDiagnostics.registerHealthDelta >= 0.75);
  assert.ok(processed.registerHealthDiagnostics.candidatesEvaluated <= MAX_REGISTER_HEALTH_CANDIDATES);
  assert.equal(processed.song.outputQualityEvolution.registerHealthRefinement.accepted, true);
  assert.deepEqual(track(processed.song, "drums"), track(source, "drums"));
  assert.deepEqual(track(processed.song, "bass"), track(source, "bass"));
  assert.deepEqual(
    track(processed.song, "melody").notes.map((note) => note.start),
    track(source, "melody").notes.map((note) => note.start),
  );
  assert.ok(Object.values(processed.registerHealthDiagnostics.protectedDeltas).every((delta) => delta >= -1));
});

test("register pipeline fails closed when the full critic cannot verify the local register improvement", () => {
  const source = sourceSong();
  const processed = applySongOutputQualityPipeline(source, {
    arrangementEvolution: false,
    returnDevelopment: false,
    densityRefinement: false,
    phraseResolutionRefinement: false,
    groovePocketRefinement: false,
    registerHealthRefinement: true,
  }, {
    evaluateCandidate(song) {
      return evaluator(song, 78);
    },
    evaluateReleaseGate: releaseGate,
  });

  assert.strictEqual(processed.song, source);
  assert.equal(processed.registerHealthDiagnostics.accepted, false);
  assert.equal(processed.registerHealthDiagnostics.reason, "critic-regression");
});

test("result wrapper preserves rejected register diagnostics for the debugger", () => {
  const source = sourceSong();
  const result = applyResultOutputQualityPipeline({ status: "committed", song: source }, {
    arrangementEvolution: false,
    returnDevelopment: false,
    densityRefinement: false,
    phraseResolutionRefinement: false,
    repetitionRefinement: false,
    groovePocketRefinement: false,
    registerHealthRefinement: true,
    melodyContinuityRefinement: false,
    bassContinuityRefinement: false,
    ensembleContinuityRefinement: false,
    genreIdentityRefinement: false,
    transitionFxRefinement: false,
  }, {
    evaluateCandidate(song) {
      return evaluator(song, 78);
    },
    evaluateReleaseGate: releaseGate,
  });

  assert.strictEqual(result.song, source);
  assert.equal(result.outputQualityDiagnostics?.registerHealthRefinement, undefined);
  assert.equal(result.outputQualityStageDiagnostics.registerHealthRefinement.accepted, false);
  assert.equal(result.outputQualityStageDiagnostics.registerHealthRefinement.reason, "critic-regression");
});

test("fresh generation opts into register refinement while explicit opt-out remains authoritative", async () => {
  const captures = [];
  const createExecutor = () => createGenerationExecutor({
    fallback(kind, payload) {
      captures.push({ kind, config: structuredClone(payload.config) });
      return { status: "committed", song: { id: `register-${kind}` } };
    },
  });

  const fresh = createExecutor();
  await fresh.run("new", { config: { genre: "trap", seed: "register-fresh" } });
  fresh.dispose();
  assert.equal(captures.at(-1).config.registerHealthRefinement, true);

  const disabled = createExecutor();
  await disabled.run("new", {
    config: { genre: "trap", seed: "register-off", registerHealthRefinement: false },
  });
  disabled.dispose();
  assert.equal(captures.at(-1).config.registerHealthRefinement, false);
});
