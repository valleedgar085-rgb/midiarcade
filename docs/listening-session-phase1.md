# Phase 1: one blind listening session (2026-10-21)

Output-affecting changes in this repo are gated on listening evidence. The experiments existed as three separate blind A/B generators; this merges them into one session with one rating sheet and a scorer, so the answers can be decoded without hand-matching keys.

## Build and score

```sh
node scripts/benchmark-section-contrast-ab.mjs --genres hipHop,pop,rap,popRadio,funk,synthwave --seeds 2 --bars 32 --out RAW/section
node scripts/benchmark-hook-rescue-shadow.mjs --seeds 2 --bars 32 --genre-v2 true --out RAW/hook
node scripts/benchmark-bass-head-preference-selector.mjs --start 4 --seeds 6 --bars 32 --out RAW/bass.json --pack RAW/bass-midi --key RAW/bass-key.json
node scripts/build-listening-session.mjs --raw RAW --out OUT     # OUT/session (listen), OUT/KEY.json (open last)
node scripts/score-listening-session.mjs --key OUT/KEY.json --ratings OUT/session/ratings.csv
```

Presentation order is a hash of the pair id, so rebuilding reproduces the same session. Each pair is the same generated song with one small change on a hidden side. The experiment never changes default generation.

## This session (generated at commit after `94fc44c`)

| Experiment | Pairs | What differs |
| --- | ---: | --- |
| section-contrast | 4 | support-track velocities in a verse to chorus lift (hipHop x2, funk x2); synthwave produced no eligible pair |
| hook-rescue | 2 | one melody note in a returning chorus (afrobeats, rap) |
| bass-answer | 3 | one bass answer shifted by a quarter beat (neoSoul) |

Notes on the counts:
- The hook pack has 2 pairs, not 3 as before the Phase 2 ordering fix: two proposals were answering a measurement artifact, not real drift.
- Section contrast only exports pairs where the real MIDI velocities differ, which is why 8 of 12 cases produced none.
- The bass pack skips pickup variants the earlier listening round rejected.

## Reading the result

`scoreSession` counts, per experiment kind, how often the experiment side was chosen, how often the original was, and how often there was no preference. Blank rows are unanswered, and a bad answer throws rather than being skipped. Nine pairs from one listener is a directional signal for what to study next. It is not proof that a change is better and it is not Android preview audio.

## What the result would unlock

| If the experiment wins | Then |
| --- | --- |
| hook-rescue | widen the one-note hook helper beyond pop/hipHop/rap (Phase 2 follow-up) |
| section-contrast | consider enabling `sectionContrastDynamics` for the genres that won |
| bass-answer | with the earlier round, promote the neoSoul answer pattern (Phase 4) |

Not covered by this session: the `orchestrationMatrix` and `finalizeNotes` findings from the stage trace. They have no shadow variant yet, because a fair A/B needs an engine-level option and must change only the hook window.

## Result of the first session (one listener, 9 pairs)

The listener chose side B on all nine pairs. The experiment happened to be on B in 5 of the 9 pairs, so the score is **experiment 5, original 4, no preference 0**:

| Experiment | Experiment chosen | Original chosen |
| --- | ---: | ---: |
| section-contrast | 2 | 2 |
| bass-answer | 2 | 1 |
| hook-rescue | 1 | 1 |

A uniform "B" answer cannot be told apart from a preference for the second clip. Nothing here supports changing default generation or activating any experiment. Next round: more pairs per experiment, with the experiment side balanced and the listener re-hearing each pair in both orders before answering.

## Round 2: section contrast only, with bias controls

Built with `node scripts/build-listening-session.mjs --raw RAW --out OUT --balanced --max-per-kind 12` from `benchmark-section-contrast-ab.mjs --genres hipHop,pop,rap,popRadio,neoSoul,funk,synthwave,house --seeds 6 --bars 32` (48 cases, 21 eligible pairs, 12 used, spread across genres).

| Control | How |
| --- | --- |
| Position bias | `--balanced` puts the experiment on A for exactly half the pairs, chosen by hash, regardless of the generators' own sides. Every re-seated file was verified byte-for-byte against the original |
| Order effects | two listens per pair (A then B, then B then A). Differing answers score as unstable no-preference |
| Small n | 12 pairs of one experiment; the scorer reports an exact two-sided sign test per experiment and overall |

Reading it: with 12 decided pairs a 10-2 split gives p of about 0.04; 9-3 gives about 0.15. Unstable and no-preference pairs are not decided pairs, so they lower the effective n.
