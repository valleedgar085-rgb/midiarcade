package com.midiarcade.app;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;

import java.util.ArrayList;
import java.util.List;
import org.junit.Test;

public class MidiStreamFramerTest {
    @Test
    public void framesSplitMessagesAndRunningStatus() {
        MidiStreamFramer framer = new MidiStreamFramer();
        List<byte[]> messages = new ArrayList<>();

        framer.accept(bytes(0x90, 60), 0, 2, messages::add);
        assertEquals(0, messages.size());
        framer.accept(bytes(100, 61, 110), 0, 3, messages::add);

        assertEquals(2, messages.size());
        assertArrayEquals(bytes(0x90, 60, 100), messages.get(0));
        assertArrayEquals(bytes(0x90, 61, 110), messages.get(1));
    }

    @Test
    public void framesPackedMessagesWithoutRealtimeInterference() {
        MidiStreamFramer framer = new MidiStreamFramer();
        List<byte[]> messages = new ArrayList<>();
        byte[] chunk = bytes(0x90, 60, 100, 0xf8, 64, 0, 0xb0, 64, 127, 0x80, 60, 0);

        framer.accept(chunk, 0, chunk.length, messages::add);

        assertEquals(4, messages.size());
        assertArrayEquals(bytes(0x90, 60, 100), messages.get(0));
        assertArrayEquals(bytes(0x90, 64, 0), messages.get(1));
        assertArrayEquals(bytes(0xb0, 64, 127), messages.get(2));
        assertArrayEquals(bytes(0x80, 60, 0), messages.get(3));
    }

    @Test
    public void systemMessagesDiscardPartialChannelDataAndDoNotLeakRunningStatus() {
        MidiStreamFramer framer = new MidiStreamFramer();
        List<byte[]> messages = new ArrayList<>();

        framer.accept(bytes(0x90, 60, 0xf0, 1, 2, 0xf8), 0, 6, messages::add);
        framer.accept(bytes(3, 0xf7, 70, 100, 0xf2, 1, 2, 0x90, 65, 99), 0, 10, messages::add);

        assertEquals(1, messages.size());
        assertArrayEquals(bytes(0x90, 65, 99), messages.get(0));
    }

    @Test
    public void resetClearsAFragmentAndRunningStatus() {
        MidiStreamFramer framer = new MidiStreamFramer();
        List<byte[]> messages = new ArrayList<>();
        framer.accept(bytes(0x90, 60), 0, 2, messages::add);
        framer.reset();
        framer.accept(bytes(100, 61, 110), 0, 3, messages::add);
        assertEquals(0, messages.size());
    }

    private static byte[] bytes(int... values) {
        byte[] result = new byte[values.length];
        for (int index = 0; index < values.length; index++) result[index] = (byte) values[index];
        return result;
    }
}
