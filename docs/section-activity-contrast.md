# MIDI Arcade — Section Activity Contrast v1

## Why this exists

The 42-song, 21-genre audit reported weak **binary section-role evolution** in all 42 songs. Existing `activeRoleIds` considers a track active if even one note begins in the section. An unchanging roster alone cannot establish that a song lacks development: the instruments might play different densities, durations, and velocities.

This developer-only addition measures those variables without altering the music engine.

## What it computes

`scripts/lib/arrangement-activity.mjs` measures each track's **attacks per bar**, fraction of section covered by notes (including note tails crossing boundaries), and average note-on velocity. It turns them into a bounded activity proxy for each section and reports a normalized per-track change between consecutive sections. The aggregate **activity contrast** ranges from 0 for no activity change to 1 for completely disjoint activity.

- `rosterChange = 0`, `activityContrast > 0`: same instruments, different playing intensity or density. Don't call this mechanically static based on instrument presence alone.
- `rosterChange = 0`, `activityContrast = 0`: section-level density, coverage, and average velocity matched; note pitches, articulation, local rhythm, energy, and musical meaning can still differ.
- `rosterChange > 0`: actual instrument presence changes (including sustained notes spanning a boundary).
- `leastContrastingTransition`: where an arranger should **listen and inspect**, not where notes must automatically be removed.

The metric is **not LUFS, a perceptual loudness estimator, or a song-quality score**; arbitrary coefficients are exploratory. Existing `ensemble-coordination-authority` scoring and the release gate remain unchanged.

## Commands

```sh
node --test tests/arrangement-activity-audit.test.mjs
node scripts/audit-musical-weaknesses.mjs --genres pop,hipHop,trap --seeds 2 --bars 32 --json /tmp/contrast-report.json
npm run quality
```

Inspect `results[].arrangementActivity` and each `summary[].meanActivityContrast` in the JSON. The existing GitHub census action stores the complete report as an artifact. Before any audible music change, compare fixed seeds and section stems at matched loudness, and preserve deterministic song generation and preview-to-MIDI parity.

This is a **measurement upgrade only**; no APK interface, runtime synthesis, musical note generation, or arrangement candidate authority changes.
