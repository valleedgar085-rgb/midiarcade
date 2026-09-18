import assert from "node:assert/strict";
import test from "node:test";

import { createArrangementCandidates, MAX_ARRANGEMENT_CANDIDATES } from "../src/core/arrangement-candidates.js";
import { evolveSongArrangement } from "../src/core/arrangement-evolution.js";
import { applyArrangementPerformance } from "../src/core/arrangement-performance.js";
import { generateNew } from "../src/music-engine.js";

const SAFE_TRACKS = new Set(["drums", "chords", "counterpoint", "pad"]);

function evolvedFixture() {
  const source = generateNew({
    genre: "pop",
    seed: "phase8b-performance-source",
    bars: 16,
    candidateCount: 1,
  });
  for (let index = 0; index < 64; index += 1) {
    const config = {
      genre: "pop",
      bars: 16,
      seed: `phase8b-performance-order-${index}`,
      arrangementEvolution: true,
    };
    const evolved = evolveSongArrangement(source, config);
    if (evolved.changed && evolved.song.arrangementTransitions?.length) return { source, config, evolved };
  }
  assert.fail("expected a deterministic changed arrangement fixture");
}

function startOf(note) {
  return Number(note?.start ?? note?.startBeat ?? note?.beat ?? note?.time ?? 0);
}

function durationOf(note) {
  return Number(note?.duration ?? note?.length ?? 0);
}

function pitchOf(note) {
  return Number(note?.pitch ?? note?.note ?? note?.midi ?? 0);
}

test("Phase 8B performance is deterministic, audible, source-immutable and bounded to safe lanes", () => {
  const { evolved } = evolvedFixture();
  const before = structuredClone(evolved.song);
  const first = applyArrangementPerformance(evolved.song, { profile: "impact" });
  const repeated = applyArrangementPerformance(evolved.song, { profile: "impact" });

  assert.deepEqual(evolved.song, before, "performance audition must never mutate the atomic reordered source");
  assert.deepEqual(first, repeated, "same reordered song and profile must shape identically");
  assert.equal(first.changed, true);
  assert.ok(first.diagnostics.changedNotes > 0, "performance stage must make an audible velocity change");
  assert.ok(first.diagnostics.pickups > 0);

  for (const sourceTrack of before.tracks) {
    const afterTrack = first.song.tracks.find((track) => track.id === sourceTrack.id);
    assert.ok(afterTrack);
    assert.equal(afterTrack.notes.length, sourceTrack.notes.length, `${sourceTrack.id} note count must stay fixed`);
    if (!SAFE_TRACKS.has(sourceTrack.id)) {
      assert.deepEqual(afterTrack, sourceTrack, `${sourceTrack.id} identity must remain authoritative`);
      continue;
    }
    for (let index = 0; index < sourceTrack.notes.length; index += 1) {
      const sourceNote = sourceTrack.notes[index];
      const afterNote = afterTrack.notes[index];
      assert.equal(pitchOf(afterNote), pitchOf(sourceNote), `${sourceTrack.id} pitch must not move`);
      assert.equal(startOf(afterNote), startOf(sourceNote), `${sourceTrack.id} onset must not move`);
      assert.equal(durationOf(afterNote), durationOf(sourceNote), `${sourceTrack.id} duration must not move`);
      const velocity = Number(afterNote.velocity ?? afterNote.vel);
      assert.ok(Number.isFinite(velocity) && velocity > 0 && velocity <= 127, `${sourceTrack.id} velocity must remain MIDI-safe`);
    }
  }
});

test("Phase 8B handoff markers always describe the reordered neighbors and arrivals stay on the boundary", () => {
  const { evolved } = evolvedFixture();
  const result = applyArrangementPerformance(evolved.song, { profile: "balanced" });
  assert.equal(result.changed, true);

  const transitionById = new Map(result.song.arrangementTransitions.map((transition) => [
    `${transition.fromSectionId}->${transition.toSectionId}`,
    transition,
  ]));
  const sectionById = new Map(result.song.structure.map((section) => [String(section.id), section]));
  let marked = 0;
  for (const track of result.song.tracks.filter(({ id }) => SAFE_TRACKS.has(id))) {
    for (const note of track.notes) {
      if (!note.transitionHandoffId) continue;
      marked += 1;
      const transition = transitionById.get(String(note.transitionHandoffId));
      assert.ok(transition, `stale handoff id ${note.transitionHandoffId} must be removed`);
      if (String(note.transitionHandoffRole ?? "").endsWith("-arrival")) {
        const from = sectionById.get(String(transition.fromSectionId));
        assert.ok(from);
        assert.ok(Math.abs(startOf(note) - Number(from.endBeat)) <= 1e-6, "arrival marker must land exactly on its new boundary");
      }
    }
  }
  assert.ok(marked > 0, "reordered arrangement should expose audible handoff markers");
});

test("Phase 8B remains inside the existing three-candidate critic ceiling", () => {
  const source = generateNew({
    genre: "hipHop",
    seed: "phase8b-candidate-budget-source",
    bars: 16,
    candidateCount: 1,
  });
  let candidates = [];
  let config = null;
  for (let index = 0; index < 64 && !candidates.length; index += 1) {
    config = {
      genre: "hipHop",
      bars: 16,
      seed: `phase8b-candidate-budget-${index}`,
      arrangementEvolution: true,
    };
    candidates = createArrangementCandidates(source, config, { maxCandidates: 99 });
  }

  assert.ok(candidates.length > 0);
  assert.ok(candidates.length <= MAX_ARRANGEMENT_CANDIDATES);
  for (const candidate of candidates) {
    assert.ok(candidate.performance?.profile);
    assert.equal(candidate.song.outputQualityEvolution.arrangement.audition.performanceProfile, candidate.performance.profile);
    assert.equal(candidate.song.meta.totalBeats, source.meta.totalBeats);
    assert.equal(candidate.song.tracks.reduce((sum, track) => sum + track.notes.length, 0), source.tracks.reduce((sum, track) => sum + track.notes.length, 0));
  }
});

test("Phase 8B defers audible boundary shaping for calibrated fusion songs", () => {
  const source = generateNew({
    genre: "hipHop",
    secondaryGenre: "rap",
    fusionBlend: 0.5,
    seed: "phase8b-fusion-protection-source",
    bars: 16,
    candidateCount: 1,
  });
  assert.equal(source.meta.isFusion, true);

  let candidates = [];
  for (let index = 0; index < 64 && !candidates.length; index += 1) {
    const config = {
      genre: "hipHop",
      secondaryGenre: "rap",
      fusionBlend: 0.5,
      bars: 16,
      seed: `phase8b-fusion-protection-${index}`,
      arrangementEvolution: true,
    };
    candidates = createArrangementCandidates(source, config, { maxCandidates: 99 });
  }

  assert.ok(candidates.length > 0, "fusion arrangement discovery should remain available");
  assert.ok(candidates.length <= MAX_ARRANGEMENT_CANDIDATES);
  for (const candidate of candidates) {
    assert.equal(candidate.performance?.reason, "fusion-contract-protected");
    assert.equal(candidate.performance?.changedNotes, 0);
    assert.equal(candidate.song.outputQualityEvolution.arrangement.audition.performanceChanged, false);
    assert.equal(candidate.song.outputQualityEvolution.arrangement.audition.performanceReason, "fusion-contract-protected");
  }
});


test("Track B vacuum-before-payoff creates a localized deterministic breath without moving notes", () => {
  const { evolved } = evolvedFixture();
  const before = structuredClone(evolved.song);
  const first = applyArrangementPerformance(evolved.song, { profile: "balanced", spaceStrategy: "vacuum-before-payoff" });
  const repeated = applyArrangementPerformance(evolved.song, { profile: "balanced", spaceStrategy: "vacuum-before-payoff" });

  assert.deepEqual(first, repeated, "localized vacuum must be exact-repeat deterministic");
  assert.deepEqual(evolved.song, before, "localized vacuum must remain source-immutable");
  assert.ok(first.diagnostics.vacuumNotes > 0, "qualifying payoff transitions must expose an audible pre-payoff breath");

  const payoffBoundaries = new Set(first.song.arrangementTransitions
    .filter((transition) => {
      const destination = first.song.structure.find((section) => String(section.id) === String(transition.toSectionId));
      return /^(chorus|drop|theme)$/i.test(String(destination?.name ?? destination?.type ?? ""));
    })
    .map((transition) => Number(first.song.structure.find((section) => String(section.id) === String(transition.fromSectionId))?.endBeat)));

  const vacuum = first.song.tracks.flatMap((track) => (track.notes ?? []).map((note) => ({ trackId: track.id, note })))
    .filter(({ note }) => note.arrangementPerformanceRole === "pre-payoff-vacuum");
  assert.ok(vacuum.length > 0);
  for (const { trackId, note } of vacuum) {
    assert.notEqual(trackId, "drums", "kick/snare backbone must not be consumed by the vacuum");
    const start = startOf(note);
    assert.ok([...payoffBoundaries].some((boundary) => start < boundary && start >= boundary - 1 - 1e-6),
      "vacuum edits must stay inside the final beat before a payoff");
  }

  for (const sourceTrack of before.tracks) {
    const afterTrack = first.song.tracks.find((track) => track.id === sourceTrack.id);
    assert.equal(afterTrack.notes.length, sourceTrack.notes.length);
    for (let index = 0; index < sourceTrack.notes.length; index += 1) {
      assert.equal(startOf(afterTrack.notes[index]), startOf(sourceTrack.notes[index]));
      assert.equal(durationOf(afterTrack.notes[index]), durationOf(sourceTrack.notes[index]));
      assert.equal(pitchOf(afterTrack.notes[index]), pitchOf(sourceTrack.notes[index]));
    }
  }
});
