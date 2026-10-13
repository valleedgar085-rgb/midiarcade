import fs from "node:fs";
import { previewDrumCharacter, bundledDrumSamplePath, drumSampleForPitch } from "../src/core/preview-drums.js";
import assert from "node:assert/strict";
import test from "node:test";
import { generateNew, evaluateSongCandidate, evaluateSongReleaseGate, encodeMidiVerified } from "../src/music-engine.js";
import { resolvePerformedNote } from "../src/core/performed-note-contract.js";
import { applyOutputQualityEvolution } from "../src/core/output-quality-evolution.js";
import { applySongOutputQualityPipeline } from "../src/core/output-quality-pipeline-register.js";
import { auditStageMutationAuthority } from "../src/core/mutation-authority.js";
import { authorizeQualityStage } from "../src/core/generation-repair-router.js";
import { analyzeJazzStructuralGroove, createJazzStructuralVariationCandidates, applyJazzStructuralVariationRefinement } from "../src/core/jazz-structural-variation.js";
const enabled = { jazzStructuralVariationRefinement: true };
function fixture() {
  const notes = [];
  for (let bar = 0; bar < 8; bar++) {
    for (const offset of [0, 0.75, 1, 1.75, 2, 2.75, 3, 3.75]) {
      notes.push({ pitch: 51, start: bar * 4 + offset + 0.002 * (bar % 3), duration: 0.06, velocity: 75 });
    }
    notes.push({ pitch: 36, start: bar * 4, duration: 0.1, velocity: 80 });
    notes.push({ pitch: 38, start: bar * 4 + 1, duration: 0.1, velocity: 85 });
  }
  notes.push({ pitch: 53, start: 0.25, duration: 0.06, velocity: 70 });
  return { genre: "jazz", meta: { bars: 8, beatsPerBar: 4 },
    structure: [{ startBeat: 0, endBeat: 32 }],
    tracks: [{ id: "drums", notes }, { id: "bass", notes: [{ pitch: 36, start: 0, duration: 1, velocity: 75 }] }] };
}
function exactScope(before, after) {
  assert.deepEqual(after.tracks.slice(1), before.tracks.slice(1));
  const source = before.tracks[0].notes, target = after.tracks[0].notes;
  assert.equal(source.length, target.length);
  const changed = [];
  source.forEach((note, index) => {
    if (note.pitch !== target[index].pitch) {
      assert.equal(note.pitch, 51); assert.equal(target[index].pitch, 53);
      assert.deepEqual({ ...target[index], pitch: note.pitch }, note);
      changed.push(index);
    } else assert.deepEqual(target[index], note);
  });
  assert.equal(changed.length, 2);
  assert.equal(new Set(changed.map((index) => Math.floor(source[index].start / 4))).size, 1);
  assert.equal(auditStageMutationAuthority(before, after, "jazzStructuralVariationRefinement").passed, true);
}
const evaluation = () => ({ score: 90, subscores: { groove: 80, drumVariety: 75 }, diagnostics: { scaleFit: 1 } });

test("timing-tolerant observation detects repeated ride structure without quantizing notes", () => {
  const song = fixture(), snapshot = structuredClone(song);
  const before = analyzeJazzStructuralGroove(song);
  assert.equal(before.cells, 16); assert.equal(before.uniqueCells, 2);
  const candidates = createJazzStructuralVariationCandidates(song);
  assert.equal(candidates.length, 3);
  assert.deepEqual(candidates, createJazzStructuralVariationCandidates(song));
  for (const candidate of candidates) {
    exactScope(song, candidate.song);
    assert.equal(candidate.after.repeatedCells, before.repeatedCells - 1);
    assert.ok(candidate.targetBar > 0 && candidate.targetBar < 7);
    assert.ok(candidate.song.tracks[0].notes.every((note) => !note.jazzMemoryGlobalRecall));
  }
  assert.deepEqual(song, snapshot);
});

test("opt-in is literal, genre and meter bounded, specialist ownership is enforced", () => {
  const song = fixture();
  for (const value of [undefined, false, 1, "true"]) {
    const result = applyJazzStructuralVariationRefinement(song, { jazzStructuralVariationRefinement: value });
    assert.equal(result.song, song); assert.equal(result.diagnostics.reason, "disabled");
  }
  for (const owner of ["groove", "phrase", "harmony", "register"]) {
    assert.equal(authorizeQualityStage("jazzStructuralVariationRefinement", { allowsSurgicalPostprocess: true, mutationOwner: owner }).allowed, false);
  }
  assert.equal(authorizeQualityStage("jazzStructuralVariationRefinement", { allowsSurgicalPostprocess: true, mutationOwner: "ensemble" }).allowed, true);
  assert.deepEqual(createJazzStructuralVariationCandidates({ ...song, genre: "house" }), []);
  song.meta.beatsPerBar = 3;
  assert.deepEqual(createJazzStructuralVariationCandidates(song), []);
});

test("fills, anchors, finalized performed notes, and memory roles are protected", () => {
  for (const key of ["drumFillId", "transitionFeature", "ensembleAccent", "phraseAnchor", "memoryRole", "jazzMemoryPocketRecall", "performed", "renderedMidiPitch"]) {
    const song = fixture();
    song.tracks[0].notes.forEach((note) => { note[key] = key === "renderedMidiPitch" ? note.pitch : true; });
    assert.deepEqual(createJazzStructuralVariationCandidates(song), [], key);
  }
  const noBell = fixture();
  noBell.tracks[0].notes = noBell.tracks[0].notes.filter((note) => note.pitch !== 53);
  assert.deepEqual(createJazzStructuralVariationCandidates(noBell), []);
  const noMap = fixture(); noMap.structure = [];
  assert.deepEqual(createJazzStructuralVariationCandidates(noMap), []);
});

test("release, critic, missing-score and scale vetoes return the original song", () => {
  for (const [evaluate, release] of [
    [evaluation, () => ({ passed: false })],
    [(song) => ({ ...evaluation(), score: song.tracks[0].notes.filter(n => n.pitch === 53).length > 1 ? 89 : 90 }), () => ({ passed: true })],
    [() => ({ ...evaluation(), diagnostics: { scaleFit: 0.9 } }), () => ({ passed: true })],
    [() => ({ ...evaluation(), score: NaN }), () => ({ passed: true })],
    [() => ({ ...evaluation(), subscores: {} }), () => ({ passed: true })],
  ]) {
    const song = fixture(), snapshot = structuredClone(song);
    const result = applyJazzStructuralVariationRefinement(song, enabled, evaluate, release);
    assert.equal(result.song, song); assert.equal(result.diagnostics.accepted, false);
    assert.deepEqual(song, snapshot);
  }
});

test("real Jazz seeds retain defaults, critic floors, deterministic output and preview/export note authority", () => {
  const measurements = [];
  for (const seed of ["quality-lab-01:jazz", "quality-lab-02:jazz", "quality-lab-03:jazz"]) {
    const config = applyOutputQualityEvolution({ genre: "jazz", seed, bars: 16, candidateCount: 1 }, { kind: "new" });
    assert.notEqual(config.jazzStructuralVariationRefinement, true);
    assert.equal(config.genreIdentityRefinement, false);
    const source = generateNew(config), snapshot = structuredClone(source);
    const baseline = applySongOutputQualityPipeline(structuredClone(source), config);
    const disabled = applySongOutputQualityPipeline(structuredClone(source), { ...config, jazzStructuralVariationRefinement: false });
    assert.deepEqual(disabled, baseline);
    assert.equal(baseline.jazzStructuralVariationDiagnostics, undefined);
    const result = applySongOutputQualityPipeline(structuredClone(source), { ...config, ...enabled });
    assert.deepEqual(result, applySongOutputQualityPipeline(structuredClone(source), { ...config, ...enabled }));
    assert.equal(result.jazzStructuralVariationDiagnostics.accepted, true, JSON.stringify(result.jazzStructuralVariationDiagnostics));
    exactScope(baseline.song, result.song);
    const before = evaluateSongCandidate(baseline.song), after = evaluateSongCandidate(result.song);
    for (const [key, value] of Object.entries(before.subscores)) assert.ok(after.subscores[key] >= value, key);
    assert.equal(evaluateSongReleaseGate(result.song, after).passed, true);
    assert.equal(after.diagnostics.scaleFit, 1);
    const exported = encodeMidiVerified(result.song);
    assert.equal(exported.audit.passed, true);
    assert.deepEqual(exported.bytes, encodeMidiVerified(result.song).bytes);
    const exportedDrums = exported.projection.tracks.find(t => t.id === "drums").notes;
    const actual = result.song.tracks.find(t => t.id === "drums").notes;
    for (let i = 0; i < actual.length; i++) {
      if (actual[i].pitch !== baseline.song.tracks.find(t => t.id === "drums").notes[i].pitch) {
        const preview = resolvePerformedNote(actual[i]);
        assert.equal(preview.pitch, 53);
        assert.ok(exportedDrums.some(n => n.pitch === preview.pitch && n.onTick === Math.round(preview.start * exported.projection.ppq)));
      }
    }
    assert.deepEqual(source, snapshot);
    measurements.push({ seed, before: result.jazzStructuralVariationDiagnostics.structuralBefore,
      after: result.jazzStructuralVariationDiagnostics.structuralAfter, beforeVariety: before.subscores.drumVariety, afterVariety: after.subscores.drumVariety });
  }
  console.info("JAZZ_STRUCTURAL_VARIATION", JSON.stringify(measurements));
});


test("GM ride bell uses cymbal preview, never a snare sample", () => {
  const kit = { cymbalFilter: 6000, cymbalDecay: 0.5, snareFilter: 2000, snareDecay: 0.2 };
  const ride = previewDrumCharacter(kit, 51, 90, 0);
  const bell = previewDrumCharacter(kit, 53, 90, 0);
  assert.equal(bell.kind, "cymbal");
  assert.ok(bell.filterFrequency > ride.filterFrequency);
  assert.ok(bell.duration < ride.duration);
  for (const id of ["basement-knock", "dusty-tape"]) {
    assert.equal(bundledDrumSamplePath(id, 53), null);
    assert.equal(drumSampleForPitch(new Map([[`${id}:snare`, {}]]), id, 53), null);
  }
});


test("actual preview scheduler routes ride bell through cymbal filtering without a snare oscillator", () => {
  const source = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
  const start = source.indexOf("    const source = context.createBufferSource();", source.indexOf("    const tomFrequencies ="));
  const stop = source.indexOf("\n  restartLoopPlayback()", start);
  const body = source.slice(start, stop).replace(/\n  }\s*$/, "");
  const scheduled = new Function("context", "event", "character", "kit", "voice", "mixGain", "when", "clamp", body);
  const filters = [];
  const node = () => ({ connect() { return this; }, start() {}, stop() {} });
  const context = { createBufferSource: node, createGain: () => ({ ...node(), gain: {} }),
    createBiquadFilter: () => { const filter = { ...node(), frequency: {}, Q: {} }; filters.push(filter); return filter; },
    createOscillator: () => assert.fail("bell must not create the snare body oscillator") };
  const receiver = { noiseBufferForKit() {}, createDrumOutput: node, shapeDrumGain() {}, registerScheduledVoice() {} };
  const character = previewDrumCharacter({ cymbalFilter: 6000, cymbalDecay: 0.5 }, 53, 90);
  scheduled.call(receiver, context, { pitch: 53 }, character, {}, {}, 1, 0, (v, lo, hi) => Math.min(hi, Math.max(lo, v)));
  assert.equal(filters.length, 1); assert.equal(filters[0].type, "highpass");
  assert.equal(filters[0].frequency.value, character.filterFrequency);
});
