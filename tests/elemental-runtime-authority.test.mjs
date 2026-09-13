import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
const producerSource = await readFile(new URL("../src/core/producer-variation-set.js", import.meta.url), "utf8");
const createCss = await readFile(new URL("../src/ui/create-workflow.css", import.meta.url), "utf8");

test("Auto elemental programs survive track-settings sync while manual program authority still wins", () => {
  assert.match(appSource, /if \(!isTrackProgramAuto\(id\) \|\| !Number\.isFinite\(Number\(track\.program\)\)\)\s*track\.program = settings\.program;/);
  assert.match(appSource, /generatedOrManualTrackSetting\(id, "cutoff"/);
  assert.match(appSource, /generatedOrManualTrackSetting\(id, "reverb"/);
  assert.match(appSource, /generatedOrManualTrackSetting\(id, "gate"/);
  assert.doesNotMatch(appSource, /\n\s*track\.program = settings\.program;\n\s*track\.settings = \{/);
});

test("preview playback keeps generated elemental tone for Auto controls but honors explicit test/manual settings", () => {
  assert.match(appSource, /const useRuntimeAuthority = settingsById === state\.trackSettings;/);
  assert.match(appSource, /for \(const key of AUTO_TRACK_RANGE_KEYS\)/);
  assert.match(appSource, /delete effectiveUiSettings\[key\]/);
  assert.match(appSource, /const settings = \{ \.\.\.defaults, \.\.\.generatedSettings, \.\.\.effectiveUiSettings \};/);
});

test("producer variations apply the audible element profile before selection", () => {
  assert.match(producerSource, /applyElementSoundProfile/);
  assert.match(producerSource, /applyElementSoundProfile\(generateSimilar\(current, config\), direction\.id, intensity\)/);
});

test("Fire Electric and Drip have distinct display typography and element-specific surfaces", () => {
  for (const element of ["fire", "electric", "drip"]) {
    assert.match(createCss, new RegExp(`data-element=["']${element}["']`));
  }
  assert.match(createCss, /\.song-variation-options button b\s*\{[\s\S]*?font-family:\s*var\(--font-display\)/);
  assert.match(createCss, /data-element="electric"[\s\S]*?font-style:\s*italic/);
  assert.match(createCss, /data-element="fire"[\s\S]*?font-weight:\s*900/);
  assert.match(createCss, /data-element="drip"[\s\S]*?letter-spacing:/);
});
