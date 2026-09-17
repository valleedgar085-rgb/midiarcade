import fs from 'node:fs';

const appPath = 'src/app.js';
const smokePath = 'tests/app-smoke.test.mjs';
const testPath = 'tests/section-variation-authority.test.mjs';

let source = fs.readFileSync(appPath, 'utf8');

function replaceOnce(label, before, after) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`${label}: expected source was not found`);
  if (source.indexOf(before, first + before.length) >= 0) {
    throw new Error(`${label}: expected source was not unique`);
  }
  source = source.slice(0, first) + after + source.slice(first + before.length);
}

replaceOnce(
  'section variation audition',
`async function auditionSectionVariation(option) {
  const lab = state.sectionVariations;
  const section = editorSection();
  if (!lab || !section) return;
  const candidate = option === 0 ? lab.base : lab.options?.[option - 1];
  if (!candidate) return;
  state.song = deepClone(candidate);
  lab.activeOption = option;
  applyTrackSettingsToSong(state.song);
  renderAll();
  const range = editorBeatRange(section);
  player.seek(range.start * 60 / songBpm());
  if (!player.playing) await player.play();
}`,
`async function auditionSectionVariation(option) {
  const lab = state.sectionVariations;
  const section = editorSection();
  if (!lab || !section) return;
  const candidate = option === 0 ? lab.base : lab.options?.[option - 1];
  if (!candidate) return;
  lab.activeOption = option;
  renderSectionVariationLab(section);
  const range = editorBeatRange(section);
  await player.auditionSong(candidate, {
    startSeconds: range.start * 60 / songBpm(candidate),
  });
}`,
);

replaceOnce(
  'section variation keep',
`function keepSectionVariation() {
  const lab = state.sectionVariations;
  if (!lab) return;
  if (lab.activeOption > 0) {
    pushHistory({ ...createHistorySnapshot(), song: deepClone(lab.base) });
    showToast(\`Option \${String.fromCharCode(64 + lab.activeOption)} is now part of the song.\`);
  } else {
    showToast("The original section is staying in the song.");
  }
  state.sectionVariations = null;
  renderSectionVariationLab();
  scheduleSessionSave();
}`,
`function keepSectionVariation() {
  const lab = state.sectionVariations;
  if (!lab) return;
  const option = Number(lab.activeOption || 0);
  const candidate = option === 0 ? lab.base : lab.options?.[option - 1];
  if (!candidate) return;
  player.stop();
  if (option > 0) {
    pushHistory({ ...createHistorySnapshot(), song: deepClone(state.song) });
    state.song = deepClone(candidate);
    applyTrackSettingsToSong(state.song);
    showToast(\`Option \${String.fromCharCode(64 + option)} is now part of the song.\`);
  } else {
    showToast("The original section is staying in the song.");
  }
  state.sectionVariations = null;
  renderAll();
  scheduleSessionSave();
}`,
);

replaceOnce(
  'section variation cancel',
`function cancelSectionVariations() {
  const lab = state.sectionVariations;
  if (!lab) return;
  player.stop();
  state.song = deepClone(lab.base);
  applyTrackSettingsToSong(state.song);
  state.sectionVariations = null;
  renderAll();
  scheduleSessionSave();
  showToast("The original section is restored. No variation was committed.");
}`,
`function cancelSectionVariations() {
  if (!state.sectionVariations) return;
  player.stop();
  state.sectionVariations = null;
  renderAll();
  scheduleSessionSave();
  showToast("No variation was committed.");
}`,
);

replaceOnce(
  'preview playback state',
`    this.playbackView = null;
    this.recoveryPromise = null;`,
`    this.playbackView = null;
    this.playbackSong = null;
    this.recoveryPromise = null;`,
);

replaceOnce(
  'current playback time',
`  currentSongTime() {
    if (!this.playing || !this.context) return this.position;
    return clamp(this.offset + (this.context.currentTime - this.startedAt), 0, totalSeconds());
  }`,
`  currentSongTime() {
    if (!this.playing || !this.context) return this.position;
    const song = this.playbackSong ?? state.song;
    return clamp(this.offset + (this.context.currentTime - this.startedAt), 0, totalSeconds(song));
  }`,
);

replaceOnce(
  'preview build events',
`  buildEvents() {
    this.events = buildPreviewEvents();
    this.configureSongFx();
    this.playbackView = playbackViewForSong();
    this.lastDetailRefreshAt = -Infinity;
  }`,
`  buildEvents(song = this.playbackSong ?? state.song) {
    this.playbackSong = song;
    this.events = buildPreviewEvents(song);
    this.configureSongFx(song);
    this.playbackView = playbackViewForSong(song);
    this.lastDetailRefreshAt = -Infinity;
  }`,
);

replaceOnce(
  'preview sidechain source',
`  applyKickSidechain(when) {
    const profile = previewSidechain(state.song ?? {}, state.mixAssistant);`,
`  applyKickSidechain(when) {
    const profile = previewSidechain(this.playbackSong ?? state.song ?? {}, state.mixAssistant);`,
);

replaceOnce(
  'preview audition entry point',
`  async toggle() {
    this.playing ? this.pause() : await this.play();
  }

  async play() {
    if (!state.song) return false;`,
`  async toggle() {
    this.playing ? this.pause() : await this.play();
  }

  async auditionSong(song, { startSeconds = 0 } = {}) {
    if (!song) return false;
    this.stop();
    this.position = clamp(Number(startSeconds) || 0, 0, totalSeconds(song));
    return this.play(song);
  }

  async play(song = this.playbackSong ?? state.song) {
    if (!song) return false;`,
);

replaceOnce(
  'preview play build source',
`    this.buildEvents();
    const duration = totalSeconds();`,
`    this.buildEvents(song);
    const duration = totalSeconds(song);`,
);

replaceOnce(
  'preview update frame song source',
`  updateFrame() {
    if (!this.playing || !this.context) return;
    const duration = totalSeconds();
    this.position = this.offset + (this.context.currentTime - this.startedAt);
    if (state.queuedSection && this.position >= (state.queuedSection.triggerBeat * 60 / songBpm())) {
      const targetSec = state.queuedSection;
      state.queuedSection = null;
      syncMobileSectionJump(targetSec.targetSectionId);
      this.seek(targetSec.targetStartBeat * 60 / songBpm());`,
`  updateFrame() {
    if (!this.playing || !this.context) return;
    const playbackSong = this.playbackSong ?? state.song;
    const duration = totalSeconds(playbackSong);
    this.position = this.offset + (this.context.currentTime - this.startedAt);
    if (state.queuedSection && this.position >= (state.queuedSection.triggerBeat * 60 / songBpm(playbackSong))) {
      const targetSec = state.queuedSection;
      state.queuedSection = null;
      syncMobileSectionJump(targetSec.targetSectionId);
      this.seek(targetSec.targetStartBeat * 60 / songBpm(playbackSong));`,
);

replaceOnce(
  'preview pause duration',
`    updateCreativeThreadPlayback(this.position, totalSeconds());
  }

  stop() {`,
`    updateCreativeThreadPlayback(this.position, totalSeconds(this.playbackSong ?? state.song));
  }

  stop() {`,
);

replaceOnce(
  'preview cache reset',
`  releasePlaybackCache() {
    this.events = [];
    this.eventIndex = 0;
    this.playbackView = null;
    this.lastDetailRefreshAt = -Infinity;
  }`,
`  releasePlaybackCache() {
    this.events = [];
    this.eventIndex = 0;
    this.playbackView = null;
    this.playbackSong = null;
    this.lastDetailRefreshAt = -Infinity;
  }`,
);

replaceOnce(
  'preview seek and restart',
`  seek(position) {
    const wasPlaying = this.playing;
    this.pause();
    this.position = clamp(position, 0, totalSeconds());
    updatePlaybackUi(this.position, totalSeconds());
    if (wasPlaying) this.play();
  }

  restart() {
    const shouldPlay = this.playing;
    this.stop();
    if (shouldPlay) this.play();
  }`,
`  seek(position) {
    const playbackSong = this.playbackSong ?? state.song;
    const wasPlaying = this.playing;
    this.pause();
    this.position = clamp(position, 0, totalSeconds(playbackSong));
    updatePlaybackUi(this.position, totalSeconds(playbackSong), {
      view: this.playbackView ?? playbackViewForSong(playbackSong),
    });
    if (wasPlaying) this.play(playbackSong);
  }

  restart() {
    const shouldPlay = this.playing;
    const playbackSong = this.playbackSong ?? state.song;
    this.stop();
    if (shouldPlay) this.play(playbackSong);
  }`,
);

fs.writeFileSync(appPath, source);

let smoke = fs.readFileSync(smokePath, 'utf8');
const oldSmoke = '  assert.match(appSource, /function cancelSectionVariations[\\s\\S]*?state\\.song = deepClone\\(lab\\.base\\)/, "the A/B lab must restore its exact original without committing");';
const newSmoke = '  assert.match(appSource, /async function auditionSectionVariation[\\s\\S]*?player\\.auditionSong\\(candidate/, "the A/B lab must audition candidates without installing them as canonical song state");';
if (!smoke.includes(oldSmoke)) throw new Error('app smoke assertion: expected source was not found');
smoke = smoke.replace(oldSmoke, newSmoke);
fs.writeFileSync(smokePath, smoke);

const authorityTest = `import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

function between(start, end) {
  const startIndex = appSource.indexOf(start);
  assert.notEqual(startIndex, -1, \`missing source marker: \${start}\`);
  const endIndex = appSource.indexOf(end, startIndex + start.length);
  assert.notEqual(endIndex, -1, \`missing end marker: \${end}\`);
  return appSource.slice(startIndex, endIndex);
}

test("section variation audition stays outside canonical song authority", () => {
  const audition = between("async function auditionSectionVariation(option)", "function keepSectionVariation()");
  assert.doesNotMatch(audition, /state\\.song\\s*=/);
  assert.match(audition, /player\\.auditionSong\\(candidate/);
  assert.match(audition, /songBpm\\(candidate\\)/);
});

test("section variation Keep is the only A/B promotion point", () => {
  const keep = between("function keepSectionVariation()", "function cancelSectionVariations()");
  assert.match(keep, /pushHistory\\(\\{ \\.\\.\\.createHistorySnapshot\\(\\), song: deepClone\\(state\\.song\\) \\}\\)/);
  assert.match(keep, /state\\.song = deepClone\\(candidate\\)/);
  assert.match(keep, /applyTrackSettingsToSong\\(state\\.song\\)/);
  assert.match(keep, /state\\.sectionVariations = null/);
});

test("section variation Cancel clears transient state without rewriting the song", () => {
  const cancel = between("function cancelSectionVariations()", "function renderArrangeWorkflow()");
  assert.doesNotMatch(cancel, /state\\.song\\s*=/);
  assert.match(cancel, /player\\.stop\\(\\)/);
  assert.match(cancel, /state\\.sectionVariations = null/);
});

test("PreviewPlayer can audition an explicit song while normal playback remains canonical", () => {
  const playerClass = between("export class PreviewPlayer", "const player = new PreviewPlayer()");
  assert.match(playerClass, /buildEvents\\(song = this\\.playbackSong \\?\\? state\\.song\\)/);
  assert.match(playerClass, /this\\.events = buildPreviewEvents\\(song\\)/);
  assert.match(playerClass, /this\\.playbackView = playbackViewForSong\\(song\\)/);
  assert.match(playerClass, /async auditionSong\\(song, \\{ startSeconds = 0 \\} = \\{\\}\\)/);
  assert.match(playerClass, /async play\\(song = this\\.playbackSong \\?\\? state\\.song\\)/);
  assert.match(playerClass, /this\\.playbackSong = null/);
});

test("generation and export continue sourcing the committed state.song", () => {
  assert.match(appSource, /const sourceSong = options\\.sourceSong \\?\\? state\\.song/);
  assert.match(appSource, /export function buildExportSongSnapshot\\(song = state\\.song/);
  assert.match(appSource, /createPersistedSessionSnapshot\\(shapeDirectorPersistenceState\\(\\)/);
});
`;
fs.writeFileSync(testPath, authorityTest);

console.log('Track A1 authority patch applied to working tree.');
