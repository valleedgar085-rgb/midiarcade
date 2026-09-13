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
const oldSmokeWait = `  elementFor("#generateNew").dispatch("click");\n  await new Promise((resolve) => setTimeout(resolve, 560));\n  assert.ok(app.getAppStateSnapshot().song, "the first explicit Generate action must create the song");`;
const newSmokeWait = `  elementFor("#generateNew").dispatch("click");\n  const generationDeadline = Date.now() + 10000;\n  while (!app.getAppStateSnapshot().song && Date.now() < generationDeadline) {\n    await new Promise((resolve) => setTimeout(resolve, 80));\n  }\n  assert.ok(app.getAppStateSnapshot().song, "the first explicit Generate action must create the song");`;
const smokeIndex = smoke.indexOf(oldSmokeWait);
if (smokeIndex < 0) throw new Error("Missing browser smoke generation wait");
if (smoke.indexOf(oldSmokeWait, smokeIndex + oldSmokeWait.length) >= 0) throw new Error("Ambiguous browser smoke generation wait");
smoke = smoke.slice(0, smokeIndex) + newSmokeWait + smoke.slice(smokeIndex + oldSmokeWait.length);
await writeFile(smokePath, smoke);

console.log("Applied steady generation runtime wiring and completion-aware smoke wait.");
