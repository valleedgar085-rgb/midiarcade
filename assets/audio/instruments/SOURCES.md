# Instrument sample sourcing — Phase 4.2

Do not activate the pitched sample path until source files are bundled, decoded and listening-tested.

## Approved candidates

1. **J. Learman Rhodes Mark I Stage 73** — CC0 electric-piano multisamples, source:
   https://github.com/smpldsnds/sfzinstruments-jlearman-jrhodes3d
   Original recordings and mappings must be checked before selecting note roots.
   Prefer a small mono subset with 3–5 semitone spacing and a single medium
   velocity layer for the first APK, then add velocity layers if performance allows.
2. **Versilian Community Sample Library (VCSL)** — CC0 instrument collection:
   https://github.com/sgossner/VCSL
   Inspect the specific bass instrument and mapping, not just the repository license.
3. **University of Iowa Musical Instrument Samples** — available for projects without
   restrictions, https://theremin.music.uiowa.edu/MIS.html
   Pizzicato double bass is an alternative to electric bass; it is *not* an 808.
   Source files are grouped into chromatic recordings and need note extraction.

## Bundling gate

- Verify each source file's licensing and preserve a provenance record.
- Trim to zero crossings with short fade-in/out and check peak headroom.
- Convert to mono WAV (or supported compressed Android playback) at consistent
  sample rate, tune roots and verify key zones and velocity layers.
- Keep individual buffers bounded and load lazily. Do not fetch sample URLs at
  playback time. Ensure offline operation.
- Register only files that actually exist under assets/audio/instruments/ in
  PITCHED_SAMPLE_MANIFEST; the manifest is intentionally empty until then.
- Compare original vs sampled preview on headphones and phone speakers; verify
  no clicks at note transitions and no regressions in drum preview or MIDI parity.

This note is a source shortlist, not a claim that the samples are already bundled.
