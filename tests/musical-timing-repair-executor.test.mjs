import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const executor = await readFile(new URL("../src/core/generation-executor.js", import.meta.url), "utf8");
const router = await readFile(new URL("../src/core/generation-repair-router.js", import.meta.url), "utf8");

test("musical timing repair runs after final ensemble and before final read-only audits", () => {
  const ensemble = executor.indexOf("withFinalEnsembleRefinementDiagnostics");
  const timing = executor.indexOf('import("./musical-timing-repair.js")');
  const melodyAudit = executor.indexOf("const committedMelodySectionMemory");
  assert.ok(ensemble >= 0 && timing > ensemble, "timing repair must follow final ensemble refinement");
  assert.ok(melodyAudit > timing, "final read-only audits must observe the repaired committed song");
});

test("musical timing repair is fail-closed behind mutation, authority, and release gates", () => {
  const start = executor.indexOf("let musicalTimingRepair = null");
  const end = executor.indexOf("const committedMelodySectionMemory", start);
  const stage = executor.slice(start, end);
  assert.match(stage, /auditStageMutationAuthority([sS]*?"musicalTimingRepair"/);
  assert.match(stage, /committedAuthorityRegression/);
  assert.match(stage, /evaluateSongReleaseGate/);
  assert.match(stage, /mutationAuthority\.passed/);
  assert.match(stage, /authorityRegression\.passed/);
  assert.match(stage, /committedRelease\.passed/);
});

test("musical timing repair has strict timing-only mutation authority", () => {
  assert.match(router, /musicalTimingRepair:\s*Object\.freeze\(\["timing"\]\)/);
  assert.match(router, /"musicalTimingRepair"/);
  assert.match(router, /musicalTimingRepair:\s*\["groove", "ensemble"\]/);
});
