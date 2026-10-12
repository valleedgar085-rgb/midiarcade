/**
 * Phase 4.2: deterministic, click-safe pitched-voice harmonic profiles.
 * Preview-only: never changes MIDI notes, drum voices, or arrangement data.
 * Studio mode remains explicitly opt-in during listening calibration.
 */
const PROFILE = Object.freeze({
  bass: Object.freeze({ harmonics: [1, 0.26, 0.14, 0.07, 0.035, 0.018], tilt: 0.92 }),
  chords: Object.freeze({ harmonics: [1, 0.46, 0.24, 0.15, 0.075, 0.035, 0.018], tilt: 0.86 }),
  melody: Object.freeze({ harmonics: [1, 0.51, 0.3, 0.13, 0.065, 0.025], tilt: 0.9 }),
  counterpoint: Object.freeze({ harmonics: [1, 0.42, 0.2, 0.1, 0.035], tilt: 0.9 }),
});
export const STUDIO_SOUND_TRACKS = Object.freeze(Object.keys(PROFILE));

export function studioSoundHarmonics(trackId, { enabled = false, brightness = 0.5 } = {}) {
  if (!enabled || !Object.hasOwn(PROFILE, trackId)) return null;
  const profile = PROFILE[trackId];
  const bright = Number.isFinite(Number(brightness)) ? Math.max(0, Math.min(1, Number(brightness))) : 0.5;
  const imaginary = new Float32Array(profile.harmonics.length + 1);
  for (let harmonic = 1; harmonic <= profile.harmonics.length; harmonic += 1) {
    imaginary[harmonic] = profile.harmonics[harmonic - 1]
      * Math.pow(profile.tilt + bright * 0.08, harmonic - 1);
  }
  return imaginary;
}
