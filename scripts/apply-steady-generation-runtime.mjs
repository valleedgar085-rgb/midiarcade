import { readFile, writeFile } from "node:fs/promises";

// Temporary guarded codemod: it is removed once the verified runtime diff lands.
const appPath = new URL("../src/app.js", import.meta.url);
const smokePath = new URL("../tests/app-smoke.test.mjs", import.meta.url);
let source = await readFile(appPath, "utf8");

function replaceOnce(before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Ambiguous ${label}`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce(
  'import { generationStageState } from "./ui/generation-progress.js";',
  'import { generationMinimumVisibleMs, generationStageState } from "./ui/generation-progress.js";',
  "generation progress import",
);

replaceOnce(
  `function generationDelay() {\n  return new Promise((resolve) => setTimeout(resolve, 430));\n}`,
  `function generationDelay(kind = "new") {\n  return new Promise((resolve) => setTimeout(resolve, generationMinimumVisibleMs(kind)));\n}`,
  "generation minimum delay",
);

replaceOnce(
  `generationProgressTimer = setInterval(() => renderGenerationProgress(kind, Date.now() - startedAt), 410);`,
  `generationProgressTimer = setInterval(() => renderGenerationProgress(kind, Date.now() - startedAt), 160);`,
  "generation progress refresh cadence",
);

replaceOnce(
  `const [generated] = await Promise.all([work, generationDelay()]);`,
  `const [generated] = await Promise.all([work, generationDelay(kind)]);`,
  "generation delay call",
);

await writeFile(appPath, source);

let smoke = await readFile(smokePath, "utf8");
function replaceSmokeOnce(before, after, label) {
  const first = smoke.indexOf(before);
  if (first < 0) throw new Error(`Missing ${label}`);
  if (smoke.indexOf(before, first + before.length) >= 0) throw new Error(`Ambiguous ${label}`);
  smoke = smoke.slice(0, first) + after + smoke.slice(first + before.length);
}

replaceSmokeOnce(
  `const buildSource = await readFile(new URL("../scripts/build.js", import.meta.url), "utf8");`,
  `const buildSource = await readFile(new URL("../scripts/build.js", import.meta.url), "utf8");\n\nasync function waitForGenerationCommit(app, previousGenerationCount, timeoutMs = 12000) {\n  const deadline = Date.now() + timeoutMs;\n  while (Date.now() < deadline) {\n    const snapshot = app.getAppStateSnapshot();\n    if (!snapshot.isGenerating && snapshot.generationCount > previousGenerationCount) return snapshot;\n    await new Promise((resolve) => setTimeout(resolve, 80));\n  }\n  throw new Error(\`Generation did not settle after generationCount \${previousGenerationCount}.\`);\n}`,
  "smoke generation completion helper",
);

replaceSmokeOnce(
  `  assert.equal(app.getAppStateSnapshot().song, null, "reopening the studio must begin with an empty song plate");\n  elementFor("#generateNew").dispatch("click");\n  await new Promise((resolve) => setTimeout(resolve, 560));\n  assert.ok(app.getAppStateSnapshot().song, "the first explicit Generate action must create the song");`,
  `  assert.equal(app.getAppStateSnapshot().song, null, "reopening the studio must begin with an empty song plate");\n  const firstGenerationCount = app.getAppStateSnapshot().generationCount;\n  elementFor("#generateNew").dispatch("click");\n  const firstGeneratedSnapshot = await waitForGenerationCommit(app, firstGenerationCount);\n  assert.ok(firstGeneratedSnapshot.song, "the first explicit Generate action must create the song");`,
  "first explicit Generate completion wait",
);

replaceSmokeOnce(
  `  const initialGeneration = app.getAppStateSnapshot();\n  elementFor("#generateNew").dispatch("click");\n  elementFor("#generateNew").dispatch("click");\n  assert.equal(app.getAppStateSnapshot().isGenerating, true);\n  await new Promise((resolve) => setTimeout(resolve, 560));\n  const freshGeneration = app.getAppStateSnapshot();`,
  `  const initialGeneration = app.getAppStateSnapshot();\n  elementFor("#generateNew").dispatch("click");\n  elementFor("#generateNew").dispatch("click");\n  assert.equal(app.getAppStateSnapshot().isGenerating, true);\n  const freshGeneration = await waitForGenerationCommit(app, initialGeneration.generationCount);`,
  "rapid-tap New completion wait",
);

replaceSmokeOnce(
  `  elementFor("#generateSimilar").dispatch("click");\n  await new Promise((resolve) => setTimeout(resolve, 560));\n  const relatedGeneration = app.getAppStateSnapshot();`,
  `  elementFor("#generateSimilar").dispatch("click");\n  const relatedGeneration = await waitForGenerationCommit(app, freshGeneration.generationCount);`,
  "first Similar completion wait",
);

replaceSmokeOnce(
  `  const previousPrograms = selectedPrograms(elementFor("#trackRack").innerHTML);\n  elementFor("#generateNew").dispatch("click");\n  await new Promise((resolve) => setTimeout(resolve, 520));\n  const newPrograms = selectedPrograms(elementFor("#trackRack").innerHTML);`,
  `  const previousPrograms = selectedPrograms(elementFor("#trackRack").innerHTML);\n  const manualNewGenerationCount = app.getAppStateSnapshot().generationCount;\n  elementFor("#generateNew").dispatch("click");\n  await waitForGenerationCommit(app, manualNewGenerationCount);\n  const newPrograms = selectedPrograms(elementFor("#trackRack").innerHTML);`,
  "manual-program New completion wait",
);

replaceSmokeOnce(
  `  elementFor("#generateSimilar").dispatch("click");\n  await new Promise((resolve) => setTimeout(resolve, 520));\n  const similarPrograms = selectedPrograms(elementFor("#trackRack").innerHTML);`,
  `  const manualSimilarGenerationCount = app.getAppStateSnapshot().generationCount;\n  elementFor("#generateSimilar").dispatch("click");\n  await waitForGenerationCommit(app, manualSimilarGenerationCount);\n  const similarPrograms = selectedPrograms(elementFor("#trackRack").innerHTML);`,
  "manual-program Similar completion wait",
);

replaceSmokeOnce(
  `  const programsBeforeAutoNew = Object.fromEntries(Object.entries(app.getAppStateSnapshot().trackSettings)\n    .map(([id, settings]) => [id, Number(settings.program)]));\n  elementFor("#generateNew").dispatch("click");\n  await new Promise((resolve) => setTimeout(resolve, 520));\n  const programsAfterAutoNew = Object.fromEntries(Object.entries(app.getAppStateSnapshot().trackSettings)`,
  `  const programsBeforeAutoNew = Object.fromEntries(Object.entries(app.getAppStateSnapshot().trackSettings)\n    .map(([id, settings]) => [id, Number(settings.program)]));\n  const autoNewGenerationCount = app.getAppStateSnapshot().generationCount;\n  elementFor("#generateNew").dispatch("click");\n  await waitForGenerationCommit(app, autoNewGenerationCount);\n  const programsAfterAutoNew = Object.fromEntries(Object.entries(app.getAppStateSnapshot().trackSettings)`,
  "reset-to-Auto New completion wait",
);

await writeFile(smokePath, smoke);
console.log("Applied steady generation runtime wiring and state-based smoke synchronization.");
