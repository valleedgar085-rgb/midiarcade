import assert from "node:assert/strict";
import test from "node:test";
import { POP_REFERENCE_PACK_ID, shapeGroovyPopMotif } from "../src/core/pop-reference-profile.js";
import { createGrooveDNA, grooveDNAConductorLanes, validateGrooveDNA } from "../src/core/groove-intelligence.js";
import { createSpecialistDirectorPlan } from "../src/core/specialist-musicians.js";
import { createSeededRandom, generateNew, generateSimilar, normalizeConfig, evaluateSongReleaseGate } from "../src/music-engine.js";
import { createGenerationExecutor } from "../src/core/generation-executor.js";

const CONFIG = {
  seed: "pop-reference-proof", genre: "pop", tempo: 118, bars: 32,
  sectionPacing: "roomier", professionalUpgrade: true,
  popReferencePack: POP_REFERENCE_PACK_ID, candidateCount: 1, targetedRepair: false,
  manualGenerationControls: { variation: 0.42, evolution: 0.58, surprise: 0.28 },
};

test("the reference profile requires solo Pop authority and preserves manual controls", () => {
  const config = normalizeConfig({ ...CONFIG, variation: 0.99, evolution: 0.99, surprise: 0.99 });
  assert.equal(config.popReferencePack, POP_REFERENCE_PACK_ID);
  for (const [key, value] of Object.entries(CONFIG.manualGenerationControls)) assert.equal(config[key], value);
  for (const input of [{ genre: "techno" }, { secondaryGenre: "techno" }, { professionalUpgrade: false }, { popReferencePack: "unknown" }]) {
    assert.equal(normalizeConfig({ ...CONFIG, ...input }).popReferencePack, undefined);
  }
});

test("original Pop phrase cells repeat a gesture and leave an audible breath in each bar", () => {
  const motif = { lengthBeats: 8, events: [0, 1, 2, 3, 4, 5, 6, 7].map((degree) => ({ degree, offset: degree, duration: 0.9, accent: 0.8 })) };
  for (const beats of [3, 4, 6]) for (let seed = 0; seed < 12; seed += 1) {
    const source = { ...motif, lengthBeats: beats * 2 };
    const first = shapeGroovyPopMotif(source, beats, createSeededRandom(seed));
    assert.deepEqual(shapeGroovyPopMotif(source, beats, createSeededRandom(seed)), first);
    assert.equal(first.events.length, 8);
    assert.equal(first.lengthBeats, beats * 2);
    for (let index = 0; index < 3; index += 1) {
      assert.equal(first.events[index + 4].degree, first.events[index].degree);
      assert.equal(first.events[index + 4].offset - first.events[index].offset, beats);
    }
    for (let bar = 0; bar < 2; bar += 1) {
      const notes = first.events.slice(bar * 4, bar * 4 + 4);
      const end = Math.max(...notes.map((event) => event.offset + event.duration));
      assert.ok((bar + 1) * beats - end >= beats * 0.15);
      assert.ok(notes.every((event) => event.duration > 0));
    }
  }
  assert.equal(motif.events[0].duration, 0.9, "the source motif is immutable");
});

test("Pop reference rhythm keeps the same pocket until the four-bar turnaround", () => {
  const structure = [{ id: "verse-1", name: "verse", startBar: 0, bars: 8 }];
  for (const tempo of [89, 118]) {
    const dna = createGrooveDNA({ ...CONFIG, tempo, bars: 8, beatsPerBar: 4, popReferenceEnabled: true, variation: 0.9 }, { structure });
    assert.equal(dna.referencePack, POP_REFERENCE_PACK_ID);
    assert.equal(validateGrooveDNA(dna).passed, true);
    for (const [left, right] of [[0, 2], [0, 4], [1, 5], [2, 6]]) {
      for (const lane of ["kick", "snare", "hat", "percussion"]) assert.deepEqual(dna.bars[left][lane].steps, dna.bars[right][lane].steps);
      assert.deepEqual(dna.bars[left].relationships, dna.bars[right].relationships);
    }
    assert.ok(dna.bars.every((bar) => bar.snare.steps.includes(4) && bar.snare.steps.includes(12)));
  }
});

test("generated Pop retains the references, longer intro, scale safety and release quality", () => {
  for (const tempo of [89, 118]) for (const seed of ["pop-reference-proof", "arcade-muon7xva-1-i7snhi", "reference-three"]) {
    const config = { ...CONFIG, seed, tempo };
    const song = generateNew(config);
    assert.equal(song.settings.popReferencePack, POP_REFERENCE_PACK_ID);
    assert.equal(song.meta.bars, 44);
    assert.ok(song.structure[0].bars >= 6);
    assert.equal(song.motifs.melody.lengthBeats, 8);
    assert.equal(song.style.drumGroove, "backbeat");
    assert.equal(song.style.bassGroove, "syncopated");
    assert.equal(song.style.chordMotion, "offbeat");
    assert.deepEqual(generateNew(config), song);
    assert.equal(evaluateSongReleaseGate(song).passed, true, `${seed} at ${tempo} BPM`);
    for (const [key, value] of Object.entries(CONFIG.manualGenerationControls)) assert.equal(song.settings[key], value);
    for (const track of song.tracks) for (const note of track.notes) {
      assert.ok(note.start >= 0 && note.start + note.duration <= song.meta.totalBeats + 0.01);
      if (track.id !== "drums") assert.ok(song.meta.scaleIntervals.includes(((note.pitch - song.meta.keyPc) % 12 + 12) % 12));
    }
    const plan = createSpecialistDirectorPlan(song);
    assert.equal(plan.grooveDNA.referencePack, POP_REFERENCE_PACK_ID);
    for (const bar of song.grooveConductor.bars) {
      const lanes = grooveDNAConductorLanes(plan.grooveDNA, bar.bar);
      for (const lane of ["anchors", "snarePulses", "hatPulses", "percussionPulses", "bassPulses", "chordPulses", "leadPulses"]) {
        assert.deepEqual([...lanes[lane]], bar[lane], `repairs must hear the source ${lane} at bar ${bar.bar}`);
      }
    }
  }
});

test("similar generations and committed quality preserve the Pop reference authority", async () => {
  const song = generateNew(CONFIG);
  const similar = generateSimilar(song, { ...CONFIG, seed: "reference-similar" });
  assert.equal(similar.meta.bars, 44);
  assert.equal(similar.settings.popReferencePack, POP_REFERENCE_PACK_ID);
  assert.equal(similar.grooveConductor.grooveDNA.referencePack, POP_REFERENCE_PACK_ID);
  assert.equal(similar.style.chordMotion, "offbeat");
  const executor = createGenerationExecutor({ fallback: (_kind, payload) => ({ status: "committed", song: generateNew(payload.config) }) });
  const result = await executor.run("new", { config: CONFIG });
  assert.equal(result.song.settings.popReferencePack, POP_REFERENCE_PACK_ID);
  assert.equal(result.song.grooveConductor.grooveDNA.referencePack, POP_REFERENCE_PACK_ID);
  assert.equal(evaluateSongReleaseGate(result.song).passed, true);
  for (const [key, value] of Object.entries(CONFIG.manualGenerationControls)) assert.equal(result.song.settings[key], value);
  executor.dispose();
});
