// Phase 3 permanent regression coverage for groove intelligence and compatibility contracts.
import test from "node:test";
import assert from "node:assert/strict";
import {
  evaluateSongCandidate,
  evaluateSongReleaseGate,
  generateNew,
  generateSimilar,
} from "../src/music-engine.js";

const TARGET_GENRES = ["rnbSoul", "techno", "trap", "drumBass", "reggaeton", "afrobeats"];
const GROOVE_MEMORY_GENRES = [...TARGET_GENRES, "house"];

function drumSignature(song) {
  const drums = song.tracks.find((track) => track.id === "drums")?.notes ?? [];
  return drums.map(({ pitch, start, velocity }) => [pitch, start, velocity]);
}

function criticBarSignatures(song) {
  const drums = song.tracks.find((track) => track.id === "drums")?.notes ?? [];
  const barBeats = song.meta?.beatsPerBar ?? 4;
  return Array.from({ length: song.bars }, (_, bar) => drums
    .filter((note) => Math.floor(note.start / barBeats) === bar)
    .map((note) => `${note.pitch}:${Math.round((((note.start % barBeats) + barBeats) % barBeats + Number.EPSILON) * 1e6) / 1e6}`)
    .join("|"));
}

function beatPhase(value) {
  return ((value % 1) + 1) % 1;
}

function phaseDelta(left, right) {
  const difference = Math.abs(left - right);
  return Math.min(difference, 1 - difference);
}

test("phase 3 groove intelligence is deterministic and develops authored Groove DNA lanes", () => {
  for (const genre of TARGET_GENRES) {
    const options = { genre, seed: `phase3-groove-test:${genre}`, bars: 16, candidateCount: 1 };
    const first = generateNew(options);
    const second = generateNew(options);
    assert.deepEqual(drumSignature(first), drumSignature(second), `${genre} drums must remain deterministic`);

    const plans = first.grooveConductor?.bars ?? [];
    const drums = first.tracks.find((track) => track.id === "drums")?.notes ?? [];
    assert.equal(plans.length, first.bars, `${genre} needs one shared Groove DNA plan per bar`);
    assert.ok(plans.every((bar) => bar.grooveDNA?.grammarId), `${genre} must name its active rhythm grammar`);
    assert.ok(new Set(criticBarSignatures(first).filter(Boolean)).size >= 8, `${genre} must vary its authored bars`);
    assert.ok(drums.length <= first.bars * 32, `${genre} drum density must stay bounded`);
    assert.ok(drums.every((note) => note.velocity >= 1 && note.velocity <= 120));
    assert.ok(drums.some((note) => String(note.grooveSource ?? "").startsWith(`${plans[0].grooveDNA.grammarId}.`)));
  }
});

test("phase 3 target genres keep a healthy drum-variety floor without weakening critic validity", () => {
  for (const genre of TARGET_GENRES) {
    const song = generateNew({ genre, seed: `phase3-quality-test:${genre}`, bars: 16, candidateCount: 1 });
    const evaluation = evaluateSongCandidate(song);
    assert.ok(evaluation.subscores.drumVariety >= 72, `${genre} drum variety fell to ${evaluation.subscores.drumVariety}`);
    assert.ok(Number.isFinite(evaluation.score) && evaluation.score > 0);
  }
});

test("phase 3 groove memory preserves transition contracts and avoids adjacent clone bars", () => {
  for (const genre of GROOVE_MEMORY_GENRES) {
    const song = generateNew({ genre, seed: `quality-lab-01:${genre}`, bars: 16, candidateCount: 1 });
    const evaluation = evaluateSongCandidate(song);
    const release = evaluateSongReleaseGate(song, evaluation);
    const drums = song.tracks.find((track) => track.id === "drums")?.notes ?? [];
    const memories = song.songBlueprint?.memoryMap ?? [];
    const signatures = criticBarSignatures(song);
    const adjacentCopies = signatures.slice(1).filter((signature, index) => signature && signatures[index] && signature === signatures[index]);

    assert.ok(memories.length > 0, `${genre} should keep the blueprint's section-memory map`);
    assert.ok(memories.every((memory) => (
      song.structure.some((section) => section.id === memory.sectionId)
      && song.structure.some((section) => section.id === memory.originSectionId)
    )), `${genre} memory links must point to real source and return sections`);
    assert.ok(song.grooveConductor.bars.every((bar) => bar.grooveDNA?.grammarId), `${genre} recall must keep Groove DNA as timing authority`);
    assert.equal(adjacentCopies.length, 0, `${genre} must not create adjacent cloned drum bars`);
    assert.deepEqual(song.finalAssembly?.checks, {
      sectionCoverage: true,
      featuredLaneCoverage: true,
      transitionCoverage: true,
    }, `${genre} final assembly safety must remain complete`);
    assert.equal(release.passed, true, `${genre} must remain release-safe after groove-memory recall`);
  }
});

test("targeted Similar drum rerolls preserve the retained Trap bass contract through critic repair", () => {
  const current = generateNew({
    genre: "trap",
    scale: "harmonicMinor",
    seed: "phase3-targeted-base",
    bars: 8,
    density: 0.8,
    variation: 0.58,
    humanize: 0,
  });
  const bass = current.tracks.find((track) => track.id === "bass");
  assert.ok(bass?.notes.length);

  const rerolled = generateSimilar(current, {
    seed: "phase3-targeted-drums",
    targetTrack: "drums",
    contextTracks: { bass },
  });
  const kicks = rerolled.tracks.find((track) => track.id === "drums")?.notes
    .filter((note) => note.pitch === 36) ?? [];
  const interaction = bass.notes.filter((note) => kicks.some((kick) => (
    phaseDelta(beatPhase(note.start), beatPhase(kick.start)) <= 0.250001
  ))).length / bass.notes.length;

  assert.ok(interaction >= 0.85, `retained bass interaction fell to ${interaction}`);
});

test("phase 3 clone detection preserves empty bar positions", () => {
  const song = {
    bars: 3,
    meta: { beatsPerBar: 4 },
    tracks: [{
      id: "drums",
      notes: [
        { pitch: 36, start: 0 },
        { pitch: 36, start: 8 },
      ],
    }],
  };
  const signatures = criticBarSignatures(song);
  assert.deepEqual(signatures, ["36:0", "", "36:0"]);
  const adjacentCopies = signatures.slice(1).filter((signature, index) => (
    signature && signatures[index] && signature === signatures[index]
  ));
  assert.equal(adjacentCopies.length, 0);
});

test("phase 3 reports the post-groove final rhythm lock", () => {
  const song = generateNew({
    genre: "techno",
    seed: "phase3-final-rhythm-lock-report",
    bars: 16,
    candidateCount: 1,
  });
  assert.deepEqual(
    song.finalMaster?.repairs?.finalRhythmLock,
    song.finalRhythmLock?.repairs,
    "final master diagnostics must describe the same post-groove lock exposed by the song",
  );
});

test("groove conductor never reserves negative space on an authored motif attack", () => {
  const song = generateNew({
    genre: "pop",
    seed: "motif-space-contract",
    bars: 24,
    candidateCount: 1,
    professionalUpgrade: true,
    complexity: 0.78,
    variation: 0.72,
  });
  const barBeats = song.meta?.beatsPerBar ?? 4;
  const mod = (value, divisor) => ((value % divisor) + divisor) % divisor;

  for (const barPlan of song.grooveConductor?.bars ?? []) {
    const section = song.structure.find((entry) => entry.id === barPlan.sectionId);
    const assignment = song.motifs?.sectionAssignments?.find((entry) => entry.sectionId === barPlan.sectionId);
    const motif = song.motifs?.family?.[assignment?.motifId ?? "A"]?.melody;
    if (!section || !motif?.events?.length) continue;

    const motifBars = Math.max(1, Math.ceil((motif.lengthBeats ?? barBeats) / barBeats));
    const motifBar = mod(barPlan.bar - section.startBar, motifBars);
    const motifPulses = motif.events
      .filter((event) => Math.floor(Number(event.offset ?? 0) / barBeats) === motifBar)
      .map((event) => mod(Number(event.offset ?? 0), barBeats));

    for (const pulse of motifPulses) {
      assert.equal(
        (barPlan.spaces ?? []).some((space) => Math.abs(space - pulse) < 0.01),
        false,
        `bar ${barPlan.bar} must not mark motif pulse ${pulse} as negative space`,
      );
    }
  }
});

test("pocket cohesion reports conductor-lane coordination separately from transient fallback", () => {
  const song = generateNew({
    genre: "techno",
    seed: "conductor-pocket-report",
    bars: 16,
    candidateCount: 1,
    professionalUpgrade: true,
    humanize: 0.28,
  });
  assert.equal(song.pocketCohesion?.version, 2);
  assert.ok(song.pocketCohesion?.conductorAlignedNotes >= 0);
  assert.ok(song.pocketCohesion?.transientFallbackAlignments >= 0);
  assert.equal(
    song.pocketCohesion.alignedNotes,
    song.pocketCohesion.conductorAlignedNotes + song.pocketCohesion.transientFallbackAlignments,
  );
});