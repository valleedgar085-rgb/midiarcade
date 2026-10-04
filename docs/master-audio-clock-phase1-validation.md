# Master Audio Clock Phase 1 Validation

Baseline: `phase-apk-pr227-memory-fix2` @ `84f73debbebdd7f2f0c6c4c6ec872822c8255587`

Candidate source: `refactor/master-audio-clock-phase-1-baseline` @ `561a1cafb777acfbbd7bbf50901d1663c5a498e6`

Draft PR: #232

## Protected scope
- no generation algorithm changes
- no harmony, groove, humanization, or note-content changes
- no MIDI export semantic changes
- no instrument DSP or mix changes

## Phase 1 timing scope
- one AudioContext-based preview clock contract
- song-time ↔ audio-time conversion helpers
- scheduler wake-up jitter protection
- late-event clamping
- pause/frame position routed through the shared clock
- Android release test coverage for the preview clock

This branch exists only to trigger the APK workflow from the exact candidate code plus this documentation-only commit.
