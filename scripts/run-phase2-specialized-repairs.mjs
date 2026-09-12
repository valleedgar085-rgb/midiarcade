import fs from "node:fs";

const sourcePath = new URL("./apply-phase2-specialized-repairs.mjs", import.meta.url);
const fixedPath = new URL("./.apply-phase2-specialized-repairs.fixed.mjs", import.meta.url);
let source = fs.readFileSync(sourcePath, "utf8");
source = source.replace(
  '  let id = `${diagnosis?.group ?? "general"}-regenerate`;',
  '  let id = String(diagnosis?.group ?? "general") + "-regenerate";',
);
if (source.includes('let id = `${diagnosis?.group')) {
  throw new Error("Failed to repair nested template literal in specialized repair codemod.");
}
fs.writeFileSync(fixedPath, source);
try {
  await import(fixedPath.href);
} finally {
  fs.rmSync(fixedPath, { force: true });
}
