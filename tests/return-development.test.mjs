import assert from "node:assert/strict";
import test from "node:test";

import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import { applySongOutputQualityPostprocess } from "../src/core/output-quality-postprocess.js";
import { repetitionBalance } from "../src/core/repetition-refinement.js";
import {
  createReturnDevelopmentCandidates,
  MAX_RETURN_DEVELOPMENT_CANDIDATES,
  returnDevelopmentTargets,
} from "../src/core/return-development.js";
import { generateNew } from "../src/music-engine.js";

function makeSource() {
  for (let index = 0; index < 24; index += 1) {
    const song = generateNew({
      genre: "popRadio",
      seed: `phase6b-return-source-${index}`,
      bars: 32,
      candidateCount: 1,
    });
    const config = {
      genre: "popRadio",
      seed: `phase6b-return-post-${index}`,
      bars: 32,
      arrangementEvolution: false,
      returnDevelopment: true,
    };
    const candidates = createReturnDevelopmentCandidates(song, config);
    if (returnDevelopmentTargets(song).length && candidates.length >= 2) return { song, config, candidates };
  }
  assert.fail("expected a deterministic song with at least two return-development candidates");
}

function phraseRepetitionRatio(song) {
  const melodyNotes = song?.tracks?.find((track) => track.id === "melody")?.notes ?? [];
  const length = Number(song?.motifs?.melody?.lengthBeats ?? 0);
  if (!(length > 0) || melodyNotes.length < 4) return 0.55;
  const signatures = [];
  for (const section of song?.structure ?? []) {
    const repeats = Math.min(4, Math.floor((section.endBeat - section.startBeat) / length));
    for (let repeat = 0; repeat < repeats; repeat += 1) {
      const start = section.startBeat + repeat * length;
      const notes = melodyNotes.filter((note) => note.start >= start - 1e-6 && note.start < start + length - 1e-6);
      if (notes.length < 2) continue;
      signatures.push(new Set(notes.map((note) => `${Math.round((note.start - start) * 4) / 4}`)));
    }
  }
  if (signatures.length < 2) return 0.55;
  const reference = signatures[0];
  const values = signatures.slice(1).map((signature) => {
    const shared = [...reference].filter((item) => signature.has(item)).length;
    return shared / Math.max(1, Math.min(reference.size, signature.size));
  });
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function makeTechnoSource() {
  for (let index = 0; index < 48; index += 1) {
    const song = generateNew({
      genre: "techno",
      seed: `phase6d-techno-return-${index}`,
      bars: 32,
      candidateCount: 1,
    });
    const config = {
      genre: "techno",
      seed: `phase6d-techno-post-${index}`,
      bars: 32,
      arrangementEvolution: false,
      returnDevelopment: true,
    };
    const candidates = createReturnDevelopmentCandidates(song, config);
    const rhythmic = candidates.find(({ id }) => id === "rhythmic-recall");
    const tagged = rhythmic?.song?.tracks?.find((track) => track.id === "melody")?.notes
      ?.filter((note) => note.returnDevelopmentRole === "techno-grid-recall") ?? [];
    const before = phraseRepetitionRatio(song);
    const after = rhythmic ? phraseRepetitionRatio(rhythmic.song) : before;
    if (returnDevelopmentTargets(song).length && rhythmic && tagged.length >= 1 && after > before + 0.02) {
      return { song, config, rhythmic, tagged, before, after };
    }
  }
  assert.fail("expected deterministic techno output with critic-overlap-improving return recall");
}

function noteKey(note) {
  return `${note.id ?? ""}:${note.start ?? note.startBeat ?? note.beat ?? note.time}:${note.pitch ?? note.note ?? note.midi}:${note.duration ?? note.length}`;
}

function evaluation(score, overrides = {}) {
  return {
    score,
    diagnostics: { scaleFit: 1 },
    subscores: {
      harmonic: 94,
      voiceLeading: 94,
      separation: 93,
      cadence: 90,
      harmonicJourney: 92,
      groove: 84,
      density: 86,
      performance: 90,
      drumVariety: 88,
      motif: 86,
      repetition: 82,
      memory: 90,
      phraseResolution: 80,
      registerHealth: 89,
      storyArc: 93,
      transitions: 92,
      orchestration: 93,
      tensionFollow: 91,
      stageInterlock: 92,
      production: 93,
      genreAuthenticity: 94,
      ...overrides,
    },
  };
}

test("Phase 6B return development is deterministic, immutable, focused, and capped at three candidates", () => {
  const { song, config, candidates: first } = makeSource();
  const before = structuredClone(song);
  const repeated = createReturnDevelopmentCandidates(song, config);

  assert.deepEqual(song, before, "return candidate creation must never mutate the source song");
  assert.ok(first.length >= 2);
  assert.ok(first.length <= MAX_RETURN_DEVELOPMENT_CANDIDATES);
  assert.deepEqual(
    repeated.map(({ id, changedNotes, returnSections }) => [id, changedNotes, returnSections]),
    first.map(({ id, changedNotes, returnSections }) => [id, changedNotes, returnSections]),
    "same source and controls must produce the same bounded return candidates",
  );
  assert.equal(new Set(first.map(({ id }) => id)).size, first.length);

  const targetIds = new Set(returnDevelopmentTargets(song).map(({ sectionId }) => sectionId));
  for (const candidate of first) {
    assert.equal(candidate.song.meta.totalBeats, song.meta.totalBeats);
    assert.equal(candidate.song.bars, song.bars);
    assert.deepEqual(candidate.song.structure, song.structure, "return development must not rewrite macro structure");
    assert.deepEqual(candidate.song.harmony, song.harmony, "return development must not rewrite harmony");
    assert.ok(candidate.changedNotes > 0);

    for (const trackId of ["melody", "bass"]) {
      const sourceTrack = song.tracks.find((track) => track.id === trackId);
      const candidateTrack = candidate.song.tracks.find((track) => track.id === trackId);
      if (!sourceTrack || !candidateTrack) continue;
      const sourceOutside = sourceTrack.notes.filter((note) => {
        const section = song.structure.find((entry) => note.start >= entry.startBeat - 1e-6 && note.start < entry.endBeat - 1e-6);
        return section && !targetIds.has(String(section.id));
      }).map(noteKey);
      const candidateOutside = candidateTrack.notes.filter((note) => {
        const section = song.structure.find((entry) => note.start >= entry.startBeat - 1e-6 && note.start < entry.endBeat - 1e-6);
        return section && !targetIds.has(String(section.id));
      }).map(noteKey);
      assert.deepEqual(candidateOutside, sourceOutside, `${candidate.id} must preserve ${trackId} outside return sections`);
    }
  }
});

test("Phase 9D return evolution improves repetition balance and reinforces the native spotlight without rewriting identity", () => {
  let fixture = null;
  for (const genre of ["pop", "synthwave", "loFiHipHop", "jazz", "techno"]) {
    for (let index = 0; index < 36 && !fixture; index += 1) {
      const song = generateNew({
        genre,
        seed: `phase9d-return-evolution-${genre}-${index}`,
        bars: 32,
        candidateCount: 1,
        creativeSpotlightRotation: "bass-to-lead",
        creativeMotifStrength: 1,
        creativeMotifMaxEvents: 0,
      });
      const config = { genre, seed: `phase9d-post-${genre}-${index}`, bars: 32, arrangementEvolution: false, returnDevelopment: true };
      const candidate = createReturnDevelopmentCandidates(song, config).find(({ id }) => id === "return-evolution");
      const spotlight = candidate?.song?.tracks?.flatMap((track) => (track.notes ?? [])
        .filter((note) => note.returnDevelopmentSpotlightRole)
        .map((note) => ({ track, note }))) ?? [];
      if (candidate && spotlight.length) fixture = { song, config, candidate, spotlight };
    }
    if (fixture) break;
  }
  assert.ok(fixture, "expected a deterministic return-evolution fixture with a native spotlight handoff");
  const { song, config, candidate: evolution, spotlight } = fixture;
  const before = structuredClone(song);
  const repeated = createReturnDevelopmentCandidates(song, config).find(({ id }) => id === "return-evolution");
  const targets = returnDevelopmentTargets(song);
  const targetIds = new Set(targets.map(({ sectionId }) => sectionId));
  const target = Math.max(0, Math.min(1, Number(song?.songBlueprint?.qualityTargets?.repetition ?? 0.62)));
  const beforeBalance = repetitionBalance(song, target);
  const afterBalance = repetitionBalance(evolution.song, target);

  assert.deepEqual(song, before, "Phase 9D candidate creation must keep the source authoritative");
  assert.deepEqual(evolution.song, repeated.song, "return evolution must be deterministic");
  assert.ok(afterBalance.absoluteError < beforeBalance.absoluteError, `return evolution must move repetition toward target (${beforeBalance.absoluteError} -> ${afterBalance.absoluteError})`);
  assert.deepEqual(evolution.song.structure, song.structure);
  assert.deepEqual(evolution.song.harmony, song.harmony);
  assert.ok(evolution.changedNotes <= 3 + targets.length * 2, "return evolution must stay inside the three timing edits plus two spotlight accents per return envelope");

  for (const sourceTrack of song.tracks) {
    const candidateTrack = evolution.song.tracks.find((track) => track.id === sourceTrack.id);
    assert.equal(candidateTrack?.notes?.length, sourceTrack.notes.length, `${sourceTrack.id} note count must remain unchanged`);
  }

  const evolvedTiming = evolution.song.tracks.find((track) => track.id === "melody")?.notes
    ?.filter((note) => note.returnDevelopmentRole === "return-evolution") ?? [];
  assert.ok(evolvedTiming.length >= 1 && evolvedTiming.length <= 3, "return evolution timing edit budget must remain 1..3 notes");
  for (const note of evolvedTiming) {
    assert.ok(Math.abs(note.start - note.returnDevelopmentOriginalStart) <= 0.5 + 1e-6, "return evolution onset shift must remain <= 0.5 beat");
    const section = evolution.song.structure.find((entry) => note.start >= entry.startBeat - 1e-6 && note.start < entry.endBeat - 1e-6);
    assert.ok(section && targetIds.has(String(section.id)), "return evolution timing edits must stay inside recurring sections");
  }

  assert.ok(spotlight.length >= 1);
  assert.ok(spotlight.length <= targets.length * 2, "spotlight reinforcement is capped at two notes per return");
  for (const { track, note } of spotlight) {
    const section = evolution.song.structure.find((entry) => note.start >= entry.startBeat - 1e-6 && note.start < entry.endBeat - 1e-6);
    assert.ok(section && targetIds.has(String(section.id)), "spotlight edits must stay inside recurring target sections");
    const matrix = evolution.song.orchestrationMatrix.find((entry) => String(entry.sectionId) === String(section.id));
    assert.equal(matrix?.featuredTrack, track.id, "spotlight reinforcement must follow the native orchestration feature owner");
  }
});

test("Phase 6D techno recall directly improves critic repetition overlap without changing note count or pitch", () => {
  const { song, rhythmic, tagged, before, after } = makeTechnoSource();
  const sourceMelody = song.tracks.find((track) => track.id === "melody");
  const candidateMelody = rhythmic.song.tracks.find((track) => track.id === "melody");
  const targetIds = new Set(returnDevelopmentTargets(song).map(({ sectionId }) => sectionId));

  assert.equal(candidateMelody.notes.length, sourceMelody.notes.length, "techno recall must not add or remove melody notes");
  assert.deepEqual(
    candidateMelody.notes.map((note) => note.pitch).sort((left, right) => left - right),
    sourceMelody.notes.map((note) => note.pitch).sort((left, right) => left - right),
    "techno recall should improve timing identity without rewriting pitches",
  );
  assert.ok(after > before + 0.02, `critic-shaped repetition overlap should improve (${before} -> ${after})`);
  assert.ok(tagged.length >= 1, "techno return should move at least one missing reference onset");
  assert.ok(tagged.length <= targetIds.size * 16, "per-return change budget must remain bounded");
  for (const note of tagged) {
    const section = rhythmic.song.structure.find((entry) => note.start >= entry.startBeat - 1e-6 && note.start < entry.endBeat - 1e-6);
    assert.ok(section && targetIds.has(String(section.id)), "techno recall must stay inside recurring target sections");
  }
});

test("explicit return-development opt-out remains authoritative while fresh generation opts in by default", () => {
  const enabled = applyOutputQualityEvolution({ genre: "pop", seed: "return-default" }, { kind: "new" });
  const disabled = applyOutputQualityEvolution({
    genre: "pop",
    seed: "return-disabled",
    arrangementEvolution: false,
    returnDevelopment: false,
  }, { kind: "new" });
  const similar = applyOutputQualityEvolution({ genre: "pop", seed: "return-similar" }, { kind: "similar" });

  assert.equal(enabled.returnDevelopment, true);
  assert.equal(disabled.returnDevelopment, false);
  assert.equal(disabled.arrangementEvolution, false);
  assert.equal(similar.returnDevelopment, false, "Similar should preserve family identity instead of silently developing returns");
});

test("candidate-first return development commits the strongest quality-safe targeted win", () => {
  const { song, config, candidates } = makeSource();
  const candidateIds = new Set(candidates.map(({ id }) => id));
  let candidateScores = 0;

  const processed = applySongOutputQualityPostprocess(song, config, {
    evaluateCandidate(candidateSong) {
      const id = candidateSong.outputQualityEvolution?.returnDevelopment?.id;
      if (!id || !candidateIds.has(id)) return evaluation(90);
      candidateScores += 1;
      if (id === "cadence-payoff") return evaluation(90.8, { phraseResolution: 88 });
      if (id === "return-evolution") return evaluation(91.8, { repetition: 92 });
      if (id === "rhythmic-recall") return evaluation(91.4, { repetition: 90, motif: 91 });
      return evaluation(89);
    },
    evaluateReleaseGate() {
      return { passed: true, totalScore: 96, exportChecks: { durationSafe: true } };
    },
  });

  assert.equal(processed.diagnostics.reason, "disabled");
  assert.equal(processed.returnDiagnostics.accepted, true);
  assert.equal(processed.returnDiagnostics.id, candidateIds.has("return-evolution") ? "return-evolution" : "rhythmic-recall");
  assert.equal(processed.returnDiagnostics.candidatesEvaluated, candidates.length);
  assert.equal(processed.returnDiagnostics.candidateLimit, MAX_RETURN_DEVELOPMENT_CANDIDATES);
  assert.equal(candidateScores, candidates.length);
  assert.notStrictEqual(processed.song, song);
  assert.equal(processed.song.outputQualityEvolution.returnDevelopment.accepted, true);
  assert.ok(processed.returnDiagnostics.targetDelta > 0);
  assert.ok(processed.returnDiagnostics.scoreDelta > 0);
  assert.ok(processed.song.meta.scoreDetails.outputQualityPostprocess.returnDevelopment.accepted);
});

test("rejected return development preserves the exact source object and cannot leak diagnostics into the executor contract", () => {
  const { song, config, candidates } = makeSource();
  let calls = 0;
  const processed = applySongOutputQualityPostprocess(song, config, {
    evaluateCandidate(candidateSong) {
      calls += 1;
      return candidateSong === song ? evaluation(92) : evaluation(88, {
        groove: 80,
        repetition: 76,
        motif: 78,
        phraseResolution: 74,
      });
    },
    evaluateReleaseGate() {
      return { passed: true, totalScore: 90, exportChecks: { durationSafe: true } };
    },
  });

  assert.strictEqual(processed.song, song);
  assert.equal(processed.returnDiagnostics.accepted, false);
  assert.equal(processed.returnDiagnostics.reason, "critic-regression");
  assert.equal(processed.returnDiagnostics.candidatesEvaluated, candidates.length);
  assert.equal(calls, candidates.length + 1, "return baseline should be scored once, then every bounded candidate once");
});
