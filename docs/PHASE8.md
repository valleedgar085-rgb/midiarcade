# MIDI Arcade 1.3.0 — audio continuity and candidate selection

## Playback fixes

- Restore the recurring scheduler and visual timer after suspension, interruption or routing changes.
- Freeze the position while hidden, await pending suspension, and never auto-resume in the background.
- Restore the remaining duration and expression of notes spanning a seek/resume; do not replay old drum hits.
- Defer future notes while the voice pool is full instead of consuming them from the queue.
- Protect newly queued kicks/leads from self-stealing when every backing voice is already sounding.
- Track each voice's final source end time and clean up when `onended` delivery lags.
- Finish cleanup even when one transient source ended before the remaining sources were stopped.
- Release retiring graphs immediately on hidden/closed contexts, where their `onended` callbacks may not run.
- Queue the next loop's downbeat in advance and wrap the clock without restarting or fading the whole graph.

The constrained Android graph remains 48 voices with a 0.55-second lookahead;
this update does not increase DSP limits or promise uninterrupted background playback.

## Generate and musical choice

- Background-only production generation: no expensive retry on the UI thread after a worker failure.
- Cold-start and damaged-session recovery also generate in the worker, with responsive loading feedback.
- Cancellation terminates the worker and rejects the owning request before the UI unlocks. Late replies are ignored.
- One in-flight worker request; failed workers can be recreated on the next user attempt.
- The UI/watchdog and worker share the existing 90-second worker time budget.
- Candidate progress messages report actual evaluated ideas and the best score so far.
- New musical fingerprints sample the whole arrangement's lead, bass and drums; phrase identities are quantized and transposition-invariant.
- Selection rewards freshness and harmonic/phrase-resolution coherence after release, scale-safety and balance gates.
- Near-identical older recent ideas are penalized, not just the immediately preceding winner.
- Release checks inspect every pitched note directly, independent of rounded scale ratios or cached final checks.
- Preserve the existing audible-density analysis: chord/pad stacks count as rhythmic attacks rather than separate noteheads.

Same seed, settings and recent-song history remain deterministic. “More like this”
keeps its similarity-target scoring. No user key, mode or genre is changed to fake novelty.

## Validation and limits

Baseline and updated 63-song Music Quality Lab: Overall 93, Musical 92,
Technical 100, Creative floor 75, Release pass 100%, Unique fingerprints 100%.
These are internal metrics, not a percentage guarantee of professional quality.

24 matched six-candidate repeated-generation comparisons across trap, neo-soul,
hip-hop, house, techno and ambient: novelty 72.3333 → 72.6667; total score
93.5417 → 93.4583; one winning choice changed. All updated release gates passed.
The measured novelty improvement is modest; the primary improvement is runtime reliability.

Automated regression tests cover hidden/resume, sustained-note reconstruction,
voice-priority starvation, queue deferral, partial-source cleanup, loop-boundary
pre-scheduling, worker cancellation/stale replies and progress, deterministic
generation, and rejection of a single out-of-key note.

The APK workflow verifies the signing schemes, actual package and version, and
prints the APK SHA-256 before upload. Debug package: `com.midiarcade.app.preview`;
version: `1.3.0-preview`, version code 4. CI debug signing is not a stable production
release key, so an older preview signed differently may require a backed-up clean install.

Still required on the phone: dense 10–15 minute playback; repeated loops;
rapid stop/play and seeking; app-switch and lock/unlock; Bluetooth routing; and
generation/cancel/retry. No real-device listening result is claimed by these tests.
