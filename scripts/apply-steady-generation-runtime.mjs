import { readFile, writeFile } from "node:fs/promises";

const path = new URL("../src/app.js", import.meta.url);
let source = await readFile(path, "utf8");

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

await writeFile(path, source);
console.log("Applied steady generation runtime wiring.");
