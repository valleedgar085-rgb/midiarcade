# Bass Head Phase 2: Existing Continuity Repair A/B

## Based on reproduced weakness, not an invented new bass algorithm

The [Bass Head Groove Director census, merged PR #366](https://github.com/valleedgar085-rgb/midiarcade/pull/366) ran two fixed songs in nine genres, all 18 passing existing release gates. Funk seed `bass-head-census-funk-01` has a **12.501-beat empty span within verse 2**, 1.865 continuity deficit, and an existing bounded candidate available in `src/core/bass-continuity-refinement.js`.

A separate [PR #367](https://github.com/valleedgar085-rgb/midiarcade/pull/367) tested a plausible quarter-beat retiming technique but **six real Funk/Neo-Soul songs offered zero eligible moves**. It was closed without merging. Do NOT loosen kick/motif protections to force that experiment.

## New evidence test

This phase **reuses the installed bass-continuity authority** and adds only developer-only automated A/B scripts and regression tests. It is not a bassline generator, does not enable `bassContinuityRefinement`, and doesn't change sound, drum notes, sample patches or existing track settings.

Evaluate 2 each of Funk, Neo-Soul and Hip-Hop at 32 bars, E minor, fixed settings/seed from the same census. Every candidate:
- Must be authored by `createBassContinuityCandidates()`.
- Adds only **1–3 bass notes**, preserves existing bass events and every non-bass track.
- Must lower the existing continuity deficit while passing the existing musical critic, every comparable critic subscore, scale-fit diagnostics and release gate.
- Must pass **real `encodeMidiVerified` MIDI parity** before exporting blinded A/B files.
- Must remain uncommitted to normal song generation.

Run tests:

```bash
node --test tests/bass-head-real-continuity-ab.test.mjs tests/bass-continuity-refinement.test.mjs
node scripts/benchmark-bass-head-continuity-ab.mjs --seeds 2 --out /tmp/bass-continuity
npm run quality
npm run quality:music
```

The blind pack keeps the treatment key separate. Compare in FL Studio with identical bass/kick programs, loudness and effects. The central listening question is whether the newly linked bass keeps momentum **without filling intentional vocal space or overstaying a chord**. A high numeric continuity score is not proof of danceability. Zero qualifying outputs is valid evidence to keep the original.

The user's approved Android sound remains unchanged.

## Skills
Used `midi-bass-groove-director`, `midi-composition-review`, `midi-safe-integration`; independent read-only source/CI inspections ran concurrently, no actual autonomous subagents dispatched.
