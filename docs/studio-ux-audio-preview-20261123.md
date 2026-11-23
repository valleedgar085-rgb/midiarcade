# Studio UX and opt-in sound preview — 2026-11-23

## Base and scope

- Latest fetched main: `f0a993613d9f7c72f47aad432f09cda2c146560d`.
- Carries the previous research preview, PR #398, at `b701d815e4548897f62e71794477f9b1615754dd`.
- Branch: `feat/studio-ux-audio-preview-20261123`. No unrelated piano-roll, TasteForge, or Instrument Intelligence branches were merged.
- This is a preview, not an approved replacement for the Android sound baseline.

## What changed

1. **Preview sound in Mix:** Auto remains the default. Studio explicitly enables the existing desktop stereo reverb, layers, transients, and effects. Android retains its 32-voice ceiling, balanced latency, scheduler cushion, voice priorities, and longer output fade. No master gain, patch, filter envelope, limiter, sample, or MIDI event is retuned.
2. **Safe switching:** selecting a mode changes a persisted device preference only. It cannot rebuild an active song or live MIDI note. On the next stopped playback start, the output fades over its defined envelope and source tail before the old context closes. Concurrent starts share the transition; the latest selection wins. Close errors remain visible and preserve the old context's recovery handler.
3. **Drum pocket graphic:** the selected Drums section shows its actual first-bar kick, snare/rim, clap, hats, and other percussion in five lanes. It is explicitly a read-only sixteenth-grid snapshot, not a live sequencer, quantizer, or full-song claim. Hit counts include rolls sharing a cell. Quiet MIDI velocity 1 stays quiet. Notes at the next bar boundary are not included.
4. **UI polish:** clearer Mix channel borders and active controls, consistent headings, larger select/range targets, two-column phone controls with a narrow-screen fallback, stronger selected-note outlines, velocity stripes on notes, and a clearer Finish card. Keyboard focus, forced colors, reduced motion, existing navigation, and safe-area spacing are retained.

## HoRNet reference

The user named HoRNet RhyGenerator MK2. The vendor describes independent rhythm lanes, pattern rotation, custom steps and accents:

https://www.hornetplugins.com/introducing-hornet-rhygenerator-mk2/

This inspired the lane-oriented view and contextual instructions for the existing **Shift Hats** and **Shape Hat Accents** previews. No proprietary code, assets, plugin, sixteen-lane generator, arpeggiator, LFO, or desktop plugin host is included. RhyGenerator produces MIDI rather than sound; it is not the audio renderer for this change.

## Audio diagnosis and evidence limits

Request: richer preview sound, not an isolated reproduced click defect. Source evidence: every Android user agent currently selects the constrained graph, regardless of hardware. Alternative explanation: lightweight Android sound is an intentional stability tradeoff, not proof of a faulty patch. The change therefore offers a reversible opt-in, keeps Auto intact, and makes no promise of objectively better sound on every phone.

Tests cover output-fade/close ordering, active-voice deferral, transition concurrency, stale-context ownership, close-error recovery, saved preference validation, unchanged composition/track settings, and the existing audio and MIDI contracts. The numeric graph settings and behavioral tests do **not** replace an OfflineAudioContext signal render, CPU profiling, listening, or physical Android tests.

Cloud browser preview access was blocked. No rendered screenshots or visual/a11y compliance claims are provided. Source/DOM-mock tests are not visual verification. Device listening, headphones/speaker comparison, actual audio peaks/RMS, runtime CPU load, and screen-layout validation remain unverified.

## Phone test

1. Install the separate preview APK; do not delete the regular app or saved songs.
2. Generate a 32-bar Hip-Hop or Pop song. In Mix, listen with **Preview sound → Auto**.
3. Pause. Choose **Studio · richer**, then press Play. Compare the same section on headphones. Notes, pitch, timing, mix settings, and exported MIDI should remain the same; ambience and synthesized layers may differ.
4. If the phone crackles, gets hot, or loses voices, pause and choose Auto, then Play. Studio uses more CPU/battery and is not yet device-validated.
5. In Shape, choose a section and Drums. The lane display describes its first bar only. Under See all changes, preview Shift Hats or Shape Hat Accents; compare Original/Preview and explicitly keep or discard.
6. Open the piano roll, select a note, and check its velocity stripe and velocity lane. Check portrait, landscape, narrow screens, the keyboard focus ring, and the bottom navigation.
7. Export after accepting/discarding auditions. The sound-quality selector is not an audio-export switch: the file remains MIDI, and an external synth or DAW may sound different.

## Release boundary

Run `npm run quality`, focused audio tests, `npm run test:android-release`, real MIDI parity tests, and Android debug build/lint/unit tests. Keep the work unmerged until required CI and device/visual review are satisfied. An APK existing is not evidence of musical or audible quality.
