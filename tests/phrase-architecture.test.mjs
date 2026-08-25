import assert from "node:assert/strict";
import test from "node:test";

import { generateNew } from "../src/music-engine.js";
import {
  cadentialHarmonyDegree,
  phraseLandingProfile,
  phraseLandingRole,
} from "../src/core/phrase-architecture.js";
import { generationStages, generationStageState } from "../src/ui/generation-progress.js";

test("loading producer passes are informative, ordered, and bounded", () => {
  const stages = generationStages("new");
  assert.equal(stages.length, 6);
  assert.deepEqual(stages.map(({ id }) => id), ["blueprint", "harmony", "phrases", "groove", "audition", "master"]);
  assert.match(generationStages("similar")[2].copy, /familiar motif/i);
  assert.match(generationStages("songVariations")[4].copy, /six complete candidates/i);
  assert.equal(generationStageState("new", -50).stageIndex, 0);
  assert.equal(generationStageState("new", 999999).stageIndex, 5);
  assert.equal(generationStageState("new", 999999).progress, 1);
});

test("harmonic phrases form preparation, approach, and resolution paths", () => {
  const input = { cadence: "resolve", sectionBars: 8, approachDegree: 4, flavor: 0 };
  assert.equal(cadentialHarmonyDegree({ ...input, localBar: 5, currentDegree: 6 }), 1, "prepare V with ii");
  assert.equal(cadentialHarmonyDegree({ ...input, localBar: 6, currentDegree: 2 }), 4, "approach with V");
  assert.equal(cadentialHarmonyDegree({ ...input, localBar: 7, currentDegree: 5 }), 0, "resolve to tonic");
  assert.equal(cadentialHarmonyDegree({ cadence: "lift", sectionBars: 4, localBar: 3, currentDegree: 0 }), 4);
  assert.equal(cadentialHarmonyDegree({ cadence: "open", sectionBars: 4, localBar: 3, currentDegree: -1 }), 6);
});

test("phrase endings alternate questions and answers before the section cadence", () => {
  assert.equal(phraseLandingRole({ boundaryIndex: 0, boundaryCount: 3, cadence: "resolve", trackId: "melody" }), "question");
  assert.equal(phraseLandingRole({ boundaryIndex: 1, boundaryCount: 3, cadence: "resolve", trackId: "melody" }), "answer");
  assert.equal(phraseLandingRole({ boundaryIndex: 2, boundaryCount: 3, cadence: "resolve", trackId: "melody" }), "resolution");
  assert.equal(phraseLandingRole({ boundaryIndex: 0, boundaryCount: 3, cadence: "resolve", trackId: "counterpoint" }), "response");
  assert.ok(phraseLandingProfile("question").durationScale < phraseLandingProfile("answer").durationScale);
  assert.ok(phraseLandingProfile("resolution").velocityDelta > phraseLandingProfile("question").velocityDelta);
});

test("rendered songs retain audible phrase-cadence roles through final performance", () => {
  const song = generateNew({
    seed: "phrase-architecture-integration",
    genre: "popRadio",
    bars: 32,
    candidateCount: 1,
    adaptiveCandidates: false,
  });
  const melody = song.tracks.find(({ id }) => id === "melody")?.notes ?? [];
  const roles = new Set(melody.map(({ phraseCadenceRole }) => phraseCadenceRole).filter(Boolean));
  assert.ok(roles.has("question"), "lead should leave an open question inside longer sections");
  assert.ok(roles.has("answer"), "lead should answer before the final cadence");
  assert.ok(roles.has("resolution"), "lead should resolve at planned section endings");
  assert.ok(melody.some(({ phraseRole }) => phraseRole), "ensemble phrase roles must survive final rendering");
});
