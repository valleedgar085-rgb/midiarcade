import assert from "node:assert/strict";
import test from "node:test";
import { TRAP_REFERENCE_PACK_ID, shapeHardTrapMotif } from "../src/core/trap-reference-profile.js";
import { createGrooveDNA, grooveDNAConductorLanes, validateGrooveDNA } from "../src/core/groove-intelligence.js";
import { createSpecialistDirectorPlan } from "../src/core/specialist-musicians.js";
import { createSeededRandom, generateNew, generateSimilar, normalizeConfig, evaluateSongReleaseGate } from "../src/music-engine.js";
import { runGenerationRequest } from "../src/core/generation-api.js";

const CONFIG = {
  seed: "trap-reference-proof", genre: "trap", tempo: 144, bars: 32,
  professionalUpgrade: true, sectionPacing: "roomier",
  trapReferencePack: TRAP_REFERENCE_PACK_ID, candidateCount: 1, targetedRepair: false,
  manualGenerationControls: { variation: 0.42, evolution: 0.58, surprise: 0.28 },
};
const STRUCTURE = [{ id: "verse-1", name: "verse", startBar: 0, bars: 16 }];

test("Trap references are explicit, solo-genre authority and leave manual values intact", () => {
  const config = normalizeConfig({ ...CONFIG, variation: 0.99, evolution: 0.99, surprise: 0.99 });
  assert.equal(config.trapReferencePack, TRAP_REFERENCE_PACK_ID);
  assert.equal(config.tempo, 144);
  for (const [key, value] of Object.entries(CONFIG.manualGenerationControls)) assert.equal(config[key], value);
  for (const input of [{ genre: "pop" }, { genre: "hipHop" }, { secondaryGenre: "hipHop" }, { professionalUpgrade: false }, { trapReferencePack: "unknown" }]) {
    assert.equal(normalizeConfig({ ...CONFIG, ...input }).trapReferencePack, undefined);
  }
});

test("Trap uses recurring kick/808 pockets and reserves exact hat bursts for turnarounds", () => {
  let burstBars = 0;
  for (let seed = 0; seed < 12; seed += 1) {
    const input = { seed, genre: "trap", bars: 16, beatsPerBar: 4, complexity: 0.62, variation: 0.85, tripletAmount: 1, trapReferenceEnabled: true, trapReferencePack: TRAP_REFERENCE_PACK_ID };
    const dna = createGrooveDNA(input, { structure: STRUCTURE });
    assert.equal(validateGrooveDNA(dna).passed, true);
    assert.deepEqual(createGrooveDNA(input, { structure: STRUCTURE }), dna);
    assert.equal(dna.referencePack, TRAP_REFERENCE_PACK_ID);
    assert.equal(dna.relationships.bass.lock, 1);
    for (const [left, right] of [[0, 2], [0, 4], [1, 5], [2, 6]]) {
      assert.deepEqual(dna.bars[left].kick.steps, dna.bars[right].kick.steps);
      assert.deepEqual(dna.bars[left].snare.steps, dna.bars[right].snare.steps);
    }
    for (const bar of dna.bars) {
      assert.deepEqual(bar.snare.steps, [8], "keep one clear half-time snare");
      assert.ok(bar.kick.steps.every((step) => bar.relationships.bass.steps.includes(step)), "the bass receives every kick anchor");
      const fractional = bar.hat.steps.filter((step) => Math.abs(step - Math.round(step)) > 0.01);
      if (fractional.length) {
        burstBars += 1;
        assert.equal(bar.bar % 4, 3, "triplets punctuate a four-bar answer");
      }
    }
    const straight = createGrooveDNA({ ...input, tripletAmount: 0 }, { structure: STRUCTURE });
    assert.ok(straight.bars.every((bar) => bar.hat.steps.every((step) => Number.isInteger(step))), "triplets off remains a hard request");
  }
  assert.ok(burstBars > 0, "the profile must actually produce its exact subdivisions");
  const offsetStructure = [{ id: "intro", name: "intro", startBar: 0, bars: 5 }, { id: "verse", name: "verse", startBar: 5, bars: 15 }];
  for (let seed = 0; seed < 12; seed += 1) {
    const dna = createGrooveDNA({ seed, genre: "trap", bars: 20, beatsPerBar: 4, tripletAmount: 1, trapReferenceEnabled: true, trapReferencePack: TRAP_REFERENCE_PACK_ID }, { structure: offsetStructure });
    for (const bar of dna.bars.filter((entry) => entry.sectionId === "verse")) {
      if (bar.hat.steps.some((step) => Math.abs(step - Math.round(step)) > 0.01)) assert.equal((bar.bar - 5) % 4, 3, "turnarounds follow the section's phrase clock");
    }
  }
});

test("the original Trap loop has a recurring small contour and a breath at each bar end", () => {
  const source = { lengthBeats: 8, events: [0, 2, 4, 6].map((degree, index) => ({ degree, offset: index * 2, duration: 1 })) };
  for (const beats of [3, 4, 6]) for (let seed = 0; seed < 12; seed += 1) {
    const motif = shapeHardTrapMotif({ ...source, lengthBeats: beats * 2 }, beats, createSeededRandom(seed));
    assert.equal(motif.events.length, 6);
    for (let index = 0; index < 2; index += 1) {
      assert.equal(motif.events[index + 3].degree, motif.events[index].degree);
      assert.equal(motif.events[index + 3].offset - motif.events[index].offset, beats);
    }
    assert.ok(motif.events.every((event) => event.duration > 0));
    assert.ok(Math.max(...motif.events.map((event) => event.degree)) - Math.min(...motif.events.map((event) => event.degree)) <= 2);
    for (let bar = 0; bar < 2; bar += 1) {
      const end = Math.max(...motif.events.slice(bar * 3, bar * 3 + 3).map((event) => event.offset + event.duration));
      assert.ok((bar + 1) * beats - end >= beats * 0.12);
    }
  }
  assert.equal(source.events[0].duration, 1);
});

test("generated Trap keeps root-weighted bass, gradual intro, scale safety and release gates", () => {
  for (const tempo of [144, 162]) for (const seed of ["trap-reference-proof", "trap-reference-two", "trap-reference-three"]) {
    const input = { ...CONFIG, seed, tempo };
    const song = generateNew(input);
    assert.deepEqual(generateNew(input), song);
    assert.equal(song.settings.trapReferencePack, TRAP_REFERENCE_PACK_ID);
    assert.equal(song.grooveConductor.grooveDNA.referencePack, TRAP_REFERENCE_PACK_ID);
    assert.equal(song.meta.bars, 44);
    assert.ok(song.structure[0].bars >= 6);
    assert.equal(song.motifs.melody.lengthBeats, 8);
    assert.equal(song.style.chordMotion, "sustained");
    assert.equal(song.style.drumGroove, "halfTime");
    assert.equal(evaluateSongReleaseGate(song).passed, true, `${seed} at ${tempo} BPM`);
    for (const [key, value] of Object.entries(CONFIG.manualGenerationControls)) assert.equal(song.settings[key], value);
    const bass = song.tracks.find((track) => track.id === "bass").notes;
    assert.ok(bass.length >= 44 * 2, "a usable bass statement/reply must survive orchestration");
    const rootNotes = bass.filter((note) => {
      const chord = song.harmony.find((event) => note.start >= event.start - 0.04 && note.start < event.start + event.duration - 0.04);
      return chord && ((note.pitch % 12) + 12) % 12 === chord.rootPc;
    });
    assert.ok(rootNotes.length / bass.length >= 0.65, "808 stays grounded instead of wandering through upper chord tones");
    for (const track of song.tracks) for (const note of track.notes) {
      assert.ok(note.start >= 0 && note.start + note.duration <= song.meta.totalBeats + 0.01);
      if (track.id !== "drums") assert.ok(song.meta.scaleIntervals.includes(((note.pitch - song.meta.keyPc) % 12 + 12) % 12));
    }
    const plan = createSpecialistDirectorPlan(song);
    assert.equal(plan.grooveDNA.referencePack, TRAP_REFERENCE_PACK_ID);
    for (const bar of song.grooveConductor.bars) {
      const lanes = grooveDNAConductorLanes(plan.grooveDNA, bar.bar);
      for (const lane of ["anchors", "snarePulses", "hatPulses", "percussionPulses", "bassPulses", "chordPulses", "leadPulses"]) assert.deepEqual([...lanes[lane]], bar[lane]);
    }
  }
});

test("worker-facing generation and similar requests preserve the Trap reference contract", () => {
  const result = runGenerationRequest("new", { config: CONFIG });
  assert.equal(result.song.settings.trapReferencePack, TRAP_REFERENCE_PACK_ID);
  assert.equal(evaluateSongReleaseGate(result.song).passed, true);
  const similar = generateSimilar(result.song, { ...CONFIG, seed: "trap-reference-similar" });
  assert.equal(similar.meta.bars, 44);
  assert.equal(similar.grooveConductor.grooveDNA.referencePack, TRAP_REFERENCE_PACK_ID);
  assert.equal(similar.style.chordMotion, "sustained");
  for (const [key, value] of Object.entries(CONFIG.manualGenerationControls)) assert.equal(similar.settings[key], value);
  const muted = generateNew({ ...CONFIG, tracks: { bass: { density: 0 }, melody: { density: 0 } } });
  assert.equal(muted.tracks.find((track) => track.id === "bass").notes.length, 0);
  assert.equal(muted.tracks.find((track) => track.id === "melody").notes.length, 0);
  const committedMuted = runGenerationRequest("new", { config: { ...CONFIG, tracks: { bass: { density: 0 }, melody: { density: 0 } } } }).song;
  assert.equal(committedMuted.tracks.find((track) => track.id === "bass").notes.length, 0);
  assert.equal(committedMuted.tracks.find((track) => track.id === "melody").notes.length, 0);
});
