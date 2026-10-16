# MIDI Arcade — first-hook motif lineage audit

Baseline: merged #362; the user confirmed that the current approved sound is good. This phase **does not modify audio, generation, MIDI notes, automation, or presets**.

## Why this audit is different from the earlier recurrence census
MIDI Arcade already creates the `B` motif family once and assigns it to repeated chorus sections in `src/music-engine.js`. It also plans a source relationship in `createMemoryMap` and `createPhraseMemoryContract` before the melody's note events are composed. A later weak chorus therefore **does not automatically mean motif planning is missing**. We need evidence for which authority first diverges.

The new `scripts/lib/hook-lineage-audit.mjs` traces each actual returning chorus through:

1. **Motif assignment:** Does the second chorus reference the same `motifId` as first?
2. **Memory map:** Does its source refer back to the first chorus?
3. **Phrase memory:** Does the performer receive the correct source and recall-strength contract?
4. **Final notes:** Does existing `evaluateChorusHookRecurrence` still recognize the return?

Results use distinct diagnoses: `motif-family-divergence`, `memory-map-divergence`, `phrase-source-divergence`, `downstream-note-identity-drift`, `retained-after-render` and `insufficient-note-evidence`.

No generated note is modified. The reference archive (28-track historical `reference.zip`) and E-minor/96-BPM working WAV remain *listening criteria*, not source samples imported into the APK. In particular, don't fit the engine by copying reference riffs.

## Run

```sh
node --test tests/hook-lineage-audit.test.mjs tests/genre-aware-hook-return-v2.test.mjs
node scripts/audit-hook-lineage.mjs --seeds 2 --bars 32 --out /tmp/hook-lineage.json
npm run quality
npm run quality:music
```

The CI workflow runs 21 genres × 2 deterministic 32-bar songs. Its `midi-arcade-hook-lineage-audit` artifact contains per-seed evidence and summary counts.

## Decision rule for the next intervention

- If motif assignments, memoryMap or phraseMemory are wrong for weak hooks, fix the **earliest incorrect planning owner**, with fixed-seed tests.
- If all three upstream authorities agree but final MIDI is weak, **do not duplicate or inflate early planning**. Trace the already-assigned `B` motif through the existing note composition, harmony adaptation and authorized section-development pass, then repair the narrow stage that loses the recognizable motif. Preserve intentional sparse returns, different pickups, note articulation and protected cadences.
- Numeric recurrence is a heuristic, not proof of a catchy melody. Any output-affecting repair needs blind A/B listening and parity checks.
- Preserve the current successful Android audio behavior unmodified.

Skills applied: MIDI Composition Review, MIDI Safe Integration and reference-informed motif-development principles. The independent source, tests and memory-contract reviews used concurrent connector calls; no autonomous subagents were dispatched.
