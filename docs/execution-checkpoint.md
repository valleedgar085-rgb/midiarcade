# MIDI Arcade execution checkpoint

Updated September 15, 2026. This checkpoint reconciles the planning blueprint with live repository evidence. Status labels distinguish implemented changes from released behavior.

## Verified starting point — M0 complete

- Repository: `valleedgar085-rgb/midiarcade`.
- Main: `1ad67a4879c9a0db2b9009a84742a6ec4bc378ab`.
- [APK #610](https://github.com/valleedgar085-rgb/midiarcade/actions/runs/34939006460): successful on that exact main commit.
- [Website deployment #38](https://github.com/valleedgar085-rgb/midiarcade/actions/runs/34939006516): successful on that exact main commit.
- PR #26 merged as `c81cbcd4cfe635527f32929c3fa83daccdabec76`: lower-pressure Android preview. Its release record reports successful physical-phone playback without popping; this execution did not repeat that device check.
- PR #27 merged as `14c84761d62b2402df4a6e43130a889219b7fc8e`: Element-aware Shape starting points.
- PR #28 merged as `037b947e3c93309006e652f060bcab131670897c`: accepted Shape is authoritative for Similar and Element generations.
- PR #29 merged as the current main commit: deficit-aware density refinement.
- Baseline `npm run quality`: 447/447 tests pass; web build and unchanged quality budgets pass.

The earlier failed suggestions build and pending PR #26 review are superseded by these merged checkpoints. The historical Pop+Hip-Hop 83/84 issue is addressed by the fusion performance stage already in `output-quality-pipeline-register.js`; its actual fixture coverage remains part of the required suite. Do not duplicate that repair based on an older diagnostic message.

## M1 — generation timeout ownership

Branch: `fix/generation-timeout-ownership`. Status: implemented and locally verified; not merged or released.

**Root cause:** the application watchdog unlocked generation at 45 seconds while its executor allowed a worker to continue up to 90 seconds. The older async operation could later commit, roll back history on error, or run cleanup against a newer operation. Disposing the executor also did not invalidate already-running or queued fallbacks, and delayed errors from a terminated worker could affect a replacement worker.

**Change:**

- Give each UI generation operation an ownership token. Check ownership after awaited work and before error recovery. Only the current owner may finish progress and unlock controls.
- Keep the 45-second watchdog; revoke ownership, dispose the worker, and restore the failed operation's history where applicable. A retry starts with fresh ownership.
- Cover New, Similar, Fire/Electric/Drip generation, section variations, and individual track rerolls.
- Invalidate outstanding ownership during page exit and a fresh session reset.
- Invalidate the executor lifecycle on disposal. Prevent queued fallback work from starting and reject stale fallback results before diagnosis, repair, or finalization.
- Ignore delayed events from workers that no longer own the executor.
- Let track-reroll errors reach the existing recovery path instead of swallowing cancellation and launching another synchronous generation.

**Protected behavior:** deterministic composition, musical scoring, repair budgets, MIDI export, Android synthesis, 94-button budget, and existing asset budgets remain unchanged.

**Regression evidence:** 13 new deterministic tests fail against the pre-change main implementation and pass with the fix. Tests execute actual application generation functions with deferred engine responses and controlled timers. They cover late success/failure across all five entry modes, preserve the newer song/history/busy state/watchdog, and verify executor fallback and replacement-worker cancellation. Existing foundation tests also pass.

**Local candidate validation:** `npm run quality` passes 460/460 tests, web compilation, and unchanged build budgets (94 buttons / 0 broad transitions). `npm run quality:music` passes all 63 songs: overall 93, musical 92, technical 100, creative floor 77, release 100%, unique fingerprints 100%. `npm run android:sync` passes. Local runtime: Node 24.19.0; CI uses the project's Node 22 runtime.

## Remaining acceptance work

1. Retain the passing local `npm run quality` and Music Quality Lab results as the candidate baseline.
2. Verify the CI quality checks and Android APK build on the exact proposed commit.
3. Keep the change in a reviewable PR until CI passes. Record the resulting commit, workflow, and artifact rather than attributing main's #610 to this change.
4. Before release, repeat phone playback and generation retry checks, including page exit/return, dense arrangements, section variations, and track rerolls. Confirm representative MIDI exports in FL Studio.

## Next blueprint work after this checkpoint

- M2: use the current Music Quality Lab and held-out seeds to select a genre-native musical bottleneck; preserve genre identity and bounded candidate counts. Density work in #29 is already integrated.
- M3: audit remaining Create/Shape controls and undo/scope continuity. Suggestions and accepted lineage are complete; test missing behavior before adding state.
- M4: measure remaining Android playback and export risks on device. Preserve the reported no-pop baseline.
- M5: release only an exact CI-verified candidate with required device and DAW evidence.

**Known limit:** JavaScript already executing synchronously in a fallback cannot be preempted by a timer. This change prevents stale async results from being accepted; it does not move the remaining output-quality postprocessing off the UI thread or claim to solve every interaction that can change song state during generation. Those require separate measured work packages.
