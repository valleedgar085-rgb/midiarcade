import assert from "node:assert/strict";
import test from "node:test";
import { copyGenerationDebuggerReport } from "../src/ui/debugger-copy.js";

test("a device-only report can be copied before generation, without confusing MIDI capability with preview or export success", async () => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  let copied;
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { clipboard: { async writeText(value) { copied = value; } } } });
  const runtime = { host: "native-webview", midi: { nativeInputApi: true, webMidiApi: false, connectedInputs: 0 },
    preview: { contextState: "not-started" }, export: { route: "native-cache-share", status: "not-attempted" } };
  try {
    await copyGenerationDebuggerReport({ runs: [], workerActive: false, runtime, toast() {} });
    assert.deepEqual(JSON.parse(copied).runtime, runtime);
    assert.deepEqual(JSON.parse(copied).runs, []);
  } finally {
    if (descriptor) Object.defineProperty(globalThis, "navigator", descriptor);
    else delete globalThis.navigator;
  }
});
