import { readFile, writeFile } from "node:fs/promises";

const path = new URL("./apply-shape-director-ui.mjs", import.meta.url);
let source = await readFile(path, "utf8");

function replaceOnce(before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Ambiguous ${label}`);
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce(
  `'import { createShapeIntent } from "./core/shape-director-policy.js";\\nimport { auditionShapeCandidate, createShapeCandidate } from "./core/shape-director-engine.js";\\nimport { executeArrangementCommand } from "./ui/arrangement-logic.js";'`,
  `'import { SHAPE_QUICK_DIRECTIONS, createShapeIntent } from "./core/shape-director-policy.js";\\nimport { auditionShapeCandidate, createShapeCandidate } from "./core/shape-director-engine.js";\\nimport { executeArrangementCommand } from "./ui/arrangement-logic.js";'`,
  "Shape Director policy import",
);

replaceOnce(
  `  const candidate = $("#shapeDirectorCandidate");\n  if (target) target.value = director.target;`,
  `  const candidate = $("#shapeDirectorCandidate");\n  const directions = $("#shapeDirectorDirections");\n  const auditionControls = $("#shapeDirectorAudition");\n  if (directions && !directions.childElementCount) {\n    directions.innerHTML = Object.values(SHAPE_QUICK_DIRECTIONS)\n      .map((entry) => '<button type="button" data-shape-direction="' + entry.id + '">' + entry.label + '</button>')\n      .join("");\n  }\n  if (auditionControls && !auditionControls.childElementCount) {\n    auditionControls.innerHTML = '<button type="button" data-shape-audition="before">Before</button><button type="button" data-shape-audition="after">After</button>';\n  }\n  if (target) target.value = director.target;`,
  "dynamic Shape controls",
);

replaceOnce(
  `                    <div class="shape-director-directions" aria-label="Quick musical directions">\n                      <button type="button" data-shape-direction="moreBounce">More Bounce</button>\n                      <button type="button" data-shape-direction="harder">Harder</button>\n                      <button type="button" data-shape-direction="simpler">Simpler</button>\n                      <button type="button" data-shape-direction="busier">Busier</button>\n                      <button type="button" data-shape-direction="moreEmotional">More Emotional</button>\n                      <button type="button" data-shape-direction="moreSpace">More Space</button>\n                      <button type="button" data-shape-direction="catchier">Catchier</button>\n                      <button type="button" data-shape-direction="darker">Darker</button>\n                      <button type="button" data-shape-direction="brighter">Brighter</button>\n                      <button type="button" data-shape-direction="buildUp">Build Up</button>\n                      <button type="button" data-shape-direction="calmDown">Calm Down</button>\n                    </div>`,
  `                    <div class="shape-director-directions" id="shapeDirectorDirections" aria-label="Quick musical directions"></div>`,
  "dynamic direction host",
);

replaceOnce(
  `                      <div class="shape-director-ab" role="group" aria-label="Before and After audition">\n                        <button type="button" data-shape-audition="before">Before</button>\n                        <button type="button" data-shape-audition="after">After</button>\n                      </div>`,
  `                      <div class="shape-director-ab" id="shapeDirectorAudition" role="group" aria-label="Before and After audition"></div>`,
  "dynamic audition host",
);

const cssStart = source.indexOf('let css = await readFile(cssPath, "utf8");');
const cssEndMarker = 'await writeFile(cssPath, css);';
const cssEnd = source.indexOf(cssEndMarker, cssStart);
if (cssStart < 0 || cssEnd < 0) throw new Error("Missing temporary Shape CSS append block");
source = source.slice(0, cssStart)
  + '// Shape Director presentation ships through src/ui/shape-director.css and the normal build pipeline.\n'
  + source.slice(cssEnd + cssEndMarker.length);

replaceOnce(
  `const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");`,
  `const css = fs.readFileSync(new URL("../src/ui/shape-director.css", import.meta.url), "utf8");`,
  "UI contract stylesheet source",
);

replaceOnce(
  `  assert.match(html, /data-shape-direction="moreBounce"[\\s\\S]*?data-shape-direction="calmDown"/);`,
  `  assert.match(html, /id="shapeDirectorDirections"/);\n  assert.doesNotMatch(html, /data-shape-direction=/);\n  assert.match(app, /Object\\.values\\(SHAPE_QUICK_DIRECTIONS\\)[\\s\\S]*?data-shape-direction/);`,
  "dynamic direction UI test",
);

replaceOnce(
  `  assert.match(html, /data-shape-audition="before"[\\s\\S]*?data-shape-audition="after"[\\s\\S]*?data-shape-discard[\\s\\S]*?data-shape-accept/);`,
  `  assert.match(html, /id="shapeDirectorAudition"[\\s\\S]*?data-shape-discard[\\s\\S]*?data-shape-accept/);\n  assert.doesNotMatch(html, /data-shape-audition=/);\n  assert.match(app, /shapeDirectorAudition[\\s\\S]*?data-shape-audition="before"[\\s\\S]*?data-shape-audition="after"/);`,
  "dynamic audition UI test",
);

await writeFile(path, source);
console.log("Optimized Shape Director startup DOM and moved presentation out of global CSS.");
