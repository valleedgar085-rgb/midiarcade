/**
 * Canonical rendered-pitch contract shared by preview and MIDI export.
 *
 * Rendered note.pitch is the sole pitch authority. Track octave settings are
 * composition inputs only and must never be applied again at playback/export.
 */
export function canonicalMidiPitch(value, fallback = 60) {
  const numeric = Number(value);
  const safe = Number.isFinite(numeric) ? numeric : Number(fallback);
  const rounded = Math.round(Number.isFinite(safe) ? safe : 60);
  return Math.max(0, Math.min(127, rounded));
}

export function midiPitchToFrequency(value, fallback = 60) {
  return 440 * 2 ** ((canonicalMidiPitch(value, fallback) - 69) / 12);
}

export function renderedPitchParity(notePitch, previewPitch, exportedPitch) {
  const canonical = canonicalMidiPitch(notePitch);
  return canonicalMidiPitch(previewPitch) === canonical
    && canonicalMidiPitch(exportedPitch) === canonical;
}
