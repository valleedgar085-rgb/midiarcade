# Hook identity, Phase 2: measurement fix and repair-coverage evidence (2026-10-21)

Baseline: `docs/baseline-20261021.md` (commit `25c5975`). No generated note, Web Audio path, MIDI export or threshold changed.

## Finding 1: the hook critic mis-ordered simultaneous notes

`chorus-hook-recurrence.js` ordered melody notes by raw `start`, then pitch. Humanize jitter (sub-millisecond) can make the two notes of a simultaneous pair swap order between two choruses. That flips the sign of an interval and the contour comparison, so an identical return scored as drifted.

Fix: `orderByOnsetThenPitch` treats attacks within 1/64 beat as one onset and orders them by pitch. It is shared by the critic, both shadow candidate helpers and the note-evidence audit, so all of them see the same note order.

Measured on the 21-genre x 2-seed, 32-bar census:

| Measure | Before | After |
| --- | ---: | ---: |
| weak-chorus-return songs | 12 / 30 | 10 / 30 |
| census findings | 248 | 246 |
| hook-lineage weak returns | 16 | 14 |
| sha256 of all 42 songs' tracks | `6e28dcb2...` | identical |

Songs that moved: synthwave-02 61 to 72, afrobeats-02 59 to 68 (now passing). Others shifted by a few points but stayed on the same side of the threshold. Funk-02 did not move (51 to 50), so it is genuine drift. Results were identical at 0.005 and 0.02 beat tolerance.

The critic only feeds diagnostics and shadow helpers, never note generation, so this is a measurement change, not a musical one.

## Finding 2: most remaining weak hooks need more than a one-note repair

Shadow run `benchmark-hook-rescue-shadow.mjs --seeds 2 --bars 32 --genre-v2 true`, before the ordering fix (45 songs):

- 14 weak hooks, 5 qualified shadow proposals, 3 blind MIDI pairs exported.
- 6 weak hooks were rejected as `one-note-change-cannot-improve-hook-score`: drill-02, funk-02, popRadio-02, synthPopRadio-01, rnbSoul-01, rap historical-00. These differ from the source by more than one note.
- rock and country are `unsupported-genre`; reggaeton too.

Implication: widening the one-note helpers to more genres would help little. The remaining drift comes from earlier in the pipeline (`downstream-note-identity-drift` in all 14 lineage cases), and fixing it there needs per-stage snapshots to find which stage first changes the hook.

## Not done, by design

- No default activation of any hook rewrite. The Phase 1 listening evidence is still outstanding.
- The per-stage snapshot audit (which stage first alters the hook) is the next step. It is read-only.
- The shadow run was not repeated after the ordering fix, so its proposal counts may shift slightly.
