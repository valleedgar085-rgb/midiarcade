import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const app = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");

test("unaccepted Shape After never becomes the autosaved or history source", () => {
  assert.match(app, /function shapeDirectorPersistenceState\(\)[\s\S]*?director\?\.transaction[\s\S]*?director\.audition === "after"[\s\S]*?song: director\.transaction\.before/);
  assert.match(app, /createPersistedSessionSnapshot\(shapeDirectorPersistenceState\(\)/);
  assert.match(app, /song: deepClone\(shapeDirectorPersistenceState\(\)\.song\)/);
});

test("pending Shape candidates resolve before destructive or context-changing boundaries", () => {
  const guarded = [
    /async function runGeneration[\s\S]*?resolvePendingShapeDirectorCandidate/,
    /export function selectSongVariation[\s\S]*?resolvePendingShapeDirectorCandidate/,
    /export function focusSongSection[\s\S]*?resolvePendingShapeDirectorCandidate/,
    /onChange\(workspace\)[\s\S]*?resolvePendingShapeDirectorCandidate/,
    /async function exportSong[\s\S]*?resolvePendingShapeDirectorCandidate/,
    /function restoreHistory[\s\S]*?resolvePendingShapeDirectorCandidate/,
    /function redoHistory[\s\S]*?resolvePendingShapeDirectorCandidate/,
    /#resetControlsButton[\s\S]*?resolvePendingShapeDirectorCandidate/,
    /function resetSessionStateForFreshStart[\s\S]*?resolvePendingShapeDirectorCandidate/,
  ];
  for (const contract of guarded) assert.match(app, contract);
});

test("fresh session reset cannot resurrect stale Shape transactions", () => {
  assert.match(app, /state\.sectionMacroValues = \{\};[\s\S]*?state\.shapeDirector = null/);
});
