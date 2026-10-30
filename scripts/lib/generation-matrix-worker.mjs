// Node transport for the actual browser worker entry point, not a fake engine.
import { parentPort } from "node:worker_threads";
globalThis.self = {
  addEventListener(type, callback) {
    if (type === "message") parentPort.on("message", (data) => callback({ data }));
  },
  postMessage(message) { parentPort.postMessage(message); },
};
await import("../../src/generation-worker.js");
