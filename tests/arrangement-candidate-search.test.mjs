import assert from "node:assert/strict";
import test from "node:test";

import {
  createArrangementCandidates,
  genreSequenceFitScore,
  MAX_ARRANGEMENT_CANDIDATES,
} from "../src/core/arrangement-candidates.js";
import { applySongOutputQualityPostprocess } from "../src/core/output-quality-postprocess.js";
import { evaluateSongSequenceAuthority, generateNew } from "../src/music-engine.js";

function orderKey(song) {
  return (song?.structure ?? song?.sections ?? [])
    .map((section) => String(section?.id ?? ""))
    .join(">");
}

function arrangementConfigWithChoices(song) {
  const genre = String(song?.meta?.genre ?? song?.genre ?? "pop");
  const bars = Number(song?.meta?.bars ?? song?.bars ?? 16);
  for (let index = 0; index < 64; index += 1) {
    const config = {
      genre,
      bars,
      seed: `phase6b-candidate-search-${index}`,
      arrangementEvolution: true,
    };
    const candidates = createArrangementCandidates(song, config);
    if (candidates.length >= 2) return { config, candidates };
  }
  assert.fail("expected a deterministic seed with at least two unique safe arrangement candidates");
}

function evaluation(score, arrangementScore) {
  return {
    score,
    diagnostics: { scaleFit: 1 },
    subscores: {
      harmonic: 95,
      voiceLeading: 94,
      separation: 94,
      cadence: 92,
      harmonicJourney: 93,
      groove: 90,
      density: 88,
      performance: 91,
      drumVariety: 89,
      motif: 91,
      repetition: 88,
      memory: 90,
      phraseResolution: 87,
      registerHealth: 90,
      storyArc: arrangementScore,
      transitions: arrangementScore,
      orchestration: arrangementScore,
      tensionFollow: arrangementScore,
      stageInterlock: arrangementScore,
      production: 92,
      genreAuthenticity: 92,
    },
  };
}

test("genre sequence scoring prefers musically ordered Pop, Hip-Hop, Techno, and Rock payoffs", () => {
  assert.ok(
    genreSequenceFitScore(["intro", "verse", "prechorus", "chorus", "bridge", "prechorus", "chorus", "outro"], "pop")
      > genreSequenceFitScore(["intro", "verse", "chorus", "prechorus", "bridge", "chorus", "verse", "outro"], "pop"),
    "Pop should prefer a setup immediately before the final chorus",
  );

  assert.ok(
    genreSequenceFitScore(["intro", "verse", "chorus", "verse", "bridge", "chorus", "outro"], "hipHop")
      > genreSequenceFitScore(["intro", "chorus", "verse", "chorus", "verse", "outro"], "hipHop"),
    "Hip-Hop should establish the verse pocket before the hook and return to a final payoff after development",
  );

  assert.ok(
    genreSequenceFitScore(["intro", "drop", "breakdown", "build", "drop", "outro"], "techno")
      > genreSequenceFitScore(["intro", "build", "drop", "breakdown", "drop", "outro"], "techno"),
    "Techno should prefer reset → rebuild → final drop",
  );

  assert.ok(
    genreSequenceFitScore(["intro", "verse", "chorus", "solo", "bridge", "chorus", "outro"], "rock")
      > genreSequenceFitScore(["intro", "verse", "chorus", "chorus", "solo", "outro"], "rock"),
    "Rock should place live-band contrast before the final payoff",
  );
});

test("Phase 6B arrangement audition is deterministic, unique, immutable, and hard-capped at three candidates", () => {
  const source = generateNew({
    genre: "pop",
    seed: "phase6b-candidate-source",
    bars: 16,
    candidateCount: 1,
  });
  const before = structuredClone(source);
  const { config, candidates: first } = arrangementConfigWithChoices(source);
  const repeated = createArrangementCandidates(source, config, { maxCandidates: 99 });

  assert.deepEqual(source, before, "candidate search must never mutate the generated source song");
  assert.deepEqual(
    repeated.map(({ orderKey: key, evolution }) => [key, evolution.family, evolution.signature]),
    first.map(({ orderKey: key, evolution }) => [key, evolution.family, evolution.signature]),
    "same song and seed must audition the same arrangement candidates",
  );
  assert.ok(first.length >= 2);
  assert.ok(first.length <= MAX_ARRANGEMENT_CANDIDATES);
  assert.equal(new Set(first.map(({ orderKey: key }) => key)).size, first.length);
  assert.ok(first.every(({ song }) => orderKey(song) !== orderKey(source)));

  const sourceIds = [...source.structure.map(({ id }) => id)].sort();
  for (const { song, candidateIndex } of first) {
    assert.equal(song.meta.totalBeats, source.meta.totalBeats);
    assert.equal(song.bars, source.bars);
    assert.deepEqual([...song.structure.map(({ id }) => id)].sort(), sourceIds);
    assert.ok(candidateIndex >= 0 && candidateIndex < MAX_ARRANGEMENT_CANDIDATES);
    const order = song.structure.map(({ id }) => id);
    assert.deepEqual(song.songBlueprint.sectionPlans.map(({ sectionId }) => sectionId), order);
    assert.deepEqual(song.songBlueprint.producerIntent.scenes.map(({ sectionId }) => sectionId), order);
    assert.deepEqual(song.generationInterlock.sectionContracts.map(({ sectionId }) => sectionId), order);
    const sectionById = new Map(song.structure.map((section) => [section.id, section]));
    for (const bar of song.grooveConductor.bars) {
      const section = sectionById.get(bar.sectionId);
      assert.ok(section);
      assert.ok(bar.bar >= section.startBar && bar.bar < section.startBar + section.bars);
    }
    assert.equal(evaluateSongSequenceAuthority(song).passed, true);
  }
});

test("Phase 6B auditions every bounded candidate and commits the strongest quality-safe arrangement", () => {
  const source = generateNew({
    genre: "pop",
    seed: "phase6b-selection-source",
    bars: 16,
    candidateCount: 1,
  });
  const { config, candidates } = arrangementConfigWithChoices(source);
  const sourceOrder = orderKey(source);
  const scores = new Map(candidates.map((candidate, index) => [
    candidate.orderKey,
    {
      score: 90.2 + index * 0.6,
      arrangement: 82.4 + index * 1.1,
    },
  ]));
  const expected = candidates.at(-1);

  const processed = applySongOutputQualityPostprocess(source, config, {
    evaluateCandidate(song) {
      const key = orderKey(song);
      if (key === sourceOrder) return evaluation(90, 82);
      const candidateScore = scores.get(key);
      assert.ok(candidateScore, `unexpected arrangement candidate ${key}`);
      return evaluation(candidateScore.score, candidateScore.arrangement);
    },
    evaluateReleaseGate() {
      return { passed: true, totalScore: 95, exportChecks: { durationSafe: true } };
    },
  });

  assert.equal(processed.diagnostics.accepted, true);
  assert.equal(processed.diagnostics.candidatesEvaluated, candidates.length);
  assert.equal(processed.diagnostics.candidateLimit, MAX_ARRANGEMENT_CANDIDATES);
  assert.deepEqual(processed.diagnostics.candidateFamilies, candidates.map(({ evolution }) => evolution.family));
  assert.equal(processed.diagnostics.candidateIndex, expected.candidateIndex);
  assert.equal(orderKey(processed.song), expected.orderKey);
  assert.ok(processed.diagnostics.scoreDelta > 0);
  assert.ok(processed.diagnostics.arrangementDelta > 0);
});

test("Phase 6B returns the original song when every bounded arrangement candidate loses", () => {
  const source = generateNew({
    genre: "pop",
    seed: "phase6b-all-rejected-source",
    bars: 16,
    candidateCount: 1,
  });
  const { config, candidates } = arrangementConfigWithChoices(source);
  let evaluationCalls = 0;
  const processed = applySongOutputQualityPostprocess(source, config, {
    evaluateCandidate(song) {
      evaluationCalls += 1;
      return song === source ? evaluation(92, 88) : evaluation(88, 80);
    },
    evaluateReleaseGate() {
      return { passed: true, totalScore: 88, exportChecks: { durationSafe: true } };
    },
  });

  assert.strictEqual(processed.song, source);
  assert.equal(processed.diagnostics.accepted, false);
  assert.equal(processed.diagnostics.reason, "critic-regression");
  assert.equal(processed.diagnostics.candidatesEvaluated, candidates.length);
  assert.equal(evaluationCalls, candidates.length + 1, "baseline should be scored once, then each bounded candidate once");
});
