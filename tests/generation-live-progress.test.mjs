import assert from "node:assert/strict";
import test from "node:test";
import { generationLiveStageState } from "../src/ui/generation-live-progress.js";
import { createGenerationExecutor } from "../src/core/generation-executor.js";
import { GENRE_PROFILES, normalizeConfig, createFusedGenreProfile } from "../src/music-engine.js";

test("loading stays on the actual composing phase even when generation takes longer", () => {
  const report = { phase: "compose", visited: ["plan", "compose"] };
  const early = generationLiveStageState("new", 100, report);
  const late = generationLiveStageState("new", 40000, report);
  assert.deepEqual(late, early);
  assert.equal(late.stage.label, "Composing");
  assert.deepEqual(late.completedStageIds, ["blueprint"]);
  assert.ok(late.progress < 1);
});

test("loading explains an actual repair and does not pretend skipped repairs happened", () => {
  const repair = generationLiveStageState("new", 1000, { phase: "repair", detail: { focusDimension: "phraseResolution" }, visited: ["plan", "compose", "diagnose", "repair"] });
  assert.match(repair.stage.copy, /phrase resolution/);
  const compare = generationLiveStageState("new", 1000, { phase: "compare", visited: ["plan", "compose", "diagnose", "compare"] });
  assert.ok(!compare.completedStageIds.includes("groove"));
  assert.equal(generationLiveStageState("new", 1000, { phase: "complete" }).progress, 1);
  assert.equal(generationLiveStageState("new", 1000, { phase: "persist" }).stage.label, "Saving");
});

test("executor reports real milestones only after the pending composition resolves", async () => {
  const events = [];
  let finish;
  const waiting = new Promise(resolve => { finish = resolve; });
  const executor = createGenerationExecutor({ fallback: () => waiting, onProgress: event => events.push(event) });
  const work = executor.run("compositionCandidate", { config: {} });
  assert.deepEqual(events.map(event => event.phase), ["plan", "compose"]);
  finish({ transaction: { validation: { valid: true } } });
  await work;
  assert.deepEqual(events.map(event => event.phase), ["plan", "compose", "diagnose", "compare", "finalize", "complete"]);
});

test("canceled work cannot advance the current loading screen", async () => {
  const events = [];
  let finish;
  const waiting = new Promise(resolve => { finish = resolve; });
  const executor = createGenerationExecutor({ fallback: () => waiting, onProgress: event => events.push(event.phase) });
  const work = executor.run("compositionCandidate", { config: {} }).catch(error => error);
  executor.dispose();
  finish({ transaction: { validation: { valid: true } } });
  assert.ok(await work instanceof Error);
  assert.deepEqual(events, ["plan", "compose"]);
});

test("standalone Neo Soul is clearly labeled and does not activate a second genre", () => {
  const config = normalizeConfig({ genre: "neoSoul", secondaryGenre: "" });
  assert.equal(config.genre, "neoSoul");
  assert.equal(config.secondaryGenre, null);
  assert.equal(GENRE_PROFILES.neoSoul.label, "Neo Soul");
  assert.equal(createFusedGenreProfile("neoSoul", ""), GENRE_PROFILES.neoSoul);
  const blend = createFusedGenreProfile("neoSoul", "rnbSoul");
  assert.equal(blend.secondaryGenre, "rnbSoul");
});
