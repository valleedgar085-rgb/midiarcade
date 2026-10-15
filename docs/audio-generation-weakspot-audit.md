# MIDI Arcade — Audio, Generation and Create Weak-Spot Audit

Date: 2026-10-15. Baseline main: 27c80e4db9aacd88154105c3c7e1a04debef2b4f.

## Evidence-led priorities

| Priority | Source evidence | Risk | Next intervention |
| --- | --- | --- | --- |
| P0 | preview-performance.js: Android 32 scheduled-voice ceiling vs 96 desktop; app.js enforces this by cleanupScheduledVoice on selected voices | Voice pruning may interrupt audible tails in dense chords/pads, creating holes or clicks | Collect voice eviction counts and time markers on physical Android; isolate mid-note vs future culling |
| P0 | app.js: startSchedulerPulse() uses worker with timer fallback; schedule() drops events older than Android lateEventGraceSeconds=0.08 | Main-thread stalls may drop events; discontinuities can be mistaken for clicks | Trace schedule gaps, worker fallbacks and late note drops on device before tuning thresholds |
| P0 | preview-audio.js already guards pitched-note attacks, pad filter automation and graceful stops | Global fades/limiting may break the approved sound baseline | Record clicks by track, attack/release and instrument; perform focused offline and device A/B before touching synthesis |
| P1 | app.js waits on Promise.all([work, generationDelay(kind)]); old default artificial hold was 3200ms New and 4200ms variations | Avoidable perceived generation slowness | PR #360 removes fixed multi-second UI hold; actual musical search still runs to completion |
| P1 | generation-executor.js serially performs composition, optional correction, quality candidate stages, canonical refresh and release checks | Extra retries or repeated validation may dominate heavy requests | Measure separate phase durations in generation-flight-recorder, then optimize only proven bottlenecks |
| P1 | Create knobs, genre, key and harmonic path scattered across small panels and nested Advanced drawer | Small touch targets and producer flow friction | PR #359 consolidates existing live controls into one responsive panel under song card |
| P2 | Hook return audit showed 14/45 weak hooks, but only one very small safe proposal | Current melody repair coverage is too narrow | Implement genre-aware hook candidates in the existing authority after human A/B listening |

## New read-only benchmark

The script scripts/audit-preview-pressure-generation.mjs runs 21 genres x 2 seeded songs at 32 bars and records: generation time on Node CI; note density; estimated actual overlapping MIDI notes; and estimated scheduling occupancy including the Android 0.55 second lookahead. Full JSON is uploaded by the preview-pressure-audit workflow.

Important limits: this model does NOT execute the real Web Audio graph. Drums and note release envelopes are approximated; single MIDI notes can spawn multiple Web Audio oscillators. Estimated concurrency above 32 is a prioritization signal, never proof of audible clicking. CI CPU time is not Android CPU time.

Commands: node --test tests/preview-voice-pressure-audit.test.mjs ; node scripts/audit-preview-pressure-generation.mjs --seeds 2 --bars 32 --json /tmp/audio-generation.json

## Reproduction checklist for audio fix

Record the APK SHA, phone/Android version, whether phone speaker/headphones, genre, seed, bar, exact track(s), at which beat the click occurs, and whether clicks line up with note attack, release, section transition or voice-heavy chord onset. Compare the same MIDI in FL Studio. If the MIDI is clean but Android preview clicks, suspect preview path rather than note generation. Capture a brief example around the click. The next fix must be one isolated audio path with click regression tests and actual phone listening.

## Release policy and skills

Do not assert the clicking is fixed without measured rendered/device audio. Keep approved synth, note events, deterministic seed, selected three-candidate authority and MIDI parity unchanged. Skills applied: MIDI Audio Diagnostics, MIDI Safe Integration and UI/UX Pro Max during independent reviews. Parallel repository tool reads were used, but no autonomous coding subagents dispatched.