import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { Worker } from "node:worker_threads";
import { createGenerationExecutor } from "../../src/core/generation-executor.js";
import { createGenerationRunner } from "../../src/core/generation-runner.js";
import { createAppGenerationFallback } from "../../src/core/app-generation-fallback.js";
import { prepareMidiExport } from "../../src/core/export-profile.js";
import { resolvePerformedNote } from "../../src/core/performed-note-contract.js";
import { CANONICAL_SONG_AUTHORITY_KEYS } from "../../src/core/canonical-song-state.js";
import { encodeMidiVerified, generateNew, generateSimilar, generateSectionVariations, GENRE_PROFILES } from "../../src/music-engine.js";

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
  return value;
}

export function songEventHash(song) {
  // No title, critic score, wall-clock timing or stale receipt can hide/mimic
  // a musical change. Preserve sub-tick timing and note multiplicity.
  const state = {
    meta: Object.fromEntries(["tempo", "timeSignature", "totalBeats", "beatsPerBar", "key", "keyPc", "scale", "ppq"].map((key) => [key, song?.meta?.[key]])),
    structure: song?.structure,
    harmony: song?.harmony,
    tracks: song?.tracks?.map((track) => ({
      id: track.id, channel: track.channel, program: track.program, settings: track.settings,
      automation: track.automation,
      notes: track.notes.map((note) => ({ ...note, performed: resolvePerformedNote(note) })),
    })),
  };
  return `sha256:${createHash("sha256").update(JSON.stringify(stable(state))).digest("hex")}`;
}

/** Integration assertion for pitch-only model adapters. It grants no permission
 * to edit notes; existing tonal/register and acceptance gates still apply.
 */
export function assertPitchOnlyEditContract(before, after, { trackId, sectionId }) {
  const section = before.structure.find((item) => item.id === sectionId);
  assert.ok(section && before.tracks.some((track) => track.id === trackId), "pitch-only selection must exist");
  for (const key of CANONICAL_SONG_AUTHORITY_KEYS) assert.deepEqual(after[key], before[key], `pitch-only authority: ${key}`);
  for (const key of ["tempo", "timeSignature", "bars", "totalBeats", "beatsPerBar", "ppq", "keyPc", "scale", "scaleIntervals"]) {
    assert.deepEqual(after.meta[key], before.meta[key], `pitch-only meta: ${key}`);
  }
  const view = (song) => song.tracks.map((track, trackIndex) => ({ ...track, notes: track.notes.map((note, index) => {
    const source = before.tracks[trackIndex]?.notes[index];
    const performed = resolvePerformedNote(source);
    const editable = track.id === trackId && source
      && performed.start >= section.startBeat && performed.start + performed.duration <= section.endBeat;
    if (!editable) return note;
    const result = structuredClone(note);
    for (const key of ["pitch", "note", "midi", "renderedMidiPitch", "semanticPitch"]) delete result[key];
    if (result.performed) delete result.performed.renderedMidiPitch;
    if (result.canonical) delete result.canonical.renderedMidiPitch;
    return result;
  }) }));
  assert.deepEqual(view(after), view(before), "pitch-only edit changed protected note data or scope");
}

export function createPairwiseRows(factors) {
  const entries = Object.entries(factors);
  if (!entries.length || entries.some(([, values]) => !Array.isArray(values) || !values.length)) throw new TypeError("Matrix factors require nonempty level arrays");
  let candidates = [{}];
  for (const [key, values] of entries) candidates = candidates.flatMap((row) => values.map((value) => ({ ...row, [key]: value })));
  const pairsFor = (row) => entries.flatMap(([key], i) => entries.slice(i + 1).map(([other]) => JSON.stringify([key, row[key], other, row[other]])));
  if (entries.length === 1) return candidates;
  const indexed = candidates.map((row) => ({ row, pairs: pairsFor(row) }));
  const uncovered = new Set(indexed.flatMap(({ pairs }) => pairs));
  const selected = [];
  while (uncovered.size) {
    let best = null;
    let bestGain = 0;
    for (const entry of indexed) {
      const gain = entry.pairs.reduce((sum, pair) => sum + Number(uncovered.has(pair)), 0);
      if (gain > bestGain) { best = entry; bestGain = gain; }
    }
    assert.ok(best, "Every uncovered pair must have a covering row");
    selected.push(best.row);
    for (const pair of best.pairs) uncovered.delete(pair);
  }
  return selected;
}

export function matrixCases(profile = "smoke") {
  const base = { genre: "pop", bars: 8, meter: "4/4", depth: "quick", candidates: 1, controls: "auto", seed: "matrix-a" };
  if (profile === "smoke") return [
    { kind: "new" },
    { kind: "new", genre: "jazz", meter: "7/8", controls: "manual" },
    { kind: "similar", genre: "hipHop", meter: "5/8" },
    { kind: "songVariations" },
    { kind: "compositionCandidate", genre: "hipHop", bars: 16 },
    { kind: "sectionVariations", meter: "9/8" },
  ].map((row, index) => ({ ...base, ...row, id: `smoke-${index + 1}-${row.kind}` }));
  if (profile !== "pairwise") throw new TypeError(`Unknown matrix profile: ${profile}`);
  return createPairwiseRows({
    kind: ["new", "similar", "songVariations", "compositionCandidate", "sectionVariations"],
    genre: Object.keys(GENRE_PROFILES),
    bars: [8, 16], meter: ["4/4", "5/8", "7/8", "9/8"],
    depth: ["quick", "deep"], candidates: [1, 3], controls: ["auto", "manual"], seed: ["matrix-a", "matrix-b"],
  }).map((row, index) => ({ ...row, id: `pairwise-${index + 1}-${row.kind}-${row.genre}` }));
}

function realWorkerFactory() {
  const worker = new Worker(new URL("./generation-matrix-worker.mjs", import.meta.url), { execArgv: [] });
  return {
    addEventListener(type, callback) {
      worker.on(type, type === "message" ? (data) => callback({ data }) : callback);
    },
    postMessage(value) { worker.postMessage(value); },
    terminate() { void worker.terminate(); },
  };
}

function fallback() {
  return createAppGenerationFallback({ generationRunner: createGenerationRunner({ generateNew, generateSimilar }) });
}

function configFor(row) {
  const manual = row.controls === "manual" ? {
    energy: 0.64, complexity: 0.55, humanize: 0.2,
    tracks: { bass: { density: 0.6, velocity: 1.1 }, melody: { density: 0.5, gate: 0.7 } },
  } : {};
  return { ...manual, genre: row.genre, bars: row.bars, seed: row.seed,
    timeSignature: row.meter.split("/").map(Number), thinkingDepth: row.depth,
    candidateCount: row.candidates, maxCandidateCount: row.candidates,
    adaptiveCandidates: false, candidatesPerVariation: 1 };
}

function resultSongs(result) {
  if (result.song) return [result.song];
  if (Array.isArray(result.variations)) return result.variations;
  if (Array.isArray(result.options)) return result.options;
  return result.transaction?.validation?.valid ? [result.transaction.after] : [];
}

function resultSnapshot(result) {
  return { status: result.status, songs: resultSongs(result).map(songEventHash),
    refusal: result.refusal,
    validation: result.transaction?.validation,
    rejectedCandidateHash: result.transaction ? songEventHash(result.transaction.after) : null };
}

const UNSAFE_SECTION_SET = "Section variation generation did not produce a complete release-safe option set.";

async function captureOutcome(executor, kind, payload) {
  try { return await executor.run(kind, payload); }
  catch (error) {
    // This one explicit application policy is a valid refusal, not a successful
    // song. All other errors remain failures, including worker startup faults.
    if (kind === "sectionVariations" && error.message === UNSAFE_SECTION_SET) return { status: "refused", refusal: error.message };
    throw error;
  }
}

function verifyScopedResult(result, payload) {
  const { sourceSong } = payload;
  if (result.transaction) {
    const { transaction } = result;
    assert.equal(result.status, transaction.validation.valid ? "candidate" : "rejected");
    assert.deepEqual(transaction.before, sourceSong);
    assert.ok(transaction.selfCorrection.attemptCount >= 1 && transaction.selfCorrection.attemptCount <= 3);
    for (const key of CANONICAL_SONG_AUTHORITY_KEYS) assert.deepEqual(transaction.after[key], sourceSong[key], `scoped authority: ${key}`);
    const range = sourceSong.structure.find((section) => section.id === transaction.selection.sectionId);
    for (const track of sourceSong.tracks) {
      const after = transaction.after.tracks.find((item) => item.id === track.id);
      if (track.id !== transaction.selection.trackId) assert.deepEqual(after, track, `untargeted ${track.id}`);
      else {
        const outside = (note) => note.start < range.startBeat || note.start + note.duration > range.endBeat;
        assert.deepEqual(after.notes.filter(outside), track.notes.filter(outside), "boundary-crossing and outside notes");
      }
    }
    if (!transaction.validation.valid) assert.ok(transaction.validation.issues.length, "rejections need a real reason");
  }
  if (result.options) {
    assert.equal(result.options.length, 3, "section option set must be complete");
    const range = sourceSong.structure.find((section) => section.id === payload.sectionId);
    const outside = (note) => note.start < range.startBeat - 1e-6 || note.start >= range.endBeat - 1e-6;
    for (const song of result.options) {
      assert.equal(song.sectionVariation.releasePassed, true);
      assert.deepEqual(song.structure, sourceSong.structure);
      for (const track of sourceSong.tracks) {
        const after = song.tracks.find((item) => item.id === track.id);
        if (payload.input.lockedTrackIds.includes(track.id)) assert.deepEqual(after, track, `locked ${track.id}`);
        else assert.deepEqual(after.notes.filter(outside), track.notes.filter(outside), `outside ${track.id}`);
      }
    }
  }
  if (result.variations) assert.equal(result.variations.length, 3, "song option set must be complete");
}

function verifyExports(song) {
  let exportsChecked = 0;
  for (const timing of ["performance", "tight"]) for (const profile of ["full", "selected"]) {
    const prepared = prepareMidiExport(song, { timing, profile, selectedTrackId: "melody" });
    const encoded = encodeMidiVerified(prepared.song, prepared.options);
    assert.equal(encoded.audit.passed, true);
    assert.deepEqual(encoded.bytes, encodeMidiVerified(prepared.song, prepared.options).bytes);
    exportsChecked += 1;
  }
  // Live Mix routing is independent of the profile: muted/soloed lanes stay
  // named shells rather than disappearing or leaking into the exported audio.
  for (const mode of ["mute", "solo"]) {
    const mixed = structuredClone(song);
    mixed.tracks[0].settings = { ...mixed.tracks[0].settings, [mode]: true };
    const exported = encodeMidiVerified(mixed);
    for (const track of exported.projection.tracks) {
      if (mode === "mute" ? track.id === mixed.tracks[0].id : track.id !== mixed.tracks[0].id) assert.equal(track.notes.length, 0);
    }
    exportsChecked += 1;
  }
  return exportsChecked;
}

export async function runMatrixCase(row, { workerFactory = realWorkerFactory, replay = null } = {}) {
  const config = configFor(row);
  const sourceSong = row.kind === "new" ? null : generateNew({ ...config, seed: `${row.seed}:source`, candidateCount: 1, maxCandidateCount: 1 });
  const sectionId = sourceSong?.structure.find((section) => section.name === "verse")?.id ?? sourceSong?.structure[0]?.id;
  const payload = replay ?? {
    ...(sourceSong ? { sourceSong } : {}), config,
    ...(row.kind === "compositionCandidate" ? { selection: { target: "section-track", sectionId, trackId: "melody" }, input: config } : {}),
    ...(row.kind === "sectionVariations" ? { sectionId, input: { ...config, count: 3, lockedTrackIds: ["drums", "bass"] } } : {}),
  };
  const before = structuredClone(payload);
  let fallbackCalls = 0;
  const workerReplies = [];
  const runFallback = fallback();
  const makeWorkerExecutor = () => createGenerationExecutor({
    workerFactory() {
      const transport = workerFactory();
      return { ...transport, addEventListener(type, callback) {
        transport.addEventListener(type, type === "message" ? (event) => { workerReplies.push(event.data); callback(event); } : callback);
      } };
    },
    fallback(...args) { fallbackCalls += 1; return runFallback(...args); },
  });
  const worker = makeWorkerExecutor();
  let repeatWorker = worker;
  const local = createGenerationExecutor({ fallback: fallback() });
  try {
    const firstRequest = structuredClone(payload);
    const repeatRequest = structuredClone(payload);
    const fallbackRequest = structuredClone(payload);
    const first = await captureOutcome(worker, row.kind, firstRequest);
    const refused = first.status === "refused";
    assert.ok(refused
      ? workerReplies.length === 1 && workerReplies[0].ok === false && workerReplies[0].error === first.refusal && fallbackCalls === 1
      : worker.usingWorker && fallbackCalls === 0, "Real worker failed or silently used fallback");
    // An application error makes the executor retire its worker. Re-probe the
    // refused request in a fresh real worker rather than testing its backoff.
    if (refused) repeatWorker = makeWorkerExecutor();
    const repeated = await captureOutcome(repeatWorker, row.kind, repeatRequest);
    const synchronous = await captureOutcome(local, row.kind, fallbackRequest);
    assert.ok(refused
      ? workerReplies.length === 2 && workerReplies[1].ok === false && workerReplies[1].error === first.refusal && fallbackCalls === 2
      : worker.usingWorker && fallbackCalls === 0, "Repeat worker failed or silently used fallback");
    assert.deepEqual(resultSnapshot(first), resultSnapshot(repeated), "same-seed repeated result drift");
    assert.deepEqual(resultSnapshot(first), resultSnapshot(synchronous), "worker/fallback result drift");
    assert.deepEqual(payload, before, "request/source mutation");
    for (const request of [firstRequest, repeatRequest, fallbackRequest]) assert.deepEqual(request, before, "executor mutated the caller's request/source");
    verifyScopedResult(first, payload);
    let releaseRefusal = null;
    if (refused) {
      const options = generateSectionVariations(payload.sourceSong, payload.sectionId, payload.input);
      releaseRefusal = options.filter((song) => song.sectionVariation.releasePassed !== true)
        .map((song) => ({ option: song.sectionVariation.option, failures: song.sectionVariation.releaseFailures }));
      assert.ok(releaseRefusal.length, "a release refusal must be backed by an actually unsafe option");
      assert.deepEqual(payload, before, "refusal diagnosis must leave source/request untouched");
    }
    const songs = resultSongs(first);
    if (row.kind !== "compositionCandidate" && !refused) assert.ok(songs.length, "committed request must contain music");
    const songReports = songs.map((song) => {
      const original = structuredClone(song);
      const exportsChecked = verifyExports(song);
      assert.deepEqual(song, original, "export preparation mutated the accepted song");
      return { seed: song.seed, eventHash: songEventHash(song), exportsChecked,
        meter: song.meta.timeSignature, score: song.meta.scoreDetails?.totalScore,
        releasePassed: song.meta.scoreDetails?.releaseGate?.passed ?? null };
    });
    return { id: row.id, request: row, passed: true, outcome: first.status,
      rejectionIssues: first.transaction?.validation?.issues ?? [], releaseRefusal,
      checks: { workerUsed: true, repeatDeterminism: true, workerFallbackParity: true, sourceUnchanged: true, midiParity: songs.length ? true : null },
      sourceHash: payload.sourceSong ? songEventHash(payload.sourceSong) : null, songs: songReports };
  } catch (error) {
    error.replay = { row, payload };
    throw error;
  } finally { worker.dispose(); if (repeatWorker !== worker) repeatWorker.dispose(); local.dispose(); }
}
