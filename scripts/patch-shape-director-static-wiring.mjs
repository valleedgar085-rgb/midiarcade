import { readFile, writeFile } from "node:fs/promises";

const path = new URL("../tests/app-smoke.test.mjs", import.meta.url);
let source = await readFile(path, "utf8");
const before = '  const delegated = /\\bdata-(?:workspace|workflow-step|bus|attitude|section-action|editor-action|song-variation)=/;';
const after = '  const delegated = /\\bdata-(?:workspace|workflow-step|bus|attitude|section-action|editor-action|song-variation|shape-direction|shape-audition|shape-discard|shape-accept)(?:=|\\b)/;';
const count = source.split(before).length - 1;
if (count !== 1) throw new Error(`Expected one delegated-button guard, found ${count}.`);
source = source.replace(before, after);
await writeFile(path, source);
console.log("Extended the static button wiring guard for Shape Director delegated controls.");
