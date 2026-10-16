# Bass Head Phase 2 — opt-in Funk/Neo-Soul groove-pulse bounce

## Purpose

A first fixed-seed 18-song Bass Head census found Funk relatively kick-locked (22 quarter-note offbeats among 84 bass notes, compared to 62/124 in Neo-Soul, 120/185 in Trap and 134/134 in House). That's an *observation*, not an automatic defect.

This independent experiment asks: **Can a small number of non-anchor bass onsets be moved onto existing bass groove conductor pulses to produce a clearer call-and-response feel?** It must never force an unsuitable groove on the approved app.

## Candidate constraints

`src/core/bass-head-bounce-candidates.js` is a **pure, candidate-only, explicitly opt-in helper** with no call site in production `src/music-engine.js` or the app. It considers only single-genre Funk and Neo-Soul with an existing groove conductor and positive bass notes.

- Changes **at most one bass attack per section** and at most two attacks per whole song.
- Only short interior quarter-beat attacks; not bar downbeats, protected anchors, kick-locked events, intentional bass rests, cadence/handoff notes, or any track other than bass.
- Moves a start by **exactly 0.25 beat** to a pre-existing bass pulse. The musical grid is not invented and no RNG is added.
- Preserves note count, pitch, velocity and duration; never crosses section or bar boundaries, harmonic change, or an adjacent bass voice collision.
- Protects all 6 original tracks, original 3-candidate arrangement authority and deterministic seed.
- Does **not** change existing sound/808 patches, gain, Web Audio envelopes, drum patterns or preview/export MIDI authority.

## Measured evidence gate

```sh
node --test tests/bass-head-bounce-candidates.test.mjs tests/groove-pocket-refinement.test.mjs
node scripts/benchmark-bass-head-bounce.mjs --seeds 3 --out /tmp/bass-bounce
npm run quality
npm run quality:music
```

The A/B bench generates **3 fixed 32-bar songs each in Funk and Neo-Soul** under exactly the same settings, compares with the original critic/release gate, scale fit and `encodeMidiVerified` parity. Only safe, actually different MIDI can produce an audition pair. Answer key is kept separate, and zero audition files is an acceptable failure to find qualifying candidates.

The final musical decision depends on human A/B listening in FL Studio with equal bass preset, kick instruments, effects, levels and tempo. Score whether the bass *makes you move more*, whether kick attack stays clear, and whether the pattern suits the genre. Do not assert improved danceability from offbeat percentages.

## Release rule

No automatic activation or runtime knob. The feature must remain OFF until multiple real-seed examples win blind listening and real Android parity. Reject the experiment if it creates misplaced bass or any critic/release/sound regression. No global bass boost or automation of synthetic bass patches.

## Skills

MIDI Bass Groove Director for objective pulse/space evaluation, MIDI Composition Review for style/section/vocal safeguards, MIDI Safe Integration for full CI and strict release gates. Independent repo reads concurrent; no autonomous subagents dispatched.
