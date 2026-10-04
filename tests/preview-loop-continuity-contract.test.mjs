import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appSource = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

test("PreviewPlayer pre-schedules the next loop head without tearing down audio", () => {
  const schedule = appSource.match(/schedule\(\)\s*\{[\s\S]*?\n\s*voicePriority\(event\)/)?.[0] ?? "";
  const boundary = appSource.match(/commitLoopBoundary\([\s\S]*?\n\s*startScheduler\(\)/)?.[0] ?? "";

  assert.match(schedule, /loopHeadHorizonSeconds/);
  assert.match(schedule, /duration \+ event\.time/);
  assert.match(schedule, /__loopPreview: true/);
  assert.match(boundary, /wrappedLoopPosition/);
  assert.match(boundary, /promoteLoopPreviewVoices\(\)/);
  assert.doesNotMatch(boundary, /clearScheduledAudio\(\)/);
  assert.doesNotMatch(boundary, /clearTimers\(\)/);

  const updateFrame = appSource.match(/updateFrame\(\)\s*\{[\s\S]*?\n\s*clearTimers\(\)/)?.[0] ?? "";
  assert.match(updateFrame, /if\s*\(state\.loop\)[\s\S]*?this\.commitLoopBoundary\(/);
  assert.doesNotMatch(updateFrame, /restartLoopPlayback/);
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
