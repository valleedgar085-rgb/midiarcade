function clamp(value, min, max) {
  const numeric = Number(value);
  const fallback = Number.isFinite(numeric) ? numeric : min;
  return Math.min(max, Math.max(min, fallback));
}

function scaleToward(value, multiplier, intensity, min, max) {
  const source = Number(value);
  if (!Number.isFinite(source)) return value;
  const amount = clamp(intensity, 0, 1);
  const effective = 1 + (Number(multiplier) - 1) * amount;
  return clamp(source * effective, min, max);
}

function offsetToward(value, delta, intensity, min, max) {
  const source = Number(value);
  if (!Number.isFinite(source)) return value;
  return clamp(source + Number(delta) * clamp(intensity, 0, 1), min, max);
}

const FIRE = Object.freeze({
  drums: { volume: 1.08, velocity: 1.1, reverb: 0.62, cutoff: 1.18, resonance: 0.1, gate: 0.82 },
  bass: { volume: 1.07, velocity: 1.07, reverb: 0.58, cutoff: 1.18, resonance: 0.08, gate: 0.9 },
  chords: { volume: 1.03, velocity: 1.03, reverb: 0.7, cutoff: 1.12, resonance: 0.06, gate: 0.9 },
  melody: { volume: 1.04, velocity: 1.06, reverb: 0.72, cutoff: 1.18, resonance: 0.08, gate: 0.88 },
  counterpoint: { volume: 1.02, velocity: 1.05, reverb: 0.7, cutoff: 1.2, resonance: 0.09, gate: 0.86 },
  pad: { volume: 0.96, velocity: 1.02, reverb: 0.84, cutoff: 1.08, resonance: 0.05, gate: 0.94 },
});

const ELECTRIC = Object.freeze({
  drums: { volume: 1.02, velocity: 1.05, reverb: 0.78, cutoff: 1.14, resonance: 0.13, gate: 0.88 },
  bass: { volume: 1.01, velocity: 1.04, reverb: 0.82, cutoff: 1.24, resonance: 0.15, gate: 0.88 },
  chords: { volume: 1, velocity: 1.02, reverb: 1.08, cutoff: 1.34, resonance: 0.19, gate: 0.84 },
  melody: { volume: 1.03, velocity: 1.04, reverb: 1.12, cutoff: 1.4, resonance: 0.22, gate: 0.8 },
  counterpoint: { volume: 1.02, velocity: 1.03, reverb: 1.15, cutoff: 1.42, resonance: 0.23, gate: 0.78 },
  pad: { volume: 0.98, velocity: 1, reverb: 1.22, cutoff: 1.28, resonance: 0.18, gate: 0.94 },
});

const DRIP = Object.freeze({
  drums: { volume: 0.94, velocity: 0.94, reverb: 1.36, cutoff: 0.82, resonance: -0.04, gate: 1.08 },
  bass: { volume: 0.98, velocity: 0.96, reverb: 1.22, cutoff: 0.78, resonance: -0.04, gate: 1.14 },
  chords: { volume: 0.98, velocity: 0.95, reverb: 1.62, cutoff: 0.72, resonance: -0.06, gate: 1.28 },
  melody: { volume: 0.99, velocity: 0.94, reverb: 1.58, cutoff: 0.8, resonance: -0.05, gate: 1.32 },
  counterpoint: { volume: 0.96, velocity: 0.93, reverb: 1.64, cutoff: 0.76, resonance: -0.06, gate: 1.34 },
  pad: { volume: 1.02, velocity: 0.94, reverb: 1.78, cutoff: 0.68, resonance: -0.08, gate: 1.38 },
});

export const ELEMENT_SOUND_PROFILES = Object.freeze({
  fire: FIRE,
  electric: ELECTRIC,
  drip: DRIP,
});

function trackId(track, index) {
  return String(track?.id ?? track?.name ?? ["drums", "bass", "chords", "melody", "counterpoint", "pad"][index] ?? "melody");
}

/**
 * Applies a bounded, playback-facing production signature to one elemental
 * interpretation. It only changes track settings, never notes, tempo, key,
 * harmony, or arrangement identity. Runtime manual controls are applied later
 * and therefore remain authoritative over these generated values.
 */
export function applyElementSoundProfile(song, elementId, intensity = 0.75) {
  if (!song || !Array.isArray(song.tracks)) return song;
  const id = String(elementId ?? "").toLowerCase();
  const profile = ELEMENT_SOUND_PROFILES[id];
  if (!profile) return song;
  const strength = clamp(intensity, 0, 1);

  song.tracks.forEach((track, index) => {
    const role = trackId(track, index);
    const shaping = profile[role];
    if (!shaping) return;
    const settings = { ...(track.settings ?? track.controls ?? {}) };

    if (settings.volume != null) settings.volume = scaleToward(settings.volume, shaping.volume, strength, 0, 1);
    if (settings.velocity != null) settings.velocity = scaleToward(settings.velocity, shaping.velocity, strength, 0.1, 1.5);
    if (settings.reverb != null) settings.reverb = scaleToward(settings.reverb, shaping.reverb, strength, 0, 1);
    if (settings.cutoff != null) settings.cutoff = scaleToward(settings.cutoff, shaping.cutoff, strength, 1000, 14000);
    if (settings.resonance != null) settings.resonance = offsetToward(settings.resonance, shaping.resonance, strength, 0, 1);
    if (settings.gate != null) settings.gate = scaleToward(settings.gate, shaping.gate, strength, 0.08, 1.5);

    track.settings = settings;
  });

  song.elementSound = Object.freeze({
    version: 1,
    id,
    intensity: Number(strength.toFixed(4)),
  });
  return song;
}
