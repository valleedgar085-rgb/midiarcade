# Bass Head Phase 4 — Kick-Relative Context Before Selecting a Groove

**Baseline:** MIDI Arcade `main` at `a400adfc8111315be219445a3d90b5573078a050`.

## Investigation

The initial Bass Head experiment changes selected Funk/Neo-Soul bass MIDI onsets by a quarter beat. A timing change **after a numbered grid beat** is **not necessarily an answer after a real kick**. Depending on the drum pattern, that bassline may instead **anticipate the next kick**. The previous candidate names `bass-head-answer-quarter` and `bassHeadBounceRole: kick-answer` describe a grid direction, not proven kick relationship.

Listening comparisons have shown that some variations are preferable to originals and some are not. We have too little independent human listening evidence to teach MIDI Arcade a reliable automatic preference rule. Do not replace the authorized generator's three arrangement candidates or its critics.

## Developer-only implementation

- `scripts/lib/bass-head-timing-context.mjs`: a **read-only** report of each annotated proposed onset against **actual GM kick pitches 35 and 36**, not against generic subdivisions or snare/hi-hat hits.
- It records **signed beat offset**, prior/next kick gaps, `kick-locked` vs `anticipation` vs `response` vs independent/no reference, section/bar placement, note length, bass-note spacing before/after, and signed milliseconds derived from original BPM.
- It matches notes by stable identity or an unambiguous signature and proximity. Ambiguous matches are reported as **unmatched**, never guessed.
- No edit to the current bass refiner, export logic, Web Audio engine, synthesizer, tracks, sample library, default config, or app UI.
- `scripts/audit-bass-head-kick-context.mjs` reports three held-out 32-bar Neo-Soul examples using exactly the original Phase-3 E-minor fixed-seed configuration; it outputs JSON and confirms source tracks were never mutated.

## Intended use

```bash
node --test tests/bass-head-timing-context.test.mjs tests/bass-head-bounce-shadow.test.mjs tests/bass-head-preference-selector.test.mjs
node scripts/audit-bass-head-kick-context.mjs --indices 4,7,8 --json /tmp/bass-kick-context.json
npm run quality
npm run quality:music
```

The GitHub CI audit uploads the actual timing-context report. We must inspect measured cases before creating a new experimental selection heuristic. A contextual classifier is **not evidence of audibly better bounce** and cannot automatically choose between MIDI A/B files.

**Next experiment:** Compare true bass-after-kick **response**, before-kick **anticipation**, and unchanged **original** phrases on separate fixed seeds, using the same instrument sound, tempo, and level. Keep short/full note durations and harmonic/section anchors protected. Human A/B listening decides whether the next candidate family merits an opt-in audition control.

**Skills:** Bass Head Groove Director for kick/bass intent and note-off context; MIDI Composition Review for rhythm and phrase boundaries; MIDI Safe Integration for test-first isolation and CI. No autonomous software subagents were run.
