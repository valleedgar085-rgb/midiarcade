package com.midiarcade.app;

import android.content.Context;
import android.media.midi.MidiDevice;
import android.media.midi.MidiDeviceInfo;
import android.media.midi.MidiDeviceStatus;
import android.media.midi.MidiManager;
import android.media.midi.MidiOutputPort;
import android.media.midi.MidiReceiver;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.IOException;

/**
 * Small Capacitor bridge around Android's system MIDI service. Class-compliant
 * MIDI devices already exposed by MidiManager can be used without broad
 * storage or media permissions.
 */
@CapacitorPlugin(name = "MidiInput")
public class MidiInputPlugin extends Plugin {
    private MidiManager midiManager;
    private final Object connectionLock = new Object();
    private long connectionGeneration;
    private boolean destroyed;
    private MidiDevice activeDevice;
    private MidiOutputPort activePort;
    private volatile String activeConnectionId;
    private final MidiStreamFramer streamFramer = new MidiStreamFramer();
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private final MidiReceiver receiver = new MidiReceiver() {
        @Override
        public void onSend(byte[] data, int offset, int count, long timestamp) {
            streamFramer.accept(data, offset, count, message -> {
                JSArray bytes = new JSArray();
                for (byte value : message) bytes.put(value & 0xff);
                JSObject payload = new JSObject();
                payload.put("data", bytes);
                payload.put("timestampNanos", timestamp);
                payload.put("connectionId", activeConnectionId);
                // Performance data is ephemeral; never replay a stale note burst
                // after a WebView reload or listener gap.
                notifyListeners("midiMessage", payload, false);
            });
        }
    };

    private final MidiManager.DeviceCallback deviceCallback = new MidiManager.DeviceCallback() {
        @Override
        public void onDeviceAdded(MidiDeviceInfo device) {
            notifyDeviceChange("added", device);
        }

        @Override
        public void onDeviceRemoved(MidiDeviceInfo device) {
            notifyDeviceChange("removed", device);
            closeIfActiveDevice(device.getId());
        }

        @Override
        public void onDeviceStatusChanged(MidiDeviceStatus status) {
            notifyDeviceChange("status", status.getDeviceInfo());
        }
    };

    @Override
    public void load() {
        midiManager = (MidiManager) getContext().getSystemService(Context.MIDI_SERVICE);
        if (midiManager != null) {
            midiManager.registerDeviceCallback(deviceCallback, mainHandler);
        }
    }

    @PluginMethod
    public void listDevices(PluginCall call) {
        if (midiManager == null) {
            call.reject("Android MIDI service is unavailable on this device.");
            return;
        }
        JSArray devices = new JSArray();
        for (MidiDeviceInfo info : midiManager.getDevices()) {
            if (info.getOutputPortCount() < 1) continue;
            devices.put(deviceJson(info));
        }
        JSObject result = new JSObject();
        result.put("devices", devices);
        call.resolve(result);
    }

    @PluginMethod
    public void connect(PluginCall call) {
        if (midiManager == null) {
            call.reject("Android MIDI service is unavailable on this device.");
            return;
        }
        Integer requestedId = call.getInt("deviceId");
        if (requestedId == null) {
            String textId = call.getString("deviceId");
            try {
                if (textId != null) requestedId = Integer.valueOf(textId);
            } catch (NumberFormatException ignored) { }
        }
        Integer requestedPort = call.getInt("portIndex");
        if (requestedPort == null) requestedPort = call.getInt("portId");
        if (requestedPort == null) {
            String textPort = call.getString("portId");
            try {
                if (textPort != null) requestedPort = Integer.valueOf(textPort);
            } catch (NumberFormatException ignored) { }
        }
        int portIndex = requestedPort == null ? 0 : requestedPort;
        if (requestedId == null) {
            call.reject("deviceId is required.");
            return;
        }

        MidiDeviceInfo selected = null;
        for (MidiDeviceInfo info : midiManager.getDevices()) {
            if (info.getId() == requestedId) {
                selected = info;
                break;
            }
        }
        if (selected == null || selected.getOutputPortCount() < 1) {
            call.reject("The selected MIDI input is no longer available.");
            return;
        }
        if (portIndex < 0 || portIndex >= selected.getOutputPortCount()) {
            call.reject("The selected MIDI output port is invalid.");
            return;
        }

        final long requestGeneration = beginConnectionRequest();
        if (requestGeneration < 0) {
            call.reject("The MIDI input bridge is no longer available.");
            return;
        }
        final MidiDeviceInfo selectedInfo = selected;
        final int selectedPort = portIndex;
        try {
            midiManager.openDevice(
                selectedInfo,
                device -> handleDeviceOpened(call, selectedInfo, selectedPort, requestGeneration, device),
                mainHandler
            );
        } catch (RuntimeException error) {
            rejectOpenFailure(call, requestGeneration, "Android could not open this MIDI device.", error);
        }
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        String requestedConnectionId = call.getString("connectionId");
        JSObject result = new JSObject();
        result.put("disconnected", disconnectConnectionIfMatching(requestedConnectionId));
        call.resolve(result);
    }

    private void handleDeviceOpened(
        PluginCall call,
        MidiDeviceInfo selectedInfo,
        int selectedPort,
        long requestGeneration,
        MidiDevice device
    ) {
        if (device == null) {
            rejectOpenFailure(call, requestGeneration, "Android could not open this MIDI device.");
            return;
        }
        if (!isCurrentConnectionRequest(requestGeneration)) {
            closeOpenedResources(device, null);
            call.reject("The MIDI connection request was superseded.");
            return;
        }

        final MidiOutputPort port;
        try {
            port = device.openOutputPort(selectedPort);
        } catch (RuntimeException error) {
            closeOpenedResources(device, null);
            rejectOpenFailure(call, requestGeneration, "Android could not open this MIDI device port.", error);
            return;
        }
        if (port == null) {
            closeOpenedResources(device, null);
            rejectOpenFailure(call, requestGeneration, "Android could not open this MIDI device port.");
            return;
        }

        synchronized (connectionLock) {
            if (!isCurrentConnectionRequestLocked(requestGeneration)) {
                closeOpenedResources(device, port);
                call.reject("The MIDI connection request was superseded.");
                return;
            }

            try {
                activeDevice = device;
                activePort = port;
                activeConnectionId = "device:" + selectedInfo.getId() + ":port:" + selectedPort;
                port.connect(receiver);

                JSObject result = deviceJson(selectedInfo);
                result.put("portIndex", selectedPort);
                result.put("connectionId", activeConnectionId);
                call.resolve(result);
            } catch (RuntimeException error) {
                connectionGeneration += 1;
                closeConnectionLocked();
                call.reject("Android could not start MIDI input.", error);
            }
        }
    }

    private void rejectOpenFailure(PluginCall call, long requestGeneration, String message) {
        rejectOpenFailure(call, requestGeneration, message, null);
    }

    private void rejectOpenFailure(PluginCall call, long requestGeneration, String message, RuntimeException error) {
        if (!invalidateConnectionRequestIfCurrent(requestGeneration)) {
            call.reject("The MIDI connection request was superseded.");
        } else if (error == null) {
            call.reject(message);
        } else {
            call.reject(message, error);
        }
    }

    private JSObject deviceJson(MidiDeviceInfo info) {
        JSObject device = new JSObject();
        String deviceName = property(info, MidiDeviceInfo.PROPERTY_NAME, property(info, MidiDeviceInfo.PROPERTY_PRODUCT, "MIDI keyboard"));
        device.put("id", info.getId());
        device.put("deviceId", info.getId());
        device.put("name", deviceName);
        device.put("manufacturer", property(info, MidiDeviceInfo.PROPERTY_MANUFACTURER, ""));
        device.put("outputPorts", info.getOutputPortCount());
        device.put("type", info.getType());
        JSArray inputPorts = new JSArray();
        for (int index = 0; index < info.getOutputPortCount(); index++) {
            JSObject port = new JSObject();
            port.put("portId", index);
            port.put("name", info.getOutputPortCount() > 1 ? "Port " + (index + 1) : deviceName);
            inputPorts.put(port);
        }
        device.put("inputPorts", inputPorts);
        return device;
    }

    private String property(MidiDeviceInfo info, String key, String fallback) {
        Object value = info.getProperties().get(key);
        String text = value == null ? "" : String.valueOf(value).trim();
        return text.isEmpty() ? fallback : text;
    }

    private void notifyDeviceChange(String change, MidiDeviceInfo info) {
        JSObject payload = deviceJson(info);
        payload.put("change", change);
        notifyListeners("devicesChanged", payload, true);
    }

    private long beginConnectionRequest() {
        synchronized (connectionLock) {
            if (destroyed) return -1;
            connectionGeneration += 1;
            closeConnectionLocked();
            return connectionGeneration;
        }
    }

    private boolean isCurrentConnectionRequest(long requestGeneration) {
        synchronized (connectionLock) {
            return isCurrentConnectionRequestLocked(requestGeneration);
        }
    }

    private boolean isCurrentConnectionRequestLocked(long requestGeneration) {
        return !destroyed && connectionGeneration == requestGeneration;
    }

    private boolean invalidateConnectionRequestIfCurrent(long requestGeneration) {
        synchronized (connectionLock) {
            if (!isCurrentConnectionRequestLocked(requestGeneration)) return false;
            connectionGeneration += 1;
            closeConnectionLocked();
            return true;
        }
    }

    private boolean disconnectConnectionIfMatching(String requestedConnectionId) {
        synchronized (connectionLock) {
            String requested = requestedConnectionId == null ? "" : requestedConnectionId.trim();
            // A delayed JavaScript cleanup for an older connect must not cancel
            // a newer request that is pending or already active.
            if (!requested.isEmpty()
                && (activeConnectionId == null || !requested.equals(activeConnectionId))) {
                return false;
            }
            connectionGeneration += 1;
            boolean hadConnection = activeDevice != null || activePort != null || activeConnectionId != null;
            closeConnectionLocked();
            return hadConnection;
        }
    }

    private void closeIfActiveDevice(int deviceId) {
        synchronized (connectionLock) {
            if (activeDevice == null || activeDevice.getInfo().getId() != deviceId) return;
            connectionGeneration += 1;
            closeConnectionLocked();
        }
    }

    private void closeConnectionLocked() {
        streamFramer.reset();
        if (activePort != null) {
            try { activePort.disconnect(receiver); } catch (RuntimeException ignored) { }
            closePort(activePort);
            activePort = null;
        }
        if (activeDevice != null) {
            closeDevice(activeDevice);
            activeDevice = null;
        }
        activeConnectionId = null;
    }

    private void closePort(MidiOutputPort port) {
        try { port.close(); } catch (IOException | RuntimeException ignored) { }
    }

    private void closeDevice(MidiDevice device) {
        try { device.close(); } catch (IOException | RuntimeException ignored) { }
    }

    private void closeOpenedResources(MidiDevice device, MidiOutputPort port) {
        synchronized (connectionLock) {
            // A stale callback must never tear down a newer request even if the
            // platform happens to return the same wrapper object to both opens.
            if (port != null && port != activePort) closePort(port);
            if (device != activeDevice) closeDevice(device);
        }
    }

    @Override
    protected void handleOnDestroy() {
        synchronized (connectionLock) {
            destroyed = true;
            connectionGeneration += 1;
            closeConnectionLocked();
        }
        if (midiManager != null) {
            midiManager.unregisterDeviceCallback(deviceCallback);
        }
    }
}
