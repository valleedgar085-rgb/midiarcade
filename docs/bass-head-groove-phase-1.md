# Bass Head Groove Director — Phase 1: kick/bass pocket evidence

Baseline: main `d5a0f8566e96a5258ed44e8c150fc4ec2b233be3`, following installation of `midi-bass-groove-director`.

## Aim

The user wants *deep, precisely timed, jumpy, groovy bass* with dance energy. The first improvement is **measurement that distinguishes intentionally syncopated bass from poor timing**, not automatically pushing all bass onto the kick grid or increasing velocity.

Developer-only workflow:

```bash
node --test tests/bass-head-groove-census.test.mjs tests/bass-continuity-refinement.test.mjs tests/groove-pocket-refinement.test.mjs
node scripts/audit-bass-head-groove.mjs --seeds 2 --bars 32 --out /tmp/bass-head-report.json
npm run quality
npm run quality:music
```

The census exercises **trap, hip-hop, neo-soul, funk, house, Afrobeats, drill, rap and R&B**, two deterministic 32-bar seeds each. Each song is generated through the *existing* public `generateNew` function. No song event changes and no additional output authority.

## What the new measurements establish

The report isolates actual **GM kick pitches 35/36**, not every event in the drums track; measures bass attacks near kicks (<=0.075 beats) vs complementary attacks, quarter-beat-grid offbeats, short/long notes, adjacent bass overlaps, rests and kick-support ratios. It records signed onset offsets in both beats and milliseconds using the actual BPM. Findings are per section, including solo and sparse sections rather than merging all tracks or assuming every section must contain bass.

The same script calls existing read-only `analyzeBassContinuity`, `createBassContinuityCandidates` and opt-in `createGroovePocketCandidates` to identify whether the present engine already has **possible** corrections without committing those candidates.

**Crucial limitations:**

- Bass syncopation and a lower kick-alignment ratio may be *musically desirable*, not a defect. Do not use universal thresholds to flatten grooves.
- "Offbeat" describes a MIDI onset not aligned with quarter-note beats, not listener-rated bounce.
- Continuity and groove candidate counts are **not release-gate acceptance** or evidence that they'd sound better.
- Bass pitch and velocity can't prove low-end SPL, sub harmonic richness, Android phone-speaker impact, or clipping. Use actual playback.
- Rests, sparse rap verses, bridge dropouts and groove shifts may be intended. Do not fill every silence.
- Do not copy existing reference recordings; compare groove intent and musical listening only.

## Next decision

If the audit finds many candidate corrections but little measurable rhythmic movement, first try **controlled per-phrase bass anticipation/answer options** inside existing `groove-pocket-refinement`, with kick anchor preservation, music critic, safety gates, and blinded A/B MIDI pairs. If key music styles already have consistent complementary offbeat movement, **do not fabricate a weakness**; first ask for listening impressions on actual song seeds. If long bass notes overlap across harmony changes, isolate their note-off owners before changing synthesizer or composer.

Preserve all approved synth voices, note register, tonal policy, deterministic seed, preview-to-MIDI parity and the three-candidate arrangement system. There is no new app UI and no sound change in this phase.

## Skills and concurrency

- `midi-bass-groove-director`: bass-first listening and MIDI timing analysis.
- `midi-composition-review`: musical phrasing, genre and vocal-pocket safeguards.
- `midi-safe-integration`: isolated branch, tests, CI, no release claim before verified checks.
- Upstream `mc-rhythm-section` and `mc-style-hiphop`: referenced via installed skill rather than imported as runtime code.
- Concurrent independent GitHub source reads, **not** separately executing autonomous subagents.

## Empirical findings — 18 songs / nine genres, 32 bars (2026-10-15)

[Dedicated successful run](https://github.com/valleedgar085-rgb/midiarcade/actions/runs/38851350856): **14/14 focused tests pass, no song mutations**; existing release gates passed **18/18**.

| Genre | Sampled bass MIDI notes | Quarter-note offbeats | Bass notes near kick onsets | Existing potential pocket/continuity proposals (songs) |
| --- | ---: | ---: | ---: | ---: |
| Trap | 185 | 120 (64.9%) | 108 | 0 / 0 |
| Hip-Hop | 224 | 134 (59.8%) | 118 | 1 / 1 |
| Neo-Soul | 124 | 62 (50.0%) | 74 | 1 / 1 |
| Funk | 84 | 22 (26.2%) | 56 | 0 / 1 |
| House | 134 | 134 (100%) | 0 | 0 / 0 |
| Afrobeats | 167 | 100 (59.9%) | 103 | 0 / 0 |
| Drill | 211 | 142 (67.3%) | 109 | 0 / 0 |
| Rap | 216 | 137 (63.4%) | 123 | 0 / 0 |
| R&B | 132 | 71 (53.8%) | 77 | 0 / 0 |

House's 100% offbeat and no near-kick bass supports **an intentional kick/bass call-response groove**, not a missing kick lock. The slightly more onbeat Funk samples suggest a possible next *experimental* bouncy bass option, but **no listener evidence** supports forcing additional offbeats. Bass register/timbre/actual mix bass loudness were not measured. Counts of existing helper candidates do not mean approved fixes; the baseline passed current release gates.

**Prioritize:** A narrowly bounded bass-only Funk/Neo-Soul test on selected interior notes, keeping section boundary attacks, melodic rhythm, drum events and chord changes intact. Verify against seeded MIDI, existing music critic, MIDI export projection and matched-DAW sound. Do **not** turn it on globally based on these ratios.
