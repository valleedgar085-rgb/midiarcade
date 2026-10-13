import assert from "node:assert/strict";
import test from "node:test";

import {
  createGrooveDNA,
  validateGrooveDNA,
} from "../src/core/groove-intelligence.js";
import {
  jazzGrooveRecallLinks,
  jazzGrooveMemorySourceForBar,
  proposeJazzHatCellMemory,
  proposeJazzGrooveCellMemory,
  JAZZ_GROOVE_PHRASE_MEMORY_LIMITS,
} from "../src/core/jazz-groove-phrase-memory.js";
import {
  generateNew, evaluateSongCandidate, evaluateSongReleaseGate,
} from "../src/music-engine.js";
import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import { applySongOutputQualityPipeline } from "../src/core/output-quality-pipeline-register.js";
import { evaluateCrossAuthorityCoherence } from "../src/core/cross-authority-coherence.js";

const sections = [
  { id: "verse-1", name: "Verse", startBar: 0, bars: 4 },
  { id: "bridge", name: "Bridge", startBar: 4, bars: 4 },
  { id: "verse-2", name: "Verse", startBar: 8, bars: 4 },
];
const opts = (seed, extra = {}) => ({
  genre: "jazz", bars: 12, beatsPerBar: 4, complexity: 0.52,
  seed: `jazz-dna-memory-${seed}`, ...extra,
});
const groove = (seed, enabled = false) => createGrooveDNA(
  opts(seed, { jazzGroovePhraseMemory: enabled }), { structure: sections },
);
const steps = (value, bar, lane) => value.bars[bar][lane].steps;
const symmetric = (left, right) => left.filter((step) => !right.includes(step)).length
  + right.filter((step) => !left.includes(step)).length;

test("Jazz phrase-memory planner preserves mandatory quarter ride and never copies an entire drum bar", () => {
  const source = [0, 3, 4, 8, 11, 12, 15];
  const target = [0, 4, 7, 8, 12, 15];
  const proposal = proposeJazzHatCellMemory({
    sourceSteps: source, targetSteps: target,
    requiredSteps: [0, 4, 8, 12],
    optionalSteps: [0, 3, 4, 7, 8, 11, 12, 15],
    protectedSteps: [2, 10],
  });
  assert.ok(proposal, "source has 3 while target has 7; one-for-one recall is available");
  assert.equal(proposal.kind, "one-for-one-development");
  assert.deepEqual(proposal.steps.slice(0, 4), [0, 3, 4, 8]);
  assert.deepEqual(proposal.steps, [0, 3, 4, 8, 12, 15]);
  assert.equal(proposal.stepsAdded, 1);
  assert.equal(proposal.stepsRemoved, 1);
  assert.equal(proposal.mismatchBefore - proposal.mismatchAfter, 2);
  for (const quarter of [0, 4, 8, 12]) assert.ok(proposal.steps.includes(quarter));
  assert.ok(proposal.changedSteps <= JAZZ_GROOVE_PHRASE_MEMORY_LIMITS.maxHatStepChangesPerBar);
});

test("empty-source Jazz percussion cell can deliberately leave a rest without adding density", () => {
  const proposal = proposeJazzGrooveCellMemory({
    sourceSteps: [], targetSteps: [13],
    requiredSteps: [], optionalSteps: [5, 13, 15],
    protectedSteps: [2, 10],
  });
  assert.ok(proposal);
  assert.equal(proposal.kind, "phrase-rest");
  assert.equal(proposal.stepsAdded, 0);
  assert.equal(proposal.stepsRemoved, 1);
  assert.deepEqual(proposal.steps, []);
});

test("return-section mapping respects explicit memory, earlier origin, and protected boundaries", () => {
  const links = jazzGrooveRecallLinks(sections);
  assert.equal(links.get("verse-2").id, "verse-1");
  assert.equal(jazzGrooveMemorySourceForBar(8, sections[2], sections, links), null);
  assert.equal(jazzGrooveMemorySourceForBar(11, sections[2], sections, links), null);
  const source = jazzGrooveMemorySourceForBar(9, sections[2], sections, links);
  assert.equal(source.sourceBar, 1);
  assert.equal(source.originSectionId, "verse-1");
  assert.equal(source.returnSectionId, "verse-2");
  assert.equal(jazzGrooveMemorySourceForBar(10, sections[2], sections, links).sourceBar, 2);
  const explicit = jazzGrooveRecallLinks(sections, [
    { relationship: "return", originSectionId: "verse-1", sectionId: "verse-2" },
  ]);
  assert.deepEqual([...explicit], [...links]);
});

test("opt-in Jazz return modifies at most one two-beat hat cell per return section", () => {
  const results = [];
  for (let index = 0; index < 24; index += 1) {
    const seed = String(index).padStart(2, "0");
    const before = groove(seed, false);
    const first = groove(seed, true);
    const second = groove(seed, true);
    assert.deepEqual(first, second);
    assert.equal(validateGrooveDNA(first).passed, true, "Groove DNA must still satisfy its protected-space contract");
    assert.equal(before.jazzPhraseMemory, undefined, "default DNA output stays unchanged");
    assert.ok(first.jazzPhraseMemory.enabled);
    assert.ok(first.jazzPhraseMemory.changedBars <= 1);
    assert.ok(first.jazzPhraseMemory.events.length <= 1);
    // Upstream Groove DNA is the only timing author: no kick/snare/percussion edits.
    for (let bar = 0; bar < 12; bar += 1) {
      for (const lane of ["kick", "snare"]) {
        assert.deepEqual(steps(first, bar, lane), steps(before, bar, lane),
          `${seed} ${bar} ${lane}`);
      }
      for (const required of [0, 4, 8, 12]) assert.ok(steps(first, bar, "hat").includes(required));
      const changesByLane = ["hat", "percussion"].map((lane) =>
        symmetric(steps(first, bar, lane), steps(before, bar, lane)));
      assert.ok(changesByLane.reduce((sum, count) => sum + count, 0) <= 2,
        "at most one bounded supporting Jazz lane may change");
      if (changesByLane.some(Boolean)) {
        assert.ok([9, 10].includes(bar), "section boundaries must be untouched");
        assert.equal(changesByLane.filter(Boolean).length, 1);
      }
      // Event timing is recomputed by Groove DNA itself after step selection.
      for (const lane of ["hat", "percussion"]) {
        assert.equal(first.bars[bar][lane].events.length, first.bars[bar][lane].steps.length);
      }
    }
    for (const event of first.jazzPhraseMemory.events) {
      assert.ok(["hat", "percussion"].includes(event.lane));
      assert.equal(event.sourceBar, 1 + (event.targetBar - 9));
      assert.ok(event.mismatchAfter < event.mismatchBefore);
      assert.ok(event.stepsAdded + event.stepsRemoved <= 2);
    }
    results.push({
      seed, changed: first.jazzPhraseMemory.changedBars,
      event: first.jazzPhraseMemory.events[0] ?? null,
    });
  }
  console.info("JAZZ_GROOVE_DNA_RECALL_FIXTURES", JSON.stringify(results));
  assert.ok(results.some((item) => item.changed > 0),
    "at least one real deterministic Jazz DNA seed must develop a returning phrase");
});

test("Jazz DNA phrase-memory stays opt-in; non-Jazz and fusion return byte-equivalent plans", () => {
  for (const genre of ["pop", "hipHop", "house", "neoSoul", "trap", "jazz"]) {
    const baseline = createGrooveDNA({
      seed: "dna-flag-optout",
      genre, bars: 12, beatsPerBar: 4,
    }, { structure: sections });
    const disabled = createGrooveDNA({
      seed: "dna-flag-optout",
      genre, bars: 12, beatsPerBar: 4,
      jazzGroovePhraseMemory: false,
    }, { structure: sections });
    assert.deepEqual(disabled, baseline, `${genre} baseline changed`);
    if (genre !== "jazz") {
      const enabled = createGrooveDNA({
        seed: "dna-flag-optout", genre, bars: 12, beatsPerBar: 4,
        jazzGroovePhraseMemory: true,
      }, { structure: sections });
      assert.deepEqual(enabled, baseline, `${genre} should ignore Jazz memory`);
    }
  }
  const jazz = createGrooveDNA({
    seed: "dna-flag-optout", genre: "jazz", bars: 12, beatsPerBar: 4,
    secondaryGenre: "hipHop", jazzGroovePhraseMemory: true,
  }, { structure: sections });
  assert.equal(jazz.jazzPhraseMemory, undefined, "fusion must not adopt single-genre Jazz recall");
});

test("real Jazz generation preserves baseline off by default and exposes authored groove-memory diagnostics", () => {
  const rows = [];
  for (const seed of ["quality-lab-01", "quality-lab-02", "quality-lab-03"]) {
    const config = {
      ...applyOutputQualityEvolution({
        genre: "jazz", bars: 16, candidateCount: 1,
        seed: `${seed}:jazz`,
      }, { kind: "new" }),
      phraseResolutionRefinement: true,
      registerHealthRefinement: true,
      genreIdentityRefinement: false,
      jazzPhraseReturnRefinement: false,
      jazzDrumExpressionRefinement: false,
    };
    const baseline = generateNew(config);
    const explicitOptOut = generateNew({ ...config, jazzGroovePhraseMemory: false });
    assert.deepEqual(explicitOptOut, baseline, "production default must retain previous Jazz timing");
    const opted = generateNew({ ...config, jazzGroovePhraseMemory: true });
    const again = generateNew({ ...config, jazzGroovePhraseMemory: true });
    assert.deepEqual(opted, again, "the upstream Jazz plan must remain deterministic");
    const memory = opted.grooveConductor?.grooveDNA?.jazzPhraseMemory;
    assert.equal(memory?.enabled, true, `${seed}: missing planned memory diagnostics`);
    const beforeCritic = evaluateSongCandidate(baseline);
    const afterCritic = evaluateSongCandidate(opted);
    const afterCoherence = evaluateCrossAuthorityCoherence(opted);
    const afterRelease = evaluateSongReleaseGate(opted, afterCritic);
    assert.ok(Number.isFinite(afterCritic.score));
    assert.equal(afterCritic.diagnostics.scaleFit, 1);
    // A shadow may reject a composer candidate; full-song release gating stays authoritative.
    const result = applySongOutputQualityPipeline(structuredClone(opted), {
      ...config, jazzGroovePhraseMemory: true,
    });
    assert.ok(result.song && result.song.tracks.length);
    rows.push({
      seed, changedBars: memory.changedBars,
      mode: memory.events[0]?.kind ?? "none",
      lane: memory.events[0]?.lane ?? null,
      beforeGroove: beforeCritic.subscores.groove,
      afterGroove: afterCritic.subscores.groove,
      beforeVariety: beforeCritic.subscores.drumVariety,
      afterVariety: afterCritic.subscores.drumVariety,
      releasePassed: afterRelease.passed,
      coherencePassed: afterCoherence.passed,
    });
  }
  console.info("JAZZ_UPSTREAM_GROOVE_MEMORY_CALIBRATION", JSON.stringify(rows));
});
