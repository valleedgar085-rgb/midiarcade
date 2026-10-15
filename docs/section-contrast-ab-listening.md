# Phase 3 — blind A/B validation of section dynamics

This is a **developer-only, reproducible audition pack**, not a new music generator or a production default. It compares an *identical arrangement candidate* with \`sectionContrastDynamics\` off vs on for a fixed source seed and same instruments/settings.

## What it does

- Generates two source songs for each genre (hipHop, pop, rap, popRadio, funk and synthwave; 12 fixed source cases total), 32 bars in E minor with matched controls.
- Runs **the same three-candidate arrangement discovery** for each source with feature off/on. Candidate order and identities must match exactly or the job fails.
- Verifies track and note counts, section order, pitch, onset, duration, and protected track velocities match.
- Flags release-gate regressions and a critical failure mode: authored support note velocities changed but the actual encoded **MIDI export projection did not change**.
- Reports critic scores and section-activity values without pretending either is a listening result.
- Chooses the *first* qualifying matched candidate per seed (not the subjective best) if both variants meet existing release checks and MIDI export is genuinely different; otherwise records no eligible pair.
- Produces \`case-NN-A.mid\`, \`case-NN-B.mid\`, \`report.json\`, \`READ_FIRST.txt\`, and a **separate answer-key artifact**.

## Run

\`\`\`sh
node --test tests/section-contrast-ab.test.mjs tests/section-contrast-performance.test.mjs
node scripts/benchmark-section-contrast-ab.mjs \
  --genres hipHop,pop,rap,popRadio,funk,synthwave --seeds 2 --bars 32 \
  --out /tmp/midi-arcade-ab
npm run quality
npm run quality:music
\`\`\`

The GitHub Actions job \`Section Contrast Blind MIDI A-B\` packages the two files per listening case as the artifact **midi-arcade-blind-section-ab-pairs**. The archive is attached to that run for 14 days. The secret mapping is a *separate* artifact named **midi-arcade-section-ab-answer-key-OPEN-LAST**.

## Listening protocol

1. Download **midi-arcade-blind-section-ab-pairs**, *not* the answer key.
2. Import both A and B files for a case into FL Studio or another DAW. Use the **same instrument plugins/presets**, sound fonts, tempo, mixer settings and master gain on both.
3. Listen to the verse-to-chorus flow, the distinctness of the chorus entrance, space for a lead vocalist, and whether quiet verses feel unduly empty.
4. Record A, B or no preference for each case and describe any audibly unnatural accents or dynamics. Reveal the answer key only when all decisions are recorded.
5. Before enabling the option automatically, also A/B **Android PreviewPlayer audio** against MIDI export on an actual phone using a matched captured performance (the MIDI pack does not simulate that audio path).

### What the files are NOT

These are **MIDI**, not WAV/MP3 recordings, so their sound depends on a matched DAW setup; the DAW may not use MIDI velocity identically to MIDI Arcade's Web Audio engine. The pack does not certify perceived improvement, preview-to-MIDI parity on hardware, absence of clicks/pops, or how a vocalist fits. The script verifies symbolic event identity and the project's \`encodeMidiVerified\` parity for chosen pairs.

## Decision gates

- Full repository quality, music benchmark and artifact script must pass.
- **MIDI export differences must be demonstrable**; an authored velocity edit alone is not a successful A/B example.
- Human listening must support the change before automatically enabling it.
- If results are unfavorable or inconclusive, keep the feature off or revise *inside the existing arrangement-performance authority*. Never bypass the original three-candidate critic/release acceptance.

## Applicable development skills

- \`.agents/skills/midi-composition-review/SKILL.md\` — matched musical comparisons and human judgments.
- \`.agents/skills/midi-safe-integration/SKILL.md\` — bounded changes, full CI, no regressions.
- \`.agents/skills/midi-audio-diagnostics/SKILL.md\` — only for subsequent actual-audio glitches. This phase contains no synthesis modifications.
