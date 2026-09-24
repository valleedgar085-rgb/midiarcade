import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const engineUrl = new URL("../src/music-engine.js", import.meta.url);
const finalizerUrl = new URL("../src/core/generation-finalizer.js", import.meta.url);

test("Groove DNA is the sole structural rhythm authority", async () => {
  const [engine, finalizer] = await Promise.all([
    readFile(engineUrl, "utf8"),
    readFile(finalizerUrl, "utf8"),
  ]);

  for (const retired of [
    "function genreKickOffsets(",
    "function genreSnareOffsets(",
    "function developDuplicateDrumBars(",
    "function reinforceGrooveMemory(",
    "function applyFinalGrooveMemory(",
    "function lockFinalBassToSurvivingKicks(",
    "function finalBassRelationshipProfile(",
    "function fitDrumsToRetainedBass(",
    "applySnareBounceRefinement",
    "applySectionDrumEvolutionRefinement",
  ]) {
    assert.equal(engine.includes(retired) || finalizer.includes(retired), false, `retired rhythm authority returned: ${retired}`);
  }

  assert.match(engine, /grooveDNAConductorLanes\(grooveDNA, bar\)/);
  assert.match(engine, /"bassPulses"/);
  assert.match(engine, /"leadPulses"/);
  assert.match(finalizer, /rhythmAuthority:\s*"groove-dna"/);
});

test("post-generation finalization does not import drum composers", async () => {
  const finalizer = await readFile(finalizerUrl, "utf8");
  assert.equal(finalizer.includes("snare-bounce-refinement"), false);
  assert.equal(finalizer.includes("section-drum-evolution-refinement"), false);
});
