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
