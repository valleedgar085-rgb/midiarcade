# MIDI Arcade generation database

This directory defines the offline-first persistence schema for the professional generation pipeline:

**Director / Intent → Blueprint → Harmony Timeline + Groove DNA → Sections → Tracks → Musical Events → Quality / Gauntlet → Repairs → Export**

## Authority rules

1. `groove_dna` is the canonical groove authority for a generation run.
2. `musical_events.pitch` is the canonical rendered pitch consumed by preview and Standard MIDI export.
3. Rejected candidates and repairs are diagnostic history; they must not overwrite the accepted `song_versions` snapshot.
4. Scoped regeneration reuses the accepted Groove DNA unless the user explicitly regenerates groove.
5. Persistence is downstream of generation and must never introduce randomness into `src/music-engine.js`.

## Current integration phase

`src/core/generation-database-record.js` converts an accepted song plus flight-recorder diagnostics into rows matching this schema. The next native step is a Capacitor SQLite repository adapter; until that adapter is merged, this schema is the canonical storage contract rather than a new generation authority.

## Main entities

- `songs`, `song_versions`
- `generation_runs`, `generation_stages`
- `song_blueprints`
- `groove_dna`
- `harmony_timelines`, `harmony_events`
- `sections`
- `tracks`, `musical_events`
- `quality_evaluations`
- `candidate_results`, `repair_actions`
- `debugger_events`
- `exports`
- `user_feedback`
- `subscriptions`
