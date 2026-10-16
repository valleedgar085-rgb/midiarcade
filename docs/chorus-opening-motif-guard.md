# MIDI Arcade — experimental chorus-opening motif identity guard

This experiment exists because the lineage audit detected **16 weak final returning choruses out of 36** even though **all 36 kept their motif B assignment, memoryMap source and phraseMemory source**.

The existing generator already builds a shared B motif. The weaker recognizability seems to arise during rendering and later adaptation. This change tests just one narrow hypothesis: *the opening statement of the first and later chorus is being transformed too differently in each section*. It does **not** copy recorded melodies or force a chorus motif into a verse.

## Implementation

Within the same `generateLead` owner in `src/music-engine.js`, and **only** with `hookReturnOpeningGuardV1: true`, suppress the additional section-level phrase-development transform for **repeat 0 of a chorus/drop lead melody**. The underlying B motif, RNG draw, already generated harmony, main lead articulation and groove conductor remain authoritative. Later repetitions and all non-chorus sections retain their former expressive development.

The normalized option is only accepted for the declared 12 supported genres, songs of at least 24 bars, and non-fusion inputs. It is absent from normal generation; the UI does not expose the flag. Current approved Android sound patches and preview scheduler are untouched. MIDI export stays with the existing encoder.

## Tests

```sh
node --test tests/chorus-opening-motif-guard.test.mjs tests/chorus-hook-recurrence.test.mjs
node scripts/benchmark-hook-opening-guard.mjs --seeds 2 --bars 32 --out /tmp/hook-opening.json
npm run quality
npm run quality:music
```

The A/B benchmark holds source seeds and parameters constant and records hook score differences, final music critic, release-gate changes, which instrument events differ, and actual MIDI parity for eligible improvement candidates. No candidate is promoted automatically.

**Decision gates:** Any default enablement requires safe cross-genre critic/release results and blinded listening. If the first-phrase guard worsens recognition or music quality on real songs, leave disabled or revert the experiment. A deterministic automated critic is not a substitute for hearing the music. Reference listening should focus on the previously supplied rap/hip-hop/pop songs and E-minor/96-BPM working WAV, without copying their audio.

## Skills and parallel review

MIDI Composition Review (motif identity and phrase rests), MIDI Safe Integration (opt-in, deterministic tests, CI gates), systematic debugging (audit established that planning was already correct). Concurrent independent repository review used; no autonomous subagent dispatched.
