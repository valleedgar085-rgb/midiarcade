---
name: midi-composition-review
description: Review MIDI Arcade melody, hook, arrangement, genre authenticity, vocal space, and bass-drum pocket; use before changing the music generator and when generated songs sound random, crowded, or incoherent.
---

# MIDI Arcade composition review

This is a **developer-only** analysis skill. It does not run in the APK and does not introduce a second generation authority. Follow root `AGENTS.md` before this skill. For deep music theory consult the original composition references below; their guidance is a source of hypotheses, **not mandatory style rules** for every genre.

## Routing to researched specialist skills

- Melody, contour, singability, cadence: [mc-melody](https://github.com/jtydhr88/music-composition-skills/blob/main/plugins/music-composition/skills/mc-melody/SKILL.md).
- Motif identity across sections and controlled variation: [mc-development](https://github.com/jtydhr88/music-composition-skills/blob/main/plugins/music-composition/skills/mc-development/SKILL.md).
- Kick, snare, bass, subdivision and per-voice time feel: [mc-rhythm-section](https://github.com/jtydhr88/music-composition-skills/blob/main/plugins/music-composition/skills/mc-rhythm-section/SKILL.md).
- Section arc, contrast, entries/exits and negative space: [mc-arrangement-arch](https://github.com/jtydhr88/music-composition-skills/blob/main/plugins/music-composition/skills/mc-arrangement-arch/SKILL.md).
- Hip-hop, trap, rap delivery space: [mc-style-hiphop](https://github.com/jtydhr88/music-composition-skills/blob/main/plugins/music-composition/skills/mc-style-hiphop/SKILL.md).

When network access permits, **read the relevant upstream skill** rather than inferring its details from the name. The upstream library uses arrangement-spec sheets for music production; here adapt *analysis criteria* to existing MIDI Arcade event contracts. Do not add ARR-SPEC as a runtime dependency or import an external generator.

## Investigation steps

1. **Freeze a reproducible baseline.** Record commit SHA, genre, seed, key/mode, tempo, bars, knobs, section names and chosen candidate. Never use `Math.random()` or a new random generator in production.
2. **Inspect existing authorities first.** Begin with `src/core/melody-phrase-intelligence.js`, `src/core/chorus-hook-recurrence.js`, `src/core/melody-section-memory.js`, `src/core/melody-section-development-refinement.js`, `src/core/groove-intelligence.js`, `src/core/groove-pocket-refinement.js`, `src/core/arrangement-candidates.js` and `src/core/generation-executor.js` as appropriate. Identify which module owns the problem; do not create duplicate critics or competing candidate selectors.
3. **Score observations, not intuition disguised as data.** Compare motif identity (rhythm and interval contour), phrase endings and breathing space, chorus-hook returns, section development, drum/bass alignment, lead-vocal space and density change across the form. Report missing evidence explicitly. A high heuristic score is not proof of catchiness.
4. **Separate style choices from errors.** Intentional rests, repeated notes, syncopation, odd phrase lengths and sparse rap verses may all be musically correct. Do not force universal thresholds or automatically fill silence.
5. **Design the smallest correction inside the existing authority.** Preserve the three-candidate arrangement process, seed determinism, scale/register rules, genre microtiming, and preview-to-MIDI note/timing parity.
6. **Run controls.** Keep fixed seeds and settings for before/after comparison; first use read-only measurements and focused tests before editing note-generation code. Favor an A/B listening sample reviewed blind if the proposed change alters output.

## Mandatory verification when changing generated notes

- Focused tests: `node --test tests/chorus-hook-recurrence.test.mjs tests/melody-section-memory.test.mjs tests/groove-pocket-refinement.test.mjs tests/arrangement-candidate-search.test.mjs tests/midi-export-parity.test.mjs`.
- Full gate: `npm run quality` and `npm run quality:music`; run deeper genre gauntlets when a genre-specific rule changes.
- Confirm no new key violations, timing drift, register collisions, candidate authority changes or preview/export mismatch.
- Report sample/seed counts, before/after observations, unresolved listening questions, and real test exits. **Never claim a musical improvement from code inspection alone.**

## Required report

`Baseline | Relevant skill/source | Musical symptom | Exact owner | Measured evidence | Alternative explanations | Proposed bounded change | Focused + full test results | Listening result or outstanding requirement`.
