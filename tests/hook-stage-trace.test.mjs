import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { generateNew, setCompositionStageTap } from "../src/music-engine.js";
import { evaluateChorusHookRecurrence } from "../src/core/chorus-hook-recurrence.js";
import {
  lastComposeRun, stagesForCommittedSong, summarizeStageTraces, traceHookStages,
} from "../scripts/lib/hook-stage-trace.mjs";

const PITCHES = [60, 62, 65, 64, 67, 65, 69, 67];
const STARTS = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5];
const phrase = (beat, pitches = PITCHES, starts = STARTS) => pitches.map((pitch, index) => ({
  start: beat + starts[index], pitch, duration: 0.35, velocity: 90,
}));
const DRIFTED_PITCHES = [60, 69, 62, 67, 60, 71, 62, 72];
const DRIFTED_STARTS = [0.5, 1.0, 3.0, 3.25, 5.0, 5.75, 6.0, 7.75];

function songWith(returnNotes) {
  return {
    genre: "pop",
    meta: { beatsPerBar: 4, tempo: 110 },
    structure: [
      { id: "chorus-1", name: "chorus", startBeat: 0, endBeat: 8, bars: 2 },
      { id: "verse-1", name: "verse", startBeat: 8, endBeat: 16, bars: 2 },
      { id: "chorus-2", name: "chorus", startBeat: 16, endBeat: 24, bars: 2 },
    ],
    tracks: [{ id: "melody", notes: [...phrase(0), ...returnNotes] }],
  };
}
const snapshot = (returnNotes) => [...phrase(0), ...returnNotes];

test("fixtures: the drifted return is weak and the faithful return is strong", () => {
  assert.ok(evaluateChorusHookRecurrence(songWith(phrase(16))).score >= 66);
  assert.ok(evaluateChorusHookRecurrence(songWith(phrase(16, DRIFTED_PITCHES, DRIFTED_STARTS))).score < 66);
});

test("a hook that is faithful until one stage breaks it is attributed to that stage", () => {
  const drifted = phrase(16, DRIFTED_PITCHES, DRIFTED_STARTS);
  const trace = traceHookStages(songWith(drifted), [
    { stage: "generateLead", notes: snapshot(phrase(16)) },
    { stage: "ensemble", notes: snapshot(phrase(16)) },
    { stage: "orchestration", notes: snapshot(drifted) },
    { stage: "mix", notes: snapshot(drifted) },
  ]);
  assert.equal(trace.status, "evaluated");
  const entry = trace.returns[0];
  assert.equal(entry.diagnosis, "degraded-after-composition");
  assert.equal(entry.firstWeakStage, "orchestration");
  assert.equal(entry.biggestDrop.stage, "orchestration");
  assert.ok(entry.biggestDrop.delta < -0.3);
  assert.equal(trace.postSelectionChangedMelody, false);
});

test("a hook that is already weak out of composition is born weak, not degraded", () => {
  const drifted = phrase(16, DRIFTED_PITCHES, DRIFTED_STARTS);
  const trace = traceHookStages(songWith(drifted), [
    { stage: "generateLead", notes: snapshot(drifted) },
    { stage: "mix", notes: snapshot(drifted) },
  ]);
  assert.equal(trace.returns[0].diagnosis, "born-weak-at-composition");
  assert.equal(trace.returns[0].biggestDrop, null);
});

test("a stage that repairs the hook is reported as helping, and a strong final is strong", () => {
  const drifted = phrase(16, DRIFTED_PITCHES, DRIFTED_STARTS);
  const trace = traceHookStages(songWith(phrase(16)), [
    { stage: "generateLead", notes: snapshot(drifted) },
    { stage: "musicalMemory", notes: snapshot(phrase(16)) },
  ]);
  assert.equal(trace.returns[0].diagnosis, "strong");
  const summary = summarizeStageTraces([{ status: "evaluated", returns: trace.returns, postSelectionChangedMelody: false }]);
  const memory = summary.stageImpact.find((row) => row.stage === "musicalMemory");
  assert.equal(memory.helped, 1);
  assert.equal(memory.harmed, 0);
});

test("post-selection edits are flagged when the last stage differs from the committed melody", () => {
  const edited = phrase(16);
  edited[3].pitch += 2;
  const trace = traceHookStages(songWith(edited), [
    { stage: "generateLead", notes: snapshot(phrase(16)) },
  ], { finalStage: "criticRepair+commit" });
  assert.equal(trace.postSelectionChangedMelody, true);
  assert.equal(trace.returns[0].steps.at(-1).stage, "criticRepair+commit");
});

test("an unevaluable song is unavailable, never a failure", () => {
  const single = songWith(phrase(16));
  single.structure = single.structure.slice(0, 2);
  const trace = traceHookStages(single, [{ stage: "generateLead", notes: snapshot([]) }]);
  assert.equal(trace.status, "unavailable");
  assert.deepEqual(trace.returns, []);
});

test("tracing does not mutate the song or the stage snapshots", () => {
  const drifted = phrase(16, DRIFTED_PITCHES, DRIFTED_STARTS);
  const song = songWith(drifted);
  const stages = [{ stage: "generateLead", notes: snapshot(phrase(16)) }, { stage: "mix", notes: snapshot(drifted) }];
  const before = JSON.stringify([song, stages]);
  traceHookStages(song, stages);
  assert.equal(JSON.stringify([song, stages]), before);
});

test("only the last compose run of a seed is traced", () => {
  const run = lastComposeRun([
    { stage: "generateLead", notes: [1] }, { stage: "mix", notes: [1] },
    { stage: "generateLead", notes: [2] }, { stage: "mix", notes: [2] },
  ]);
  assert.deepEqual(run.map((entry) => entry.notes[0]), [2, 2]);
});

test("a repaired committed song resolves to its composed root, following repair chains", () => {
  const stage = (tag) => [{ stage: "generateLead", notes: [tag] }];
  const bySeed = new Map([["s:new:0:a", stage("c0")], ["s:new:1:b", stage("c1")], ["s:new:2:c", stage("c2")]]);
  assert.equal(stagesForCommittedSong({ seed: "s:new:1:b" }, bySeed).stages[0].notes[0], "c1");
  const direct = stagesForCommittedSong({ seed: "s:repair:0:x", criticRepair: { sourceCandidate: 2 } }, bySeed);
  assert.equal(direct.stages[0].notes[0], "c2");
  assert.equal(direct.finalStage, "criticRepair+commit");
  // candidate 3 is repair attempt 1 (from candidate 0); the committed song repairs candidate 3.
  const chained = stagesForCommittedSong({
    seed: "s:repair:1:y",
    criticRepair: { sourceCandidate: 3, acceptanceHistory: [{ attempt: 1, sourceCandidate: 0 }] },
  }, bySeed);
  assert.equal(chained.stages[0].notes[0], "c0");
  assert.deepEqual(stagesForCommittedSong({ seed: "unknown" }, bySeed).stages, []);
});

test("the composition stage tap observes without changing generated notes", () => {
  const config = {
    genre: "pop", key: "E", scale: "minor", bars: 16, seed: "stage-tap-parity",
    energy: 0.68, complexity: 0.62, variation: 0.62, evolution: 0.68, swing: 0.14, humanize: 0.12,
  };
  const digest = (song) => createHash("sha256").update(JSON.stringify(song.tracks)).digest("hex");
  const plain = generateNew(config);

  const seen = new Map();
  const previous = setCompositionStageTap((name, notes, seed) => {
    if (!seen.has(seed)) seen.set(seed, []);
    seen.get(seed).push({ name, notes });
  });
  let tapped;
  try {
    tapped = generateNew(config);
  } finally {
    setCompositionStageTap(previous);
  }
  assert.equal(digest(tapped), digest(plain));
  assert.ok(seen.size >= 1);
  for (const run of seen.values()) {
    assert.equal(run[0].name, "generateLead");
    assert.equal(run.at(-1).name, "candidateAssemblyRepair");
    assert.ok(run.every((entry) => entry.notes.every((note) => Number.isFinite(note.pitch))));
  }
  // Restoring the previous tap leaves nothing attached for later generation.
  assert.equal(previous, null);
  assert.equal(setCompositionStageTap(null), null);
});
