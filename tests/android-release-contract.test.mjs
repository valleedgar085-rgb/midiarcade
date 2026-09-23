import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const appSource = fs.readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const packageJson = JSON.parse(fs.readFileSync(new URL("../package.json", import.meta.url), "utf8"));
const activityMain = fs.readFileSync(new URL("../android/app/src/main/res/layout/activity_main.xml", import.meta.url), "utf8");
const nativeShellDrawable = fs.readFileSync(new URL("../android/app/src/main/res/drawable/midi_arcade.xml", import.meta.url), "utf8");
const brandColors = fs.readFileSync(new URL("../android/app/src/main/res/values/brand_colors_v2.xml", import.meta.url), "utf8");

function between(start, end) {
  const from = appSource.indexOf(start);
  const to = appSource.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `missing source boundary: ${start}`);
  return appSource.slice(from, to);
}

test("Android release gate keeps playback lifecycle recovery wired", () => {
  const player = between("export class PreviewPlayer", "const player = new PreviewPlayer()");
  assert.match(player, /document\.addEventListener\("visibilitychange", this\.visibilityHandler\)/);
  assert.match(player, /document\.visibilityState === "hidden"[\s\S]*?this\.position = this\.currentSongTime\(\)/);
  assert.match(player, /this\.clearTimers\(\)[\s\S]*?this\.clearScheduledAudio\(\)[\s\S]*?this\.context\.suspend\(\)/);
  assert.match(player, /document\.visibilityState === "visible"[\s\S]*?recoverAudioContext\(this\.context\)/);
  assert.match(player, /navigator\.mediaDevices\.addEventListener\("devicechange", this\.deviceChangeHandler\)/);
  assert.match(player, /handleContextStateChange\(context\)[\s\S]*?\["suspended", "interrupted", "closed"\]/);
  assert.match(player, /async recoverAudioContext[\s\S]*?requestGeneration !== this\.playRequestGeneration/);
  assert.match(player, /document\.removeEventListener\("visibilitychange", this\.visibilityHandler\)/);
  assert.match(player, /removeEventListener\?\.\("devicechange", this\.deviceChangeHandler\)/);
});

test("pause, seek, restart, and disposal preserve explicit playback ownership", () => {
  const player = between("export class PreviewPlayer", "const player = new PreviewPlayer()");
  const pause = player.match(/pause\(\)\s*\{[\s\S]*?\n\s*stop\(\)/)?.[0] ?? "";
  const seek = player.match(/seek\(position\)\s*\{[\s\S]*?\n\s*restart\(\)/)?.[0] ?? "";
  const dispose = player.match(/dispose\(\)\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? "";
  assert.match(pause, /this\.position = this\.offset \+ \(this\.context\.currentTime - this\.startedAt\)/);
  assert.match(pause, /this\.cancelPendingPlay\(\)/);
  assert.match(seek, /const wasPlaying = this\.playing/);
  assert.match(seek, /this\.pause\(\)/);
  assert.match(seek, /this\.position = clamp\(position, 0, totalSeconds\(playbackSong\)\)/);
  assert.match(seek, /if \(wasPlaying\) this\.play\(\)/);
  assert.match(dispose, /this\.cancelPendingPlay\(\)/);
  assert.match(dispose, /this\.stopAllLiveNotes\(\)/);
});

test("app lifecycle invalidates generation ownership before worker disposal", () => {
  const wiring = between('window.addEventListener?.("pagehide"', "function resetSessionStateForFreshStart");
  const invalidate = wiring.indexOf("generationOwnership.invalidate()");
  const executorDispose = wiring.indexOf("generationExecutor.dispose()");
  const playerDispose = wiring.indexOf("player.dispose()");
  assert.ok(invalidate >= 0);
  assert.ok(executorDispose > invalidate);
  assert.ok(playerDispose > invalidate);
  assert.match(wiring, /clearGenerationSafetyTimer\(\)/);
  assert.match(wiring, /state\.isGenerating = false/);
  assert.match(wiring, /saveSessionNow\(\)/);
});

test("native MIDI handoff stays clone-only and uses Capacitor cache + Share", () => {
  const nativeHandoff = between("export async function exportSongNative", "/**\n * Prune the midi-exports cache");
  const exportFlow = between("export function buildExportSongSnapshot", "function expressionPoints");
  assert.match(exportFlow, /const clone = deepClone\(song\)/);
  assert.match(exportFlow, /const clone = buildExportSongSnapshot\(\)/);
  assert.match(exportFlow, /prepareMidiExport\(clone, currentExportSetup\(\)\)/);
  assert.match(nativeHandoff, /Filesystem\.writeFile\(\{[\s\S]*?directory: "CACHE"[\s\S]*?recursive: true/);
  assert.match(nativeHandoff, /Share\.share\(\{[\s\S]*?url: result\.uri[\s\S]*?dialogTitle: "Save MIDI Song Idea"/);
  assert.match(nativeHandoff, /pruneMidiExportsCache\(\)\.catch/);
});

test("native Android shell preserves the uploaded MIDI Arcade frame responsively", () => {
  assert.match(activityMain, /android:id="@\+id\/midi_arcade"/);
  assert.match(activityMain, /android:layout_width="match_parent"/);
  assert.match(activityMain, /android:layout_height="match_parent"/);
  assert.match(activityMain, /android:background="@drawable\/midi_arcade"/);
  assert.match(activityMain, /android:clipToOutline="true"/);
  assert.match(activityMain, /android:outlineProvider="background"/);
  assert.match(activityMain, /<WebView[\s\S]*?android:background="@android:color\/transparent"/);
  assert.doesNotMatch(activityMain, /402dp|874dp/);

  assert.match(nativeShellDrawable, /<solid android:color="#0D0E11"\s*\/>/);
  assert.match(nativeShellDrawable, /<corners android:radius="24dp"\s*\/>/);
  assert.match(brandColors, /<color name="midi_arcade_surface_v2">#0D0E11<\/color>/);
});

test("focused Android release command runs the protected contract suites", () => {
  const script = packageJson.scripts?.["test:android-release"] ?? "";
  for (const path of [
    "tests/android-release-contract.test.mjs",
    "tests/generation-timeout-ownership.test.mjs",
    "tests/preview-loop-continuity-contract.test.mjs",
    "tests/phase7-audio-runtime.test.mjs",
    "tests/section-variation-authority.test.mjs",
  ]) assert.ok(script.includes(path), `Android release script must include ${path}`);
});
