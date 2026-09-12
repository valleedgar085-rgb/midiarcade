import fs from "node:fs";

const path = new URL("../src/app.js", import.meta.url);
let source = fs.readFileSync(path, "utf8");
const original = source;

function replaceExact(before, after, label) {
  const index = source.indexOf(before);
  if (index < 0) {
    if (source.includes(after)) return;
    throw new Error(`Session runtime codemod could not find ${label}`);
  }
  if (source.indexOf(before, index + before.length) >= 0) {
    throw new Error(`Session runtime codemod found multiple ${label} blocks`);
  }
  source = source.slice(0, index) + after + source.slice(index + before.length);
}

function replaceRegex(pattern, after, label) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const matches = [...source.matchAll(new RegExp(pattern.source, flags))];
  if (matches.length === 0) {
    if (source.includes(after)) return;
    throw new Error(`Session runtime codemod could not find ${label}`);
  }
  if (matches.length !== 1) throw new Error(`Session runtime codemod found ${matches.length} ${label} blocks`);
  source = source.replace(pattern, after);
}

replaceExact(
  'import { sanitizePersistedTrackSettings, sanitizeTasteProfile, validPersistedSong } from "./core/session-contract.js";\n',
  'import { applyPersistedSessionState, createPersistedSessionSnapshot, createSessionAutosaveController, decodePersistedSession } from "./core/session-runtime.js";\n',
  "session contract import",
);

replaceExact('let sessionSaveTimer = null;\n', '', "session save timer");

const runtimeBlock = `const sessionRuntime = createSessionAutosaveController({
  storage: sessionStorage,
  snapshot: () => createPersistedSessionSnapshot(state, {
    schema: SESSION_SCHEMA,
    normalizeMixAssistant,
  }),
  onSaved() {
    const status = $("#autosaveStatus");
    if (status) status.innerHTML = "<i></i> SAVED ON DEVICE";
  },
  onUnavailable(result) {
    if (result?.error) console.warn("Session autosave was unavailable", result.error);
    const status = $("#autosaveStatus");
    if (status) status.textContent = "SESSION OPEN";
  },
  defer(task) {
    if (typeof window !== "undefined" && typeof window.requestIdleCallback === "function") {
      window.requestIdleCallback(task, { timeout: 1000 });
    } else {
      task();
    }
  },
});

export function saveSessionNow() {
  return sessionRuntime.saveNow();
}

function scheduleSessionSave() {
  return sessionRuntime.schedule();
}

function discardPersistedSession() {
  return sessionRuntime.discard();
}

export function restorePersistedSession() {
  rejectedPersistedSession = false;
  const restored = decodePersistedSession(sessionStorage.load(), {
    schema: SESSION_SCHEMA,
    trackOrder: TRACK_ORDER,
    defaultTrackSettings: DEFAULT_TRACK_SETTINGS,
    genreIds: GENRE_IDS,
    recipeCount: RECIPES.length,
    normalizeMixAssistant,
  });
  if (restored.status === "empty") return false;
  if (restored.status !== "ready") {
    if (restored.error) console.warn("Saved session was corrupt and has been ignored", restored.error);
    rejectedPersistedSession = true;
    discardPersistedSession();
    return false;
  }
  applyPersistedSessionState(state, restored.value);
  return true;
}

const editorNoteIds`;

replaceRegex(
  /function persistedSession\(\) \{[\s\S]*?\nconst editorNoteIds/,
  runtimeBlock,
  "session persistence runtime",
);

if (source === original) {
  console.log("Session runtime codemod: no changes required.");
  process.exit(0);
}

fs.writeFileSync(path, source);
console.log(`Session runtime codemod updated src/app.js (${original.length} -> ${source.length} bytes).`);
