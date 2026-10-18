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

## Implemented read-only audit
- `scripts/lib/hook-note-evidence.mjs` collects actual first/returning chorus opening-note events, reusing the existing recurrence comparison's 2- or 4-bar window and 12-note cap. The report retains relative start, MIDI pitch, duration, velocity, and surviving phrase-memory/hook-development tags.
- `scripts/lib/hook-lineage-audit.mjs` attaches the evidence to existing motif/memory lineage for each returning chorus; it does not introduce a second composer or critic.
- `scripts/audit-hook-lineage.mjs` ranks the lowest existing similarity dimensions *only for evaluable weak returns*, counts matched/mismatched/absent note tags separately, and verifies the entire song object remains byte-identical after the audit.
- `tests/hook-note-evidence.test.mjs` covers identical/altered returns, matched/conflicting/absent tags, transposition, rhythm-only drift, four-bar sparse fallback, unavailable evidence, repeatability, and non-mutation. The existing lineage CI workflow now runs those tests.

### Interpretive boundary
Rendered note metadata cannot prove which internal stage first changed the phrase. The earliest responsible stage remains **unverified** until per-stage snapshots are measured. Numeric hook similarity is not a listening verdict; no generator, Web Audio, exported MIDI, user setting, or critic threshold was changed.

### Developer verification
```sh
node --test tests/hook-note-evidence.test.mjs tests/hook-lineage-audit.test.mjs
node scripts/audit-hook-lineage.mjs --seeds 2 --bars 32 --out tmp/hook-note-evidence.json
npm run quality
npm run quality:music
npm run quality:ensemble
npm run test:android-release
```
