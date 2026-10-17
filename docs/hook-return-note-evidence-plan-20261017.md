# Hook return note evidence — October 17, 2026

## Objective
Trace the first weak chorus-return evidence without changing the approved music engine, default song notes, Web Audio, MIDI export, or Android app.

## Highest-value unfinished phase
The upstream motif and phrase-memory ownership remain correct for the weak returns in the merged hook-lineage audit. The next step is read-only inspection of actual first-two-bar note events, with a four-bar fallback for sparse hooks.

## Proposed implementation
- Extend the existing hook-lineage report with exact normalized opening-note signatures (relative onset, pitch, duration, velocity), using the same comparison window and 12-note limit as the existing recurrence critic.
- Include separately measured contour, interval, rhythm, duration, and note-count coverage.
- Count note-level phrase-memory tags as matched, mismatched, or absent; absent tags are not automatically errors.
- Preserve original note order, section boundaries, original 3-candidate arrangement selection, and existing critic thresholds.
- Produce a fixed-seed census and rank the most common weaknesses before any opt-in composer intervention.

## Acceptance
1. Deterministic repeat reports are byte-identical for a fixed seed.
2. Report generation leaves every track, note, harmony event, and metadata field unchanged.
3. Insufficient note evidence is explicitly unavailable, never scored as failure.
4. Tests cover matching, conflicting, and absent note-level provenance, sparse chorus, transposed return, and rhythm-only drift.
5. Full npm quality, music, ensemble, MIDI export parity, and Android debug CI must pass.
6. No production audio change without a separate fixed-seed A/B and blind listening.

## Rollout
Developer-only audit first. Do not automatically activate hook rewrites. Inspect any active bass experiments separately.
