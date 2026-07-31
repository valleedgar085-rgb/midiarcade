/**
 * Browser/native MIDI input bridge.
 *
 * This module deliberately does not inspect browser globals while it is being
 * imported. Browser and Capacitor surfaces are resolved lazily when a manager
 * method is called, and can be injected for deterministic tests.
 */

const NOTE_OFF = 0x80;
const NOTE_ON = 0x90;
const CONTROL_CHANGE = 0xb0;
const SUSTAIN_CONTROLLER = 64;
const SUSTAIN_ON_VALUE = 64;
const ALL_SOUND_OFF_CONTROLLER = 120;
const RESET_ALL_CONTROLLERS = 121;
const ALL_NOTES_OFF_CONTROLLER = 123;
const CHANNEL_RELEASE_CONTROLLERS = new Map([
  [ALL_SOUND_OFF_CONTROLLER, "all-sound-off"],
  [RESET_ALL_CONTROLLERS, "reset-all-controllers"],
  [ALL_NOTES_OFF_CONTROLLER, "all-notes-off"],
]);

function defaultWindowProvider() {
  if (typeof window !== "undefined") return window;
  if (typeof globalThis !== "undefined" && globalThis.window) return globalThis.window;
  return undefined;
}

function defaultNow() {
  return Date.now();
}

function midiBytes(value) {
  if (value instanceof Uint8Array) return [...value];
  if (ArrayBuffer.isView(value)) {
    return [...new Uint8Array(value.buffer, value.byteOffset, value.byteLength)];
  }
  if (value instanceof ArrayBuffer) return [...new Uint8Array(value)];
  if (!Array.isArray(value)) return null;
  if (!value.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255)) return null;
  return [...value];
}

/**
 * Parse one complete MIDI channel message without consulting any external
 * state. Unsupported, malformed, running-status, and system messages return
 * null. Channels are zero-based and note/controller values remain 0..127.
 */
export function parseMidiBytes(value) {
  const bytes = midiBytes(value);
  if (!bytes?.length || bytes[0] < 0x80 || bytes[0] >= 0xf0) return null;

  const status = bytes[0];
  const command = status & 0xf0;
  const channel = status & 0x0f;
  const data1 = bytes[1];
  const data2 = bytes[2];

  if (command === NOTE_ON || command === NOTE_OFF) {
    if (bytes.length < 3 || data1 > 127 || data2 > 127) return null;
    const noteOnWithZeroVelocity = command === NOTE_ON && data2 === 0;
    const type = command === NOTE_OFF || noteOnWithZeroVelocity ? "note-off" : "note-on";
    return {
      type,
      channel,
      note: data1,
      velocity: data2,
      normalizedVelocity: data2 / 127,
      noteOnWithZeroVelocity,
      raw: bytes.slice(0, 3),
    };
  }

  if (command === CONTROL_CHANGE) {
    if (bytes.length < 3 || data1 > 127 || data2 > 127) return null;
    const event = {
      type: "control-change",
      channel,
      controller: data1,
      value: data2,
      normalizedValue: data2 / 127,
      raw: bytes.slice(0, 3),
    };
    if (data1 === SUSTAIN_CONTROLLER) event.sustain = data2 >= SUSTAIN_ON_VALUE;
    return event;
  }

  return null;
}

export const parseMidiMessage = parseMidiBytes;

function text(value, fallback = "") {
  return value == null ? fallback : String(value);
}

function prefixedId(backend, rawId) {
  const value = text(rawId, "unknown");
  return value.startsWith(`${backend}:`) ? value : `${backend}:${value}`;
}

function nativeItems(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.inputs)) return result.inputs;
  if (Array.isArray(result?.devices)) return result.devices;
  return [];
}

function expandNativeInputs(item) {
  const ports = Array.isArray(item?.inputs)
    ? item.inputs
    : Array.isArray(item?.inputPorts)
      ? item.inputPorts
      : null;
  if (!ports?.length) return [item];
  return ports.map((port) => ({
    ...item,
    ...port,
    deviceId: item.deviceId ?? item.id,
    portId: port.portId ?? port.id,
    name: port.name || item.name,
    manufacturer: port.manufacturer || item.manufacturer,
  }));
}

function normalizeNativeDevice(item, index) {
  const deviceId = text(item?.deviceId ?? item?.id ?? item?.uid ?? index);
  const portValue = item?.portId ?? item?.port;
  const portId = portValue == null ? null : text(portValue);
  const rawId = portId == null ? deviceId : `${deviceId}:${portId}`;
  const state = text(item?.state, item?.connected === false ? "disconnected" : "connected");
  return Object.freeze({
    id: prefixedId("native", rawId),
    backend: "native",
    rawId,
    deviceId,
    portId,
    name: text(item?.name ?? item?.product, "MIDI input"),
    manufacturer: text(item?.manufacturer),
    state,
    connection: text(item?.connection, item?.connected ? "open" : "closed"),
    connected: item?.connected === true || item?.connection === "open",
  });
}

function normalizeWebDevice(port, index) {
  const rawId = text(port?.id, index);
  const state = text(port?.state, "connected");
  const connection = text(port?.connection, "closed");
  return Object.freeze({
    id: prefixedId("web", rawId),
    backend: "web",
    rawId,
    deviceId: rawId,
    portId: null,
    name: text(port?.name, "MIDI input"),
    manufacturer: text(port?.manufacturer),
    state,
    connection,
    connected: state !== "disconnected" && connection === "open",
  });
}

function midiInputValues(inputs) {
  if (!inputs) return [];
  if (typeof inputs.values === "function") return [...inputs.values()];
  if (Symbol.iterator in Object(inputs)) return [...inputs];
  return [];
}

function nativePayloadBytes(payload) {
  if (payload == null) return null;
  if (Array.isArray(payload) || ArrayBuffer.isView(payload) || payload instanceof ArrayBuffer) {
    return midiBytes(payload);
  }
  const direct = payload.data ?? payload.bytes ?? payload.message;
  const decoded = midiBytes(direct);
  if (decoded) return decoded;
  if ([payload.status, payload.data1, payload.data2].every((value) => Number.isInteger(value))) {
    return midiBytes([payload.status, payload.data1, payload.data2]);
  }
  return null;
}

async function removeHandle(handle) {
  const resolved = await Promise.resolve(handle);
  if (typeof resolved?.remove === "function") await resolved.remove();
}

/**
 * Unifies Capacitor MidiInput and Web MIDI inputs.
 *
 * Note listeners receive only normalized note-on/note-off events. CC64 is
 * consumed internally so note-off callbacks are delayed until pedal-up;
 * channel-mode panic messages synthesize the releases needed to avoid stuck
 * voices.
 */
export class MidiInputManager {
  constructor({ getWindow = defaultWindowProvider, now = defaultNow, onNote, onDevicesChanged, onError } = {}) {
    if (typeof getWindow !== "function") throw new TypeError("getWindow must be a function");
    if (typeof now !== "function") throw new TypeError("now must be a function");
    this._getWindow = getWindow;
    this._now = now;
    this._onError = typeof onError === "function" ? onError : null;
    this._noteListeners = new Set(typeof onNote === "function" ? [onNote] : []);
    this._deviceListeners = new Set(typeof onDevicesChanged === "function" ? [onDevicesChanged] : []);
    this._devices = new Map();
    this._connections = new Map();
    this._pendingConnections = new Map();
    this._nativeConnectGeneration = 0;
    this._nativeConnectionIds = new Map();
    this._sustain = new Map();
    this._activeNotes = new Map();
    this._midiAccess = null;
    this._webStateBinding = null;
    this._nativePluginWithListeners = null;
    this._nativeListenerHandles = [];
    this._nativeListenerSetup = null;
  }

  get devices() {
    return [...this._devices.values()];
  }

  get connectionIds() {
    return [...this._connections.keys()];
  }

  subscribe(listener) {
    if (typeof listener !== "function") throw new TypeError("listener must be a function");
    this._noteListeners.add(listener);
    return () => this._noteListeners.delete(listener);
  }

  subscribeDevices(listener) {
    if (typeof listener !== "function") throw new TypeError("listener must be a function");
    this._deviceListeners.add(listener);
    return () => this._deviceListeners.delete(listener);
  }

  _window() {
    return this._getWindow();
  }

  _nativePlugin() {
    return this._window()?.Capacitor?.Plugins?.MidiInput ?? null;
  }

  _report(error) {
    if (!this._onError) return;
    try {
      this._onError(error instanceof Error ? error : new Error(String(error)));
    } catch {
      // Error reporting must never break MIDI delivery.
    }
  }

  _notifyDevices(reason) {
    const devices = this.devices;
    for (const listener of this._deviceListeners) {
      try {
        listener(devices, { reason });
      } catch (error) {
        this._report(error);
      }
    }
  }

  async _ensureNativeListeners(plugin = this._nativePlugin()) {
    if (!plugin?.addListener || this._nativePluginWithListeners === plugin) return;
    if (this._nativeListenerSetup) {
      await this._nativeListenerSetup;
      if (this._nativePluginWithListeners === plugin) return;
    }
    if (this._nativePluginWithListeners && this._nativePluginWithListeners !== plugin) {
      await this._removeNativeListeners();
    }
    const setup = (async () => {
      const handles = [];
      try {
        handles.push(await plugin.addListener("midiMessage", (payload) => this._receiveNative(payload)));
        handles.push(await plugin.addListener("devicesChanged", () => this._handleHotPlug("native")));
        this._nativeListenerHandles.push(...handles);
        this._nativePluginWithListeners = plugin;
      } catch (error) {
        for (const handle of handles) {
          try {
            await removeHandle(handle);
          } catch (removeError) {
            this._report(removeError);
          }
        }
        this._report(error);
      }
    })();
    this._nativeListenerSetup = setup;
    await setup;
    if (this._nativeListenerSetup === setup) {
      this._nativeListenerSetup = null;
    }
  }

  async _removeNativeListeners() {
    const handles = this._nativeListenerHandles.splice(0);
    this._nativePluginWithListeners = null;
    for (const handle of handles) {
      try {
        await removeHandle(handle);
      } catch (error) {
        this._report(error);
      }
    }
  }

  async _listNativeDevices() {
    const plugin = this._nativePlugin();
    if (!plugin) return [];
    await this._ensureNativeListeners(plugin);
    const list = typeof plugin.listDevices === "function"
      ? plugin.listDevices.bind(plugin)
      : typeof plugin.getDevices === "function"
        ? plugin.getDevices.bind(plugin)
        : null;
    if (!list) return [];
    const result = await list();
    return nativeItems(result)
      .flatMap(expandNativeInputs)
      .map(normalizeNativeDevice);
  }

  _listWebDevices() {
    return midiInputValues(this._midiAccess?.inputs).map(normalizeWebDevice);
  }

  /** Discover native devices and already-authorized Web MIDI ports. No permission prompt is made. */
  async refreshDevices({ notify = false, reason = "manual" } = {}) {
    let nativeDevices = [];
    try {
      nativeDevices = await this._listNativeDevices();
    } catch (error) {
      this._report(error);
    }
    const combined = [...nativeDevices, ...this._listWebDevices()];
    this._devices = new Map(combined.map((device) => [device.id, device]));
    if (notify) this._notifyDevices(reason);
    return this.devices;
  }

  /**
   * Explicitly request Web MIDI access. This is the only method that calls
   * navigator.requestMIDIAccess and therefore the only permission-triggering path.
   */
  async requestWebMidi({ sysex = false } = {}) {
    const browserWindow = this._window();
    const navigator = browserWindow?.navigator;
    const request = navigator?.requestMIDIAccess;
    if (typeof request !== "function") throw new Error("Web MIDI is unavailable in this environment.");
    const access = await request.call(navigator, { sysex: Boolean(sysex) });
    this._bindWebStateChanges(access);
    this._midiAccess = access;
    return this.refreshDevices({ notify: true, reason: "web-access" });
  }

  _bindWebStateChanges(access) {
    this._unbindWebStateChanges();
    const handler = () => this._handleHotPlug("web");
    if (typeof access?.addEventListener === "function") {
      access.addEventListener("statechange", handler);
      this._webStateBinding = { access, handler, mode: "event" };
    } else if (access) {
      const previous = access.onstatechange;
      access.onstatechange = handler;
      this._webStateBinding = { access, handler, previous, mode: "property" };
    }
  }

  _unbindWebStateChanges() {
    const binding = this._webStateBinding;
    if (!binding) return;
    if (binding.mode === "event") binding.access.removeEventListener?.("statechange", binding.handler);
    else if (binding.access.onstatechange === binding.handler) binding.access.onstatechange = binding.previous ?? null;
    this._webStateBinding = null;
  }

  async _handleHotPlug(backend) {
    try {
      return await this.refreshDevices({ notify: true, reason: `${backend}-hot-plug` });
    } catch (error) {
      this._report(error);
      return this.devices;
    }
  }

  async connect(deviceOrId) {
    const requestedId = typeof deviceOrId === "string" ? deviceOrId : deviceOrId?.id;
    if (!requestedId) throw new TypeError("A normalized MIDI device id is required.");
    if (!this._devices.has(requestedId)) await this.refreshDevices();
    const device = this._devices.get(requestedId);
    if (!device) throw new Error(`MIDI input not found: ${requestedId}`);

    const existing = [...this._connections.values()].find((connection) => connection.deviceId === device.id);
    if (existing) return existing.id;
    const pending = this._pendingConnections.get(device.id);
    if (pending && (device.backend !== "native" || pending.generation === this._nativeConnectGeneration)) {
      return pending.promise;
    }

    const generation = device.backend === "native" ? ++this._nativeConnectGeneration : null;
    const attempt = device.backend === "native"
      ? this._connectNative(device, generation)
      : this._connectWeb(device);
    const pendingEntry = { promise: attempt, generation };
    this._pendingConnections.set(device.id, pendingEntry);
    try {
      return await attempt;
    } finally {
      if (this._pendingConnections.get(device.id) === pendingEntry) this._pendingConnections.delete(device.id);
    }
  }

  async _connectNative(device, generation) {
    const plugin = this._nativePlugin();
    if (typeof plugin?.connect !== "function") throw new Error("Native MidiInput.connect is unavailable.");
    await this._ensureNativeListeners(plugin);
    // The Android bridge owns one MidiDevice/MidiOutputPort at a time. Keep
    // Web MIDI ports open, but release any prior native input before replacing
    // it so the Java and JavaScript connection models cannot diverge.
    for (const connection of [...this._connections.values()]) {
      if (connection.backend === "native") await this.disconnect(connection.id);
    }
    const result = await plugin.connect({
      id: device.rawId,
      deviceId: device.deviceId,
      ...(device.portId == null ? {} : { portId: device.portId }),
    });
    const rawConnectionId = text(
      typeof result === "string" ? result : result?.connectionId ?? result?.id,
      device.rawId,
    );
    if (generation !== this._nativeConnectGeneration) {
      if (typeof plugin.disconnect === "function") {
        try {
          await plugin.disconnect({ connectionId: rawConnectionId });
        } catch (error) {
          this._report(error);
        }
      }
      throw new Error("MIDI connection request was superseded.");
    }
    const connectionId = prefixedId("native", rawConnectionId);
    this._connections.set(connectionId, {
      id: connectionId,
      backend: "native",
      deviceId: device.id,
      rawConnectionId,
      rawDeviceId: device.deviceId,
    });
    this._nativeConnectionIds.set(rawConnectionId, connectionId);
    return connectionId;
  }

  async _connectWeb(device) {
    if (!this._midiAccess) throw new Error("Call requestWebMidi() before connecting a Web MIDI input.");
    const port = midiInputValues(this._midiAccess.inputs).find((input) => text(input?.id) === device.rawId);
    if (!port) throw new Error(`Web MIDI input not found: ${device.rawId}`);
    const openedPort = typeof port.open === "function" ? await port.open() : port;
    const activePort = openedPort || port;
    const connectionId = prefixedId("web", device.rawId);
    const handler = (event) => this._receiveWeb(connectionId, event);
    const connection = {
      id: connectionId,
      backend: "web",
      deviceId: device.id,
      port: activePort,
      handler,
      previousHandler: null,
      listenerMode: "property",
    };
    if (typeof activePort.addEventListener === "function") {
      activePort.addEventListener("midimessage", handler);
      connection.listenerMode = "event";
    } else {
      connection.previousHandler = activePort.onmidimessage;
      activePort.onmidimessage = handler;
    }
    this._connections.set(connectionId, connection);
    return connectionId;
  }

  _receiveNative(payload) {
    const bytes = nativePayloadBytes(payload);
    if (!bytes) return null;
    const rawConnectionId = text(payload?.connectionId ?? payload?.connection ?? payload?.id);
    let connectionId = this._nativeConnectionIds.get(rawConnectionId);
    if (!connectionId && rawConnectionId.startsWith("native:") && this._connections.has(rawConnectionId)) {
      connectionId = rawConnectionId;
    }
    if (!connectionId && payload?.deviceId != null) {
      connectionId = [...this._connections.values()].find(
        (connection) => connection.backend === "native" && connection.rawDeviceId === text(payload.deviceId),
      )?.id;
    }
    if (!connectionId) {
      const nativeConnections = [...this._connections.values()].filter((connection) => connection.backend === "native");
      if (nativeConnections.length === 1) connectionId = nativeConnections[0].id;
    }
    if (!connectionId) return null;
    return this._receive(connectionId, bytes, payload?.timestamp ?? payload?.timeStamp);
  }

  _receiveWeb(connectionId, event) {
    return this._receive(connectionId, event?.data, event?.receivedTime ?? event?.timeStamp);
  }

  _receive(connectionId, bytes, timestamp) {
    const parsed = parseMidiBytes(bytes);
    if (!parsed) return null;
    const event = {
      ...parsed,
      connectionId,
      backend: this._connections.get(connectionId)?.backend ?? connectionId.split(":", 1)[0],
      timestamp: Number.isFinite(Number(timestamp)) ? Number(timestamp) : this._now(),
    };

    if (event.type === "control-change") {
      const releaseReason = CHANNEL_RELEASE_CONTROLLERS.get(event.controller);
      if (releaseReason) {
        this._releaseChannelNotes(event.connectionId, event.channel, releaseReason, event.timestamp);
        return event;
      }
      if (event.controller === SUSTAIN_CONTROLLER) {
        this._handleSustain(event);
        return event;
      }
    }
    if (event.type === "note-on") {
      this._emitNote(event);
      return event;
    }
    if (event.type === "note-off") {
      const sustain = this._channelSustain(connectionId, event.channel);
      if (sustain.down) sustain.deferred.push(event);
      else this._emitNote(event);
      return event;
    }
    return event;
  }

  _channelSustain(connectionId, channel) {
    if (!this._sustain.has(connectionId)) this._sustain.set(connectionId, new Map());
    const channels = this._sustain.get(connectionId);
    if (!channels.has(channel)) channels.set(channel, { down: false, deferred: [] });
    return channels.get(channel);
  }

  _handleSustain(controlEvent) {
    const state = this._channelSustain(controlEvent.connectionId, controlEvent.channel);
    const wasDown = state.down;
    state.down = controlEvent.value >= SUSTAIN_ON_VALUE;
    if (!wasDown || state.down) return;
    const deferred = state.deferred.splice(0);
    for (const event of deferred) {
      this._emitNote({
        ...event,
        timestamp: controlEvent.timestamp,
        originalTimestamp: event.timestamp,
        deferred: true,
      });
    }
  }

  _activeMap(connectionId) {
    if (!this._activeNotes.has(connectionId)) this._activeNotes.set(connectionId, new Map());
    return this._activeNotes.get(connectionId);
  }

  _emitNote(event) {
    const active = this._activeMap(event.connectionId);
    const key = `${event.channel}:${event.note}`;
    const count = active.get(key) ?? 0;
    if (event.type === "note-on") active.set(key, count + 1);
    else if (count <= 1) active.delete(key);
    else active.set(key, count - 1);

    const deliveredEvent = {
      ...event,
      activeCount: active.get(key) ?? 0,
    };

    for (const listener of this._noteListeners) {
      try {
        listener(deliveredEvent);
      } catch (error) {
        this._report(error);
      }
    }
  }

  _releaseChannelNotes(connectionId, channel, reason, timestamp = this._now()) {
    const sustainChannels = this._sustain.get(connectionId);
    sustainChannels?.delete(channel);
    if (sustainChannels && sustainChannels.size === 0) this._sustain.delete(connectionId);

    const active = this._activeNotes.get(connectionId);
    if (!active?.size) return;
    const connection = this._connections.get(connectionId);
    for (const [key, count] of [...active]) {
      const [activeChannel, note] = key.split(":").map(Number);
      if (activeChannel !== channel) continue;
      for (let index = 0; index < count; index += 1) {
        this._emitNote({
          type: "note-off",
          channel: activeChannel,
          note,
          velocity: 0,
          normalizedVelocity: 0,
          noteOnWithZeroVelocity: false,
          raw: [NOTE_OFF | activeChannel, note, 0],
          connectionId,
          backend: connection?.backend ?? connectionId.split(":", 1)[0],
          timestamp,
          synthetic: true,
          reason,
        });
      }
    }
    if (!active.size) this._activeNotes.delete(connectionId);
  }

  _releaseActiveNotes(connectionId, reason) {
    const active = this._activeNotes.get(connectionId);
    this._sustain.delete(connectionId);
    if (!active?.size) {
      this._activeNotes.delete(connectionId);
      return;
    }
    const connection = this._connections.get(connectionId);
    const timestamp = this._now();
    for (const [key, count] of active) {
      const [channel, note] = key.split(":").map(Number);
      for (let index = 0; index < count; index += 1) {
        this._emitNote({
          type: "note-off",
          channel,
          note,
          velocity: 0,
          normalizedVelocity: 0,
          noteOnWithZeroVelocity: false,
          raw: [NOTE_OFF | channel, note, 0],
          connectionId,
          backend: connection?.backend ?? connectionId.split(":", 1)[0],
          timestamp,
          synthetic: true,
          reason,
        });
      }
    }
    this._activeNotes.delete(connectionId);
  }

  async disconnect(connectionId) {
    const connection = this._connections.get(connectionId);
    if (!connection) return false;
    let failure = null;
    try {
      if (connection.backend === "native") {
        const plugin = this._nativePlugin();
        if (typeof plugin?.disconnect === "function") {
          await plugin.disconnect({ connectionId: connection.rawConnectionId });
        }
      } else {
        const { port, handler } = connection;
        if (connection.listenerMode === "event") port.removeEventListener?.("midimessage", handler);
        else if (port.onmidimessage === handler) port.onmidimessage = connection.previousHandler ?? null;
        if (typeof port.close === "function") await port.close();
      }
    } catch (error) {
      failure = error;
    } finally {
      this._releaseActiveNotes(connectionId, "disconnect");
      this._connections.delete(connectionId);
      if (connection.backend === "native") this._nativeConnectionIds.delete(connection.rawConnectionId);
    }
    if (failure) throw failure;
    return true;
  }

  async disconnectAll() {
    for (const connectionId of this.connectionIds) {
      try {
        await this.disconnect(connectionId);
      } catch (error) {
        this._report(error);
      }
    }
  }

  async destroy() {
    this._nativeConnectGeneration += 1;
    await this.disconnectAll();
    this._unbindWebStateChanges();
    await this._removeNativeListeners();
    this._devices.clear();
    this._pendingConnections.clear();
    this._noteListeners.clear();
    this._deviceListeners.clear();
    this._midiAccess = null;
  }
}

export function createMidiInputManager(options) {
  return new MidiInputManager(options);
}
