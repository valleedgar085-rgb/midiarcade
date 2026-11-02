# Instrument sound provenance — Phase 4.2

## Bundled sampled piano: Osiris Piano (CC0 1.0)

- Source: https://github.com/sfzinstruments/Osiris_Piano
- License: https://github.com/sfzinstruments/Osiris_Piano/blob/18c6afccb60cff458edbf7c394571783e074e1e9/LICENSE
- Pinned source commit: `18c6afccb60cff458edbf7c394571783e074e1e9`
- Original samples: `UC/A/Piano_UC_MicA_{note}_vl{1,2}.flac`
- Original mapping: `Programs/modules/mappings/uc_mica_vl1_map.sfz` and `uc_mica_vl2_map.sfz`
- Converter: `scripts/import-cc0-piano.py`, mono 22,050 Hz PCM16 WAV, 2.5-second length, short fades
- Local output: `assets/audio/instruments/piano/piano-{root}.wav` (soft) and `piano-{root}-strong.wav` (strong)
- Velocity layers: original SFZ maps layer 1 to MIDI 1–63 and layer 2 to MIDI 64–127
- Roots: Osiris C2→MIDI 48, F2→53, C3→60, F3→65, C4→72, F4→77

**Critical root-pitch convention:** Osiris uses C3 as MIDI 60 (middle C). Do
not assume that its filename C3 is MIDI 48: that would shift the entire
sample pack by an octave. Read note-key centers from the upstream SFZ mapping.

**Instrument type:** This pack is an acoustic piano, not Rhodes/electric piano.
It is an optional chord-track timbre and must not replace the existing synth.
No claims of listening-test completion should be made without actual listening.

**Release gate:** Validate sample WAV contents, note pitches and both
velocity layers after the importer workflow; run full tests and debug APK.
A/B on phone speakers and headphones for relative loudness, click-free
stops, and polyphonic peak headroom before merging.

## Other source candidates

- **J. Learman Rhodes Mark I Stage 73 — NOT APPROVED for bundling.**
  Its recordings are CC BY-NC 4.0 for redistribution in software; explicit
  permission is needed for a commercial APK. Compositions created with the
  instrument may have different licensing. Never bundle this recording pack.
  https://github.com/sfzinstruments/jlearman.jRhodes3d
- **Versilian Community Sample Library (VCSL)**, CC0 source candidate
  for future bass and other instruments. Verify instrument-level provenance.
  https://github.com/sgossner/VCSL
- **University of Iowa Musical Instrument Samples**, bass reference candidate
  but pizzicato double bass is not electric bass or an 808.
  https://theremin.music.uiowa.edu/MIS.html

The included samples are served locally by the APK. The preload fetch reads
bundled assets and does not contact a remote sample service. All sampled mode
changes are opt-in and must preserve preview/MIDI timing and drums.
