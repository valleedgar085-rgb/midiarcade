import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  generationMinimumVisibleMs,
  generationStageState,
} from "../src/ui/generation-progress.js";

const css = fs.readFileSync(new URL("../src/ui/generation-experience.css", import.meta.url), "utf8");
const build = fs.readFileSync(new URL("../scripts/build.js", import.meta.url), "utf8");
const quality = fs.readFileSync(new URL("../scripts/check-build-quality.js", import.meta.url), "utf8");

test("Producer Brain loading uses a readable steady timing contract", () => {
  assert.ok(generationMinimumVisibleMs("new") >= 3000);
  assert.ok(generationMinimumVisibleMs("similar") >= 2800);
  assert.ok(generationMinimumVisibleMs("songVariations") >= 4000);
  const early = generationStageState("new", 160);
  const middle = generationStageState("new", 1600);
  const late = generationStageState("new", 999999);
  assert.ok(middle.progress > early.progress);
  assert.equal(late.progress, 0.96, "live progress must reserve 100% for the completion/fade frame");
});

test("generation overlay freezes expensive ambience and landscape removes unstable blur layers", () => {
  assert.match(css, /body\[aria-busy="true"\] \.ambient[\s\S]*?animation-play-state:\s*paused\s*!important/);
  assert.match(css, /@media \(orientation:\s*landscape\) and \(max-height:\s*720px\)/);
  assert.match(css, /@media[\s\S]*?\.ambient\s*\{[\s\S]*?display:\s*none\s*!important/);
  assert.match(css, /min-height:\s*100svh/);
  assert.match(css, /max-height:\s*calc\(100svh - 20px\)/);
  assert.match(css, /var\(--generation-hue,\s*268\)/);
  assert.match(css, /prefers-reduced-motion:\s*reduce/);
});

test("generation experience ships as a bounded standalone asset to web and Android", () => {
  assert.match(build, /generation-experience\.css/);
  assert.match(build, /writeFileSync\([\s\S]*?generation-experience\.css/);
  assert.match(build, /<link rel="stylesheet" href="\.\/generation-experience\.css">/);
  assert.match(build, /androidPublicDir[\s\S]*?generation-experience\.css/);
  assert.match(quality, /"www\/generation-experience\.css":\s*16 \* 1024/);
  assert.match(quality, /href="\.\/generation-experience\.css"/);
});
