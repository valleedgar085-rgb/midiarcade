# MIDI Arcade — Reference-informed Melody Hook Return V2

## User reference sources recovered (Oct 15, 2026)

- Previously supplied `reference.zip` (28 MP3 files, Oct 2): Hip-Hop, Rap, Trap and Pop reference listening examples, including melodic Southern Hip-Hop, sparse rhythmic rap, and groove-forward pop.
- Earlier E-minor, 96 BPM **working WAV** `e_minor_hiphop_pop_radio_96bpm.wav` (Oct 6): 53.855 seconds, 48 kHz stereo. This is a reference-guided *working example from the previous session*, **not definitively the same original unnamed user-uploaded reference audio**. Its 96 BPM is taken from the filename; do not claim independent tempo extraction.
- Source WAV was inspected **outside the repository**. With bar boundaries defined by 96 BPM and 4/4, RMS over bars 1–4 was ~0.0816, bars 5–8 ~0.1188 (ratio ~1.455), middle bars 9–16 ~0.1148 and final two bars ~0.0716. These are waveform observations, **not independently verified intro/chorus/outro labels**, musical quality scores, or a mandate to alter all genres' mastering.

**No copyrighted MP3/WAV files or transcribed riffs are included in the app or this PR.** The reference pack and working WAV are guides for full-phrase continuity, intentional negative space, recognizable returns and purposeful dynamics—not training data, cloned riffs or a new generative model.

## One-owner, narrow refactor

Previously `scripts/benchmark-hook-rescue-shadow.mjs` handled only the existing `pop/hipHop/rap` one-note pitch/rhythm candidates. Rather than duplicate the complex critic/release/MIDI-export pipeline, this phase **reuses that same shadow benchmark** with an opt-in `--genre-v2 true` flag and adds one pure proposal module `src/core/genre-aware-hook-return-v2.js`. Normal song generation never invokes it.

The new helper tests **bounded one-note contour recall** in a later chorus. It only acts on weak, evaluable chorus returns; the source motif and all verses remain unchanged. Every proposed note must:

- Match a corresponding **relative onset** to avoid rewriting expressive pickups or syncopation.
- Fit the authoritative song scale and melody register; require keyPc and scaleIntervals to exist. Raw contour intervals are first projected onto the nearest eligible scale pitches within six semitones; unverified chromatic notes are never accepted.
- Remain within six semitones of the current note and avoid excessive neighboring melodic leaps.
- Avoid motif-memory/cadence/transition/handoff/protected notes.
- Preserve all note counts, starts, durations, velocities, all other tracks and section arrangement.
- Improve the *existing read-only hook-recurrence metric*. Candidate promotion **still requires** the independent critic, scale checks, release gate, real MIDI export parity and blind listening.

Supported proposal genres are neoSoul, rnbSoul, popRadio, afrobeats, funk, synthwave, synthPopRadio, loFiHipHop, hipHop, rap, pop, drill. Genre support is not a guarantee that a song needs or receives any candidate. Out-of-genre cases return no proposal.

## Reproducible evaluations

```sh
node --test tests/genre-aware-hook-return-v2.test.mjs tests/chorus-hook-development.test.mjs tests/hook-rescue-shadow.test.mjs
node scripts/benchmark-hook-rescue-shadow.mjs --genre-v2 true --seeds 2 --bars 32 --out /tmp/hook-v2-21-genres
node scripts/benchmark-hook-rescue-shadow.mjs --genre-v2 true --reference-96 true --genres hipHop,rap,popRadio,neoSoul,rnbSoul --seeds 2 --bars 32 --out /tmp/hook-v2-reference-96
npm run quality
npm run quality:music
```

The optional reference-aligned comparison sets E minor and 96 BPM for only the five appropriate reference-proximate genres; it does **not** force 96 BPM on other styles. The existing shadow evaluator records legacy vs V2 proposal counts, critic/release deltas and actual modified MIDI events and exports eligible matched **blind A/B MIDI pairs**. It never changes the production default.

## Acceptance criteria

1. Benchmark shows additional **safe and audible (MIDI-different)** proposals compared with the legacy candidate system; count alone is not enough.
2. No non-melody note, timing, original motif, key, swing, program, or sound-envelope changes.
3. No loss of the original three-candidate arrangement authority or seed determinism.
4. Full quality, music gauntlet and Android debug CI green before merge.
5. Test on the actual Android phone and compare blinded MIDI with the same instrument programs. Do not enable by default merely because similarity scoring improves.

## Skills/method

Applied repository MIDI Composition Review and Safe Integration; upstream mc-melody and mc-development were read for motif identity, phrase/rest restraint and avoiding over-predictable repetition. Parallel repository research tasks executed concurrently through connector tools. No autonomous subagents were dispatched. The sound engine and previously approved playback must remain untouched.

## First empirical iteration and root cause (not a final musical claim)

The first 45-song shadow run of this helper found **zero new qualifying real-song proposals**, despite focused fixture tests passing. The additional diagnostic trace found 13 weak cases hitting `no-scale-safe-neighbor`, with other cases blocked by deliberately protected or unaligned notes. Rather than bypass those protections, the next revision projects *candidate contour targets* onto the actual song scale, then checks exact register/neighbor limits and the independent critic. A second all-genre run must prove whether this helps. If it doesn't, keep the feature draft/off and move the repair earlier into motif planning rather than force final-note edits.

This is intentionally a **root-cause-oriented refactor** and the audio sounds/presets remain untouched.

## Second empirical iteration: projected-scale options

[21-genre V2 A/B run](https://github.com/valleedgar085-rgb/midiarcade/actions/runs/38805326270) passed. The revised candidate-only helper produced the following outcomes:

| Benchmark | Cases | Weak evaluable returns | Candidate proposals | Independent-guard-qualified proposals | Blind MIDI pairs |
| --- | ---: | ---: | ---: | ---: | ---: |
| All configured genres × 2 plus 3 historical rap cases | 45 | 14 | 5 | 5 | 3 |
| Reference-proximate E minor/96 BPM genres × 2, plus 3 historical rap cases | 13 | 6 | 1 | 1 | 1 |

The historical previous helper generated one qualifying rap candidate on the same 45-song set. **Four additional qualifying candidates were found**, from two Afrobeats songs. This is a measurable feasibility improvement, **not listener-verified catchiness**. The reference-aligned 96 BPM test did not uncover a new safe candidate: it repeats the earlier historical rap case.

Read-only readiness breakdown for weak cases in the general set: 9 cases where a one-note edit did not improve the existing hook score despite scale-safe options, one with no short unprotected note, one with no matched relative onset (alongside the historical rap legacy case), and two unsupported styles (rock and country). These patterns suggest that **realistic hooks often need structural motif planning earlier in the pipeline, not a late one-note edit**. Do not weaken the protected anchors to chase the score.

All 20 focused tests passed; real Android/FL Studio blind listening remains unverified. The feature remains OFF by default and does not alter any approved sound.
