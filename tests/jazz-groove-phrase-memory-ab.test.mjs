import assert from "node:assert/strict";
import test from "node:test";

import {
  generateNew, evaluateSongCandidate, evaluateSongReleaseGate, encodeMidiVerified,
} from "../src/music-engine.js";
import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import { evaluateCrossAuthorityCoherence } from "../src/core/cross-authority-coherence.js";

// Compare the authored *notes*, not just Groove DNA diagnostics or critic scores.
const songConfig = (seed) => ({
  ...applyOutputQualityEvolution({
    genre: "jazz", bars: 16, candidateCount: 1, seed: `${seed}:jazz`,
  }, { kind: "new" }),
  phraseResolutionRefinement: true,
  registerHealthRefinement: true,
  genreIdentityRefinement: false,
  jazzPhraseReturnRefinement: false,
  jazzDrumExpressionRefinement: false,
});
const notesInBar = (song, bar) => (song.tracks.find((track) => track.id === "drums")?.notes ?? [])
  .filter((note) => Math.floor(note.start / 4) === bar);
const details = (report) => ({
  passed: report.passed,
  score: report.score,
  issues: report.issues,
  timingViolations: report.grooveLock?.timingViolations,
  protectedSpaceViolations: report.grooveLock?.protectedSpaceViolations,
});

test("opt-in Jazz memory changes real drums only in the declared return bar, without regressions", () => {
  const measurements = [];
  for (const seed of ["quality-lab-01", "quality-lab-02", "quality-lab-03"]) {
    const config = songConfig(seed);
    const baseline = generateNew(config);
    const candidate = generateNew({ ...config, jazzGroovePhraseMemory: true });
    const memory = candidate.grooveConductor?.grooveDNA?.jazzPhraseMemory;
    assert.equal(memory?.enabled, true, seed);
    assert.equal(memory.events.length, memory.changedBars, seed);
    assert.ok(memory.events.length <= 1, seed);
    const targetBars = new Set(memory.events.map((event) => event.targetBar));
    for (const event of memory.events) {
      assert.deepEqual(
        candidate.grooveConductor.bars[event.targetBar].grooveDNA.phraseMemory,
        event,
        `${seed}: source-authored hat/percussion memory must be visible in the bar plan`,
      );
    }

    // The new phrase must be reflected in the musical output, not only in plans.
    const changedBars = Array.from({ length: 16 }, (_, bar) => bar)
      .filter((bar) => {
        const changed = JSON.stringify(notesInBar(candidate, bar)) !== JSON.stringify(notesInBar(baseline, bar));
        if (changed && !targetBars.has(bar)) {
          console.info("JAZZ_GROOVE_MEMORY_UNPLANNED_BAR", JSON.stringify({
            seed, bar, targetBars: [...targetBars],
            baseline: notesInBar(baseline, bar).map((note) => ({
              pitch: note.pitch, start: note.start, velocity: note.velocity,
              grooveSource: note.grooveSource, rhythmicFeature: note.rhythmicFeature,
            })),
            candidate: notesInBar(candidate, bar).map((note) => ({
              pitch: note.pitch, start: note.start, velocity: note.velocity,
              grooveSource: note.grooveSource, rhythmicFeature: note.rhythmicFeature,
            })),
          }));
          assert.fail(`${seed}: unplanned drum edit at bar ${bar}`);
        }
        return changed;
      });
    assert.equal(changedBars.length, memory.changedBars,
      `${seed}: promised phrase-memory edit did not reach the played notes`);
    assert.deepEqual(
      candidate.tracks.filter((track) => track.id !== "drums"),
      baseline.tracks.filter((track) => track.id !== "drums"),
      `${seed}: phrase-memory must not disturb any pitched part`,
    );
    const beforeCritic = evaluateSongCandidate(baseline);
    const afterCritic = evaluateSongCandidate(candidate);
    for (const [key, value] of Object.entries(beforeCritic.subscores)) {
      assert.ok(afterCritic.subscores[key] >= value,
        `${seed}: ${key} regression ${value} -> ${afterCritic.subscores[key]}`);
    }
    const beforeCoherence = evaluateCrossAuthorityCoherence(baseline);
    const afterCoherence = evaluateCrossAuthorityCoherence(candidate);
    const newIssues = (afterCoherence.issues ?? []).filter(
      (issue) => !(beforeCoherence.issues ?? []).includes(issue),
    );
    assert.deepEqual(newIssues, [], `${seed}: new authority violations`);
    assert.ok(afterCoherence.score >= beforeCoherence.score, `${seed}: coherence score regressed`);
    for (const key of ["timingViolations", "protectedSpaceViolations"]) {
      const oldCount = beforeCoherence.grooveLock?.[key];
      const newCount = afterCoherence.grooveLock?.[key];
      if (Number.isFinite(oldCount) && Number.isFinite(newCount)) {
        assert.ok(newCount <= oldCount, `${seed}: ${key} regressed`);
      }
    }
    if (evaluateSongReleaseGate(baseline, beforeCritic).passed) {
      assert.equal(evaluateSongReleaseGate(candidate, afterCritic).passed, true,
        `${seed}: accepted baseline became release-unsafe`);
    }
    const exported = encodeMidiVerified(candidate);
    assert.equal(exported.audit.passed, true, `${seed}: MIDI parity`);
    measurements.push({
      seed, planChangedBars: memory.changedBars, audibleChangedBars: changedBars,
      sourceCoherence: details(beforeCoherence), optInCoherence: details(afterCoherence),
      scoreBefore: beforeCritic.score, scoreAfter: afterCritic.score,
    });
  }
  assert.ok(measurements.some((row) => row.planChangedBars > 0),
    "at least one fixed real Jazz seed must produce a bounded one-for-one development");
  console.info("JAZZ_GROOVE_MEMORY_FULL_SONG_AB", JSON.stringify(measurements));
});
