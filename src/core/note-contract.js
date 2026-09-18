export const MIDI_NOTE_VELOCITY_MIN = 1;
export const MIDI_NOTE_VELOCITY_MAX = 120;
export const MIDI_PITCH_MIN = 0;
export const MIDI_PITCH_MAX = 127;

export function clampMidiVelocity(value, fallback = 90) {
  const numeric = Number(value);
  const resolved = Number.isFinite(numeric) ? numeric : fallback;
  return Math.round(Math.min(MIDI_NOTE_VELOCITY_MAX, Math.max(MIDI_NOTE_VELOCITY_MIN, resolved)));
}

export function isValidMidiVelocity(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    && numeric >= MIDI_NOTE_VELOCITY_MIN
    && numeric <= MIDI_NOTE_VELOCITY_MAX;
}
