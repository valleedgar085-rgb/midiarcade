# Instrument sample sourcing — Phase 4.2

Do not activate the pitched sample path until source files are bundled, decoded and listening-tested.

## Approved candidates

1. **J. Learman Rhodes Mark I Stage 73 — NOT APPROVED for APK bundling.**
   The original sample license is CC BY-NC 4.0 for redistribution inside
   software, even though control files and musical works made with the
   instrument are CC0. Commercial APK redistribution needs explicit
   permission from Jeff Learman. Do not import or redistribute its audio.
   Original license: https://github.com/sfzinstruments/jlearman.jRhodes3d/blob/master/LICENSE
2. **Osiris Piano (CC0)** — https://github.com/sfzinstruments/Osiris_Piano
   Repository contains a CC0 1.0 LICENSE and sampled piano instruments.
   Evaluate its electric-piano suitability by listening; it is not a Rhodes
   substitute by license or instrument identity. Verify sample-specific
   provenance and record chosen note roots before bundling.
3. **Versilian Community Sample Library (VCSL)** — CC0 instrument collection:
   https://github.com/sgossner/VCSL
   Inspect the specific bass instrument and mapping, not just the repository license.
4. **University of Iowa Musical Instrument Samples** — available for projects without
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
