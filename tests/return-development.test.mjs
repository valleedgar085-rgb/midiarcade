import assert from "node:assert/strict";
import test from "node:test";

import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import { applySongOutputQualityPostprocess } from "../src/core/output-quality-postprocess.js";
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

function makeTechnoSource() {
  for (let index = 0; index < 32; index += 1) {
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
    if (returnDevelopmentTargets(song).length && rhythmic && tagged.length >= 2) {
      return { song, config, rhythmic, tagged };
    }
  }
  assert.fail("expected deterministic techno output with multi-phrase rhythmic return recall");
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

test("Phase 6D techno recall develops repeated motif windows without changing note count or pitch", () => {
  const { song, rhythmic, tagged } = makeTechnoSource();
  const sourceMelody = song.tracks.find((track) => track.id === "melody");
  const candidateMelody = rhythmic.song.tracks.find((track) => track.id === "melody");
  const targetIds = new Set(returnDevelopmentTargets(song).map(({ sectionId }) => sectionId));

  assert.equal(candidateMelody.notes.length, sourceMelody.notes.length, "techno recall must not add or remove melody notes");
  assert.deepEqual(
    candidateMelody.notes.map((note) => note.pitch),
    sourceMelody.notes.map((note) => note.pitch),
    "techno recall should improve timing identity without rewriting pitches",
  );
  assert.ok(tagged.length >= 2, "techno return should develop more than a single isolated onset");
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
      if (id === "cadence-payoff") return evaluation(90.5, { phraseResolution: 86 });
      if (id === "rhythmic-recall") return evaluation(91.4, { repetition: 90, motif: 91 });
      if (id === "groove-lock") return evaluation(90.8, { groove: 92 });
      return evaluation(89);
    },
    evaluateReleaseGate() {
      return { passed: true, totalScore: 96, exportChecks: { durationSafe: true } };
    },
  });

  assert.equal(processed.diagnostics.reason, "disabled");
  assert.equal(processed.returnDiagnostics.accepted, true);
  assert.equal(processed.returnDiagnostics.id, "rhythmic-recall");
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
