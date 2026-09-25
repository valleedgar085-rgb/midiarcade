import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appUrl = new URL("../src/app.js", import.meta.url);
const engineUrl = new URL("../src/music-engine.js", import.meta.url);
const finalizerUrl = new URL("../src/core/generation-finalizer.js", import.meta.url);

test("generation UI has no raw-engine emergency escape hatch", async () => {
  const app = await readFile(appUrl, "utf8");
  assert.equal(app.includes("variationSongs = generateSongVariations(sourceSong, config)"), false);
  assert.equal(app.includes('candidateSong = kind === "new"'), false);
  assert.match(app, /generation authority could not produce a valid arrangement/);
});

test("final composer has one Producer Intent enforcement and one Final Assembly invocation", async () => {
  const engine = await readFile(engineUrl, "utf8");
  assert.equal(engine.includes("auditProducerIntentContract"), false);
  assert.match(engine, /function enforceProducerIntentContract/);
  assert.match(engine, /function evaluateProducerIntentContract/);

  const finalAssemblyCalls = [...engine.matchAll(/runFinalAssemblyPass\(/g)].length;
  assert.equal(
    finalAssemblyCalls,
    3,
    "one declaration plus one final invocation for fresh composition and one for targeted critic repair should remain",
  );

  const composeStart = engine.indexOf("function compose(");
  const repairStart = engine.indexOf("function finishRepairedSong(");
  const composeFinal = engine.slice(composeStart, repairStart);
  const repairedFinal = engine.slice(repairStart, engine.indexOf("function repairCandidateSong(", repairStart));

  const composeTonal = composeFinal.indexOf("const tonalIntegrityRepair = refineTonalIntegrity(");
  const composeAssembly = composeFinal.indexOf("const finalAssemblyRepair = runFinalAssemblyPass(");
  const composeReadOnly = composeFinal.indexOf("const finalProducerIntentReport = evaluateProducerIntentContract(");
  assert.ok(composeTonal >= 0 && composeTonal < composeAssembly);
  assert.ok(composeAssembly < composeReadOnly);
  assert.equal(composeFinal.slice(composeAssembly).includes("refineTonalIntegrity("), false);

  const repairedTonal = repairedFinal.indexOf("const repairedTonalIntegrity = refineTonalIntegrity(");
  const repairedPerformance = repairedFinal.indexOf('repairStrategy?.dimension === "performance"');
  const repairedAssembly = repairedFinal.indexOf("const finalAssemblyRepair = runFinalAssemblyPass(");
  const repairedReadOnly = repairedFinal.indexOf("const finalProducerIntentReport = evaluateProducerIntentContract(");
  assert.ok(repairedTonal >= 0 && repairedTonal < repairedAssembly);
  assert.ok(repairedPerformance >= 0 && repairedPerformance < repairedAssembly);
  assert.ok(repairedAssembly < repairedReadOnly);
  assert.equal(repairedFinal.slice(repairedAssembly).includes("refineTonalIntegrity("), false);
});

test("retired rhythm compatibility diagnostics stay deleted", async () => {
  const finalizer = await readFile(finalizerUrl, "utf8");
  assert.equal(finalizer.includes("retiredRhythmDiagnostic"), false);
  assert.equal(finalizer.includes("snareBounce"), false);
  assert.equal(finalizer.includes("sectionDrumEvolution"), false);
  assert.match(finalizer, /rhythmChanged:\s*false/);
});
