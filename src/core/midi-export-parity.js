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
    const notes = [];
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
        const key = openNoteKey(channel, data1);
        const queue = openNotes.get(key) ?? [];
        queue.push({
          sequence: noteSequence++,
          startTick: currentTick,
          velocity: data2,
        });
        openNotes.set(key, queue);
        continue;
      }

      if (message === 0x80 || (message === 0x90 && data2 === 0)) {
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

  let sourceNoteCount = 0;
  let exportedNoteCount = 0;

  for (let index = 0; index < projection.tracks.length; index += 1) {
    const expectedTrack = projection.tracks[index];
    const actualTrack = parsed.tracks[index + 1] ?? null;
    const expectedNotes = expectedTrack.notes ?? [];
    const actualNotes = actualTrack?.notes ?? [];
    sourceNoteCount += expectedNotes.length;
    exportedNoteCount += actualNotes.length;
    trackBreakdown[expectedTrack.id] = {
      trackName: expectedTrack.trackName,
      source: expectedNotes.length,
      exported: actualNotes.length,
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

    if (expectedNotes.length !== actualNotes.length) {
      mismatches.push({
        type: "NOTE_COUNT_MISMATCH",
        trackId: expectedTrack.id,
        trackName: expectedTrack.trackName,
        expected: { count: expectedNotes.length },
        actual: { count: actualNotes.length },
        detail: `Expected ${expectedNotes.length} notes on ${expectedTrack.id}, found ${actualNotes.length}.`,
      });
    }

    const used = new Set();
    const unresolved = [];

    for (const expected of expectedNotes) {
      const exact = takeMatch(actualNotes, used, (actual) => exactNoteMatch(expected, actual));
      if (!exact) unresolved.push(expected);
    }

    for (const expected of unresolved) {
      const samePitchAndStart = takeMatch(actualNotes, used, (actual) => (
        actual.pitch === expected.pitch
        && actual.startTick === expected.onTick
      ));
      const sameChannelAndStart = samePitchAndStart ?? takeMatch(actualNotes, used, (actual) => (
        actual.channel === expected.channel
        && actual.startTick === expected.onTick
      ));
      const sameChannelAndPitch = sameChannelAndStart ?? takeMatch(actualNotes, used, (actual) => (
        actual.channel === expected.channel
        && actual.pitch === expected.pitch
      ));

      if (!sameChannelAndPitch) {
        const elsewhere = parsed.tracks
          .filter((track) => track.trackIndex !== index + 1)
          .flatMap((track) => track.notes.map((note) => ({ track, note })))
          .find(({ note }) => exactNoteMatch(expected, note));
        if (elsewhere) {
          mismatches.push(mismatch(
            "TRACK_MISMATCH",
            expectedTrack,
            expected,
            elsewhere.note,
            `Note ${expected.noteId ?? ""} was serialized on MIDI track ${elsewhere.track.trackIndex} instead of ${index + 1}.`,
          ));
        } else {
          mismatches.push(mismatch(
            "MISSING_NOTE",
            expectedTrack,
            expected,
            null,
            `Expected note ${expected.noteId ?? ""} was not found in the serialized track.`,
          ));
        }
        continue;
      }

      const actual = sameChannelAndPitch.note;
      if (expected.pitch !== actual.pitch) {
        mismatches.push(mismatch(
          "PITCH_MISMATCH",
          expectedTrack,
          expected,
          actual,
          `Pitch changed from ${expected.pitch} to ${actual.pitch}.`,
        ));
      }
      if (expected.channel !== actual.channel) {
        mismatches.push(mismatch(
          "CHANNEL_MISMATCH",
          expectedTrack,
          expected,
          actual,
          `Channel changed from ${expected.channel + 1} to ${actual.channel + 1}.`,
        ));
      }
      if (expected.onTick !== actual.startTick) {
        mismatches.push(mismatch(
          "TIMING_MISMATCH",
          expectedTrack,
          expected,
          actual,
          `Start tick changed from ${expected.onTick} to ${actual.startTick}.`,
        ));
      }
      if (expected.offTick !== actual.endTick) {
        mismatches.push(mismatch(
          "DURATION_MISMATCH",
          expectedTrack,
          expected,
          actual,
          `End tick changed from ${expected.offTick} to ${actual.endTick}.`,
        ));
      }
      if (expected.velocity !== actual.velocity) {
        mismatches.push(mismatch(
          "VELOCITY_MISMATCH",
          expectedTrack,
          expected,
          actual,
          `Velocity changed from ${expected.velocity} to ${actual.velocity}.`,
        ));
      }
    }

    actualNotes.forEach((actual, actualIndex) => {
      if (used.has(actualIndex)) return;
      mismatches.push(mismatch(
        "UNEXPECTED_EXTRA_NOTE",
        expectedTrack,
        null,
        actual,
        `Serialized track contains an unexpected note at tick ${actual.startTick}.`,
      ));
    });
  }

  const extraMusicalTracks = parsed.tracks.slice(projection.tracks.length + 1);
  for (const track of extraMusicalTracks) {
    exportedNoteCount += track.notes.length;
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
