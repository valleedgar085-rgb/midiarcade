# MIDI Arcade database architecture

## Purpose

The database is a persistence and diagnostics layer. It does not own composition decisions.

Generation authority remains:

```text
Director / Blueprint
        ↓
Harmony authority + Groove Conductor
        ↓
Composer / Musical Events
        ↓
Gauntlet / repair
        ↓
Persistence
        ↓
Preview + MIDI export
```

## Phase 1 contract

The first persistence slice records:

- generation run identity and configuration
- song blueprint / song plan
- canonical `grooveConductor`
- harmony
- section structure
- tracks
- rendered musical events

The mapping lives in `src/core/generation-persistence.js` and is pure. It must not mutate generated songs.

The SQL contract lives in `src/core/database-schema.js` and is versioned so Android database upgrades can run migrations instead of replacing user data.

## Authority rules

1. The database never creates or repairs music.
2. Scoped regeneration must reuse the active song's existing groove authority unless groove regeneration is explicitly requested.
3. Rendered note pitch should become the shared authority consumed by both preview and MIDI export.
4. Persistence failures must never silently change the generated musical result.
5. Database I/O belongs outside the heavy composition worker path unless explicitly designed as a non-blocking handoff.

## Next integration slice

Add a platform adapter with:

- SQLite on Capacitor Android
- a browser-safe fallback for web development
- transactionally saving one generation snapshot
- schema-version migration tracking
- quality evaluations, repairs, debugger events, exports, and user feedback
