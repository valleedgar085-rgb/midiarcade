import assert from "node:assert/strict";
import test from "node:test";
import {
  createPairwiseRows,
  matrixCases,
  runMatrixCase,
  songEventHash,
  assertPitchOnlyEditContract,
} from "../scripts/lib/generation-request-matrix.mjs";

test("request matrix covers every pair of factor levels without randomness", () => {
  const factors = { genre: ["pop", "jazz", "hipHop"], meter: ["4/4", "7/8"], count: [1, 3], depth: ["quick", "deep"] };
  const rows = createPairwiseRows(factors);
  assert.deepEqual(rows, createPairwiseRows(factors));
  const keys = Object.keys(factors);
  for (let i = 0; i < keys.length; i += 1) {
    for (let j = i + 1; j < keys.length; j += 1) {
      for (const left of factors[keys[i]]) for (const right of factors[keys[j]]) {
        assert.ok(rows.some((row) => row[keys[i]] === left && row[keys[j]] === right));
      }
    }
  }
  assert.ok(rows.length < 24, "pairwise coverage should avoid an exhaustive product");
});

test("event hashes ignore debug metadata but retain pitch, timing, programs and meter", () => {
  const song = { meta: { tempo: 120, totalBeats: 4, timeSignature: [4, 4] }, structure: [], harmony: [],
    tracks: [{ id: "melody", program: 80, notes: [{ start: 0.5, duration: 1, pitch: 60, velocity: 90 }] }] };
  const hash = songEventHash(song);
  assert.equal(hash, songEventHash({ ...song, debug: { durationMs: 800 }, title: "Renamed" }));
  for (const change of [
    (copy) => { copy.tracks[0].notes[0].pitch += 12; },
    (copy) => { copy.tracks[0].notes[0].start += 0.001; },
    (copy) => { copy.tracks[0].notes[0].duration += 0.001; },
    (copy) => { copy.tracks[0].notes[0].velocity += 1; },
    (copy) => { copy.tracks[0].program += 1; },
    (copy) => { copy.meta.timeSignature = [7, 8]; },
  ]) {
    const copy = structuredClone(song);
    change(copy);
    assert.notEqual(songEventHash(copy), hash);
  }
});

test("the matrix fails on a lying worker instead of silently exercising fallback", async () => {
  const row = matrixCases("smoke")[0];
  await assert.rejects(runMatrixCase(row, {
    workerFactory() { throw new Error("injected worker startup failure"); },
  }), /worker.*fallback/i);
});

test("pitch-only adapter contract locks rhythm, duration, velocity, structure and outside notes", () => {
  const before = { meta: { tempo: 120, totalBeats: 8, timeSignature: [4, 4] },
    structure: [{ id: "verse", startBeat: 0, endBeat: 4 }], harmony: [],
    tracks: [{ id: "melody", program: 80, notes: [
      { start: 1, duration: 0.5, pitch: 60, velocity: 90 },
      { start: 5, duration: 0.5, pitch: 60, velocity: 90 },
    ] }] };
  const selection = { trackId: "melody", sectionId: "verse" };
  const pitchOnly = structuredClone(before);
  pitchOnly.tracks[0].notes[0].pitch += 12;
  assert.doesNotThrow(() => assertPitchOnlyEditContract(before, pitchOnly, selection));
  for (const corrupt of [
    (song) => { song.tracks[0].notes[0].start += 0.01; },
    (song) => { song.tracks[0].notes[0].duration += 0.01; },
    (song) => { song.tracks[0].notes[0].velocity += 1; },
    (song) => { song.tracks[0].notes[1].pitch += 12; },
    (song) => { song.structure[0].endBeat += 1; },
  ]) {
    const copy = structuredClone(pitchOnly);
    corrupt(copy);
    assert.throws(() => assertPitchOnlyEditContract(before, copy, selection), /pitch-only/);
  }
});

test("a real unsafe Trap section option set is deterministically refused, never counted as MIDI success", async () => {
  const report = await runMatrixCase({ id: "unsafe-trap-section", kind: "sectionVariations", genre: "trap",
    bars: 8, meter: "4/4", depth: "quick", candidates: 1, controls: "auto", seed: "matrix-a" });
  assert.equal(report.passed, true);
  assert.equal(report.outcome, "refused");
  assert.equal(report.checks.workerUsed, true);
  assert.equal(report.checks.workerFallbackParity, true);
  assert.equal(report.checks.midiParity, null, "no unsafe song was exported");
  assert.deepEqual(report.songs, []);
  assert.ok(report.releaseRefusal.length > 0);
});

for (const row of matrixCases("smoke")) {
  test(`request contract: ${row.id}`, async () => {
    const report = await runMatrixCase(row);
    assert.equal(report.passed, true, JSON.stringify(report));
    assert.equal(report.checks.workerUsed, true);
    assert.equal(report.checks.repeatDeterminism, true);
    assert.equal(report.checks.workerFallbackParity, true);
    assert.equal(report.checks.sourceUnchanged, true);
    assert.equal(report.checks.midiParity, true);
    assert.match(report.songs[0]?.eventHash ?? report.sourceHash, /^sha256:[a-f0-9]{64}$/);
  });
}
