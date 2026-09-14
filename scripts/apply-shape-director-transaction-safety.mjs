import { readFile, writeFile } from "node:fs/promises";

const appUrl = new URL("../src/app.js", import.meta.url);
const testUrl = new URL("../tests/shape-director-transaction-safety.test.mjs", import.meta.url);
let app = await readFile(appUrl, "utf8");

function replaceOnce(before, after, label) {
  const first = app.indexOf(before);
  if (first < 0) throw new Error(`Missing ${label}`);
  if (app.indexOf(before, first + before.length) >= 0) throw new Error(`Ambiguous ${label}`);
  app = app.slice(0, first) + after + app.slice(first + before.length);
}

replaceOnce(
  `  snapshot: () => createPersistedSessionSnapshot(state, {`,
  `  snapshot: () => createPersistedSessionSnapshot(shapeDirectorPersistenceState(), {`,
  "Shape-safe autosave snapshot",
);

replaceOnce(
  `function clearShapeDirectorCandidate({ restore = true, rerender = true } = {}) {`,
  `function shapeDirectorPersistenceState() {\n  const director = state.shapeDirector;\n  if (director?.transaction && director.audition === "after") {\n    return { ...state, song: director.transaction.before };\n  }\n  return state;\n}\n\nfunction resolvePendingShapeDirectorCandidate({ rerender = false } = {}) {\n  if (!state.shapeDirector?.transaction) return false;\n  clearShapeDirectorCandidate({ restore: true, rerender });\n  return true;\n}\n\nfunction clearShapeDirectorCandidate({ restore = true, rerender = true } = {}) {`,
  "Shape persistence and boundary helpers",
);

replaceOnce(
  `    song: deepClone(state.song),`,
  `    song: deepClone(shapeDirectorPersistenceState().song),`,
  "Shape-safe history snapshot",
);

replaceOnce(
  `async function runGeneration(kind, options = {}) {\n  if (state.isGenerating) return;\n  const copy = GENERATION_STATUS_COPY[kind] ?? GENERATION_STATUS_COPY.new;`,
  `async function runGeneration(kind, options = {}) {\n  if (state.isGenerating) return;\n  resolvePendingShapeDirectorCandidate({ rerender: false });\n  const copy = GENERATION_STATUS_COPY[kind] ?? GENERATION_STATUS_COPY.new;`,
  "generation boundary",
);

replaceOnce(
  `export function selectSongVariation(index) {\n  const safeIndex = Math.round(Number(index));\n  const variation = state.songVariations?.[safeIndex];\n  if (!variation) return false;\n  player.stop();`,
  `export function selectSongVariation(index) {\n  const safeIndex = Math.round(Number(index));\n  const variation = state.songVariations?.[safeIndex];\n  if (!variation) return false;\n  resolvePendingShapeDirectorCandidate({ rerender: false });\n  player.stop();`,
  "variation selection boundary",
);

replaceOnce(
  `export function focusSongSection(sectionId, track = state.editorTrack, { openEditor = false, scroll = false } = {}) {\n  const section = normalizeSections().find((candidate) => candidate.id === sectionId);\n  if (!section) return false;\n  state.focusedSection = section.id;`,
  `export function focusSongSection(sectionId, track = state.editorTrack, { openEditor = false, scroll = false } = {}) {\n  const section = normalizeSections().find((candidate) => candidate.id === sectionId);\n  if (!section) return false;\n  resolvePendingShapeDirectorCandidate({ rerender: false });\n  state.focusedSection = section.id;`,
  "section focus boundary",
);

replaceOnce(
  `  onChange(workspace) {\n    appStore.transaction("workspace:activate", (draft) => {`,
  `  onChange(workspace) {\n    resolvePendingShapeDirectorCandidate({ rerender: true });\n    appStore.transaction("workspace:activate", (draft) => {`,
  "workspace boundary",
);

replaceOnce(
  `async function exportSong() {\n  if (!state.song) return;\n  let isNative = false;`,
  `async function exportSong() {\n  if (!state.song) return;\n  resolvePendingShapeDirectorCandidate({ rerender: true });\n  let isNative = false;`,
  "export boundary",
);

replaceOnce(
  `function restoreHistory({ captureFuture = true, announce = true } = {}) {\n  const snapshot = state.history.pop();`,
  `function restoreHistory({ captureFuture = true, announce = true } = {}) {\n  resolvePendingShapeDirectorCandidate({ rerender: false });\n  const snapshot = state.history.pop();`,
  "undo boundary",
);

replaceOnce(
  `function redoHistory() {\n  const snapshot = state.future.pop();`,
  `function redoHistory() {\n  resolvePendingShapeDirectorCandidate({ rerender: false });\n  const snapshot = state.future.pop();`,
  "redo boundary",
);

replaceOnce(
  `  $("#resetControlsButton").addEventListener("click", () => {\n    state.autoControls.clear();`,
  `  $("#resetControlsButton").addEventListener("click", () => {\n    resolvePendingShapeDirectorCandidate({ rerender: true });\n    state.autoControls.clear();`,
  "creative reset boundary",
);

replaceOnce(
  `function resetSessionStateForFreshStart() {\n  clearTimeout(sessionSaveTimer);`,
  `function resetSessionStateForFreshStart() {\n  resolvePendingShapeDirectorCandidate({ rerender: false });\n  clearTimeout(sessionSaveTimer);`,
  "fresh session boundary",
);

replaceOnce(
  `  state.sectionMacroValues = {};\n  midiConnectionRequestGeneration += 1;`,
  `  state.sectionMacroValues = {};\n  state.shapeDirector = null;\n  midiConnectionRequestGeneration += 1;`,
  "fresh session Shape state reset",
);

await writeFile(appUrl, app);

const test = `import assert from "node:assert/strict";\nimport fs from "node:fs";\nimport test from "node:test";\n\nconst app = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");\n\ntest("unaccepted Shape After never becomes the autosaved or history source", () => {\n  assert.match(app, /function shapeDirectorPersistenceState\\(\\)[\\s\\S]*?director\\?\\.transaction[\\s\\S]*?director\\.audition === "after"[\\s\\S]*?song: director\\.transaction\\.before/);\n  assert.match(app, /createPersistedSessionSnapshot\\(shapeDirectorPersistenceState\\(\\)/);\n  assert.match(app, /song: deepClone\\(shapeDirectorPersistenceState\\(\\)\\.song\\)/);\n});\n\ntest("pending Shape candidates resolve before destructive or context-changing boundaries", () => {\n  const guarded = [\n    /async function runGeneration[\\s\\S]*?resolvePendingShapeDirectorCandidate/,\n    /export function selectSongVariation[\\s\\S]*?resolvePendingShapeDirectorCandidate/,\n    /export function focusSongSection[\\s\\S]*?resolvePendingShapeDirectorCandidate/,\n    /onChange\\(workspace\\)[\\s\\S]*?resolvePendingShapeDirectorCandidate/,\n    /async function exportSong[\\s\\S]*?resolvePendingShapeDirectorCandidate/,\n    /function restoreHistory[\\s\\S]*?resolvePendingShapeDirectorCandidate/,\n    /function redoHistory[\\s\\S]*?resolvePendingShapeDirectorCandidate/,\n    /#resetControlsButton[\\s\\S]*?resolvePendingShapeDirectorCandidate/,\n    /function resetSessionStateForFreshStart[\\s\\S]*?resolvePendingShapeDirectorCandidate/,\n  ];\n  for (const contract of guarded) assert.match(app, contract);\n});\n\ntest("fresh session reset cannot resurrect stale Shape transactions", () => {\n  assert.match(app, /state\\.sectionMacroValues = \\{\\};[\\s\\S]*?state\\.shapeDirector = null/);\n});\n`;
await writeFile(testUrl, test);
console.log("Applied Shape Director transaction-safety boundaries and persistence guard.");
