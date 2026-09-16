import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const producerBrain = fs.readFileSync(new URL("../src/core/producer-brain.js", import.meta.url), "utf8");

test("Phase 9E keeps ordinary requests composition-neutral until Creative Range is explicit", () => {
  const buildConfig = app.match(/export function buildConfig[\s\S]*?const GENERATION_SETTING_IDS/)?.[0] ?? "";
  assert.match(buildConfig, /\.\.\.\(creativeRange \? \{ creativeRange \} : \{\}\)/);
  assert.doesNotMatch(buildConfig, /creativeRange:\s*["'](?:familiar|fresh|wild)["']/);
  assert.match(producerBrain, /explicitRange[\s\S]*?creativeGenomeSteering === true/);
});

test("Phase 9E does not alter existing Creative Genome strength calibration", () => {
  const steering = fs.readFileSync(new URL("../src/core/creative-genome-steering.js", import.meta.url), "utf8");
  assert.match(steering, /familiar:\s*0\.55/);
  assert.match(steering, /fresh:\s*1/);
  assert.match(steering, /wild:\s*1\.28/);
});
