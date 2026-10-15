---
name: midi-audio-diagnostics
description: Diagnose MIDI Arcade preview clicks, pops, crackles, clipping, performance spikes, silence and Web Audio problems using evidence before modifying synthesis or audio envelopes.
---

# MIDI Arcade audio diagnostics

Developer-only skill. The validated sound of the existing Android APK is the **baseline**, not an invitation to retune effects. Read root `AGENTS.md` and `docs/phase4-hook-research-and-baseline.md` first. Do not modify audio merely because new composition tooling has been adopted.

## Upstream specialist references

- [Sonic Skills: audio-artifacts-debug](https://github.com/kunitoki/sonic-skills/blob/main/skills/audio-artifacts-debug/SKILL.md): symptom-led investigation.
- [Sonic Skills: webaudio-review](https://github.com/kunitoki/sonic-skills/blob/main/skills/webaudio-review/SKILL.md): Web Audio scheduling and runtime constraints.
- [Sonic Skills: audio-numerics-review](https://github.com/kunitoki/sonic-skills/blob/main/skills/audio-numerics-review/SKILL.md): finite-value handling, filtering, and precision.
- [Sonic Skills: audio-performance-debug](https://github.com/kunitoki/sonic-skills/blob/main/skills/audio-performance-debug/SKILL.md): glitch and load profiling.
- [Audio Verification](https://github.com/AkshitIreddy/agent-skills/blob/main/skills/audio-verification/SKILL.md): offline audio metrics and the limit of those measurements.

Read the relevant original source when available. Use ideas only where they match this app's Web Audio + Capacitor architecture; do not apply JUCE/VST3-specific remedies blindly.

## Evidence-first triage

1. Record affected track(s), attack vs release vs section transition, tempo, device/browser, seed, knobs, whether the problem scales with voice count or level, and whether it reproduces in a previous known-good build.
2. Isolate the **actual production path** before inventing test oscillators. Relevant code includes `src/core/preview-audio.js`, `src/core/preview-drums.js`, `src/core/preview-performance.js`, `src/app.js` and the player scheduling lifecycle.
3. Distinguish note-envelope discontinuity, filter automation ordering, abrupt voice stop, transient overs, context/device lifecycle, GC/CPU deadline, and sample-source artifacts. Use concrete sample times, transitions, signal paths, or profiler output; do not diagnose by anecdote alone.
4. Where browser tooling permits, render the production graph with `OfflineAudioContext` under fixed conditions and measure peak, RMS, non-finite samples, active voices and start/stop boundary discontinuities. Compare identical seeds/settings and playback overlap patterns. Check audible artifacts separately on actual Android hardware.
5. Treat near-full-scale samples, attack heuristics or spectral metrics as **warnings, not proof of audible defects**. A numeric gain improvement may worsen the artistic baseline; do not change master gain/reverb/limiter or approved voice patches without an isolated reproduction and listening check.
6. If a change is justified, target one root cause and add a focused regression test; do not mask problems with blanket headroom reductions, global fades, or arbitrary delay increases.

## Verification

- Run `node --test tests/atmosphere-pad-click-regression.test.mjs tests/pitched-preview-click-regression.test.mjs tests/preview-audio-transition.test.mjs tests/phase7-audio-runtime.test.mjs tests/playback-recovery.test.mjs tests/preview-performance.test.mjs`.
- Then `npm run quality` and `npm run test:android-release`; verify on a physical Android device before claiming a device-audio fix.
- Do not alter generated MIDI events while fixing preview audio. Check preview/export parity and stop/mute/section-jump cleanup where relevant.

## Required diagnosis format

`Symptom + affected track | Reproduction setup | Suspected stage/function | Evidence and alternative hypotheses | Sample/performance measurements | Narrow fix | Automated test evidence | Device listening evidence or still-unverified`.

A missing measurement or device test must be reported as missing; it must not be described as a pass.
