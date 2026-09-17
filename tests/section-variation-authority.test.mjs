import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

function between(start, end) {
  const startIndex = appSource.indexOf(start);
  assert.notEqual(startIndex, -1, `missing source marker: ${start}`);
  const endIndex = appSource.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, `missing end marker: ${end}`);
  return appSource.slice(startIndex, endIndex);
}

test("section variation audition stays outside canonical song authority", () => {
  const audition = between("async function auditionSectionVariation(option)", "function keepSectionVariation()");
  assert.doesNotMatch(audition, /state\.song\s*=/);
  assert.match(audition, /player\.auditionSong\(candidate/);
  assert.match(audition, /songBpm\(candidate\)/);
});

test("section variation Keep is the only A/B promotion point", () => {
  const keep = between("function keepSectionVariation()", "function cancelSectionVariations()");
  assert.match(keep, /pushHistory\(\{ \.\.\.createHistorySnapshot\(\), song: deepClone\(state\.song\) \}\)/);
  assert.match(keep, /state\.song = deepClone\(candidate\)/);
  assert.match(keep, /applyTrackSettingsToSong\(state\.song\)/);
  assert.match(keep, /state\.sectionVariations = null/);
});

test("section variation Cancel clears transient state without rewriting the song", () => {
  const cancel = between("function cancelSectionVariations()", "function renderArrangeWorkflow()");
  assert.doesNotMatch(cancel, /state\.song\s*=/);
  assert.match(cancel, /player\.stop\(\)/);
  assert.match(cancel, /state\.sectionVariations = null/);
});

test("PreviewPlayer can audition an explicit song while normal playback remains canonical", () => {
  const playerClass = between("export class PreviewPlayer", "const player = new PreviewPlayer()");
  assert.match(playerClass, /buildEvents\(\) \{[\s\S]*?const song = this\.playbackSong \?\? state\.song/);
  assert.match(playerClass, /this\.events = buildPreviewEvents\(song\)/);
  assert.match(playerClass, /this\.playbackView = playbackViewForSong\(song\)/);
  assert.match(playerClass, /async auditionSong\(song, \{ startSeconds = 0 \} = \{\}\)/);
  assert.match(playerClass, /async play\(\) \{[\s\S]*?const song = this\.playbackSong \?\? state\.song/);
  assert.match(playerClass, /this\.playbackSong = null/);
});

test("generation and export continue sourcing the committed state.song", () => {
  assert.match(appSource, /const sourceSong = options\.sourceSong \?\? state\.song/);
  assert.match(appSource, /export function buildExportSongSnapshot\(song = state\.song/);
  assert.match(appSource, /createPersistedSessionSnapshot\(shapeDirectorPersistenceState\(\)/);
});
