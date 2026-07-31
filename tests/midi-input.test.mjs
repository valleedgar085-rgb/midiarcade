import assert from "node:assert/strict";
import test from "node:test";

import {
  MidiInputManager,
  createMidiInputManager,
  parseMidiBytes,
  parseMidiMessage,
} from "../src/midi-input.js";

function createNativePlugin(initialDevices = []) {
  let devices = initialDevices;
  const listeners = new Map();
  const connected = [];
  const disconnected = [];
  let permissionCalls = 0;
  let removedListeners = 0;

  return {
    get permissionCalls() { return permissionCalls; },
    get connected() { return connected; },
    get disconnected() { return disconnected; },
    get removedListeners() { return removedListeners; },
    setDevices(next) { devices = next; },
    async emit(name, payload) { return listeners.get(name)?.(payload); },
    async listDevices() { return { devices }; },
    async requestPermissions() { permissionCalls += 1; },
    async connect(options) {
      connected.push(options);
      return { connectionId: `native-connection-${options.deviceId}-${options.portId ?? "default"}` };
    },
    async disconnect(options) { disconnected.push(options); },
    async addListener(name, callback) {
      listeners.set(name, callback);
      return {
        async remove() {
          if (listeners.get(name) === callback) listeners.delete(name);
          removedListeners += 1;
        },
      };
    },
  };
}

function createWebInput(id, name = id) {
  const listeners = new Map();
  return {
    id,
    name,
    manufacturer: "Mock Keys",
    state: "connected",
    connection: "closed",
    openCalls: 0,
    closeCalls: 0,
    async open() {
      this.openCalls += 1;
      this.connection = "open";
      return this;
    },
    async close() {
      this.closeCalls += 1;
      this.connection = "closed";
    },
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name, callback) {
      if (listeners.get(name) === callback) listeners.delete(name);
    },
    emit(data, timestamp = 10) {
      return listeners.get("midimessage")?.({ data: Uint8Array.from(data), receivedTime: timestamp });
    },
    hasListener(name) { return listeners.has(name); },
  };
}

function createMidiAccess(inputs = []) {
  const listeners = new Map();
  return {
    inputs: new Map(inputs.map((input) => [input.id, input])),
    addEventListener(name, callback) { listeners.set(name, callback); },
    removeEventListener(name, callback) {
      if (listeners.get(name) === callback) listeners.delete(name);
    },
    emitStateChange(event = {}) { return listeners.get("statechange")?.(event); },
    hasListener(name) { return listeners.has(name); },
  };
}

test("module import does not inspect browser globals", async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    get() { throw new Error("window was read during module import"); },
  });
  try {
    const imported = await import(`../src/midi-input.js?no-globals=${Date.now()}`);
    assert.equal(typeof imported.MidiInputManager, "function");
  } finally {
    if (original) Object.defineProperty(globalThis, "window", original);
    else delete globalThis.window;
  }
});

test("parseMidiBytes normalizes note messages and note-on velocity zero", () => {
  assert.deepEqual(parseMidiBytes([0x92, 60, 100]), {
    type: "note-on",
    channel: 2,
    note: 60,
    velocity: 100,
    normalizedVelocity: 100 / 127,
    noteOnWithZeroVelocity: false,
    raw: [0x92, 60, 100],
  });
  assert.deepEqual(parseMidiBytes(Uint8Array.from([0x82, 60, 45])), {
    type: "note-off",
    channel: 2,
    note: 60,
    velocity: 45,
    normalizedVelocity: 45 / 127,
    noteOnWithZeroVelocity: false,
    raw: [0x82, 60, 45],
  });
  assert.deepEqual(parseMidiBytes([0x9f, 127, 0]), {
    type: "note-off",
    channel: 15,
    note: 127,
    velocity: 0,
    normalizedVelocity: 0,
    noteOnWithZeroVelocity: true,
    raw: [0x9f, 127, 0],
  });
  assert.equal(parseMidiMessage, parseMidiBytes);
});

test("parseMidiBytes exposes CC64 state and rejects malformed or unsupported data", () => {
  assert.deepEqual(parseMidiBytes([0xb0, 64, 63]), {
    type: "control-change",
    channel: 0,
    controller: 64,
    value: 63,
    normalizedValue: 63 / 127,
    raw: [0xb0, 64, 63],
    sustain: false,
  });
  assert.equal(parseMidiBytes([0xb0, 64, 64]).sustain, true);
  assert.equal(parseMidiBytes([0xb7, 1, 127]).sustain, undefined);
  assert.equal(parseMidiBytes([]), null);
  assert.equal(parseMidiBytes([0x90, 60]), null);
  assert.equal(parseMidiBytes([0x90, 60, 128]), null);
  assert.equal(parseMidiBytes([60, 100]), null, "running status is intentionally unsupported");
  assert.equal(parseMidiBytes([0xf8]), null, "system real-time messages are ignored");
  assert.equal(parseMidiBytes([0xc0, 10]), null, "non-note/channel-control messages are ignored");
  assert.equal(parseMidiBytes("90 3c 7f"), null);
});

test("native discovery is permission-free and returns normalized descriptors and connection ids", async () => {
  const plugin = createNativePlugin([{
    id: "keyboard-1",
    name: "Stage Piano",
    manufacturer: "Arcade",
    inputs: [{ id: "keys", name: "Keyboard Port" }],
  }]);
  const manager = createMidiInputManager({
    getWindow: () => ({ Capacitor: { Plugins: { MidiInput: plugin } } }),
  });

  const devices = await manager.refreshDevices();
  assert.equal(plugin.permissionCalls, 0);
  assert.deepEqual(devices, [{
    id: "native:keyboard-1:keys",
    backend: "native",
    rawId: "keyboard-1:keys",
    deviceId: "keyboard-1",
    portId: "keys",
    name: "Keyboard Port",
    manufacturer: "Arcade",
    state: "connected",
    connection: "closed",
    connected: false,
  }]);

  const connectionId = await manager.connect(devices[0].id);
  assert.equal(connectionId, "native:native-connection-keyboard-1-keys");
  assert.deepEqual(plugin.connected, [{ id: "keyboard-1:keys", deviceId: "keyboard-1", portId: "keys" }]);
  assert.deepEqual(manager.connectionIds, [connectionId]);

  assert.equal(await manager.disconnect(connectionId), true);
  assert.equal(await manager.disconnect(connectionId), false);
  assert.deepEqual(plugin.disconnected, [{ connectionId: "native-connection-keyboard-1-keys" }]);
  await manager.destroy();
  assert.equal(plugin.removedListeners, 2);
});

test("native events normalize notes and CC64 defers releases only on its channel", async () => {
  const plugin = createNativePlugin([{ id: "keys", name: "Keys" }]);
  let now = 1000;
  const notes = [];
  const manager = new MidiInputManager({
    getWindow: () => ({ Capacitor: { Plugins: { MidiInput: plugin } } }),
    now: () => now,
    onNote: (event) => notes.push(event),
  });
  const [device] = await manager.refreshDevices();
  const connectionId = await manager.connect(device.id);
  const rawConnectionId = connectionId.slice("native:".length);

  await plugin.emit("midiMessage", { connectionId: rawConnectionId, data: [0x90, 60, 110], timestamp: 1 });
  await plugin.emit("midiMessage", { connectionId: rawConnectionId, bytes: [0xb0, 64, 127], timestamp: 2 });
  await plugin.emit("midiMessage", { connectionId: rawConnectionId, status: 0x90, data1: 60, data2: 0, timestamp: 3 });
  await plugin.emit("midiMessage", { connectionId: rawConnectionId, data: [0x91, 65, 90], timestamp: 4 });
  await plugin.emit("midiMessage", { connectionId: rawConnectionId, data: [0x81, 65, 20], timestamp: 5 });

  assert.deepEqual(notes.map(({ type, channel, note }) => [type, channel, note]), [
    ["note-on", 0, 60],
    ["note-on", 1, 65],
    ["note-off", 1, 65],
  ]);

  now = 1006;
  await plugin.emit("midiMessage", { connectionId: rawConnectionId, data: [0xb0, 64, 0], timestamp: 6 });
  assert.equal(notes.length, 4);
  assert.match(notes[3].connectionId, /^native:/);
  assert.deepEqual(
    {
      type: notes[3].type,
      channel: notes[3].channel,
      note: notes[3].note,
      timestamp: notes[3].timestamp,
      originalTimestamp: notes[3].originalTimestamp,
      deferred: notes[3].deferred,
      zeroVelocity: notes[3].noteOnWithZeroVelocity,
    },
    {
      type: "note-off",
      channel: 0,
      note: 60,
      timestamp: 6,
      originalTimestamp: 3,
      deferred: true,
      zeroVelocity: true,
    },
  );
  await manager.destroy();
});

test("sustain retriggers preserve independent same-pitch note counts", async () => {
  const plugin = createNativePlugin([{ id: "keys", name: "Keys" }]);
  const notes = [];
  const manager = new MidiInputManager({
    getWindow: () => ({ Capacitor: { Plugins: { MidiInput: plugin } } }),
    onNote: (event) => notes.push(event),
  });
  const connectionId = await manager.connect((await manager.refreshDevices())[0].id);
  const rawConnectionId = connectionId.slice("native:".length);

  await plugin.emit("midiMessage", { connectionId: rawConnectionId, data: [0x90, 60, 110] });
  await plugin.emit("midiMessage", { connectionId: rawConnectionId, data: [0xb0, 64, 127] });
  await plugin.emit("midiMessage", { connectionId: rawConnectionId, data: [0x80, 60, 0] });
  await plugin.emit("midiMessage", { connectionId: rawConnectionId, data: [0x90, 60, 105] });
  await plugin.emit("midiMessage", { connectionId: rawConnectionId, data: [0xb0, 64, 0] });
  await plugin.emit("midiMessage", { connectionId: rawConnectionId, data: [0x80, 60, 0] });

  assert.deepEqual(notes.map(({ type, note, activeCount, deferred }) => ({
    type,
    note,
    activeCount,
    deferred: Boolean(deferred),
  })), [
    { type: "note-on", note: 60, activeCount: 1, deferred: false },
    { type: "note-on", note: 60, activeCount: 2, deferred: false },
    { type: "note-off", note: 60, activeCount: 1, deferred: true },
    { type: "note-off", note: 60, activeCount: 0, deferred: false },
  ]);
  await manager.destroy();
});

test("channel panic and controller reset messages release only their own channel", async () => {
  const plugin = createNativePlugin([{ id: "keys", name: "Keys" }]);
  const notes = [];
  const manager = new MidiInputManager({
    getWindow: () => ({ Capacitor: { Plugins: { MidiInput: plugin } } }),
    onNote: (event) => notes.push(event),
  });
  const connectionId = await manager.connect((await manager.refreshDevices())[0].id);
  const rawConnectionId = connectionId.slice("native:".length);

  await plugin.emit("midiMessage", { connectionId: rawConnectionId, data: [0x90, 60, 100] });
  await plugin.emit("midiMessage", { connectionId: rawConnectionId, data: [0xb0, 64, 127] });
  await plugin.emit("midiMessage", { connectionId: rawConnectionId, data: [0x80, 60, 0] });
  await plugin.emit("midiMessage", { connectionId: rawConnectionId, data: [0x91, 67, 100] });
  await plugin.emit("midiMessage", { connectionId: rawConnectionId, data: [0xb0, 121, 0] });

  assert.deepEqual(notes.map(({ type, channel, note, synthetic, reason }) => ({
    type, channel, note, synthetic: Boolean(synthetic), reason,
  })), [
    { type: "note-on", channel: 0, note: 60, synthetic: false, reason: undefined },
    { type: "note-on", channel: 1, note: 67, synthetic: false, reason: undefined },
    { type: "note-off", channel: 0, note: 60, synthetic: true, reason: "reset-all-controllers" },
  ]);

  await plugin.emit("midiMessage", { connectionId: rawConnectionId, data: [0xb0, 64, 0] });
  assert.equal(notes.length, 3, "controller reset must clear deferred sustain releases without duplicating them");
  await plugin.emit("midiMessage", { connectionId: rawConnectionId, data: [0xb1, 123, 0] });
  assert.deepEqual(
    { channel: notes.at(-1).channel, note: notes.at(-1).note, synthetic: notes.at(-1).synthetic, reason: notes.at(-1).reason },
    { channel: 1, note: 67, synthetic: true, reason: "all-notes-off" },
  );
  await manager.destroy();
});

test("all-sound-off releases every retrigger count without touching another channel", async () => {
  const plugin = createNativePlugin([{ id: "keys" }]);
  const notes = [];
  const manager = new MidiInputManager({
    getWindow: () => ({ Capacitor: { Plugins: { MidiInput: plugin } } }),
    onNote: (event) => notes.push(event),
  });
  const connectionId = await manager.connect((await manager.refreshDevices())[0].id);
  const rawConnectionId = connectionId.slice("native:".length);
  await plugin.emit("midiMessage", { connectionId: rawConnectionId, data: [0x92, 48, 100] });
  await plugin.emit("midiMessage", { connectionId: rawConnectionId, data: [0x92, 48, 95] });
  await plugin.emit("midiMessage", { connectionId: rawConnectionId, data: [0x93, 72, 90] });
  await plugin.emit("midiMessage", { connectionId: rawConnectionId, data: [0xb2, 120, 0] });

  const releases = notes.filter((event) => event.type === "note-off");
  assert.equal(releases.length, 2);
  assert.deepEqual(releases.map(({ channel, note, activeCount, reason }) => ({ channel, note, activeCount, reason })), [
    { channel: 2, note: 48, activeCount: 1, reason: "all-sound-off" },
    { channel: 2, note: 48, activeCount: 0, reason: "all-sound-off" },
  ]);
  await plugin.emit("midiMessage", { connectionId: rawConnectionId, data: [0xb3, 123, 0] });
  assert.equal(notes.at(-1).note, 72);
  assert.equal(notes.at(-1).reason, "all-notes-off");
  await manager.destroy();
});

test("connecting a second native input replaces the first while preserving Web MIDI", async () => {
  const plugin = createNativePlugin([
    { id: "native-a", name: "Native A" },
    { id: "native-b", name: "Native B" },
  ]);
  const webInput = createWebInput("web-a", "Web A");
  const webAccess = createMidiAccess([webInput]);
  const manager = new MidiInputManager({
    getWindow: () => ({
      Capacitor: { Plugins: { MidiInput: plugin } },
      navigator: { requestMIDIAccess: async () => webAccess },
    }),
  });

  const devices = await manager.requestWebMidi();
  const firstNative = devices.find((device) => device.id === "native:native-a");
  const secondNative = devices.find((device) => device.id === "native:native-b");
  const webDevice = devices.find((device) => device.id === "web:web-a");
  const firstConnection = await manager.connect(firstNative.id);
  const webConnection = await manager.connect(webDevice.id);
  const secondConnection = await manager.connect(secondNative.id);

  assert.deepEqual(plugin.disconnected, [{ connectionId: firstConnection.slice("native:".length) }]);
  assert.deepEqual(manager.connectionIds.sort(), [secondConnection, webConnection].sort());
  assert.equal(webInput.closeCalls, 0);
  await manager.destroy();
});

test("overlapping connects to the same native port share one in-flight request", async () => {
  const plugin = createNativePlugin([{ id: "keys", name: "Keys" }]);
  let releaseConnect;
  let connectCalls = 0;
  plugin.connect = async (options) => {
    connectCalls += 1;
    await new Promise((resolve) => { releaseConnect = resolve; });
    return { connectionId: `device:${options.deviceId}:port:${options.portId ?? 0}` };
  };
  const manager = new MidiInputManager({
    getWindow: () => ({ Capacitor: { Plugins: { MidiInput: plugin } } }),
  });
  const device = (await manager.refreshDevices())[0];

  const first = manager.connect(device.id);
  const second = manager.connect(device.id);
  await Promise.resolve();
  assert.equal(connectCalls, 1, "the bridge must be opened only once while that same port is pending");
  releaseConnect();
  const [firstId, secondId] = await Promise.all([first, second]);
  assert.equal(firstId, secondId);
  assert.deepEqual(manager.connectionIds, [firstId]);
  await manager.destroy();
});

test("rapid native X to Y to X opens a fresh request for the latest X intent", async () => {
  const plugin = createNativePlugin([
    { id: "x", name: "Keyboard X" },
    { id: "y", name: "Keyboard Y" },
  ]);
  const attempts = [];
  plugin.connect = (options) => new Promise((resolve, reject) => {
    attempts.push({ options, resolve, reject });
  });
  const manager = new MidiInputManager({
    getWindow: () => ({ Capacitor: { Plugins: { MidiInput: plugin } } }),
  });
  const devices = await manager.refreshDevices();
  const x = devices.find((device) => device.deviceId === "x");
  const y = devices.find((device) => device.deviceId === "y");

  const firstX = manager.connect(x.id);
  await Promise.resolve();
  const middleY = manager.connect(y.id);
  await Promise.resolve();
  const latestX = manager.connect(x.id);
  await Promise.resolve();
  assert.deepEqual(attempts.map((attempt) => attempt.options.deviceId), ["x", "y", "x"]);

  const staleResults = Promise.allSettled([firstX, middleY]);
  attempts[2].resolve({ connectionId: "latest-x" });
  assert.equal(await latestX, "native:latest-x");
  attempts[0].resolve({ connectionId: "stale-x" });
  attempts[1].resolve({ connectionId: "stale-y" });
  const settled = await staleResults;
  assert.ok(settled.every((result) => result.status === "rejected" && /superseded/i.test(result.reason.message)));
  assert.deepEqual(manager.connectionIds, ["native:latest-x"]);
  assert.deepEqual(plugin.disconnected.map(({ connectionId }) => connectionId).sort(), ["stale-x", "stale-y"]);
  await manager.destroy();
});

test("disconnect emits synthetic note-offs so active voices cannot stick", async () => {
  const plugin = createNativePlugin([{ id: "keys" }]);
  const notes = [];
  const manager = new MidiInputManager({
    getWindow: () => ({ Capacitor: { Plugins: { MidiInput: plugin } } }),
    now: () => 77,
    onNote: (event) => notes.push(event),
  });
  const connectionId = await manager.connect((await manager.refreshDevices())[0].id);
  await plugin.emit("midiMessage", { connectionId: connectionId.slice(7), data: [0x94, 72, 100] });
  await manager.disconnect(connectionId);
  assert.equal(notes.length, 2);
  assert.deepEqual(
    { type: notes[1].type, channel: notes[1].channel, note: notes[1].note, synthetic: notes[1].synthetic, reason: notes[1].reason },
    { type: "note-off", channel: 4, note: 72, synthetic: true, reason: "disconnect" },
  );
});

test("Web MIDI is requested only explicitly, connects ports, and cleans up listeners", async () => {
  const input = createWebInput("web-keys", "Web Keys");
  const access = createMidiAccess([input]);
  let requests = 0;
  let requestedOptions;
  const mockWindow = {
    navigator: {
      async requestMIDIAccess(options) {
        requests += 1;
        requestedOptions = options;
        return access;
      },
    },
  };
  const notes = [];
  const manager = new MidiInputManager({ getWindow: () => mockWindow, onNote: (event) => notes.push(event) });

  assert.deepEqual(await manager.refreshDevices(), []);
  assert.equal(requests, 0, "discovery must not trigger the Web MIDI permission prompt");
  const devices = await manager.requestWebMidi({ sysex: false });
  assert.equal(requests, 1);
  assert.deepEqual(requestedOptions, { sysex: false });
  assert.equal(devices[0].id, "web:web-keys");
  assert.equal(access.hasListener("statechange"), true);

  const connectionId = await manager.connect(devices[0]);
  assert.equal(connectionId, "web:web-keys");
  assert.equal(input.openCalls, 1);
  assert.equal(input.hasListener("midimessage"), true);
  input.emit([0x90, 48, 120], 12.5);
  input.emit([0x90, 48, 0], 13);
  assert.deepEqual(notes.map(({ type, note, backend, timestamp }) => ({ type, note, backend, timestamp })), [
    { type: "note-on", note: 48, backend: "web", timestamp: 12.5 },
    { type: "note-off", note: 48, backend: "web", timestamp: 13 },
  ]);

  await manager.disconnect(connectionId);
  assert.equal(input.closeCalls, 1);
  assert.equal(input.hasListener("midimessage"), false);
  await manager.destroy();
  assert.equal(access.hasListener("statechange"), false);
});

test("native and Web MIDI hot-plug events refresh the normalized device list", async () => {
  const plugin = createNativePlugin([{ id: "native-a", name: "Native A" }]);
  const webA = createWebInput("web-a", "Web A");
  const access = createMidiAccess([webA]);
  const changes = [];
  const manager = new MidiInputManager({
    getWindow: () => ({
      Capacitor: { Plugins: { MidiInput: plugin } },
      navigator: { requestMIDIAccess: async () => access },
    }),
  });
  manager.subscribeDevices((devices, info) => changes.push({ ids: devices.map((device) => device.id), reason: info.reason }));

  await manager.refreshDevices();
  await manager.requestWebMidi();
  plugin.setDevices([{ id: "native-a" }, { id: "native-b" }]);
  await plugin.emit("devicesChanged", {});
  assert.deepEqual(changes.at(-1), {
    ids: ["native:native-a", "native:native-b", "web:web-a"],
    reason: "native-hot-plug",
  });

  const webB = createWebInput("web-b", "Web B");
  access.inputs.set(webB.id, webB);
  await access.emitStateChange({ port: webB });
  assert.deepEqual(changes.at(-1), {
    ids: ["native:native-a", "native:native-b", "web:web-a", "web:web-b"],
    reason: "web-hot-plug",
  });
  await manager.destroy();
});

test("listener failures are isolated and reported without interrupting note delivery", async () => {
  const input = createWebInput("keys");
  const access = createMidiAccess([input]);
  const errors = [];
  const received = [];
  const manager = new MidiInputManager({
    getWindow: () => ({ navigator: { requestMIDIAccess: async () => access } }),
    onError: (error) => errors.push(error.message),
  });
  manager.subscribe(() => { throw new Error("listener failed"); });
  manager.subscribe((event) => received.push(event));
  await manager.connect((await manager.requestWebMidi())[0].id);
  input.emit([0x90, 60, 100]);
  assert.equal(received.length, 1);
  assert.deepEqual(errors, ["listener failed"]);
  await manager.destroy();
});

test("partially registered native listeners are removed when plugin setup fails", async () => {
  let removed = 0;
  const errors = [];
  const plugin = {
    async listDevices() { return [{ id: "keys" }]; },
    async addListener(name) {
      if (name === "devicesChanged") throw new Error("hot-plug listener unavailable");
      return { async remove() { removed += 1; } };
    },
  };
  const manager = new MidiInputManager({
    getWindow: () => ({ Capacitor: { Plugins: { MidiInput: plugin } } }),
    onError: (error) => errors.push(error.message),
  });

  assert.equal((await manager.refreshDevices())[0].id, "native:keys");
  assert.equal(removed, 1);
  assert.deepEqual(errors, ["hot-plug listener unavailable"]);
  await manager.destroy();
});
