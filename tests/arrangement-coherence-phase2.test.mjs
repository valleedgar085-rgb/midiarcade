import assert from "node:assert/strict";
import test from "node:test";

import { createArrangementCandidates, MAX_ARRANGEMENT_CANDIDATES } from "../src/core/arrangement-candidates.js";
import { applyArrangementPerformance } from "../src/core/arrangement-performance.js";
import { generateNew } from "../src/music-engine.js";

function fixture() {
  const sections = [
    { id: "intro", name: "intro", startBeat: 0, endBeat: 8, bars: 2 },
    { id: "hook", name: "chorus", startBeat: 8, endBeat: 16, bars: 2 },
    { id: "verse", name: "verse", startBeat: 16, endBeat: 24, bars: 2 },
    { id: "outro", name: "outro", startBeat: 24, endBeat: 32, bars: 2 },
  ];
  const note = (start, pitch, velocity = 90) => ({ start, pitch, duration: 0.25, velocity });
  return {
    meta: { bars: 16, beatsPerBar: 4, totalBeats: 64 },
    structure: sections,
    tracks: [
      { id: "drums", notes: [note(7.75, 42), note(8, 36), note(8.5, 36), note(16, 36)] },
      { id: "bass", notes: [note(8.5, 45), note(16, 43)] },
      { id: "chords", notes: [note(8, 60), note(16, 60)] },
      { id: "pad", notes: [note(16, 67)] },
      { id: "melody", notes: [note(8, 75), note(16, 72)] },
    ],
    arrangementTransitions: [
      { fromSectionId: "intro", toSectionId: "hook", type: "lift", strength: 0.8, pickupBeats: 1 },
      { fromSectionId: "hook", toSectionId: "verse", type: "push", strength: 0.8, pickupBeats: 0.75 },
    ],
  };
}

test("Phase 2 handoffs support bass/kick conversation and make space after a hook, without changing note identities", () => {
  const source = fixture();
  const original = structuredClone(source);
  const result = applyArrangementPerformance(source, { profile: "balanced" });
  const repeated = applyArrangementPerformance(source, { profile: "balanced" });

  assert.deepEqual(source, original, "performance audition must not modify the source");
  assert.deepEqual(result, repeated, "musical handoff must remain exactly deterministic");
  assert.equal(result.changed, true);
  assert.equal(result.diagnostics.bassKickAccents, 1);
  assert.equal(result.diagnostics.lyricSpaceNotes, 2);

  const drums = result.song.tracks.find((track) => track.id === "drums");
  const chord = result.song.tracks.find((track) => track.id === "chords");
  const pad = result.song.tracks.find((track) => track.id === "pad");
  assert.ok(drums.notes[2].velocity > source.tracks[0].notes[2].velocity,
    "existing kick matching a bass entrance must have slightly more emphasis");
  assert.equal(drums.notes[2].arrangementPerformanceRole, "bass-kick-conversation");
  assert.ok(chord.notes[1].velocity < source.tracks[2].notes[1].velocity,
    "chords should leave room when the verse follows a hook");
  assert.ok(pad.notes[0].velocity < source.tracks[3].notes[0].velocity);
  assert.equal(chord.notes[1].arrangementPerformanceRole, "post-hook-lyrical-space");
  assert.ok(drums.notes[3].velocity >= source.tracks[0].notes[3].velocity,
    "lyrical-space shaping must not thin the drum backbone");

  for (const track of source.tracks) {
    const after = result.song.tracks.find((entry) => entry.id === track.id);
    assert.equal(after.notes.length, track.notes.length);
    for (let i = 0; i < track.notes.length; i += 1) {
      for (const field of ["start", "duration", "pitch"]) {
        assert.equal(after.notes[i][field], track.notes[i][field],
          `${track.id} ${field} must remain unchanged`);
      }
      assert.ok(after.notes[i].velocity >= 1 && after.notes[i].velocity <= 127);
    }
    if (["bass", "melody"].includes(track.id)) assert.deepEqual(after, track, "hook and bass identity are protected");
  }
});

test("kick/bass accent is withheld when there is no aligned existing bass hit", () => {
  const source = fixture();
  source.tracks.find(({ id }) => id === "bass").notes[0].start = 8.75;
  const result = applyArrangementPerformance(source, { profile: "balanced" });
  assert.equal(result.diagnostics.bassKickAccents, 0);
  const kicks = result.song.tracks.find(({ id }) => id === "drums").notes;
  assert.equal(kicks[2].velocity, source.tracks[0].notes[2].velocity);
});

test("arrangement family connects existing pre-payoff breath without extending audition budget", () => {
  const genre = "pop";
  const song = generateNew({ genre, bars: 16, candidateCount: 1, seed: "phase2-space-source" });
  let observedContextualFamily = false;
  const supported = new Set(["bridge-payoff", "slow-bloom", "double-peak"]);
  for (let seed = 0; seed < 24 && !observedContextualFamily; seed += 1) {
    const candidates = createArrangementCandidates(song, {
      genre,
      bars: 16,
      arrangementEvolution: true,
      seed: `phase2-space-${seed}`,
    });
    assert.ok(candidates.length <= MAX_ARRANGEMENT_CANDIDATES);
    for (const candidate of candidates) {
      const diagnostics = candidate.song.outputQualityEvolution?.arrangement?.audition;
      const expected = supported.has(candidate.evolution.family) ? "vacuum-before-payoff" : null;
      assert.equal(diagnostics?.performanceSpaceStrategy, expected);
      if (expected) observedContextualFamily = true;
    }
  }
  assert.equal(observedContextualFamily, true, "at least one safe contextual story must enable the existing breath");
});
