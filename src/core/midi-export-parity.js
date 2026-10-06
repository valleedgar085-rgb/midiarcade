function textFromBytes(bytes) {
  if (typeof TextDecoder === "function") return new TextDecoder().decode(bytes);
  return Array.from(bytes, (value) => String.fromCharCode(value)).join("");
}

function requireBytes(bytes, offset, length, label) {
  if (offset + length > bytes.length) {
    throw new RangeError(`Invalid MIDI: truncated ${label}`);
  }
}

function readUint16(bytes, state) {
  requireBytes(bytes, state.offset, 2, "uint16");
  const value = (bytes[state.offset] << 8) | bytes[state.offset + 1];
  state.offset += 2;
  return value;
}

function readUint32(bytes, state) {
  requireBytes(bytes, state.offset, 4, "uint32");
  const value = (
    (bytes[state.offset] << 24)
    | (bytes[state.offset + 1] << 16)
    | (bytes[state.offset + 2] << 8)
    | bytes[state.offset + 3]
  ) >>> 0;
  state.offset += 4;
  return value;
}

function readVarLength(bytes, state, limit = bytes.length) {
  let value = 0;
  let count = 0;
  while (state.offset < limit) {
    const byte = bytes[state.offset++];
    value = (value << 7) | (byte & 0x7f);
    count += 1;
    if (!(byte & 0x80)) return value >>> 0;
    if (count >= 4) throw new RangeError("Invalid MIDI: variable-length value exceeds four bytes");
  }
  throw new RangeError("Invalid MIDI: truncated variable-length value");
}

function chunkTag(bytes, offset) {
  requireBytes(bytes, offset, 4, "chunk tag");
  return String.fromCharCode(...bytes.slice(offset, offset + 4));
}

function openNoteKey(channel, pitch) {
  return `${channel}:${pitch}`;
}

function closeParsedNote(openNotes, key, patch, notes, diagnostics) {
  const queue = openNotes.get(key);
  const opened = queue?.shift() ?? null;
  if (!opened) {
    diagnostics.orphanNoteOffs += 1;
    return;
  }
  if (!queue.length) openNotes.delete(key);
  notes.push({
    sequence: opened.sequence,
    channel: patch.channel,
    pitch: patch.pitch,
    startTick: opened.startTick,
    endTick: patch.endTick,
    durationTicks: Math.max(0, patch.endTick - opened.startTick),
    velocity: opened.velocity,
  });
}

export function parseMidiNoteTracks(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input ?? []);
  const state = { offset: 0 };
  if (chunkTag(bytes, state.offset) !== "MThd") throw new Error("Invalid MIDI: missing MThd chunk");
  state.offset += 4;
  const headerLength = readUint32(bytes, state);
  if (headerLength < 6) throw new RangeError("Invalid MIDI: header chunk shorter than six bytes");
  const headerEnd = state.offset + headerLength;
  requireBytes(bytes, state.offset, headerLength, "header");
  const format = readUint16(bytes, state);
  const trackCount = readUint16(bytes, state);
  const division = readUint16(bytes, state);
  if (division & 0x8000) throw new RangeError("Invalid MIDI: SMPTE timing is not supported by MIDI Arcade export parity");
  const ppq = division;
  state.offset = headerEnd;

  const tracks = [];
  const diagnostics = { orphanNoteOffs: 0, unterminatedNotes: 0 };

  for (let trackIndex = 0; trackIndex < trackCount; trackIndex += 1) {
    if (chunkTag(bytes, state.offset) !== "MTrk") {
      throw new Error(`Invalid MIDI: missing MTrk chunk at track ${trackIndex}`);
    }
    state.offset += 4;
    const trackLength = readUint32(bytes, state);
    const trackEnd = state.offset + trackLength;
    requireBytes(bytes, state.offset, trackLength, `track ${trackIndex}`);

    let currentTick = 0;
    let runningStatus = null;
    let trackName = `Track-${trackIndex}`;
    let noteSequence = 0;
    let noteOffSequence = 0;
    const notes = [];
    const noteOns = [];
    const noteOffs = [];
    const openNotes = new Map();

    while (state.offset < trackEnd) {
      currentTick += readVarLength(bytes, state, trackEnd);
      requireBytes(bytes, state.offset, 1, "event status");
      let status = bytes[state.offset];

      if (status >= 0x80) {
        state.offset += 1;
        runningStatus = status < 0xf0 ? status : null;
      } else if (runningStatus != null) {
        status = runningStatus;
      } else {
        throw new Error(`Invalid MIDI: data byte without running status in track ${trackIndex}`);
      }

      if (status === 0xff) {
        requireBytes(bytes, state.offset, 1, "meta type");
        const metaType = bytes[state.offset++];
        const length = readVarLength(bytes, state, trackEnd);
        requireBytes(bytes, state.offset, length, "meta payload");
        if (metaType === 0x03) {
          trackName = textFromBytes(bytes.slice(state.offset, state.offset + length));
        }
        state.offset += length;
        runningStatus = null;
        continue;
      }

      if (status === 0xf0 || status === 0xf7) {
        const length = readVarLength(bytes, state, trackEnd);
        requireBytes(bytes, state.offset, length, "sysex payload");
        state.offset += length;
        runningStatus = null;
        continue;
      }

      const message = status & 0xf0;
      const channel = status & 0x0f;
      if (message === 0xc0 || message === 0xd0) {
        requireBytes(bytes, state.offset, 1, "channel event");
        state.offset += 1;
        continue;
      }

      requireBytes(bytes, state.offset, 2, "channel event");
      const data1 = bytes[state.offset++];
      const data2 = bytes[state.offset++];

      if (message === 0x90 && data2 > 0) {
        const sequence = noteSequence++;
        noteOns.push({
          sequence,
          channel,
          pitch: data1,
          tick: currentTick,
          velocity: data2,
        });
        const key = openNoteKey(channel, data1);
        const queue = openNotes.get(key) ?? [];
        queue.push({
          sequence,
          startTick: currentTick,
          velocity: data2,
        });
        openNotes.set(key, queue);
        continue;
      }

      if (message === 0x80 || (message === 0x90 && data2 === 0)) {
        noteOffs.push({
          sequence: noteOffSequence++,
          channel,
          pitch: data1,
          tick: currentTick,
        });
        closeParsedNote(
          openNotes,
          openNoteKey(channel, data1),
          { channel, pitch: data1, endTick: currentTick },
          notes,
          diagnostics,
        );
      }
    }

    for (const queue of openNotes.values()) diagnostics.unterminatedNotes += queue.length;
    notes.sort((left, right) => left.sequence - right.sequence);
    tracks.push({
      trackIndex,
      name: trackName,
      notes,
      noteOns,
      noteOffs,
    });
    state.offset = trackEnd;
  }

  return {
    format,
    ppq,
    trackCount,
    tracks,
    diagnostics,
  };
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
}

function noteShape(note) {
  return {
    noteId: note.noteId ?? null,
    channel: note.channel,
    pitch: note.pitch,
    startTick: note.onTick ?? note.startTick,
    endTick: note.offTick ?? note.endTick,
    durationTicks: (note.offTick ?? note.endTick) - (note.onTick ?? note.startTick),
    velocity: note.velocity,
  };
}

function exactNoteMatch(expected, actual) {
  return expected.channel === actual.channel
    && expected.pitch === actual.pitch
    && expected.onTick === actual.startTick
    && expected.offTick === actual.endTick
    && expected.velocity === actual.velocity;
}

function takeMatch(actualNotes, used, predicate) {
  const index = actualNotes.findIndex((note, candidateIndex) => !used.has(candidateIndex) && predicate(note));
  if (index < 0) return null;
  used.add(index);
  return { index, note: actualNotes[index] };
}

function mismatch(type, track, expected, actual, detail) {
  return {
    type,
    trackId: track?.id ?? null,
    trackName: track?.trackName ?? track?.name ?? null,
    expected: expected ? noteShape(expected) : null,
    actual: actual ? noteShape(actual) : null,
    detail,
  };
}

export function auditMidiBytesAgainstProjection(projection, midiBytes) {
  if (!projection || !Array.isArray(projection.tracks)) {
    throw new TypeError("auditMidiBytesAgainstProjection requires a MIDI export projection");
  }
  const parsed = parseMidiNoteTracks(midiBytes);
  const mismatches = [];
  const trackBreakdown = {};
  const expectedTrackCount = projection.tracks.length + 1;

  if (parsed.format !== 1) {
    mismatches.push({
      type: "FORMAT_MISMATCH",
      trackId: null,
      trackName: null,
      expected: { format: 1 },
      actual: { format: parsed.format },
      detail: `Expected Standard MIDI File format 1, found format ${parsed.format}.`,
    });
  }
  if (parsed.ppq !== projection.ppq) {
    mismatches.push({
      type: "PPQ_MISMATCH",
      trackId: null,
      trackName: null,
      expected: { ppq: projection.ppq },
      actual: { ppq: parsed.ppq },
      detail: `Expected PPQ ${projection.ppq}, found ${parsed.ppq}.`,
    });
  }
  if (parsed.trackCount !== expectedTrackCount) {
    mismatches.push({
      type: "TRACK_COUNT_MISMATCH",
      trackId: null,
      trackName: null,
      expected: { trackCount: expectedTrackCount },
      actual: { trackCount: parsed.trackCount },
      detail: `Expected ${expectedTrackCount} MIDI tracks including conductor, found ${parsed.trackCount}.`,
    });
  }

  const conductorTrack = parsed.tracks[0] ?? null;
  const conductorNoteOns = conductorTrack?.noteOns ?? [];
  const conductorNoteOffs = conductorTrack?.noteOffs ?? [];
  if (conductorNoteOns.length || conductorNoteOffs.length) {
    mismatches.push({
      type: "CONDUCTOR_NOTE_EVENT",
      trackId: null,
      trackName: conductorTrack?.name ?? "Conductor",
      expected: { noteOns: 0, noteOffs: 0 },
      actual: { noteOns: conductorNoteOns.length, noteOffs: conductorNoteOffs.length },
      detail: "Conductor track 0 must not contain musical note events.",
    });
  }

  let sourceNoteCount = 0;
  let exportedNoteCount = conductorNoteOns.length;

  for (let index = 0; index < projection.tracks.length; index += 1) {
    const expectedTrack = projection.tracks[index];
    const actualTrack = parsed.tracks[index + 1] ?? null;
    const expectedNotes = expectedTrack.notes ?? [];
    const actualNoteOns = actualTrack?.noteOns ?? [];
    sourceNoteCount += expectedNotes.length;
    exportedNoteCount += actualNoteOns.length;
    trackBreakdown[expectedTrack.id] = {
      trackName: expectedTrack.trackName,
      source: expectedNotes.length,
      exported: actualNoteOns.length,
    };

    if (!actualTrack) {
      mismatches.push({
        type: "TRACK_MISMATCH",
        trackId: expectedTrack.id,
        trackName: expectedTrack.trackName,
        expected: { trackIndex: index + 1, trackName: expectedTrack.trackName },
        actual: null,
        detail: `Missing MIDI track for ${expectedTrack.id}.`,
      });
      continue;
    }

    if (actualTrack.name !== expectedTrack.trackName) {
      mismatches.push({
        type: "TRACK_MISMATCH",
        trackId: expectedTrack.id,
        trackName: expectedTrack.trackName,
        expected: { trackIndex: index + 1, trackName: expectedTrack.trackName },
        actual: { trackIndex: actualTrack.trackIndex, trackName: actualTrack.name },
        detail: `Expected track ${index + 1} to be "${expectedTrack.trackName}", found "${actualTrack.name}".`,
      });
    }

    if (expectedNotes.length !== actualNoteOns.length) {
      mismatches.push({
        type: "NOTE_COUNT_MISMATCH",
        trackId: expectedTrack.id,
        trackName: expectedTrack.trackName,
        expected: { count: expectedNotes.length },
        actual: { count: actualNoteOns.length },
        detail: `Expected ${expectedNotes.length} note-on events on ${expectedTrack.id}, found ${actualNoteOns.length}.`,
      });
    }

    const actualNoteOffs = actualTrack.noteOffs ?? [];
    const usedNoteOns = new Set();
    const unresolvedNoteOns = [];

    for (const expected of expectedNotes) {
      const exact = takeMatch(actualNoteOns, usedNoteOns, (actual) => (
        expected.channel === actual.channel
        && expected.pitch === actual.pitch
        && expected.onTick === actual.tick
        && expected.velocity === actual.velocity
      ));
      if (!exact) unresolvedNoteOns.push(expected);
    }

    for (const expected of unresolvedNoteOns) {
      const samePitchAndTick = takeMatch(actualNoteOns, usedNoteOns, (actual) => (
        actual.pitch === expected.pitch
        && actual.tick === expected.onTick
      ));
      const sameChannelAndTick = samePitchAndTick ?? takeMatch(actualNoteOns, usedNoteOns, (actual) => (
        actual.channel === expected.channel
        && actual.tick === expected.onTick
      ));
      const sameChannelAndPitch = sameChannelAndTick ?? takeMatch(actualNoteOns, usedNoteOns, (actual) => (
        actual.channel === expected.channel
        && actual.pitch === expected.pitch
      ));

      if (!sameChannelAndPitch) {
        const elsewhere = parsed.tracks
          .filter((track) => track.trackIndex !== index + 1)
          .flatMap((track) => (track.noteOns ?? []).map((event) => ({ track, event })))
          .find(({ event }) => (
            event.channel === expected.channel
            && event.pitch === expected.pitch
            && event.tick === expected.onTick
            && event.velocity === expected.velocity
          ));
        if (elsewhere) {
          mismatches.push(mismatch(
            "TRACK_MISMATCH",
            expectedTrack,
            expected,
            {
              channel: elsewhere.event.channel,
              pitch: elsewhere.event.pitch,
              startTick: elsewhere.event.tick,
              endTick: elsewhere.event.tick,
              velocity: elsewhere.event.velocity,
            },
            `Note ${expected.noteId ?? ""} was serialized on MIDI track ${elsewhere.track.trackIndex} instead of ${index + 1}.`,
          ));
        } else {
          mismatches.push(mismatch(
            "MISSING_NOTE",
            expectedTrack,
            expected,
            null,
            `Expected note-on ${expected.noteId ?? ""} was not found in the serialized track.`,
          ));
        }
        continue;
      }

      const actual = sameChannelAndPitch.note;
      const actualShape = {
        channel: actual.channel,
        pitch: actual.pitch,
        startTick: actual.tick,
        endTick: actual.tick,
        velocity: actual.velocity,
      };
      if (expected.pitch !== actual.pitch) {
        mismatches.push(mismatch(
          "PITCH_MISMATCH",
          expectedTrack,
          expected,
          actualShape,
          `Pitch changed from ${expected.pitch} to ${actual.pitch}.`,
        ));
      }
      if (expected.channel !== actual.channel) {
        mismatches.push(mismatch(
          "CHANNEL_MISMATCH",
          expectedTrack,
          expected,
          actualShape,
          `Channel changed from ${expected.channel + 1} to ${actual.channel + 1}.`,
        ));
      }
      if (expected.onTick !== actual.tick) {
        mismatches.push(mismatch(
          "TIMING_MISMATCH",
          expectedTrack,
          expected,
          actualShape,
          `Start tick changed from ${expected.onTick} to ${actual.tick}.`,
        ));
      }
      if (expected.velocity !== actual.velocity) {
        mismatches.push(mismatch(
          "VELOCITY_MISMATCH",
          expectedTrack,
          expected,
          actualShape,
          `Velocity changed from ${expected.velocity} to ${actual.velocity}.`,
        ));
      }
    }

    actualNoteOns.forEach((actual, actualIndex) => {
      if (usedNoteOns.has(actualIndex)) return;
      mismatches.push(mismatch(
        "UNEXPECTED_EXTRA_NOTE",
        expectedTrack,
        null,
        {
          channel: actual.channel,
          pitch: actual.pitch,
          startTick: actual.tick,
          endTick: actual.tick,
          velocity: actual.velocity,
        },
        `Serialized track contains an unexpected note-on at tick ${actual.tick}.`,
      ));
    });

    const usedNoteOffs = new Set();
    const unresolvedNoteOffs = [];
    for (const expected of expectedNotes) {
      const exact = takeMatch(actualNoteOffs, usedNoteOffs, (actual) => (
        expected.channel === actual.channel
        && expected.pitch === actual.pitch
        && expected.offTick === actual.tick
      ));
      if (!exact) unresolvedNoteOffs.push(expected);
    }

    for (const expected of unresolvedNoteOffs) {
      const sameChannelAndPitch = takeMatch(actualNoteOffs, usedNoteOffs, (actual) => (
        actual.channel === expected.channel
        && actual.pitch === expected.pitch
      ));
      if (!sameChannelAndPitch) {
        mismatches.push(mismatch(
          "DURATION_MISMATCH",
          expectedTrack,
          expected,
          null,
          `Expected note-off for pitch ${expected.pitch} at tick ${expected.offTick} was not found.`,
        ));
        continue;
      }
      const actual = sameChannelAndPitch.note;
      mismatches.push(mismatch(
        "DURATION_MISMATCH",
        expectedTrack,
        expected,
        {
          channel: actual.channel,
          pitch: actual.pitch,
          startTick: actual.tick,
          endTick: actual.tick,
          velocity: 0,
        },
        `Note-off tick changed from ${expected.offTick} to ${actual.tick} for pitch ${expected.pitch}.`,
      ));
    }

    actualNoteOffs.forEach((actual, actualIndex) => {
      if (usedNoteOffs.has(actualIndex)) return;
      mismatches.push({
        type: "UNEXPECTED_NOTE_OFF",
        trackId: expectedTrack.id,
        trackName: expectedTrack.trackName,
        expected: null,
        actual: {
          channel: actual.channel,
          pitch: actual.pitch,
          tick: actual.tick,
        },
        detail: `Serialized track contains an unexpected note-off for pitch ${actual.pitch} at tick ${actual.tick}.`,
      });
    });
  }

  const extraMusicalTracks = parsed.tracks.slice(projection.tracks.length + 1);
  for (const track of extraMusicalTracks) {
    exportedNoteCount += (track.noteOns ?? []).length;
    mismatches.push({
      type: "TRACK_MISMATCH",
      trackId: null,
      trackName: track.name,
      expected: null,
      actual: { trackIndex: track.trackIndex, trackName: track.name, notes: track.notes.length },
      detail: `Serialized MIDI contains unexpected track ${track.trackIndex} "${track.name}".`,
    });
  }

  if (parsed.diagnostics.orphanNoteOffs || parsed.diagnostics.unterminatedNotes) {
    mismatches.push({
      type: "MALFORMED_NOTE_STREAM",
      trackId: null,
      trackName: null,
      expected: { orphanNoteOffs: 0, unterminatedNotes: 0 },
      actual: { ...parsed.diagnostics },
      detail: "Serialized MIDI contains unmatched note-on or note-off events.",
    });
  }

  return Object.freeze({
    version: 1,
    authority: "midi-export-parity-v1",
    mode: "read-only",
    passed: mismatches.length === 0,
    ppq: parsed.ppq,
    sourceNoteCount,
    exportedNoteCount,
    mismatchCount: mismatches.length,
    mismatches: Object.freeze(mismatches),
    trackBreakdown: Object.freeze(trackBreakdown),
    parserDiagnostics: Object.freeze({ ...parsed.diagnostics }),
  });
}

export class MidiExportParityViolationError extends Error {
  constructor(audit) {
    super(`MIDI export parity violation: ${audit?.mismatchCount ?? audit?.mismatches?.length ?? 0} mismatch(es)`);
    this.name = "MidiExportParityViolationError";
    this.audit = audit;
  }
}
