import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createMidiInputManager } from "../src/midi-input.js";

const app = readFileSync(new URL("../src/app.js", import.meta.url), "utf8");
const handlerSource = app.slice(app.indexOf("function handleMidiInputEvent("), app.indexOf("export function shouldDisconnectStaleMidiConnection"));

test("the app preview handler consumes the bridge's actual normalized note names and pitches", () => {
  const calls = [];
  const handler = runInNewContext(`(${handlerSource})`, { player: {
    liveNoteOn: (pitch, velocity) => calls.push(["on", pitch, velocity]),
    liveNoteOff: (pitch) => calls.push(["off", pitch]),
  } });
  const manager = createMidiInputManager({ getWindow: () => ({}), onNote: handler });
  manager._receive("web:keys", [0x90, 67, 96], 1);
  manager._receive("web:keys", [0x80, 67, 0], 2);
  assert.deepEqual(calls, [["on", 67, 96], ["off", 67]]);
});

test("sustain and disconnect releases reach the same live-preview boundary", async () => {
  const calls = [];
  const handler = runInNewContext(`(${handlerSource})`, { player: {
    liveNoteOn: (pitch, velocity) => calls.push(["on", pitch, velocity]),
    liveNoteOff: (pitch) => calls.push(["off", pitch]),
  } });
  const manager = createMidiInputManager({ getWindow: () => ({}), onNote: handler });
  manager._receive("native:keys", [0xb0, 64, 127], 1);
  manager._receive("native:keys", [0x90, 60, 127], 2);
  manager._receive("native:keys", [0x80, 60, 0], 3);
  assert.deepEqual(calls, [["on", 60, 127]]);
  manager._releaseActiveNotes("native:keys", "disconnect");
  assert.deepEqual(calls, [["on", 60, 127], ["off", 60]]);
});
