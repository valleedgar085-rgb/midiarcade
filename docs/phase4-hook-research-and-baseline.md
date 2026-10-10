# Phase 4 — Hook Intelligence: research and first implementation

## Scope and protected audio baseline

**Approved Android sound:** merged PR #309, commit 6c664cabc4940cb586c874fe8091cbe05115d520 and its associated APK. Do not modify PreviewPlayer, drum samples, track patches, master output, limiter, envelope timing, voice stealing, or synthesis as part of this phase.

This first PR introduces a **read-only measurement tool only**. It does not add, remove, move, or re-pitch notes; it is not a new song-generation authority and is not an automatic release gate.

## Research takeaways

1. **Recognizable hooks rely on repetition and placement, not just density.** Berklee: Andrea Stolpe, "How to Write Songs with Killer Hooks" — https://online.berklee.edu/takenote/how-to-write-songs-with-killer-hooks/
2. **Melodic variety comes from rhythm, rests, phrase length, entrance timing, and contour — not just pitch changes.** Berklee: "Writing Melodies: 3 Simple Tools" — https://online.berklee.edu/takenote/simple-tools-for-better-melodies/
3. **The phrase is a small recognizable musical statement with a breath or cadence.** Berklee: "What is Melody in a Song?" — https://online.berklee.edu/takenote/conjunct-disjunct-melody-basic-definitions/
4. **Symbolic music can be audited without relying on audio render or model training.** MusPy includes pitch-range, scale consistency, pitch entropy, groove consistency and empty-measure metrics — https://muspy.readthedocs.io/en/latest/metrics.html and https://github.com/salu133445/muspy
5. **Pop-song arrangements benefit from separate melody, sub-melody, and accompaniment analysis.** POP909 organizes these in independently inspectable MIDI tracks — https://github.com/music-x-lab/POP909-Dataset

These references are **research inputs** and not code copied into MIDI Arcade. Do not import an entire external generator or download dataset recordings into the shipped Android app. Review dataset licensing and rights before considering any training use.

## Gap relative to current engine

The existing src/core/melody-phrase-intelligence.js measures **within-section** motif, groove, harmonic landing and expression. The existing src/core/melody-section-memory.js evaluates **full-section** memory contracts, if present, and guards against clone risk. Neither directly reports **the opening two bars of chorus A versus the opening two bars of a later chorus**, independent of memory tags.

The existing melody-continuity-refinement.js fills significant melodic gaps. This should not be conflated with hook quality: deliberate rest space may serve a rapper or make a hook stronger.

## Implementation

src/core/chorus-hook-recurrence.js exports evaluateChorusHookRecurrence(song):

- Reads actual final melody MIDI notes and section bounds only.
- Compares the **first two bars of each chorus** to the first chorus. At least four notes per phrase are required to avoid rewarding short coincidences.
- Uses quantized note-to-note onset intervals (rhythm), interval contour, interval size, and note lengths, tolerating transposition and minor variations. Sequence alignment tolerates occasional differing notes or ornaments.
- Reports a score (0–100), per-return metrics, a literal-copy flag, and coverage; returns unavailable for missing melodies or single-chorus songs and incomplete for insufficient evidence. No automatic changes or new random sampling.
- Reports note attacks per bar, unoccupied lead-melody duration, and longest lead-melody rest in verses as a **vocal-space proxy**, not a measure of actual recorded vocals.
- Detection is a **heuristic, not a guarantee of catchiness**. Genre-specific targets and hook placements need calibration against generated material and listening.

## Validation

- Synthetic fixtures: recognizable transposition, controlled melodic variation, unrelated return rejection, literal clone reporting, insufficient evidence, missing chorus/melody, verse negative space, deterministic zero-note-mutation.
- Real generated seeds: pop, hip-hop, rap, 32 bars. They log PHASE4_HOOK_BASELINE entries in CI for analysis, without imposing new release failures.
- All existing automated tests, generator deterministic seed behavior, tonal safety, preview-to-MIDI parity and Android APK checks must remain green.
- **No APK necessary for this audit** — musical and audio output are unchanged by read-only measurement.

## Next decision

Inspect real-song audit logs. If enough songs have weak recurring chorus hooks, propose a **small, bounded** candidate refinement using the existing phrase-memory/section-development authorities, gated by tonal, groove, vocal-space and existing quality checks. Require human listening before shipping an audible change.
