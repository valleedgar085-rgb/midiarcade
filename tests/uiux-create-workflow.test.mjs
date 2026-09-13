import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../src/ui/create-workflow.css", import.meta.url), "utf8");
const presentation = fs.readFileSync(new URL("../src/ui/create-workflow-phase1.js", import.meta.url), "utf8");
const progress = fs.readFileSync(new URL("../src/ui/generation-progress.js", import.meta.url), "utf8");
const build = fs.readFileSync(new URL("../scripts/build.js", import.meta.url), "utf8");
const pkg = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));

test("Create workspace keeps the production flow intact", () => {
  const hero = html.indexOf('id="heroPanel"');
  const direction = html.indexOf('id="preGenSection"');
  assert.ok(hero > 0 && direction > hero, "Now Playing should remain before Song Direction");
  for (const id of ["tempoControl", "energyControl", "complexityControl", "genreControl", "generateNew", "generateSimilar"]) {
    assert.equal((html.match(new RegExp(`id="${id}"`, "g")) || []).length, 1, `${id} must remain unique`);
  }
});

test("Phase 1 presentation mounts through the existing generation UI boundary", () => {
  assert.match(progress, /import "\.\/create-workflow-phase1\.js";/);
  assert.match(presentation, /typeof document !== "undefined"/);
  assert.match(presentation, /applyCreateWorkflowPhase1\(document\)/);
  assert.doesNotMatch(presentation, /music-engine|generateNew\(|generateSimilar\(/);
});

test("Phase 1 presentation can be imported without browser globals", async () => {
  const previousDocument = globalThis.document;
  try {
    delete globalThis.document;
    const module = await import(`../src/ui/create-workflow-phase1.js?importSafe=${Date.now()}`);
    assert.equal(typeof module.applyCreateWorkflowPhase1, "function");
    assert.equal(module.applyCreateWorkflowPhase1(undefined), false);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test("generation essentials move from Now Playing into Song Direction without duplicating controls", () => {
  assert.match(presentation, /querySelector\("\.create-live-controls"\)/);
  assert.match(presentation, /className = "direction-essentials-heading section-heading"/);
  assert.match(presentation, /creatorMain\.insertBefore\(controls, shapeControls\)/);
  assert.match(presentation, /creator\.insertAdjacentElement\("afterend", workflow\)/);
  for (const id of ["tempoControl", "energyControl", "complexityControl", "barsControl", "grooveControl"]) {
    assert.doesNotMatch(presentation, new RegExp(`id=["']${id}["']`), `${id} must be moved, not recreated`);
  }
});

test("advanced direction moves optional controls below the primary generation actions", () => {
  assert.match(presentation, /className = "phase1-advanced-direction"/);
  assert.match(presentation, /body\.append\(shapeControls, recipeControls\)/);
  assert.match(presentation, /generationActions\.insertAdjacentElement\("afterend", advanced\)/);
  assert.match(presentation, /creatorGrid\.classList\.add\("phase1-essentials-grid"\)/);
  assert.match(css, /#preGenSection \.phase1-advanced-direction-body\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/);
  assert.match(css, /#preGenSection \.creator-grid\.phase1-essentials-grid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
});

test("Create layout overrides inherited grid spans and restores full mobile facts", () => {
  assert.match(css, /#tab-create \.create-live-control,[\s\S]*?#tab-create \.create-live-select\s*\{[\s\S]*?grid-column:\s*span 1/);
  assert.match(css, /#tab-create #factBars,[\s\S]*?#tab-create #factDuration,[\s\S]*?#tab-create #factRhythm\s*\{[\s\S]*?display:\s*inline-flex/);
});

test("Create-only mobile header changes do not leak into Shape, Mix, or Finish", () => {
  assert.match(css, /body:has\(#tab-create\.is-active\) \.topbar/);
  assert.doesNotMatch(css, /\n\s*\.topbar \.session-status,[\s\S]*?display:\s*none/);
});

test("Phase 1 gives Create a clear desktop and mobile hierarchy", () => {
  assert.match(css, /#preGenSection \.generation-actions-bar\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1\.3fr\) minmax\(0, 0\.9fr\)/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*?body:has\(#tab-create\.is-active\) \.topbar \.session-status[\s\S]*?display:\s*none/);
  assert.match(css, /@media \(max-width: 600px\)[\s\S]*?#tab-create \.create-live-controls\s*\{[\s\S]*?grid-template-columns:\s*1fr 1fr/);
  assert.match(css, /#tab-create \.taste-actions\s*\{[\s\S]*?opacity:\s*0\.72/);
});

test("Create-specific CSS stays outside the protected global stylesheet budget and dev serves the built UI", () => {
  assert.match(build, /src', 'ui', 'create-workflow\.css'/);
  assert.match(build, /createWorkflowStyles/);
  assert.match(build, /<style>\$\{creatorStyles\.code\}<\/style><style>\$\{createWorkflowStyles\.code\}<\/style>/);
  assert.match(pkg.scripts.dev, /npm run build/);
  assert.match(pkg.scripts.dev, /--directory www/);
});
