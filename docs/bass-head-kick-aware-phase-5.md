# Bass Head Phase 5 — Kick-Aware Audition (shadow-only)

**Scope:** Developer-only comparison planning. No default song generation, no changes to approved bass synth, sound patches, output authority, MIDI export, Android app or release gates.

## Motivation
Phase 4 showed that five existing quarter-beat onset shifts across three Neo-Soul songs included **three newly anticipated upcoming kicks and zero newly created true post-kick responses**. Naming a candidate `kick-answer` based on grid timing alone was misleading. The listener preferred the experimental version on one of the three new Phase-3 A/B trials, but the unchanged original in the other two. Do not automatically choose the candidate.

## New behavior
`planKickAwareBassAuditions(song, {enabled:true})` asks the **existing opt-in protected bass generator** for candidates, then classifies every changed onset using `inspectBassHeadTimingChanges` and the actual drum track's GM kick 35/36. Each note is identified as a new post-kick **response**, new pre-kick **anticipation**, tighter existing response, stronger existing anticipation, or other. Only candidates whose every changed onset represents the *same clear newly created kick relationship* are eligible for future auditions. Mixed candidates are rejected by default. The original remains the sole production authority.

The selector does not create a new timing engine, alter note pitches/durations/velocities, or import user listening history. It rejects ambiguous/unmatched changes and preserves all protections of the existing opt-in source candidates. Tests ensure that a declared `kick-answer` may actually be an anticipation, that shifts nearer a prior kick are not mislabeled as a new response, and that the default is disabled.

## Required before any real musical activation
A/B compare **original** against separately designed *true kick responses* and *true anticipations* on held-out seeds with verified critic/release/export parity and identical FL Studio instruments/levels. Phase 5's shadow selector may produce no eligible trials with the existing candidates; **do not relax safeguards to manufacture a positive result**. Obtain actual human listening results before any production selection.

## Verification
```sh
node --test tests/bass-head-kick-aware-auditions.test.mjs tests/bass-head-timing-context.test.mjs tests/bass-head-bounce-shadow.test.mjs tests/bass-head-preference-selector.test.mjs
npm run quality
npm run quality:music
```
