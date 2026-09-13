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

// Keep first-paint HTML below the long-standing 80 KiB budget. The omitted
// helper copy is redundant with the visible values and the live status line.
replaceOnce(
  `                      <em>Non-destructive until Accept</em>\n`,
  ``,
  "redundant candidate helper copy",
);
replaceOnce(
  `<label><span>SCOPE <small>Where the change is allowed</small></span>`,
  `<label><span>SCOPE</span>`,
  "compact scope label",
);
replaceOnce(
  `<option value="track">Current instrument</option>`,
  `<option value="track">Instrument</option>`,
  "compact track scope option",
);
replaceOnce(
  `<span class="shape-director-current"><small>CURRENT INSTRUMENT</small><strong id="shapeDirectorTrackName">Melody</strong><em id="shapeDirectorNoteCount">0 selected notes</em></span>`,
  `<span class="shape-director-current"><small>INSTRUMENT</small><strong id="shapeDirectorTrackName"></strong><em id="shapeDirectorNoteCount"></em></span>`,
  "compact current instrument placeholder",
);
replaceOnce(
  `<label><span>CHANGE SIZE <small>How far MIDI Arcade may rewrite</small></span>`,
  `<label><span>CHANGE SIZE</span>`,
  "compact change size label",
);
replaceOnce(
  `<option value="touchUp">Touch Up · subtle</option>`,
  `<option value="touchUp">Touch Up</option>`,
  "compact Touch Up option",
);
replaceOnce(
  `<option value="reshape">Reshape · meaningful</option>`,
  `<option value="reshape">Reshape</option>`,
  "compact Reshape option",
);
replaceOnce(
  `<option value="transform">Transform · large</option>`,
  `<option value="transform">Transform</option>`,
  "compact Transform option",
);
replaceOnce(
  `<p class="shape-director-status" id="shapeDirectorStatus" role="status" aria-live="polite">Choose a musical direction to prepare a local candidate.</p>`,
  `<p class="shape-director-status" id="shapeDirectorStatus" role="status" aria-live="polite"></p>`,
  "dynamic status placeholder",
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
console.log("Optimized Shape Director startup DOM, copy, and presentation delivery within protected budgets.");
