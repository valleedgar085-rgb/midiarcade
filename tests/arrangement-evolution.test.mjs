import assert from "node:assert/strict";
import test from "node:test";

import {
  createArrangementEvolution,
  evolveArrangementLayout,
  evolveSongArrangement,
} from "../src/core/arrangement-evolution.js";
import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import {
  applyResultOutputQualityPostprocess,
  applySongOutputQualityPostprocess,
} from "../src/core/output-quality-postprocess.js";
import { createSongFingerprint, generateNew } from "../src/music-engine.js";

function fixtureSong() {
  const names = ["intro", "verse", "chorus", "bridge", "chorus", "outro"];
  const sections = names.map((name, index) => ({
    id: `${name}-${index + 1}`,
    name,
    bars: 2,
    start: index * 2,
    startBar: index * 2,
    startBeat: index * 8,
    endBeat: (index + 1) * 8,
  }));
  const timed = (kind, section, index) => ({
    tag: `${kind}:${section.id}`,
    sourceSectionId: section.id,
    start: section.startBeat + 1 + index * 0.125,
    duration: 0.5,
    pitch: 60 + index,
    velocity: 84,
  });
  return {
    id: "phase6b-fixture",
    bars: 12,
    meta: { bars: 12, beatsPerBar: 4, totalBeats: 48, scoreDetails: { totalScore: 90 } },
    structure: sections,
    sections: structuredClone(sections),
    tracks: [
      {
        id: "melody",
        notes: sections.map((section, index) => timed("note", section, index)),
        automation: sections.map((section, index) => ({
          tag: `automation:${section.id}`,
          sourceSectionId: section.id,
          start: section.startBeat + 0.5 + index * 0.0625,
          value: 0.5,
        })),
      },
    ],
    harmony: sections.map((section, index) => ({
      tag: `harmony:${section.id}`,
      sourceSectionId: section.id,
      start: section.startBeat,
      duration: 8,
      degree: index % 7,
    })),
    songBlueprint: { sectionPlans: sections.map((section) => ({ sectionId: section.id, role: "fixture" })) },
    phraseMemory: { sections: sections.map((section) => ({ sectionId: section.id, relationship: "statement" })) },
    songDNA: { sections: sections.map((section) => ({ sectionId: section.id, phraseSeed: section.startBeat })) },
  };
}

function changingConfig(song, genre = "pop") {
  for (let index = 0; index < 128; index += 1) {
    const config = {
      genre,
      bars: song.meta?.bars ?? song.bars,
      seed: `phase6b-arrangement-${index}`,
      arrangementEvolution: true,
    };
    if (evolveSongArrangement(song, config).changed) return config;
  }
  assert.fail("expected at least one deterministic arrangement family to reorder the fixture");
}

function sectionForSource(song, sourceSectionId) {
  return song.structure.find((section) => section.id === sourceSectionId);
}

function assertRelocatedEvents(source, evolved, sourceEvents, evolvedEvents) {
  assert.equal(evolvedEvents.length, sourceEvents.length, "arrangement evolution must not create or delete timed events");
  for (const original of sourceEvents) {
    const moved = evolvedEvents.find((event) => event.tag === original.tag);
    assert.ok(moved, `missing relocated event ${original.tag}`);
    const originalSection = sectionForSource(source, original.sourceSectionId);
    const evolvedSection = sectionForSource(evolved, original.sourceSectionId);
    const offset = original.start - originalSection.startBeat;
    assert.equal(moved.start, evolvedSection.startBeat + offset, `${original.tag} must keep its section-relative timing`);
  }
}

function evaluation(score, arrangementScore) {
  return {
    score,
    diagnostics: { scaleFit: 1 },
    subscores: {
      harmonic: 94,
      groove: 90,
      phraseResolution: 88,
      storyArc: arrangementScore,
      transitions: arrangementScore,
      orchestration: arrangementScore,
      tensionFollow: arrangementScore,
      stageInterlock: arrangementScore,
      production: 92,
    },
  };
}

test("Phase 6B arrangement families are deterministic and respect explicit enable/disable controls", () => {
  const first = createArrangementEvolution({ genre: "techno", bars: 16, seed: "family-proof", arrangementEvolution: true });
  const repeated = createArrangementEvolution({ genre: "techno", bars: 16, seed: "family-proof", arrangementEvolution: true });
  assert.deepEqual(first, repeated);
  assert.equal(first.enabled, true);

  assert.equal(applyOutputQualityEvolution({ genre: "pop", seed: "default-on", bars: 16 }, { kind: "new" }).arrangementEvolution, true);
  assert.equal(applyOutputQualityEvolution({ genre: "pop", seed: "manual-off", bars: 16, arrangementEvolution: false }, { kind: "new" }).arrangementEvolution, false);
  assert.equal(applyOutputQualityEvolution({ genre: "pop", seed: "similar-default", bars: 16 }, { kind: "similar" }).arrangementEvolution, false);
  assert.equal(applyOutputQualityEvolution({ genre: "pop", seed: "similar-manual", bars: 16, arrangementEvolution: true }, { kind: "similar" }).arrangementEvolution, true);
  assert.equal(applyOutputQualityEvolution({ genre: "techno", seed: "fx-default-on", bars: 16 }, { kind: "new" }).transitionFxRefinement, true);
  assert.equal(applyOutputQualityEvolution({ genre: "techno", seed: "fx-similar-off", bars: 16 }, { kind: "similar" }).transitionFxRefinement, false);
});

test("genre storytelling layouts give Pop, Rock, and Techno distinct long-form arcs", () => {
  const base = [
    { name: "intro", weight: 1 },
    { name: "verse", weight: 1 },
    { name: "chorus", weight: 1 },
    { name: "bridge", weight: 1 },
    { name: "chorus", weight: 1 },
    { name: "outro", weight: 1 },
  ];

  const pop = evolveArrangementLayout(base, {
    genre: "pop",
    bars: 24,
    seed: "story-layout-proof",
    arrangementEvolution: true,
  }).map(({ name }) => name);
  const rock = evolveArrangementLayout(base, {
    genre: "rock",
    bars: 24,
    seed: "story-layout-proof",
    arrangementEvolution: true,
  }).map(({ name }) => name);
  const techno = evolveArrangementLayout(base, {
    genre: "techno",
    bars: 24,
    seed: "story-layout-proof",
    arrangementEvolution: true,
  }).map(({ name }) => name);

  assert.notDeepEqual(pop, rock, "Pop and Rock must not share the same generic song form");
  assert.notDeepEqual(pop, techno, "Pop and Techno must not share the same generic song form");
  assert.notDeepEqual(rock, techno, "Rock and Techno must not share the same generic song form");

  const finalPopChorus = pop.lastIndexOf("chorus");
  assert.ok(finalPopChorus > 0);
  assert.ok(
    pop[finalPopChorus - 1] === "prechorus" || pop.includes("bridge"),
    "Pop must earn the final chorus with a prechorus or bridge setup",
  );

  assert.ok(rock.includes("solo") || rock.includes("bridge"), "Rock must reserve a live-band contrast section");
  assert.equal(rock.includes("drop"), false, "Rock should not inherit EDM drop grammar");

  const finalDrop = techno.lastIndexOf("drop");
  assert.ok(finalDrop > 1);
  assert.equal(techno[finalDrop - 1], "build", "Techno must rebuild immediately into its final drop");
  assert.ok(
    techno.slice(0, finalDrop - 1).includes("breakdown"),
    "Techno must create a reset/breath before the final rebuild",
  );
});

test("arrangement evolution moves complete sections atomically without changing song duration or section identity", () => {
  const source = fixtureSong();
  const before = structuredClone(source);
  const config = changingConfig(source);
  const result = evolveSongArrangement(source, config);

  assert.equal(result.changed, true);
  assert.deepEqual(source, before, "arrangement evolution must not mutate the source song");
  assert.equal(result.song.meta.totalBeats, source.meta.totalBeats);
  assert.equal(result.song.bars, source.bars);
  assert.deepEqual(
    [...result.song.structure.map(({ id }) => id)].sort(),
    [...source.structure.map(({ id }) => id)].sort(),
    "section identity must be preserved exactly",
  );
  assert.notDeepEqual(result.song.structure.map(({ id }) => id), source.structure.map(({ id }) => id));

  assertRelocatedEvents(source, result.song, source.tracks[0].notes, result.song.tracks[0].notes);
  assertRelocatedEvents(source, result.song, source.tracks[0].automation, result.song.tracks[0].automation);
  assertRelocatedEvents(source, result.song, source.harmony, result.song.harmony);

  const order = result.song.structure.map(({ id }) => id);
  assert.deepEqual(result.song.songBlueprint.sectionPlans.map(({ sectionId }) => sectionId), order);
  assert.deepEqual(result.song.phraseMemory.sections.map(({ sectionId }) => sectionId), order);
  assert.deepEqual(result.song.songDNA.sections.map(({ sectionId }) => sectionId), order);
});

test("candidate-first postprocess accepts only a scored arrangement win and refreshes authoritative metadata", () => {
  const source = generateNew({ genre: "pop", seed: "phase6b-postprocess-source", bars: 16, candidateCount: 1 });
  const config = changingConfig(source, "pop");
  let evaluationCall = 0;
  const processed = applySongOutputQualityPostprocess(source, config, {
    evaluateCandidate() {
      evaluationCall += 1;
      return evaluationCall === 1 ? evaluation(90, 82) : evaluation(91.2, 84);
    },
    evaluateReleaseGate() {
      return { passed: true, totalScore: 91.2, exportChecks: { durationSafe: true } };
    },
  });

  assert.equal(processed.diagnostics.attempted, true);
  assert.equal(processed.diagnostics.accepted, true);
  assert.equal(processed.diagnostics.reason, "quality-win");
  assert.notStrictEqual(processed.song, source);
  assert.equal(processed.song.meta.scoreDetails.totalScore, 91.2);
  assert.deepEqual(processed.song.meta.ideaFingerprint, createSongFingerprint(processed.song));
  assert.equal(processed.song.meta.scoreDetails.outputQualityPostprocess.arrangement.accepted, true);
  assert.equal(processed.song.outputQualityEvolution.arrangement.accepted, true);
});

test("candidate-first postprocess keeps the original song when the evolved arrangement regresses", () => {
  const source = generateNew({ genre: "pop", seed: "phase6b-reject-source", bars: 16, candidateCount: 1 });
  const config = changingConfig(source, "pop");
  let evaluationCall = 0;
  const processed = applySongOutputQualityPostprocess(source, config, {
    evaluateCandidate() {
      evaluationCall += 1;
      return evaluationCall === 1 ? evaluation(91, 84) : evaluation(89, 80);
    },
    evaluateReleaseGate() {
      return { passed: true, totalScore: 89, exportChecks: { durationSafe: true } };
    },
  });

  assert.equal(processed.diagnostics.attempted, true);
  assert.equal(processed.diagnostics.accepted, false);
  assert.equal(processed.diagnostics.reason, "critic-regression");
  assert.strictEqual(processed.song, source, "rejected arrangement candidates must not replace the generated song");
});

test("result postprocess is reference-stable when no arrangement candidate is committed", () => {
  const noStructureResult = { status: "committed", song: { id: "no-structure" } };
  assert.strictEqual(
    applyResultOutputQualityPostprocess(noStructureResult, {
      genre: "pop",
      seed: "no-op-contract",
      bars: 16,
      arrangementEvolution: true,
    }),
    noStructureResult,
    "no-op arrangement diagnostics must not change the executor result object",
  );

  const source = generateNew({ genre: "pop", seed: "phase6b-result-reject", bars: 16, candidateCount: 1 });
  const config = changingConfig(source, "pop");
  const rejectedResult = { status: "committed", song: source };
  let evaluationCall = 0;
  const processed = applyResultOutputQualityPostprocess(rejectedResult, config, {
    evaluateCandidate() {
      evaluationCall += 1;
      return evaluationCall === 1 ? evaluation(92, 86) : evaluation(88, 79);
    },
    evaluateReleaseGate() {
      return { passed: true, totalScore: 88, exportChecks: { durationSafe: true } };
    },
  });
  assert.strictEqual(processed, rejectedResult, "rejected arrangement candidates must preserve exact executor result identity");
});
