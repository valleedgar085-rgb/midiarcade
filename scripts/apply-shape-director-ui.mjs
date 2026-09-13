import { readFile, writeFile } from "node:fs/promises";

// Temporary guarded codemod. Remove after the verified UI runtime lands.
const appPath = new URL("../src/app.js", import.meta.url);
const htmlPath = new URL("../index.html", import.meta.url);
const cssPath = new URL("../styles.css", import.meta.url);
const testPath = new URL("../tests/shape-director-ui-contract.test.mjs", import.meta.url);

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Ambiguous ${label}`);
  return source.slice(0, first) + after + source.slice(first + before.length);
}

let app = await readFile(appPath, "utf8");
app = replaceOnce(
  app,
  'import { executeArrangementCommand } from "./ui/arrangement-logic.js";',
  'import { createShapeIntent } from "./core/shape-director-policy.js";\nimport { auditionShapeCandidate, createShapeCandidate } from "./core/shape-director-engine.js";\nimport { executeArrangementCommand } from "./ui/arrangement-logic.js";',
  "Shape Director imports",
);

const directorRuntime = String.raw`
function shapeDirectorState() {
  if (!state.shapeDirector || typeof state.shapeDirector !== "object") {
    state.shapeDirector = {
      target: "section",
      size: "touchUp",
      direction: null,
      preserve: [],
      transaction: null,
      audition: "before",
    };
  }
  return state.shapeDirector;
}

function shapeDirectorSelection(section = editorSection()) {
  if (!section) return null;
  const director = shapeDirectorState();
  if (director.target === "track") {
    return { target: "track", sectionId: section.id, trackId: state.editorTrack };
  }
  if (director.target === "notes") {
    const noteIds = [...(state.editorSelection ?? [])].map(String);
    if (!noteIds.length) return null;
    return { target: "notes", sectionId: section.id, trackId: state.editorTrack, noteIds };
  }
  return { target: "section", sectionId: section.id };
}

function clearShapeDirectorCandidate({ restore = true, rerender = true } = {}) {
  const director = shapeDirectorState();
  const transaction = director.transaction;
  const shouldRestore = Boolean(restore && transaction && director.audition === "after");
  director.transaction = null;
  director.audition = "before";
  director.direction = null;
  if (shouldRestore) {
    player.stop();
    state.song = deepClone(transaction.before);
    applyTrackSettingsToSong(state.song);
    if (rerender) renderAll();
  } else if (rerender) {
    renderShapeDirector();
  }
}

function renderShapeDirector(section = editorSection()) {
  const panel = $("#shapeDirectorPanel");
  if (!panel) return;
  panel.hidden = !section;
  if (!section) return;
  const director = shapeDirectorState();
  const target = $("#shapeDirectorTarget");
  const size = $("#shapeDirectorSize");
  const trackName = $("#shapeDirectorTrackName");
  const noteCount = $("#shapeDirectorNoteCount");
  const status = $("#shapeDirectorStatus");
  const candidate = $("#shapeDirectorCandidate");
  if (target) target.value = director.target;
  if (size) size.value = director.size;
  if (trackName) trackName.textContent = TRACK_META[state.editorTrack]?.name || state.editorTrack || "Instrument";
  if (noteCount) noteCount.textContent = `${state.editorSelection?.size || 0} selected notes`;
  const notesOption = target?.querySelector?.('option[value="notes"]');
  if (notesOption) notesOption.disabled = !(state.editorSelection?.size > 0);
  $$('[data-shape-preserve]', panel).forEach((control) => {
    control.checked = director.preserve.includes(control.dataset.shapePreserve);
  });
  $$('[data-shape-direction]', panel).forEach((button) => {
    button.classList.toggle("is-selected", button.dataset.shapeDirection === director.direction);
  });
  if (!director.transaction) {
    if (candidate) candidate.hidden = true;
    if (status) status.textContent = director.target === "notes" && !(state.editorSelection?.size > 0)
      ? "Select notes in the piano roll first, or use Section / Current instrument scope."
      : "Choose a musical direction. MIDI Arcade will prepare a local Before / After candidate without committing it.";
    return;
  }
  const summary = director.transaction.summary;
  if (candidate) candidate.hidden = false;
  $("#shapeDirectorCandidateTitle").textContent = `${director.transaction.intent.direction.label} · ${director.transaction.intent.size.label}`;
  $("#shapeDirectorCandidateMeta").textContent = `${summary.changedNoteCount} shaped · ${summary.insertedNoteCount} added · ${summary.deletedNoteCount} removed · ${summary.scopeNoteCount} notes in scope`;
  $$('[data-shape-audition]', panel).forEach((button) => {
    button.classList.toggle("is-active", button.dataset.shapeAudition === director.audition);
  });
  if (status) status.textContent = director.audition === "after"
    ? "After is playing from the uncommitted candidate. Accept to write it into the song or return to Before."
    : "Original song is still active. Tap After to audition the proposed local rewrite.";
}

function prepareShapeDirectorCandidate(direction) {
  const section = editorSection();
  if (!section || !state.song) return false;
  if (state.sectionVariations) {
    showToast("Finish or cancel the current A/B section variation before starting a Shape Director pass.");
    return false;
  }
  clearShapeDirectorCandidate({ restore: true, rerender: false });
  const director = shapeDirectorState();
  director.direction = direction;
  const selection = shapeDirectorSelection(section);
  if (!selection) {
    renderShapeDirector(section);
    showToast("Select at least one note first, or widen Shape scope to the current instrument or section.");
    return false;
  }
  const intent = createShapeIntent({
    selection,
    size: director.size,
    direction,
    preserve: director.preserve,
  });
  const transaction = createShapeCandidate(state.song, intent, {
    seed: `shape:${state.generationCount}:${section.id}:${state.editorTrack}:${direction}:${director.size}`,
  });
  if (transaction.status !== "candidate") {
    renderShapeDirector(section);
    showToast(transaction.error === "no-musical-change"
      ? "That part already matches the requested direction. Try a stronger size or another direction."
      : "Shape Director could not make that local change safely with the current locks.");
    return false;
  }
  director.transaction = transaction;
  director.audition = "before";
  renderShapeDirector(section);
  showToast(`${transaction.intent.direction.label} candidate ready. Compare Before and After before committing.`);
  return true;
}

async function auditionShapeDirector(side) {
  const director = shapeDirectorState();
  const transaction = director.transaction;
  const sectionId = transaction?.intent?.selection?.sectionId;
  if (!transaction || !sectionId) return false;
  const song = auditionShapeCandidate(transaction, side);
  if (!song) return false;
  player.stop();
  state.song = song;
  director.audition = side === "after" ? "after" : "before";
  applyTrackSettingsToSong(state.song);
  renderAll();
  const section = normalizeSections().find((candidate) => String(candidate.id) === String(sectionId));
  if (section) {
    const range = editorBeatRange(section);
    player.seek(range.start * 60 / songBpm());
    if (!player.playing) await player.play();
  }
  renderShapeDirector(section);
  return true;
}

function acceptShapeDirectorCandidate() {
  const director = shapeDirectorState();
  const transaction = director.transaction;
  if (!transaction) return false;
  player.stop();
  pushHistory({ ...createHistorySnapshot(), song: deepClone(transaction.before) });
  state.song = deepClone(transaction.after);
  applyTrackSettingsToSong(state.song);
  const label = transaction.intent.direction.label;
  director.transaction = null;
  director.audition = "before";
  director.direction = null;
  renderAll();
  scheduleSessionSave();
  showToast(`${label} is now part of this section. Undo can restore the previous version.`);
  return true;
}

function discardShapeDirectorCandidate() {
  const director = shapeDirectorState();
  const transaction = director.transaction;
  if (!transaction) return false;
  player.stop();
  state.song = deepClone(transaction.before);
  applyTrackSettingsToSong(state.song);
  director.transaction = null;
  director.audition = "before";
  director.direction = null;
  renderAll();
  scheduleSessionSave();
  showToast("Shape candidate discarded. The original section is restored.");
  return true;
}
`;

app = replaceOnce(
  app,
  'function renderSectionShaper(message = "") {',
  `${directorRuntime}\nfunction renderSectionShaper(message = "") {`,
  "Shape Director runtime insertion",
);

app = replaceOnce(
  app,
  `  $('[data-section-action="later"]', shaper).disabled = sectionIndex < 0 || sectionIndex >= sections.length - 1;\n}`,
  `  $('[data-section-action="later"]', shaper).disabled = sectionIndex < 0 || sectionIndex >= sections.length - 1;\n  renderShapeDirector(section);\n}`,
  "Section Shaper render bridge",
);

app = replaceOnce(
  app,
  `  $("#sectionShaper")?.addEventListener("change", (event) => {\n    const barsControl = event.target.closest?.("[data-section-bars]");`,
  `  $("#sectionShaper")?.addEventListener("change", (event) => {\n    const shapeTarget = event.target.closest?.("#shapeDirectorTarget");\n    if (shapeTarget) {\n      clearShapeDirectorCandidate({ restore: true, rerender: false });\n      const director = shapeDirectorState();\n      director.target = shapeTarget.value;\n      renderAll();\n      return;\n    }\n    const shapeSize = event.target.closest?.("#shapeDirectorSize");\n    if (shapeSize) {\n      clearShapeDirectorCandidate({ restore: true, rerender: false });\n      const director = shapeDirectorState();\n      director.size = shapeSize.value;\n      renderAll();\n      return;\n    }\n    const preserve = event.target.closest?.("[data-shape-preserve]");\n    if (preserve) {\n      clearShapeDirectorCandidate({ restore: true, rerender: false });\n      const director = shapeDirectorState();\n      const locks = new Set(director.preserve);\n      if (preserve.checked) locks.add(preserve.dataset.shapePreserve);\n      else locks.delete(preserve.dataset.shapePreserve);\n      director.preserve = [...locks];\n      renderAll();\n      return;\n    }\n    const barsControl = event.target.closest?.("[data-section-bars]");`,
  "Shape Director change handlers",
);

app = replaceOnce(
  app,
  `  $("#sectionShaper")?.addEventListener("click", (event) => {\n    if (event.target.closest("#sectionShaperPlay")) {`,
  `  $("#sectionShaper")?.addEventListener("click", (event) => {\n    const direction = event.target.closest?.("[data-shape-direction]")?.dataset.shapeDirection;\n    if (direction) {\n      prepareShapeDirectorCandidate(direction);\n      return;\n    }\n    const audition = event.target.closest?.("[data-shape-audition]")?.dataset.shapeAudition;\n    if (audition) {\n      void auditionShapeDirector(audition);\n      return;\n    }\n    if (event.target.closest?.("[data-shape-accept]")) {\n      acceptShapeDirectorCandidate();\n      return;\n    }\n    if (event.target.closest?.("[data-shape-discard]")) {\n      discardShapeDirectorCandidate();\n      return;\n    }\n    if (event.target.closest("#sectionShaperPlay")) {`,
  "Shape Director click handlers",
);

await writeFile(appPath, app);

let html = await readFile(htmlPath, "utf8");
const directorMarkup = String.raw`
                  <section class="shape-director-panel" id="shapeDirectorPanel" aria-labelledby="shapeDirectorTitle">
                    <div class="shape-director-heading">
                      <span><small>SHAPE DIRECTOR</small><strong id="shapeDirectorTitle">Direct only what you choose</strong></span>
                      <em>Non-destructive until Accept</em>
                    </div>
                    <div class="shape-director-scope">
                      <label><span>SCOPE <small>Where the change is allowed</small></span>
                        <select id="shapeDirectorTarget" aria-label="Shape target scope">
                          <option value="section">Whole section</option>
                          <option value="track">Current instrument</option>
                          <option value="notes">Selected notes</option>
                        </select>
                      </label>
                      <span class="shape-director-current"><small>CURRENT INSTRUMENT</small><strong id="shapeDirectorTrackName">Melody</strong><em id="shapeDirectorNoteCount">0 selected notes</em></span>
                      <label><span>CHANGE SIZE <small>How far MIDI Arcade may rewrite</small></span>
                        <select id="shapeDirectorSize" aria-label="Shape change size">
                          <option value="touchUp">Touch Up · subtle</option>
                          <option value="reshape">Reshape · meaningful</option>
                          <option value="transform">Transform · large</option>
                        </select>
                      </label>
                    </div>
                    <div class="shape-director-directions" aria-label="Quick musical directions">
                      <button type="button" data-shape-direction="moreBounce">More Bounce</button>
                      <button type="button" data-shape-direction="harder">Harder</button>
                      <button type="button" data-shape-direction="simpler">Simpler</button>
                      <button type="button" data-shape-direction="busier">Busier</button>
                      <button type="button" data-shape-direction="moreEmotional">More Emotional</button>
                      <button type="button" data-shape-direction="moreSpace">More Space</button>
                      <button type="button" data-shape-direction="catchier">Catchier</button>
                      <button type="button" data-shape-direction="darker">Darker</button>
                      <button type="button" data-shape-direction="brighter">Brighter</button>
                      <button type="button" data-shape-direction="buildUp">Build Up</button>
                      <button type="button" data-shape-direction="calmDown">Calm Down</button>
                    </div>
                    <details class="shape-director-locks">
                      <summary><span>Preserve what already works</span><small>OPTIONAL LOCKS</small></summary>
                      <div>
                        <label><input type="checkbox" data-shape-preserve="melody" /> Melody</label>
                        <label><input type="checkbox" data-shape-preserve="harmony" /> Harmony</label>
                        <label><input type="checkbox" data-shape-preserve="rhythm" /> Rhythm</label>
                        <label><input type="checkbox" data-shape-preserve="instrument" /> Instrument</label>
                      </div>
                    </details>
                    <div class="shape-director-candidate" id="shapeDirectorCandidate" hidden>
                      <span><small>LOCAL CANDIDATE</small><strong id="shapeDirectorCandidateTitle">More Bounce · Touch Up</strong><em id="shapeDirectorCandidateMeta">Ready to compare</em></span>
                      <div class="shape-director-ab" role="group" aria-label="Before and After audition">
                        <button type="button" data-shape-audition="before">Before</button>
                        <button type="button" data-shape-audition="after">After</button>
                      </div>
                      <div class="shape-director-commit">
                        <button type="button" data-shape-discard>Discard</button>
                        <button class="is-primary" type="button" data-shape-accept>Accept change</button>
                      </div>
                    </div>
                    <p class="shape-director-status" id="shapeDirectorStatus" role="status" aria-live="polite">Choose a musical direction to prepare a local candidate.</p>
                  </section>
`;
html = replaceOnce(
  html,
  `                  </div>\n                  <button class="section-edit-primary" type="button" data-section-action="edit">`,
  `                  </div>\n${directorMarkup}                  <button class="section-edit-primary" type="button" data-section-action="edit">`,
  "Shape Director panel markup",
);
await writeFile(htmlPath, html);

let css = await readFile(cssPath, "utf8");
if (!css.includes("PHASE 4: SHAPE DIRECTOR")) {
  css += String.raw`

/* PHASE 4: SHAPE DIRECTOR */
.shape-director-panel{margin:16px 0;padding:16px;border:1px solid rgba(139,92,246,.28);border-radius:18px;background:linear-gradient(145deg,rgba(17,18,31,.94),rgba(25,22,40,.9));box-shadow:inset 0 1px rgba(255,255,255,.04),0 16px 34px rgba(0,0,0,.16)}
.shape-director-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:13px}.shape-director-heading span{display:grid;gap:3px}.shape-director-heading small{font:700 10px/1.2 var(--font-mono);letter-spacing:.14em;color:#a78bfa}.shape-director-heading strong{font:750 16px/1.15 var(--font-display);color:#f7f5ff}.shape-director-heading em{font:600 10px/1.2 var(--font-mono);font-style:normal;color:#8f8aa4}
.shape-director-scope{display:grid;grid-template-columns:minmax(0,1fr) minmax(120px,.72fr) minmax(0,1fr);gap:9px}.shape-director-scope label,.shape-director-current{min-width:0;display:grid;gap:6px;padding:10px;border:1px solid rgba(255,255,255,.08);border-radius:12px;background:rgba(255,255,255,.025)}.shape-director-scope label>span,.shape-director-current small{font:700 9px/1.25 var(--font-mono);letter-spacing:.08em;color:#aaa4bc}.shape-director-scope label span small{display:block;margin-top:3px;font-weight:500;letter-spacing:0;color:#777186}.shape-director-scope select{width:100%;border:1px solid rgba(255,255,255,.1);border-radius:9px;background:#151522;color:#f7f5ff;padding:8px 9px;font:650 12px/1.2 var(--font-body)}.shape-director-current strong{font:750 13px/1.15 var(--font-display);color:#f7f5ff}.shape-director-current em{font:500 10px/1.2 var(--font-mono);font-style:normal;color:#777186}
.shape-director-directions{display:flex;flex-wrap:wrap;gap:7px;margin:12px 0}.shape-director-directions button{min-height:34px;padding:8px 11px;border:1px solid rgba(255,255,255,.1);border-radius:999px;background:rgba(255,255,255,.035);color:#c9c4d7;font:700 11px/1 var(--font-body);transition:transform .14s ease,border-color .14s ease,background .14s ease,color .14s ease}.shape-director-directions button:active{transform:scale(.97)}.shape-director-directions button.is-selected{border-color:rgba(167,139,250,.7);background:linear-gradient(135deg,rgba(124,58,237,.3),rgba(217,70,239,.16));color:#fff;box-shadow:0 0 0 1px rgba(167,139,250,.12),0 7px 18px rgba(88,28,135,.2)}
.shape-director-locks{border-top:1px solid rgba(255,255,255,.07);border-bottom:1px solid rgba(255,255,255,.07);padding:9px 0}.shape-director-locks summary{cursor:pointer;display:flex;justify-content:space-between;gap:10px;color:#c9c4d7;font:650 11px/1.2 var(--font-body)}.shape-director-locks summary small{font:700 9px/1.2 var(--font-mono);color:#777186}.shape-director-locks>div{display:flex;flex-wrap:wrap;gap:8px;margin-top:10px}.shape-director-locks label{display:flex;align-items:center;gap:6px;padding:7px 9px;border-radius:9px;background:rgba(255,255,255,.035);font:600 10px/1 var(--font-body);color:#b9b3c8}
.shape-director-candidate{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:center;margin-top:12px;padding:12px;border:1px solid rgba(52,211,153,.24);border-radius:14px;background:linear-gradient(135deg,rgba(16,185,129,.08),rgba(124,58,237,.08))}.shape-director-candidate>span{display:grid;gap:2px}.shape-director-candidate small{font:700 9px/1.2 var(--font-mono);letter-spacing:.09em;color:#6ee7b7}.shape-director-candidate strong{font:750 13px/1.2 var(--font-display);color:#fff}.shape-director-candidate em{font:500 9px/1.25 var(--font-mono);font-style:normal;color:#858096}.shape-director-ab,.shape-director-commit{display:flex;gap:6px}.shape-director-commit{grid-column:1/-1;justify-content:flex-end}.shape-director-ab button,.shape-director-commit button{min-height:34px;padding:8px 12px;border:1px solid rgba(255,255,255,.11);border-radius:10px;background:#171722;color:#c8c2d5;font:700 10px/1 var(--font-body)}.shape-director-ab button.is-active{border-color:#a78bfa;background:rgba(124,58,237,.24);color:#fff}.shape-director-commit button.is-primary{border-color:rgba(52,211,153,.42);background:linear-gradient(135deg,#15803d,#047857);color:white}
.shape-director-status{margin:10px 0 0;color:#8f899f;font:500 10px/1.45 var(--font-body)}
@media(max-width:680px){.shape-director-panel{padding:13px}.shape-director-scope{grid-template-columns:1fr 1fr}.shape-director-current{grid-column:1/-1;grid-row:2}.shape-director-directions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr))}.shape-director-directions button{border-radius:11px}.shape-director-candidate{grid-template-columns:1fr}.shape-director-ab{justify-content:stretch}.shape-director-ab button{flex:1}.shape-director-commit{grid-column:auto}.shape-director-commit button{flex:1}}
@media(orientation:landscape) and (max-height:720px){.shape-director-panel{padding:12px}.shape-director-heading{margin-bottom:8px}.shape-director-directions{margin:8px 0;gap:5px}.shape-director-directions button{min-height:30px;padding:6px 9px}.shape-director-locks{padding:6px 0}.shape-director-status{margin-top:7px}}
`;
}
await writeFile(cssPath, css);

await writeFile(testPath, String.raw`import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const css = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

test("Shape Director exposes scope, strength, directions, locks and A/B commit controls", () => {
  assert.match(html, /id="shapeDirectorPanel"[\s\S]*?id="shapeDirectorTarget"[\s\S]*?id="shapeDirectorSize"/);
  assert.match(html, /data-shape-direction="moreBounce"[\s\S]*?data-shape-direction="calmDown"/);
  assert.match(html, /data-shape-preserve="melody"[\s\S]*?data-shape-preserve="instrument"/);
  assert.match(html, /data-shape-audition="before"[\s\S]*?data-shape-audition="after"[\s\S]*?data-shape-discard[\s\S]*?data-shape-accept/);
});

test("Shape Director runtime remains candidate-first and history-safe", () => {
  assert.match(app, /createShapeIntent[\s\S]*?createShapeCandidate/);
  assert.match(app, /function prepareShapeDirectorCandidate[\s\S]*?transaction\.status !== "candidate"/);
  assert.match(app, /function auditionShapeDirector[\s\S]*?auditionShapeCandidate/);
  assert.match(app, /function acceptShapeDirectorCandidate[\s\S]*?pushHistory[\s\S]*?transaction\.after/);
  assert.match(app, /function discardShapeDirectorCandidate[\s\S]*?transaction\.before/);
});

test("Shape Director is touch friendly and landscape aware", () => {
  assert.match(css, /PHASE 4: SHAPE DIRECTOR/);
  assert.match(css, /\.shape-director-directions button\{[\s\S]*?min-height:34px/);
  assert.match(css, /@media\(max-width:680px\)[\s\S]*?grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(orientation:landscape\) and \(max-height:720px\)[\s\S]*?\.shape-director-panel/);
});
`);

console.log("Applied Shape Director UI runtime, markup, styles, and permanent UI contract tests.");
