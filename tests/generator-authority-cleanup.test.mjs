import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appUrl = new URL("../src/app.js", import.meta.url);
const engineUrl = new URL("../src/music-engine.js", import.meta.url);
const finalizerUrl = new URL("../src/core/generation-finalizer.js", import.meta.url);
const pipelineUrl = new URL("../src/core/output-quality-pipeline.js", import.meta.url);

test("generation UI has no raw-engine emergency escape hatch", async () => {
  const app = await readFile(appUrl, "utf8");
  assert.equal(app.includes("variationSongs = generateSongVariations(sourceSong, config)"), false);
  assert.equal(app.includes('candidateSong = kind === "new"'), false);
  assert.equal(app.includes("generateSectionVariations("), false);
  assert.match(app, /generation authority could not produce a valid arrangement/);
  assert.match(app, /generation authority returned an incomplete section variation set/);
});

test("candidate repair and committed Final Assembly have one-way authority ordering", async () => {
  const engine = await readFile(engineUrl, "utf8");
  assert.equal(engine.includes("auditProducerIntentContract"), false);
  assert.match(engine, /function enforceProducerIntentContract/);
  assert.match(engine, /function evaluateProducerIntentContract/);

  const finalAssemblyCalls = [...engine.matchAll(/runFinalAssemblyPass\(/g)].length;
  assert.equal(
    finalAssemblyCalls,
    2,
    "only the declaration and the single committed Final Assembly invocation should remain",
  );

  const composeStart = engine.indexOf("function compose(");
  const repairStart = engine.indexOf("function finishRepairedSong(");
  const commitStart = engine.indexOf("function commitCandidate(");
  const composeFinal = engine.slice(composeStart, repairStart);
  const repairedFinal = engine.slice(repairStart, engine.indexOf("function repairCandidateSong(", repairStart));
  const committedFinal = engine.slice(commitStart, engine.indexOf("function candidateSelectionScore(", commitStart));

  const composeTonal = composeFinal.indexOf("const tonalIntegrityRepair = refineTonalIntegrity(");
  const composeAssembly = composeFinal.indexOf("const finalAssemblyRepair = runCandidateAssemblyRepair(");
  const composeReadOnly = composeFinal.indexOf("const finalProducerIntentReport = evaluateProducerIntentContract(");
  assert.ok(composeTonal >= 0 && composeTonal < composeAssembly);
  assert.ok(composeAssembly < composeReadOnly);
  assert.equal(composeFinal.includes("runFinalAssemblyPass("), false);

  const repairedTonal = repairedFinal.indexOf("const repairedTonalIntegrity = refineTonalIntegrity(");
  const repairedPerformance = repairedFinal.indexOf('repairStrategy?.dimension === "performance"');
  const repairedAssembly = repairedFinal.indexOf("const finalAssemblyRepair = runCandidateAssemblyRepair(");
  const repairedReadOnly = repairedFinal.indexOf("const finalProducerIntentReport = evaluateProducerIntentContract(");
  assert.ok(repairedTonal >= 0 && repairedTonal < repairedAssembly);
  assert.ok(repairedPerformance >= 0 && repairedPerformance < repairedAssembly);
  assert.ok(repairedAssembly < repairedReadOnly);
  assert.equal(repairedFinal.includes("runFinalAssemblyPass("), false);

  const sectionCompletion = committedFinal.indexOf("const committedSectionCompletion = applySectionCompletionAuthority(");
  const registerRepair = committedFinal.indexOf("const committedRegister = refineRoleRegisters(");
  const finalAssembly = committedFinal.indexOf("const committedFinalAssembly = runFinalAssemblyPass(");
  const authorityRefresh = committedFinal.indexOf("refreshCommittedGenerationDiagnostics(selected.song)");
  assert.ok(sectionCompletion >= 0 && sectionCompletion < registerRepair);
  assert.ok(registerRepair < finalAssembly);
  assert.ok(finalAssembly < authorityRefresh);
  const afterFinalAssembly = committedFinal.slice(finalAssembly);
  assert.equal(afterFinalAssembly.includes("applySectionCompletionAuthority("), false);
  assert.equal(afterFinalAssembly.includes("refineRoleRegisters("), false);
  assert.equal(afterFinalAssembly.includes("refineTonalIntegrity("), false);
});

test("retired rhythm compatibility diagnostics stay deleted", async () => {
  const finalizer = await readFile(finalizerUrl, "utf8");
  assert.equal(finalizer.includes("retiredRhythmDiagnostic"), false);
  assert.equal(finalizer.includes("snareBounce"), false);
  assert.equal(finalizer.includes("sectionDrumEvolution"), false);
  assert.match(finalizer, /rhythmChanged:\s*false/);
});


test("base output quality module defines stages but cannot orchestrate a second pipeline", async () => {
  const pipeline = await readFile(pipelineUrl, "utf8");
  assert.match(pipeline, /export function createBaseOutputQualityStages/);
  assert.equal(pipeline.includes("export function applySongOutputQualityPipeline"), false);
  assert.equal(pipeline.includes("export function applyResultOutputQualityPipeline"), false);
});
