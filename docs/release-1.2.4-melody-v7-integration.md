# MIDI Arcade 1.2.4 — Melody v7 + Vocal Pocket Integration

**Release branch:** `release/midi-arcade-1-2-4-melody-v7-vocal-pocket` from baseline `main` `9831355bfccd85c56b1d1fb8dcc6abe83b9bcdfd`.

## What is integrated

- Import the exact **20 files** from the stacked, draft Melody v7 + Shape clarity candidate [PR #349](https://github.com/valleedgar085-rgb/midiarcade/pull/349), including new and modified tests.
- Novel musical transformations are still **explicit Shape Before/After auditions** with Accept/Reject, not an uncontrolled automatic generation rewrite.
- Add melody question/answer editing for appropriate genres; refine the candidate cadence contour and scale safety; give measured, advisory vocal-pocket evidence in Rap/Hip-Hop/Trap/Drill verse selections; improve UI copy and scoped Shape layout.
- Bump web `package.json` and root package-lock metadata to 1.2.4, Android `versionName "1.2.4"` and `versionCode 7` (debug remains `com.midiarcade.app.preview`), in-app version chip, debugger build metadata, release readiness test, and APK CI artifact label.

## Why this integration is safe to test

Before the transplant, comparison against PR #349's base (`970d37b...`) confirmed the **20 touched paths were unchanged on later main**; all unrelated main changes, bass R&D, existing audio and generation/execution ownership remain intact. This is a new feature branch—neither old draft PR #349 nor its stale base is merged directly.

## Required release gates (do not skip)

1. `npm run quality` (whole Node test suite, esbuild web output, exact build budgets)
2. `npm run quality:music` (genre/seed fixed music quality)
3. `npm run test:android-release`, preview and Web Audio tests, CI quality gate
4. `npx cap sync android` after build; `./gradlew assembleDebug`
5. Verify APK artifact is produced from the **same verified PR head**; inspect Android manifest, package ID and version metadata, contents and archive integrity.
6. Manual device test after automated gates: Create → Shape → vocal-space/Hook Inspector/Before-After → Accept/Reject → drums+bass playback, preview/MIDI import/export parity, pause/seek and background stability. Physical listening cannot be replaced by tests; do not claim a sonically superior hook without auditioning it.

**Non-goals:** synth changes, sample patches, FX loudness, live bass selector, UI redesign outside Shape, Android permission requests, automatic change of default music arranger. Old PR #349 remains unchanged until separately reviewed/closed.

**Rollback:** Use the previous tested 1.2.3 preview APK and baseline main `9831355...` if manual QA reveals regressions; release 1.2.4 remains branch-only until green.
