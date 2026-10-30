import { createMidiExportProjection } from "../../src/music-engine.js";

/** Compare actual buildPreviewEvents output with MIDI score events, not audio
 * samples. CC11 gain, synthesis release/timbre, a 30 ms minimum preview envelope
 * and the MIDI song-end clamp are explicit playback policies, not note edits.
 * DAW-safe/tight export profiles are separately audited against their clone.
 */
export function auditPreviewMidiEvents(song, previewEvents) {
  const projection = createMidiExportProjection(song);
  const secondsPerBeat = 60 / Number(song.meta.tempo);
  if (!Number.isFinite(secondsPerBeat) || secondsPerBeat <= 0) throw new TypeError("Preview parity requires a finite positive tempo");
  const secondsPerTick = secondsPerBeat / projection.ppq;
  const tick = (seconds) => Math.round(seconds / secondsPerTick);
  const clampTick = (value, min, max) => Math.max(min, Math.min(max, value));
  const used = new Set();
  const mismatches = [];
  let minimumEnvelopeNotes = 0;
  let songEndClamps = 0;
  for (const track of projection.tracks) for (const note of track.notes) {
    const index = previewEvents.findIndex((event, i) => !used.has(i)
      && event.id === track.id && event.pitch === note.pitch
      && Math.round(event.baseVelocity) === note.velocity
      && (track.program == null || event.program === track.program)
      && Math.abs(tick(event.time) - note.onTick) <= 1);
    if (index < 0) { mismatches.push({ type: "MISSING_OR_CHANGED_PREVIEW_NOTE", trackId: track.id, noteId: note.noteId }); continue; }
    used.add(index);
    const event = previewEvents[index];
    if (!Number.isFinite(event.duration) || event.duration <= 0) {
      mismatches.push({ type: "INVALID_PREVIEW_DURATION", trackId: track.id, noteId: note.noteId });
      continue;
    }
    const end = clampTick(tick(event.time + event.duration), 1, projection.endTick);
    const minimumEnvelope = event.duration === 0.03 && (note.offTick - note.onTick) * secondsPerTick <= 0.03 + secondsPerTick;
    if (minimumEnvelope) minimumEnvelopeNotes += 1;
    if (tick(event.time + event.duration) > projection.endTick) songEndClamps += 1;
    if (Math.abs(end - note.offTick) > 1 && !minimumEnvelope) mismatches.push({ type: "PREVIEW_DURATION_MISMATCH", trackId: track.id, noteId: note.noteId, expected: note.offTick, actual: end });
  }
  previewEvents.forEach((event, index) => {
    if (!used.has(index)) mismatches.push({ type: "UNEXPECTED_PREVIEW_NOTE", trackId: event.id, pitch: event.pitch });
  });
  return { passed: mismatches.length === 0, noteCount: projection.noteCount, minimumEnvelopeNotes, songEndClamps, mismatches };
}
