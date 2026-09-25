import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const budgets = Object.freeze({
  "www/src/app.js": 361 * 1024,
  "www/src/cover-art.js": 12 * 1024,
  "www/src/generation-worker.js": 320 * 1024,
  "www/src/quality-pipeline.js": 24 * 1024,
  "www/styles.css": 150 * 1024,
  "www/generation-experience.css": 16 * 1024,
  "www/shape-director.css": 16 * 1024,
  "www/solar-pop.css": 16 * 1024,
  "www/index.html": 80 * 1024,
  "www/privacy-policy.html": 40 * 1024,
});
const aggregateCssBudget = (150 + 16 + 16) * 1024;

const failures = [];
for (const [relativePath, maxBytes] of Object.entries(budgets)) {
  const size = (await stat(path.join(projectRoot, relativePath))).size;
  if (size > maxBytes) failures.push(`${relativePath} is ${size} bytes; budget is ${maxBytes}`);
}
const aggregateCssBytes = (await Promise.all([
  "www/styles.css",
  "www/generation-experience.css",
  "www/shape-director.css",
].map(async (relativePath) => (await stat(path.join(projectRoot, relativePath))).size))).reduce((sum, size) => sum + size, 0);
if (aggregateCssBytes > aggregateCssBudget) failures.push(`shipped CSS is ${aggregateCssBytes} bytes; aggregate budget remains ${aggregateCssBudget}`);

const html = await readFile(path.join(projectRoot, "www/index.html"), "utf8");
const css = await readFile(path.join(projectRoot, "www/styles.css"), "utf8");
const generationCss = await readFile(path.join(projectRoot, "www/generation-experience.css"), "utf8");
const shapeCss = await readFile(path.join(projectRoot, "www/shape-director.css"), "utf8");
const solarPopCss = await readFile(path.join(projectRoot, "www/solar-pop.css"), "utf8");
const app = await readFile(path.join(projectRoot, "www/src/app.js"), "utf8");
const coverArt = await readFile(path.join(projectRoot, "www/src/cover-art.js"), "utf8");
const generationWorker = await readFile(path.join(projectRoot, "www/src/generation-worker.js"), "utf8");
const qualityPipeline = await readFile(path.join(projectRoot, "www/src/quality-pipeline.js"), "utf8");
const buttonCount = (html.match(/<button\b/g) || []).length;
const transitionAllCount = (css.match(/transition:\s*all/g) || []).length;
const mojibake = /(?:â€”|â€“|â€™|â€œ|â€|âœ|â†|â‡|â™|âš|â›|â—|â‰|âŒ|ðŸ|Â·|ï¿½|\uFFFD)/u;

if (buttonCount > 94) failures.push(`initial HTML exposes ${buttonCount} buttons; budget is 94`);
if (transitionAllCount > 30) failures.push(`CSS contains ${transitionAllCount} transition:all declarations; budget is 30`);
if (!css.includes("content-visibility:auto")) failures.push("offscreen rendering optimization is missing");
if (!html.includes('href="./generation-experience.css"')) failures.push("generation experience stylesheet is not linked from the built app");
if (!html.includes('href="./shape-director.css"')) failures.push("Shape Director stylesheet is not linked from the built app");
if (!html.includes('href="./solar-pop.css"')) failures.push("Solar Pop stylesheet is not linked from the built app");
if (!generationCss.includes("orientation:landscape")) failures.push("landscape generation stabilization is missing from the shipped stylesheet");
if (!shapeCss.includes("orientation:landscape")) failures.push("Shape Director landscape safeguards are missing from the shipped stylesheet");
if (!solarPopCss.includes("--solar-coral:#ff4f4f")) failures.push("Solar Pop design tokens are missing from the shipped stylesheet");
if (!solarPopCss.includes("orientation:landscape")) failures.push("Solar Pop landscape safeguards are missing from the shipped stylesheet");
for (const [relativePath, source] of [
  ["www/index.html", html],
  ["www/styles.css", css],
  ["www/generation-experience.css", generationCss],
  ["www/shape-director.css", shapeCss],
  ["www/solar-pop.css", solarPopCss],
  ["www/src/app.js", app],
  ["www/src/cover-art.js", coverArt],
  ["www/src/generation-worker.js", generationWorker],
  ["www/src/quality-pipeline.js", qualityPipeline],
]) {
  if (mojibake.test(source)) failures.push(`${relativePath} contains malformed UTF-8 text`);
}

if (failures.length) {
  console.error(`Build quality gate failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(`Build quality gate passed · ${buttonCount} buttons · ${transitionAllCount} broad legacy transitions · ${aggregateCssBytes}/${aggregateCssBudget} CSS bytes`);
}