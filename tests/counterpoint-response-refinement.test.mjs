import assert from "node:assert/strict";
import test from "node:test";
import { evaluateSongCandidate, evaluateSongReleaseGate, generateNew } from "../src/music-engine.js";
import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import { applySongOutputQualityPipeline } from "../src/core/output-quality-pipeline-register.js";
import { qualityStageAuthority, authorizeQualityStage } from "../src/core/generation-repair-router.js";
import {
  applyCounterpointResponseRefinement,
  createCounterpointResponseCandidates,
  MAX_COUNTERPOINT_RESPONSE_CANDIDATES,
} from "../src/core/counterpoint-response-refinement.js";

const fixture = () => ({
  genre: "rnbSoul", meta: { genre: "rnbSoul", beatsPerBar: 4, bars: 1 },
  structure: [{ id: "verse", startBeat: 0, endBeat: 4 }],
  harmony: [{ start: 0, duration: 4, tones: [0, 4, 7] }],
  tracks: [
    { id: "melody", notes: [{ start: 0, duration: 0.5, pitch: 72, velocity: 88 }] },
    { id: "counterpoint", notes: [{ start: 0.25, duration: 0.25, pitch: 60, velocity: 76 }] },
  ],
});
test("proposal never mutates original and moves only counterpoint timing", () => {
  const song = fixture();
  const source = structuredClone(song);
  const proposals = createCounterpointResponseCandidates(song);
  assert.ok(proposals.length > 0);
  assert.ok(proposals.length <= MAX_COUNTERPOINT_RESPONSE_CANDIDATES);
  assert.deepEqual(song, source);
  const candidate = proposals[0].song;
  assert.equal(candidate.tracks[0], song.tracks[0]);
  assert.equal(candidate.tracks[1].notes[0].pitch, 60);
  assert.equal(candidate.tracks[1].notes[0].velocity, 76);
  assert.equal(candidate.tracks[1].notes[0].duration, 0.25);
  assert.equal(candidate.tracks[1].notes[0].start, 0.5);
  assert.ok(proposals[0].afterConflicts < proposals[0].beforeConflicts);
  assert.deepEqual(createCounterpointResponseCandidates(song).map((item) => item.song),
    proposals.map((item) => item.song));
});
test("no shift can cross a section or newly cross a chord boundary", () => {
  const song = fixture();
  song.harmony.push({ start: 0.45, duration: 3.55, tones: [2, 5, 9] });
  assert.deepEqual(createCounterpointResponseCandidates(song), []);
  const late = fixture();
  late.structure[0].endBeat = 0.45;
  assert.deepEqual(createCounterpointResponseCandidates(late), []);
});
test("refinement is disabled by default and router admits only ensemble authority", () => {
  const song = fixture();
  const disabled = applyCounterpointResponseRefinement(song, {});
  assert.equal(disabled.song, song);
  assert.equal(disabled.diagnostics.reason, "disabled");
  const stage = qualityStageAuthority("counterpointResponseRefinement");
  assert.deepEqual(stage.owners, ["ensemble"]);
  assert.ok(stage.mutations.includes("timing"));
  assert.equal(authorizeQualityStage("counterpointResponseRefinement", {
    allowsSurgicalPostprocess: true, mutationOwner: "harmony",
  }).allowed, false);
  assert.equal(authorizeQualityStage("counterpointResponseRefinement", {
    allowsSurgicalPostprocess: true, mutationOwner: "ensemble",
  }).allowed, true);
});
test("target R&B seed preserves critic, release gates, and deterministic results", () => {
  const baseConfig = {
    ...applyOutputQualityEvolution({
      genre: "rnbSoul", seed: "quality-lab-03:rnbSoul", bars: 16, candidateCount: 1,
    }, { kind: "new" }),
    phraseResolutionRefinement: true, registerHealthRefinement: true,
  };
  const original = generateNew(baseConfig);
  const finished = applySongOutputQualityPipeline(original, baseConfig).song;
  const originalSnapshot = structuredClone(finished);
  const first = applyCounterpointResponseRefinement(
    finished, { ...baseConfig, counterpointResponseRefinement: true },
    evaluateSongCandidate, evaluateSongReleaseGate,
  );
  const second = applyCounterpointResponseRefinement(
    finished, { ...baseConfig, counterpointResponseRefinement: true },
    evaluateSongCandidate, evaluateSongReleaseGate,
  );
  const before = evaluateSongCandidate(finished);
  const after = evaluateSongCandidate(first.song);
  const release = evaluateSongReleaseGate(first.song, after);
  assert.deepEqual(first.song, second.song);
  assert.deepEqual(first.diagnostics, second.diagnostics);
  assert.deepEqual(finished, originalSnapshot, "rejected or accepted proposals must leave input unchanged");
  for (const [key, value] of Object.entries(before.subscores)) {
    assert.ok(Number(after.subscores[key]) >= Number(value) - 1e-9,
      `${key}: ${value} -> ${after.subscores[key]}`);
  }
  if (first.diagnostics.accepted) {
    assert.ok(after.subscores.separation > before.subscores.separation);
    assert.equal(release.passed, true);
    assert.equal(after.diagnostics.scaleFit, 1);
  } else {
    assert.equal(first.song, finished);
  }
  console.info("counterpoint quality-lab-03", JSON.stringify({
    beforeSeparation: before.subscores.separation,
    afterSeparation: after.subscores.separation,
    attempted: first.diagnostics.attempted,
    accepted: first.diagnostics.accepted,
    reason: first.diagnostics.reason,
    candidateSummaries: first.diagnostics.candidates,
  }));
});
