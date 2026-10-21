# Hook stage trace: which compose() stage weakens a returning chorus hook (2026-10-21)

Read-only audit. Generated notes are byte-identical with and without it (sha256 of all 42 census songs' tracks unchanged). Scores are the existing recurrence critic, **not listening results**.

## How it works

- `setCompositionStageTap` (`src/music-engine.js`) is a developer hook. While a tap is set, `compose()` reports a **copy** of the melody notes after each of 32 stages. With no tap (the default, including the app and worker) it does nothing.
- `scripts/lib/hook-stage-trace.mjs` re-scores every returning chorus with `evaluateChorusHookRecurrence` at each stage and attributes the change to the stage that caused it. Critic repairs are followed back to the composed candidate they came from, including repair chains.
- Run it: `node scripts/audit-hook-stage-trace.mjs --seeds 2 --bars 32 --out /tmp/hook-stage-trace.json` (about 75 s). Tests: `node --test tests/hook-stage-trace.test.mjs`.

## Result (21 genres x 2 seeds, 32 bars, E minor; 36 returning choruses)

| Diagnosis | Returns |
| --- | ---: |
| strong at the end | 22 |
| weak straight out of composition (`generateLead`) | 12 |
| strong out of composition, weakened later | 2 |

Mean hook score: **0.54 raw to 0.70 final**. Of the 14 returns still weak at the end, 12 were already weak at `generateLead`.

### Stage impact on all 36 returns (a step changes a return when it moves the score by 0.05 or more)

| Stage | Mean change | Hurt | Helped | Dimensions that move |
| --- | ---: | ---: | ---: | --- |
| `musicalMemory` | +0.279 | 1 | 35 | all (interval +0.38, rhythm +0.32, contour +0.21) |
| `commit` / `criticRepair+commit` | +0.11 / +0.01 | 0 / 5 | 5 / 8 | mixed |
| `orchestrationMatrix` | -0.078 | 19 | 4 | note coverage -0.08, rhythm -0.08, duration -0.07 |
| `finalizeNotes` (feel/humanize) | -0.035 | 14 | 3 | rhythm -0.06, duration -0.04, contour -0.04 |
| `spectrumPlan` | -0.022 | 8 | 0 | contour -0.04, interval -0.04 (pitch only) |
| `melodicFlow` | -0.008 | 5 | 1 | contour -0.02 |

Every other stage is within 0.004 of zero on average.

## What this means

1. **The earlier "downstream-note-identity-drift" label was misleading.** The phrase-memory contract is correct (292 of 292 tags match), but the hook is mostly weak at the lead's first rendering. The musical-memory pass then recovers most of it (+0.19 on the weak ones, helping 13 of 14) without finishing the job.
2. **Two later stages take part of it back.** `orchestrationMatrix` changes how many melody notes survive in a return and `finalizeNotes` re-times them. Together they hurt 7 and 6 of the 14 weak returns. `spectrumPlan` shifts pitch, hurting contour and interval.
3. **Drill, afrobeats, rock and neo-soul start lowest.** Mean raw scores are 0.44 to 0.53, against 0.57 to 0.62 for the stronger genres. n is 2 to 4 returns per genre, so treat that as a lead rather than a result.

## Where a fix would go, if listening supports it (not done)

| Candidate | Owner | Why | Risk |
| --- | --- | --- | --- |
| Stop `orchestrationMatrix` thinning or re-gating melody notes inside a returning chorus's hook window | `applyOrchestrationMatrix` | largest net harm, and it is a section-arrangement stage that should not rewrite melodic identity | thinning may be intentional for contrast |
| Make `finalizeNotes` timing consistent between a hook and its return | feel/humanize pass | rhythm and duration loss; humanize should not de-sync a repeated phrase | changes groove feel; genre micro-timing must stay |
| Render the hook more faithfully in `generateLead` | lead composer | 12 of 14 weak finals start here; fixing it removes the need for the memory pass to carry the load | widest blast radius |
| Keep `spectrumPlan` from displacing single notes of a hook | spectrum plan | pitch-only harm | register separation rules apply |

None of these is applied. Each needs a fixed-seed A/B, parity checks and blind listening first. The stage trace gives the before/after measurement for each.

## Limits

- 36 returns from 42 songs is a small sample. Run `--seeds 6` before acting on any per-genre claim.
- A hook that is weak raw and strong final may be fine to hear. The critic cannot say whether the raw lead was musically good.
- The trace follows the committed song's lineage. Candidates that lose the search are not examined.
- `commit` and `criticRepair+commit` are lumped: they include repair, register and section work after selection. Splitting them needs taps in `commitCandidate`.
