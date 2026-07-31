import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const budgets = Object.freeze({
  "www/src/app.js": 360 * 1024,
  "www/src/generation-worker.js": 320 * 1024,
  "www/styles.css": 150 * 1024,
  "www/index.html": 80 * 1024,
  "www/privacy-policy.html": 40 * 1024,
});

const failures = [];
for (const [relativePath, maxBytes] of Object.entries(budgets)) {
  const size = (await stat(path.join(projectRoot, relativePath))).size;
  if (size > maxBytes) failures.push(`${relativePath} is ${size} bytes; budget is ${maxBytes}`);
}

const html = await readFile(path.join(projectRoot, "www/index.html"), "utf8");
const css = await readFile(path.join(projectRoot, "www/styles.css"), "utf8");
const app = await readFile(path.join(projectRoot, "www/src/app.js"), "utf8");
const generationWorker = await readFile(path.join(projectRoot, "www/src/generation-worker.js"), "utf8");
const buttonCount = (html.match(/<button\b/g) || []).length;
const transitionAllCount = (css.match(/transition:\s*all/g) || []).length;
const mojibake = /(?:â€”|â€“|â€™|â€œ|â€|âœ|â†|â‡|â™|âš|â›|â—|â‰|âŒ|ðŸ|Â·|ï¿½|\uFFFD)/u;

if (buttonCount > 94) failures.push(`initial HTML exposes ${buttonCount} buttons; budget is 94`);
if (transitionAllCount > 30) failures.push(`CSS contains ${transitionAllCount} transition:all declarations; budget is 30`);
if (!css.includes("content-visibility:auto")) failures.push("offscreen rendering optimization is missing");
for (const [relativePath, source] of [
  ["www/index.html", html],
  ["www/styles.css", css],
  ["www/src/app.js", app],
  ["www/src/generation-worker.js", generationWorker],
]) {
  if (mojibake.test(source)) failures.push(`${relativePath} contains malformed UTF-8 text`);
}

if (failures.length) {
  console.error(`Build quality gate failed:\n- ${failures.join("\n- ")}`);
  process.exitCode = 1;
} else {
  console.log(`Build quality gate passed · ${buttonCount} buttons · ${transitionAllCount} broad legacy transitions`);
}
