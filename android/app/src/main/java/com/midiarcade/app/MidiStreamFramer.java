package com.midiarcade.app;

import java.util.Arrays;

/**
 * Frames an arbitrary Android MIDI byte stream into complete MIDI 1.0
 * messages. MidiReceiver chunks are transport chunks, not message boundaries:
 * they can split one message, contain several messages, use running status, or
 * contain realtime bytes between channel-message bytes.
 */
final class MidiStreamFramer {
    interface Listener {
        void onMessage(byte[] message);
    }

    private final byte[] pending = new byte[3];
    private int pendingLength;
    private int expectedLength;
    private int runningStatus = -1;
    private int systemDataRemaining;
    private boolean inSystemExclusive;

    synchronized void accept(byte[] data, int offset, int count, Listener listener) {
        if (data == null || listener == null || offset < 0 || count <= 0 || offset > data.length - count) return;
        for (int index = offset; index < offset + count; index++) {
            int value = data[index] & 0xff;

            // Realtime bytes may appear anywhere and never disturb running status.
            if (value >= 0xf8) continue;

            if (inSystemExclusive) {
                if (value == 0xf7) {
                    inSystemExclusive = false;
                } else if (value < 0x80) {
                    continue;
                } else {
                    // A non-realtime status aborts malformed SysEx and is then parsed.
                    inSystemExclusive = false;
                }
            }

            if (value >= 0x80) {
                pendingLength = 0;
                expectedLength = 0;
                systemDataRemaining = 0;
                if (value < 0xf0) {
                    runningStatus = value;
                    beginChannelMessage(value);
                } else {
                    runningStatus = -1;
                    switch (value) {
                        case 0xf0:
                            inSystemExclusive = true;
                            break;
                        case 0xf1:
                        case 0xf3:
                            systemDataRemaining = 1;
                            break;
                        case 0xf2:
                            systemDataRemaining = 2;
                            break;
                        default:
                            // Tune request, EOX, and undefined common statuses have no data.
                            break;
                    }
                }
                continue;
            }

            if (systemDataRemaining > 0) {
                systemDataRemaining -= 1;
                continue;
            }
            if (pendingLength == 0) {
                if (runningStatus < 0) continue;
                beginChannelMessage(runningStatus);
            }
            pending[pendingLength++] = (byte) value;
            if (pendingLength == expectedLength) {
                listener.onMessage(Arrays.copyOf(pending, expectedLength));
                pendingLength = 0;
                expectedLength = 0;
            }
        }
    }

    synchronized void reset() {
        pendingLength = 0;
        expectedLength = 0;
        runningStatus = -1;
        systemDataRemaining = 0;
        inSystemExclusive = false;
    }

    private void beginChannelMessage(int status) {
        pending[0] = (byte) status;
        pendingLength = 1;
        int command = status & 0xf0;
        expectedLength = command == 0xc0 || command == 0xd0 ? 2 : 3;
    }
}
