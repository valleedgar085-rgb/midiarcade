import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

test("PreviewPlayer loop restart preserves the master path instead of re-entering full play", () => {
  assert.match(appSource, /rampAudioParamValue/);
  assert.match(appSource, /restartLoopPlayback\(\)\s*\{[\s\S]*?clearScheduledAudio\(\)[\s\S]*?resetDynamicBuses\(\)[\s\S]*?this\.offset\s*=\s*0[\s\S]*?this\.schedule\(\)/);

  const updateFrame = appSource.match(/updateFrame\(\)\s*\{[\s\S]*?\n\s*clearTimers\(\)/)?.[0] ?? "";
  assert.match(updateFrame, /if\s*\(state\.loop\)\s*\{[\s\S]*?this\.restartLoopPlayback\(\)/);
  assert.doesNotMatch(updateFrame, /if\s*\(state\.loop\)\s*\{[\s\S]*?this\.play\(\)/);
});

test("PreviewPlayer master transitions use held ramps for play and pause", () => {
  const play = appSource.match(/async play\(\)\s*\{[\s\S]*?\n\s*schedule\(\)/)?.[0] ?? "";
  const pause = appSource.match(/pause\(\)\s*\{[\s\S]*?\n\s*stop\(\)/)?.[0] ?? "";

  assert.match(play, /rampAudioParamValue\(this\.master\.gain,\s*0\.42/);
  assert.doesNotMatch(play, /setValueAtTime\(0\.0001,\s*now\)/);
  assert.match(pause, /rampAudioParamValue\(this\.master\.gain,\s*0\.0001/);
  assert.ok(
    pause.indexOf("rampAudioParamValue(this.master.gain, 0.0001") < pause.indexOf("this.clearScheduledAudio()"),
    "master fade must begin before scheduled voices are released",
  );
});
